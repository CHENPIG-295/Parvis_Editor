import 'virtual:svg-icons-register'

import { createApp, h } from 'vue'

import UmoEditor from './components/index.vue'
import UmoMenuButton from './components/menus/button.vue'
import UmoDialog from './components/modal.vue'
import UmoTooltip from './components/tooltip.vue'

const useUmoEditor = {
  install: (app, options) => {
    app.provide('defaultOptions', options || {})
    app.component(UmoEditor.name || 'UmoEditor', UmoEditor)
  },
}

/**
 * Parvis 框架孤岛挂载入口。
 *
 * Parvis 宿主是 SolidJS，本编辑器是 Vue3。不走 iframe，而是在宿主提供的 DOM
 * 节点上挂载一个独立的 Vue 应用（Vue 运行时已被 vite.config.bundle.js 打进本包 dist），
 * 并返回编辑器的命令式句柄（UmoEditor 通过 defineExpose 暴露的 API），
 * 外加一个 destroy() 用于卸载整个 Vue app。
 *
 * 宿主不需要、也不应该自己引入 Vue。
 *
 * @param {HTMLElement} el 挂载目标节点
 * @param {object} [options] 透传给 UmoEditor 的 props（document / toolbar / page / locale / theme 等）
 * @param {Record<string, Function>} [handlers] 事件回调，键为 UmoEditor 的 emit 事件名（如 'created' / 'changed' / 'saved'）
 * @returns {{ editor: object, destroy: () => void, app: import('vue').App }}
 *          editor: defineExpose 暴露的命令式 API（setContent/getContent/getEditor/...）
 */
function mountParvisEditor(el, options = {}, handlers = {}) {
  if (!el) {
    throw new Error('[parvis-editor] mount target element is required')
  }

  // 把 handlers 转成 Vue 的 onXxx props，透传给根组件
  const eventProps = {}
  for (const [name, fn] of Object.entries(handlers)) {
    if (typeof fn !== 'function') continue
    const onName = `on${name.charAt(0).toUpperCase()}${name.slice(1)}`
    eventProps[onName] = fn
  }

  // 用一个轻量根组件持有对 UmoEditor 的 ref，挂载后即可拿到 expose 句柄
  let exposed = null
  const app = createApp({
    name: 'ParvisEditorRoot',
    render() {
      return h(UmoEditor, {
        ref: (vm) => {
          // vm 是 UmoEditor 的组件实例代理，expose 出来的方法直接挂在其上
          if (vm) exposed = vm
        },
        ...options,
        ...eventProps,
      })
    },
  })

  // 捕获 Vue 内部渲染/生命周期错误，避免冒泡到 SolidJS 宿主把整页带崩。
  app.config.errorHandler = (err, _instance, info) => {
    console.error('[parvis-editor] Vue error:', info, err)
  }
  app.config.warnHandler = (msg) => {
    console.warn('[parvis-editor] Vue warn:', msg)
  }

  app.use(useUmoEditor, options)

  app.mount(el)

  return {
    get editor() {
      return exposed
    },
    app,
    destroy() {
      try {
        app.unmount()
      } finally {
        exposed = null
      }
    },
  }
}

export {
  mountParvisEditor,
  UmoEditor,
  UmoDialog,
  UmoMenuButton,
  UmoTooltip,
  useUmoEditor,
}

export default mountParvisEditor
