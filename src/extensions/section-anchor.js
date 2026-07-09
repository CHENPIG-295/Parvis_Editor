import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

/**
 * 章节归属标记（标题锚定方案）。
 *
 * 只给 heading 节点挂两个全局属性：
 *  - sectionId    → data-section-id：与宿主 outline.json 节点 id、sections/{id}.html 文件名强绑定。
 *  - sectionLevel → data-section-level：该节在大纲中的层级（可与 <hN> tag 级别脱钩）。
 *
 * 语义：一节 = 从「带 data-section-id 的标题」到「下一个带 data-section-id 的标题」之间的所有块。
 * 归属只挂在标题上，段落/列表等不打标记（新输入的块靠「位于某锚定标题之后」归属）。
 *
 * 为什么不用容器节点：<section> 容器会让文档变成 doc > section > paragraph，
 * 段落 depth=2，破坏 @tiptap/extension-drag-handle 的段落级拖拽（库硬编码取顶层直接子节点）。
 * 纯全局属性不改 schema、不加嵌套，文档保持扁平 doc > heading/paragraph，drag-handle 正常工作。
 *
 * 实时补 id（appendTransaction + onCreate）：用户手敲的新标题 sectionId 默认为 null，导出即裸 <hN>，
 * 宿主后端要靠"保存时按标签切分补 id"兜底，滞后且有竞态。这里在编辑器内敲下即补稳定 id，
 * 从源头消除"标题无 id"。做法照 @tiptap/extension-table-of-contents 的 data-toc-id 补法：
 *  - 只补 sectionId==null 的非空标题（绝不碰已有 id → 保住宿主/AI 分配的原 id）。
 *  - 跳过空标题（textContent 为空）：空标题不该成为大纲节点。
 *  - 跳过 IME 组合事务（composition）：避免打断中文输入。
 *  - appendTransaction 只在 docChanged 时触发；纯 setContent 加载不触发，故另用 onCreate 补一次初始内容。
 */

// 与宿主后端 generateSectionId（packages/opencode/src/writing/writing-data.ts）保持一致的格式。
const generateSectionId = () =>
  `sec_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

// 遍历文档，给「无 id」或「id 与前面的标题重复」的非空 heading 在给定 tr 上补新 id。
// 重复判据（照 @tiptap/extension-table-of-contents）：复制粘贴带 id 的标题、或回车分裂标题，
// 会让新节点继承原标题的 id → 两节点同 id → 后端 sections/{id}.html 覆盖、AI 定位歧义。
// 故不仅补 null，还要给重复 id 的重新分配（保留第一个出现的，后续重复的换新 id）。
const stampMissingIds = (doc, tr) => {
  const used = new Set()
  let modified = false
  doc.descendants((node, pos) => {
    if (node.type.name !== 'heading' || node.textContent.length === 0) return
    const existing = node.attrs.sectionId
    const needsId = existing === null || existing === undefined || used.has(existing)
    if (!needsId) {
      used.add(existing)
      return
    }
    // 生成不与本次已用 id 冲突的新 id（同毫秒/重复时靠 random 区分，再兜一层去重）
    let id = generateSectionId()
    while (used.has(id)) id = generateSectionId()
    used.add(id)
    tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      sectionId: id,
      sectionLevel: node.attrs.sectionLevel ?? node.attrs.level,
    })
    modified = true
  })
  return modified
}

export default Extension.create({
  name: 'sectionAnchor',
  addOptions() {
    return {
      types: ['heading'],
    }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          sectionId: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-section-id') || null,
            renderHTML: (attributes) => {
              if (!attributes.sectionId) return {}
              return { 'data-section-id': attributes.sectionId }
            },
          },
          sectionLevel: {
            default: null,
            parseHTML: (element) => {
              const value = element.getAttribute('data-section-level')
              return value === null || value === '' ? null : Number(value) || null
            },
            renderHTML: (attributes) => {
              if (attributes.sectionLevel === null || attributes.sectionLevel === undefined) return {}
              return { 'data-section-level': String(attributes.sectionLevel) }
            },
          },
        },
      },
    ]
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('sectionAnchor'),
        appendTransaction(transactions, _oldState, newState) {
          // SSR 无 DOM：跳过（与 TableOfContents 一致）
          if (typeof window === 'undefined') return null
          // IME 中文输入组合期间：不补 id，避免打断输入
          if (transactions.some((tr) => tr.getMeta('composition'))) return null
          // 仅在文档真正变化时才补（选区变化等不触发，防空转/死循环）
          if (!transactions.some((tr) => tr.docChanged)) return null
          const { tr } = newState
          return stampMissingIds(newState.doc, tr) ? tr : null
        },
      }),
    ]
  },
  onCreate() {
    // appendTransaction 只覆盖 docChanged；初始 setContent 加载的内容需在此补一次，
    // 否则加载时就无 id 的标题（历史/粘贴内容）要等用户编辑才补。
    if (typeof window === 'undefined' || !this.editor?.view) return
    const { state } = this.editor
    const { tr } = state
    if (stampMissingIds(state.doc, tr)) {
      this.editor.view.dispatch(tr)
    }
  },
})
