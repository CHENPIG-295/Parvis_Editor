<template>
  <menus-button
    ico="download"
    :text="t('exportDoc.text')"
    menu-type="popup"
    huge
    :disabled="loading"
    :popup-visible="popupVisible"
    @toggle-popup="togglePopup"
  >
    <template #content>
      <div class="umo-dropdown__menu umo-export-popup">
        <li
          class="umo-dropdown__item umo-dropdown__item--theme-default umo-export-popup__item"
          @click="onPick('word')"
        >
          <icon name="word" class="umo-export-popup__ico" />
          <span>{{ t('exportDoc.word') }}</span>
        </li>
        <li
          class="umo-dropdown__item umo-dropdown__item--theme-default umo-export-popup__item"
          @click="onPick('pdf')"
        >
          <icon name="pdf" class="umo-export-popup__ico" />
          <span>{{ t('exportDoc.pdf') }}</span>
        </li>
      </div>
    </template>
  </menus-button>

  <!-- 导出 PDF 的生成提示：teleport 到 body，用纯 CSS 自转圆环，避免受编辑器/宿主
       scoped 样式或 transform 影响导致图标公转。 -->
  <teleport to="body">
    <div v-if="loading" class="umo-export-loading-mask">
      <div class="umo-export-loading-box">
        <span class="umo-export-loading-spinner"></span>
        <span class="umo-export-loading-text">{{ t('exportDoc.generating') }}</span>
      </div>
    </div>
  </teleport>
</template>

<style lang="less">
.umo-export-loading-mask {
  position: fixed;
  inset: 0;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.15);
}
.umo-export-loading-box {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  font-size: 14px;
  color: #333;
}
.umo-export-loading-spinner {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border: 2px solid #d9d9d9;
  border-top-color: #3480f9;
  border-radius: 50%;
  transform-origin: 50% 50%;
  animation: umo-export-spin 0.7s linear infinite;
}
@keyframes umo-export-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

<script setup>
import { saveAs } from 'file-saver'
import html2pdf from 'html2pdf.js'
// browser 子路径：turbodocx 的浏览器构建，返回 Blob（Node 下返回 Buffer）。
import HTMLtoDOCX from '@turbodocx/html-to-docx/dist/html-to-docx.browser.esm.js'
// turbodocx 的浏览器构建在 buildImage 里用了 Node 的 Buffer（Buffer.from/isBuffer）处理图片，
// 但 WKWebView/浏览器没有 Buffer 全局 → 文档含任何图片（含 echarts 转出的 <img>）时导出崩、
// 图片被丢弃。用 buffer polyfill 挂到 globalThis 兜底。
import { Buffer as BufferPolyfill } from 'buffer'

import { loadResource } from '@/utils/load-resource'

if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = BufferPolyfill
}

const container = inject('container')
const editor = inject('editor')
const options = inject('options')
const page = inject('page')
const { popupVisible, togglePopup } = usePopup()

let loading = $ref(false)

const onPick = (type) => {
  togglePopup(false)
  if (type === 'word') {
    void handleExportWord()
  } else {
    void handleExportPdf()
  }
}

// 收集页面里所有 <style>/<link> 样式表，随正文一起喂给转换器，
// 让编辑器里的排版（标题层级、字体、颜色、对齐、列表、表格等）尽量保留。
const getStylesHtml = () =>
  Array.from(document.querySelectorAll('link, style'))
    .map((item) => item.outerHTML)
    .join('')

// 把正文 HTML 里的 <echarts> 节点替换成图表位图 <img>。
// 背景：echarts 节点用运行时 <canvas> 绘制，getHTML() 序列化出的 <echarts …> 是空标签，
// html-to-docx / PDF 渲染都不认它、也拿不到 canvas 位图 → 导出丢图表。
// 两级取图（保证「未滚动到视口 / 实例已销毁」的图表也能导出）：
//   1) 优先用当前已渲染的实例 echarts.getInstanceByDom(#chart-X).getDataURL()（快、所见即所得）；
//   2) 取不到实例时，读节点 chart-options 属性离屏渲染一张（AI chart_generate 产出的节点
//      始终带 chart-options）。两者都拿不到才保留原标签、不阻断导出。
// 离屏渲染需 echarts 已加载，导出前统一 ensure 一次。
const ECHARTS_EXPORT_WIDTH = 720 // 离屏渲染宽度（无实例参照时的兜底画布宽，px）

