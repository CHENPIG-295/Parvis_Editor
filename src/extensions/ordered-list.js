import { OrderedList } from '@tiptap/extension-list'

export default OrderedList.extend({
  content: 'listItem*',
  addAttributes() {
    return {
      ...this.parent?.(),
      listType: {
        default: 'decimal',
        parseHTML: (element) =>
          element.style.getPropertyValue('list-style-type') || 'decimal',
        renderHTML: ({ listType }) => {
          return {
            style: `list-style-type: ${listType}`,
            'data-type': listType,
          }
        },
      },
      start: {
        default: 1,
        parseHTML: (element) => {
          const start = element.getAttribute('data-start')
          return start ? Number(start) : 1
        },
        // 序号由 editor.less 的 CSS 计数器（counter-increment: section）绘制，
        // 每个 <ol> 必须重置 section 计数器，否则序号会跨列表/文档持续累加。
        // 此前重置写在 CSS 里，用带类型的 attr() 从 data-start 读起始值参与 calc()，
        // 但带类型的 attr()（CSS Values L5）在 WebKit/WKWebView 不支持 → 整条声明被丢弃 →
        // 计数器永不归零 → 序号错乱。这里改由 JS 在 renderHTML 内联算好 counter-reset，
        // 各引擎通用；同时保留 data-start 供 parseHTML 往返。
        renderHTML: (attributes) => {
          const start = Number(attributes.start) || 1
          const style = `counter-reset: section ${start - 1}`
          if (start === 1) {
            // 起始为 1：无需 data-start，但仍要重置计数器（归零）
            return { style }
          }
          return {
            'data-start': start,
            style,
          }
        },
      },
    }
  },
})
