import { Extension } from '@tiptap/core'

/**
 * Section 归属标记 —— Parvis 写作模式「每章独立存储」的编辑器侧物理基础。
 *
 * 背景：Parvis 写作模式把文档存储从「单个 content.md」拆成「每个叶子章节一个
 * sections/{id}.html」，由 outline.json 记录结构。编辑器全文渲染时，需要一种
 * 稳定的方式标记「这段正文属于哪一节」，用户在全文里连续编辑后，宿主才能按节
 * 切分、按 id 写回对应文件，避免靠标题文本模糊匹配导致的写错位。
 *
 * ⚠️ 实现方式（方案 A）：不再用 <section> 容器节点包裹正文，改为给每个顶层块
 * 节点挂 sectionId / sectionLevel 全局属性。原因是 TipTap 的 drag-handle 只能
 * 抓「编辑器根的直接子节点」，一旦正文被 <section>（content: 'block+'）包住，
 * 段落变成 section 的子节点，drag-handle 便只在 section 级出现，段落级的 + 号 /
 * 拖拽按钮全部消失。改成「属性标记」后文档结构回到 doc > paragraph，drag-handle
 * 天然按段落工作。
 *
 * 代价：失去了原 <section isolating:true> 的物理隔离（光标/删除/回车不跨节）。
 * 章节边界现在仅靠属性维持，切分时按「连续相同 sectionId」分组（见 getSections）。
 * 后续若要恢复硬边界，需另想不干扰 drag-handle 的隔离方案。
 *
 *  - sectionId —— 与 outline.json 的节点 id、sections/{id}.html 的文件名强绑定。
 *  - sectionLevel —— 该节在大纲中的层级，拼装/导出时决定标题层级。
 *
 * 宿主传入的旧版 HTML（<section data-section-id data-level>...</section>）由
 * contentTransform() 在 setContent 前展开、把外壳属性下放到子块（见
 * src/utils/content-transform.js）。切分逻辑由 getSections() 工具函数在宿主侧
 * 遍历 doc 完成（见 UmoEditor 的 defineExpose）。
 */
const Section = Extension.create({
  name: 'section',

  addOptions() {
    return {
      // 需要携带章节归属的顶层块节点类型
      types: [
        'paragraph',
        'heading',
        'blockquote',
        'codeBlock',
        'bulletList',
        'orderedList',
        'taskList',
        'table',
        'horizontalRule',
        'pageBreak',
        'callout',
        'details',
        'columns',
        'image',
        'video',
        'audio',
        'iframe',
        'file',
        'echarts',
        'toc',
      ],
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          sectionId: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-section-id'),
            renderHTML: (attributes) => {
              if (!attributes.sectionId) return {}
              return { 'data-section-id': attributes.sectionId }
            },
          },
          sectionLevel: {
            default: null,
            parseHTML: (element) => {
              const level = element.getAttribute('data-section-level')
              return level === null ? null : Number(level) || null
            },
            renderHTML: (attributes) => {
              if (attributes.sectionLevel == null) return {}
              return { 'data-section-level': attributes.sectionLevel }
            },
          },
        },
      },
    ]
  },
})

export default Section