const ensureECharts = async () => {
  if (typeof window.echarts !== 'undefined') return true
  try {
    const url =
      options.value.echartsUrl ||
      `${options.value.cdnUrl}/libs/echarts/echarts.min.js`
    await loadResource(url)
  } catch {
    /* 加载失败下面判定为不可用 */
  }
  return typeof window.echarts !== 'undefined'
}

// 用 chart-options 属性离屏渲染，返回 { dataURL, w, h }；失败返回 null。
const renderOffscreen = (optionsJson, width) => {
  let option
  try {
    option = JSON.parse(optionsJson)
  } catch {
    return null
  }
  if (!option || typeof option !== 'object') return null
  const holder = document.createElement('div')
  const w = width > 0 ? width : ECHARTS_EXPORT_WIDTH
  const h = Math.round(w * 0.5)
  holder.style.cssText = `position:absolute;left:-99999px;top:0;width:${w}px;height:${h}px;`
  document.body.appendChild(holder)
  let inst = null
  try {
    inst = window.echarts.init(holder)
    inst.setOption(option)
    const dataURL = inst.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#fff',
    })
    return { dataURL, w, h }
  } catch (err) {
    console.error('[parvis-editor] echarts 离屏渲染失败:', err)
    return null
  } finally {
    if (inst) inst.dispose()
    holder.remove()
  }
}

const replaceEchartsWithImages = async (html) => {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const nodes = Array.from(doc.querySelectorAll('echarts'))
  if (nodes.length === 0) return html
  if (!(await ensureECharts())) return html
  for (const node of nodes) {
    const id = node.getAttribute('id')
    // 1) 优先用已渲染实例
    const dom = id ? document.getElementById(`chart-${id}`) : null
    const inst = dom ? window.echarts.getInstanceByDom(dom) : null
    let src = null
    let w = 0
    let h = 0
    if (inst) {
      try {
        src = inst.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' })
        w = Math.round(inst.getWidth() || dom.offsetWidth || 0)
        h = Math.round(inst.getHeight() || dom.offsetHeight || 0)
      } catch (err) {
        console.error('[parvis-editor] echarts 实例取图失败，改离屏渲染:', err)
        src = null
      }
    }
    // 2) 无实例 / 取图失败：用 chart-options 离屏渲染
    if (!src) {
      const optionsJson = node.getAttribute('chart-options')
      if (!optionsJson) continue
      const rendered = renderOffscreen(optionsJson, dom?.offsetWidth || 0)
      if (!rendered) continue
      ;({ dataURL: src, w, h } = rendered)
    }
    const img = doc.createElement('img')
    img.setAttribute('src', src)
    // 显式 width/height 属性：docx 布局按属性取尺寸；PDF 原生 WebView 下也保证有确定高度
    // （只靠 aspect-ratio 在部分 WebView 里算不出高、图会塌成 0 高度看不见）。
    if (w > 0) img.setAttribute('width', String(w))
    if (h > 0) img.setAttribute('height', String(h))
    // 响应式收窄：宽度超容器时等比缩小（height:auto 覆盖上面的固定 height 属性）。
    img.style.maxWidth = '100%'
    img.style.height = 'auto'
    const alt = node.getAttribute('name')
    if (alt) img.setAttribute('alt', alt)
    node.replaceWith(img)
  }
  return doc.body.innerHTML
}

// cm → twip（1cm ≈ 566.929 twip）。
const cmToTwip = (cm) => Math.round((Number(cm) || 0) * 566.929)

const buildDocumentOptions = () => {
  const { orientation, margin } = page.value ?? {}
  return {
    orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
    margins: {
      top: cmToTwip(margin?.top ?? 1),
      right: cmToTwip(margin?.right ?? 1),
      bottom: cmToTwip(margin?.bottom ?? 1),
      left: cmToTwip(margin?.left ?? 1),
    },
    table: { row: { cantSplit: true } },
    footer: false,
    pageNumber: false,
  }
}

// 编辑器 options.document.title 在 Parvis 宿主里是空的（真标题在宿主侧），
// 这里只给一个兜底名；宿主 onExport 会用真实标题覆盖。
const getFallbackFilename = (ext) => {
  const title = options.value.document?.title
  return `${title && title !== '' ? title : t('document.untitled')}.${ext}`
}

