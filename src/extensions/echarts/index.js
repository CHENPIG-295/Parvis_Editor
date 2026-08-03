import { mergeAttributes, Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'

import NodeView from './node-view.vue'

// 组件扩展于 echarts，适配标准 echarts，也可以自定义属性进行转换
export default Node.create({
  name: 'echarts',
  inline: false,
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      vnode: {
        default: true,
      },
      id: {
        // 图形唯一标识，若生成图片，这就是唯一标识
        default: null,
      },
      name: {
        // 名称
        default: null,
      },
      width: {
        default: null,
      },
      height: {
        default: 300,
        // 从 HTML 属性解析回来是字符串，强转 Number（服务端往返后 es-drager 等按数值用）
        parseHTML: (element) => {
          const _h = element.getAttribute('height')
          return _h ? Number(_h) : 300
        },
      },
      mode: {
        // 图表设置时，默认打开的模式 0，表示直接使用 echarts 的 options，json: 源码模式，1: 可视化模式，可以通过配置创建图表
        default: 1,
        // 从 HTML 属性解析回来是字符串，node-view 用 mode === 1 判定，必须强转 Number
        parseHTML: (element) => {
          const _m = element.getAttribute('mode')
          return _m === null ? 1 : Number(_m)
        },
      },
      chartOptions: {
        // 展示配置，echarts 的 options，mode==0 时使用
        default: null,
        // 当从 HTML 解析时，尝试将 chartOptions 从字符串解析回对象
        parseHTML: (element) => {
          const _data = element.hasAttribute('chart-options')
            ? element.getAttribute('chart-options')
            : null
          return _data ? JSON.parse(_data) : null
        },
        renderHTML: (attributes) => ({
          // 在渲染 HTML 时，确保 chartOptions 被序列化为字符串
          'chart-options': attributes.chartOptions
            ? JSON.stringify(attributes.chartOptions)
            : null,
        }),
      },
      chartConfig: {
        // 基础配置，后续适配自定义的数据集合和配置信息 mode==1 时使用
        default: null,
        parseHTML: (element) => {
          const _data = element.hasAttribute('chart-config')
            ? element.getAttribute('chart-config')
            : null
          return _data ? JSON.parse(_data) : null
        },
        renderHTML: (attributes) => ({
          'chart-config': attributes.chartConfig
            ? JSON.stringify(attributes.chartConfig)
            : null,
        }),
      },
      src: '', // 图片地址路径，也记录图片唯一标识
      previewSrc: {
        // 渲染快照：图表 canvas 渲染完成后写入的 PNG data-uri。
        // 仅供宿主后端导出（Word/PDF）直接嵌图用——echarts 是运行时 canvas 节点，
        // getHTML() 序列化出的 <echarts> 是空标签，后端拿不到位图。这里把渲染结果
        // 随正文一起落盘为 <echarts preview-src="data:image/png…">，后端读它即可嵌图。
        default: '',
        parseHTML: (element) => element.getAttribute('preview-src') || '',
        renderHTML: (attributes) =>
          attributes.previewSrc ? { 'preview-src': attributes.previewSrc } : {},
      },
      describe: {
        // 描述信息
        default: null,
      },
    }
  },
  parseHTML() {
    return [{ tag: 'echarts' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['echarts', mergeAttributes(HTMLAttributes)]
  },
  addNodeView() {
    return VueNodeViewRenderer(NodeView)
  },
  addCommands() {
    return {
      setEcharts:
        (options) =>
        ({ commands, editor }) => {
          return commands.insertContentAt(editor.state.selection.anchor, {
            type: this.name,
            attrs: options,
          })
        },
      // 新增更新命令
      updateEcharts:
        (options) =>
        ({ commands, editor, tr }) => {
          // 获取当前选中的节点
          editor.commands.selectParentNode()
          const { selection } = editor.state
          tr.setSelection(selection)
          const { doc } = tr
          const { from, to } = selection
          doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name === this.name) {
              // 更新选中节点的属性
              commands.updateAttributes(this.name, options)
              return false
            }
            return true
          })
          return true
        },
    }
  },
})
