/**
 * 遍历文档顶层块，按「连续相同 sectionId」分组，取出每一节的正文 HTML。
 *
 * 方案 A 下 section 不再是容器节点，而是每个顶层块携带的 sectionId / sectionLevel
 * 属性（见 src/extensions/section/index.js）。同一节的正文表现为一串连续、
 * sectionId 相同的顶层块。宿主保存时需把全文按节切回，按 sectionId 写到
 * sections/{id}.html。命令式 API 无法直接返回值，故这里遍历 doc、按 id 分组、
 * 用 ProseMirror 序列化每组为独立 HTML 片段。
 *
 * 无 sectionId 的顶层块（sectionId === null）也各自成组返回，宿主可自行决定丢弃
 * 或归入相邻节，避免正文被静默吞掉。
 *
 * @param {import('@tiptap/vue-3').Editor} editor
 * @returns {Array<{ sectionId: string|null, level: number, html: string, from: number, to: number }>}
 */
import { DOMSerializer } from '@tiptap/pm/model'

export const getSections = (editor) => {
  if (!editor) return []
  const { state } = editor
  const { doc, schema } = state
  const serializer = DOMSerializer.fromSchema(schema)
  const sections = []

  let current = null

  const flush = () => {
    if (!current) return
    const div = document.createElement('div')
    div.appendChild(current.fragment)
    sections.push({
      sectionId: current.sectionId,
      level: current.level,
      html: div.innerHTML,
      from: current.from,
      to: current.to,
    })
    current = null
  }

  // 只遍历顶层子节点，按连续相同 sectionId 归组
  doc.forEach((node, offset) => {
    const sectionId = node.attrs.sectionId ?? null
    const level = node.attrs.sectionLevel ?? 2
    const nodeFrom = offset
    const nodeTo = offset + node.nodeSize

    // 新节：sectionId 与当前组不同（含 null 各自成组）时切分
    if (!current || current.sectionId !== sectionId) {
      flush()
      current = {
        sectionId,
        level,
        fragment: document.createDocumentFragment(),
        from: nodeFrom,
        to: nodeTo,
      }
    } else {
      current.to = nodeTo
    }

    current.fragment.appendChild(serializer.serializeNode(node))
  })

  flush()

  return sections
}