// 从实际渲染出来的表格单元格上读边框色（编辑器用 CSS 变量 --umo-content-table-border-color，
// html-to-docx 解析不了变量），拿到具体颜色后写成内联 border，导出才能是实线。
const resolveTableBorderColor = () => {
  const cell = document.querySelector(
    `${container} .umo-page-content td, ${container} .umo-page-content th`,
  )
  const color = cell ? getComputedStyle(cell).borderTopColor : ''
  // rgb(a) → #rrggbb；解析失败兜底成常见的浅灰。
  const m = color.match(/\d+/g)
  if (m && m.length >= 3) {
    const hex = m
      .slice(0, 3)
      .map((n) => Number(n).toString(16).padStart(2, '0'))
      .join('')
    return `#${hex}`
  }
  return '#dcdcdc'
}

// html-to-docx 的列宽来自单元格自身的 width，而 Tiptap 导出的 <td>/<th> 没有宽度，
// Word 会把每列缩到最小内容宽度（一个字一行）；边框也因用了 CSS 变量而回退成虚线。
// 这里给表格补上 width:100% + table-layout:fixed、按列数均分列宽，并写死实线边框。
const normalizeTablesForDocx = (html) => {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const borderColor = resolveTableBorderColor()
  const borderStyle = `1px solid ${borderColor}`
  for (const table of Array.from(doc.querySelectorAll('table'))) {
    table.style.width = '100%'
    table.style.tableLayout = 'fixed'
    table.style.borderCollapse = 'collapse'
    table.style.border = borderStyle

    // 统计列数：取各行 colspan 之和的最大值。
    const rows = Array.from(table.querySelectorAll('tr'))
    let colCount = 0
    for (const row of rows) {
      const cells = Array.from(row.children).filter(
        (el) => el.tagName === 'TD' || el.tagName === 'TH',
      )
      const span = cells.reduce(
        (sum, cell) => sum + (parseInt(cell.getAttribute('colspan') || '1', 10) || 1),
        0,
      )
      colCount = Math.max(colCount, span)
    }
    if (colCount === 0) continue

    const unit = 100 / colCount
    for (const row of rows) {
      const cells = Array.from(row.children).filter(
        (el) => el.tagName === 'TD' || el.tagName === 'TH',
      )
      for (const cell of cells) {
        const span = parseInt(cell.getAttribute('colspan') || '1', 10) || 1
        // 已有明确宽度（非百分比像素等）就不覆盖，保留用户/编辑器设定。
        if (!cell.style.width) {
          cell.style.width = `${(unit * span).toFixed(2)}%`
        }
        // 写死实线边框，覆盖 CSS 变量导致的虚线回退。
        cell.style.border = borderStyle
      }
    }
  }
  return doc.body.innerHTML
}

const handleExportWord = async () => {
  if (!editor.value || loading) return
  loading = true
  try {
    // Tiptap getHTML() 是干净的 ProseMirror 序列化结果（不含 node-view 的拖拽手柄/
    // 装饰等 DOM 副产物），且已把用户格式（加粗/斜体/颜色/字号/字体/对齐/列表/表格/
    // 图片）以内联方式带出，是「所见即所得」的内容来源；再拼上页面样式表一起转换。
    // 先把 <echarts> 换成位图 <img>，再做表格规整（顺序无所谓，二者作用对象不重叠）。
    const contentHtml = normalizeTablesForDocx(
      await replaceEchartsWithImages(editor.value.getHTML()),
    )

    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">${getStylesHtml()}</head><body><div class="tiptap umo-editor">${contentHtml}</div></body></html>`

    const result = await HTMLtoDOCX(fullHtml, null, buildDocumentOptions())

    // 归一化成 Blob：turbodocx 浏览器构建在「全局存在 Buffer」时会返回 Node Buffer 而非 Blob
    // （见其 generateAsync 后的 hasOwnProperty(global,'Buffer') 分支）。我们为了让 buildImage
    // 能处理图片补了 Buffer polyfill，反而触发这个分支 → 返回 Buffer，宿主 blob.arrayBuffer()
    // 就崩。这里统一兜成 Blob：已是 Blob 直接用；否则（Buffer/Uint8Array/ArrayBuffer）包一层。
    const blob =
      result instanceof Blob
        ? result
        : new Blob([result], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          })

    // 宿主注入了 onExport：把生成好的 blob 交给宿主用真实标题命名并 Tauri save() 落盘。
    const onExport = options.value.onExport
    if (typeof onExport === 'function') {
      await onExport({ blob, filename: getFallbackFilename('docx'), format: 'word' })
    } else {
      // 浏览器兜底：直接下载。
      saveAs(blob, getFallbackFilename('docx'))
    }
  } catch (err) {
    console.error('[parvis-editor] export word failed:', err)
  } finally {
    loading = false
  }
}

