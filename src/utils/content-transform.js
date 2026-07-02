/**
 * 展开宿主传入的 <section data-section-id data-level> 外壳。
 *
 * 方案 A 下 section 不再是 schema 节点（改为块级全局属性 sectionId/sectionLevel，
 * 见 src/extensions/section/index.js）。宿主写作模式全文渲染时传入的 HTML 仍是
 *   <section data-section-id="x" data-level="2"><h2>..</h2><p>..</p></section>
 * 这里在 setContent 前把外壳拆掉，把 id / level 下放到每个直接子块的
 * data-section-id / data-section-level 上，交给全局属性 parseHTML 消费。
 * 不含 <section> 的普通 HTML 原样返回。
 */
const expandSections = (html) => {
  if (typeof html !== 'string' || !html.includes('<section')) {
    return html
  }
  const container = document.createElement('div')
  container.innerHTML = html
  const sections = container.querySelectorAll('section[data-section-id]')
  if (sections.length === 0) {
    return html
  }
  sections.forEach((section) => {
    const sectionId = section.getAttribute('data-section-id')
    const level = section.getAttribute('data-level')
    const fragment = document.createDocumentFragment()
    Array.from(section.children).forEach((child) => {
      if (sectionId && !child.hasAttribute('data-section-id')) {
        child.setAttribute('data-section-id', sectionId)
      }
      if (level !== null && !child.hasAttribute('data-section-level')) {
        child.setAttribute('data-section-level', level)
      }
      fragment.appendChild(child)
    })
    section.replaceWith(fragment)
  })
  return container.innerHTML
}

export const contentTransform = (content) => {
  // 处理空内容或非字符串内容
  if (content && typeof content === 'string' && !content.startsWith('<')) {
    // 处理纯文本中的换行符
    return content
      .split('\n')
      .map((line) => `<p>${line}</p>`)
      .join('')
  }

  return expandSections(content)
}