// 组装交给原生 WebView 渲染 PDF 的完整 HTML。
// 关键：用 editor.getHTML()（干净的 ProseMirror 序列化，不含节点气泡/拖拽手柄/装饰等
// 编辑态 DOM），而不是 .umo-page-content 的 outerHTML —— 否则气泡按钮会进 PDF、且会
// 带上用户当前缩放/横向滚动状态导致右侧被裁。再用样式表 + 固定 A4 页宽 + 正常缩放，
// 让原生 WebView 从零重新布局，保证内容完整、所见即所得（正文样式一致）。
const buildStyledHtml = async (orientationStr) => {
  const contentHtml = await replaceEchartsWithImages(editor.value?.getHTML() ?? '')
  const theme = options.value.theme || 'light'
  const { margin } = page.value ?? {}

  // 关键：编辑器正文样式挂在 `.umo-editor-content .umo-editor` 这条类链上（见 editor.less），
  // 还依赖 --umo-* CSS 变量。所以导出 HTML 必须：
  //  1) 复刻同样的类链容器：.umo-editor-container > .umo-editor-content > .tiptap.umo-editor
  //  2) 从实际渲染的编辑器根节点快照关键 CSS 变量（字体/字号/颜色/页边距）内联进来，
  //     避免变量作用域/动态注入导致丢失，字才不会退回浏览器默认。
  const contentEl = document.querySelector(`${container} .umo-editor-content`)
  const rootEl =
    contentEl ||
    document.querySelector(`${container} .umo-editor`) ||
    document.querySelector(container)
  const cs = rootEl ? getComputedStyle(rootEl) : null
  // 行距是内联挂在 .umo-editor-content 上的（无单位倍数，值来自 options.dicts.lineHeights
  // 的默认项），不在 CSS 文件里 → getStylesHtml 收集不到，必须单独取出；否则大标题
  // (h1 2.5em)会挤压重叠。用内联 style 的原始无单位值（如 1.6），不能用 getComputedStyle
  // 的 px 结果——px 是定值、不随 h1 大字号缩放，照样会重叠。
  const lineHeight =
    contentEl?.style?.lineHeight ||
    options.value.dicts?.lineHeights?.find((i) => i.default)?.value ||
    '1.7'
  const readVar = (name, fallback) => {
    const v = cs?.getPropertyValue(name)?.trim()
    return v && v !== '' ? v : fallback
  }
  const vars = [
    `--umo-font-family:${readVar('--umo-font-family', "simsun, '宋体', serif")}`,
    `--umo-font-size:${readVar('--umo-font-size', '14px')}`,
    `--umo-content-text-color:${readVar('--umo-content-text-color', '#333')}`,
    `--umo-content-table-border-color:${readVar('--umo-content-table-border-color', '#dcdcdc')}`,
    `--umo-content-table-thead-background:${readVar('--umo-content-table-thead-background', '#f5f5f5')}`,
    `--umo-content-code-family:${readVar('--umo-content-code-family', 'monospace')}`,
    `--umo-content-code-background:${readVar('--umo-content-code-background', '#f5f5f5')}`,
    `--umo-content-code-color:${readVar('--umo-content-code-color', '#333')}`,
  ].join(';')

  // 页边距：编辑器 web 版式里，左右靠 .umo-editor 的 padding(--umo-page-margin-*)，
  // 上下靠独立的 header/footer 节点（不在 getHTML 里）。导出时统一改成给外层容器四边
  // padding（cm），并把 .umo-editor 自带的左右 padding 清零，避免左右被叠加两次。
  const mt = `${Number(margin?.top ?? 1)}cm`
  const mr = `${Number(margin?.right ?? 1)}cm`
  const mb = `${Number(margin?.bottom ?? 1)}cm`
  const ml = `${Number(margin?.left ?? 1)}cm`

  const _ = orientationStr // 方向由宿主命令控制 webview frame，这里样式无关
  return `<!DOCTYPE html><html lang="zh-CN" theme-mode="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">${getStylesHtml()}<style>
:root{${vars}}
/* 强制全白底：编辑器正文区默认背景是页面灰底/主题色，导出必须纯白。 */
html,body,.umo-editor-container,.umo-editor-content,.umo-editor{background:#fff!important;background-color:#fff!important;}
html,body{margin:0;padding:0;width:100%;-webkit-print-color-adjust:exact;print-color-adjust:exact;zoom:1;transform:none;}
/* 撑满 webview 视口（= A4 页宽），屏蔽编辑器缩放/横向滚动，右侧不被裁。 */
.umo-editor-container{width:100%;}
/* 四边页边距统一放到内容容器上（cm），保证与编辑器页边距设置一致。 */
.umo-editor-content{width:100%;box-sizing:border-box;line-height:${lineHeight};padding:${mt} ${mr} ${mb} ${ml};}
/* 清零 .umo-editor 自带的左右 padding(--umo-page-margin-*)，避免左右叠加两次。 */
.umo-editor-content .umo-editor{width:100%!important;max-width:100%!important;padding:0!important;transform:none!important;zoom:1!important;}
/* 保险：隐藏任何可能混入的编辑态 UI（气泡/拖拽手柄/装饰）。 */
[class*="bubble-menu"],[class*="drag-handle"],.ProseMirror-widget{display:none!important;}
</style></head><body class="is-print"><div class="umo-editor-container"><div class="umo-editor-content"><div class="tiptap umo-editor" translate="no">${contentHtml}</div></div></div></body></html>`
}

const handleExportPdf = async () => {
  if (loading) return
  loading = true // 驱动 teleport 到 body 的纯 CSS spinner 浮层
  try {
    await nextTick()

    const { orientation } = page.value ?? {}
    const orientationStr = orientation === 'landscape' ? 'landscape' : 'portrait'

    // 优先走宿主原生 PDF（矢量、文字可选、快、系统保存框）。
    const onNative = options.value.onExportPdfNative
    if (typeof onNative === 'function') {
      try {
        const ok = await onNative({
          html: await buildStyledHtml(orientationStr),
          orientation: orientationStr,
          filename: getFallbackFilename('pdf'),
        })
        if (ok) return // 已原生落盘
      } catch (err) {
        console.error('[parvis-editor] onExportPdfNative failed, fallback:', err)
      }
    }

    // 回退：html2pdf 截图式（无原生能力 / 原生失败时兜底）。
    await handleExportPdfFallback(orientationStr)
  } catch (err) {
    console.error('[parvis-editor] export pdf failed:', err)
  } finally {
    loading = false // 隐藏 spinner 浮层
  }
}

// 回退实现：html2pdf 对渲染节点截图转 PDF。文字不可选、较慢，但无需原生能力。
const handleExportPdfFallback = async (orientationStr) => {
  const node = document.querySelector(`${container} .umo-page-content`)
  if (!node) throw new Error('page content not found')

  const worker = html2pdf()
    .set({
      margin: 0,
      image: { type: 'jpeg', quality: 0.92 },
      html2canvas: {
        scale: 1.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        removeContainer: true,
      },
      jsPDF: {
        unit: 'pt',
        format: 'a4',
        orientation: orientationStr,
        compress: true,
      },
      pagebreak: { mode: ['css', 'legacy'] },
    })
    .from(node)

  const blob = await worker.outputPdf('blob')

  const onExport = options.value.onExport
  if (typeof onExport === 'function') {
    await onExport({ blob, filename: getFallbackFilename('pdf'), format: 'pdf' })
  } else {
    saveAs(blob, getFallbackFilename('pdf'))
  }
}
</script>

<style lang="less" scoped>
.umo-export-popup {
  // 抵消 .umo-popup-content 的 12px 内边距，去掉多余留白。
  margin: calc(var(--umo-popup-content-padding) * -1);
  min-width: 140px;
  &__item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    cursor: pointer;
  }
  &__ico {
    font-size: 16px;
    flex-shrink: 0;
  }
}
</style>
