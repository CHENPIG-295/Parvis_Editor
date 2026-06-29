/**
 * Parvis 框架孤岛入口（src/parvis-entry.js）的类型声明。
 *
 * 本包对外是自包含 ESM（Vue 运行时已打进 dist），消费方为 SolidJS 宿主，
 * 这里只描述 mountParvisEditor 的命令式契约，编辑器内部细节保持 any。
 */
declare module '@parvis/editor/parvis' {
  /** UmoEditor 通过 defineExpose 暴露的命令式 API（setContent/getContent/getEditor/...） */
  export interface ParvisEditorExposed {
    [key: string]: any
  }

  export interface ParvisEditorInstance {
    /** defineExpose 暴露的命令式句柄 */
    readonly editor: ParvisEditorExposed | null
    /** 底层 Vue App 实例 */
    readonly app: import('vue').App
    /** 卸载整个 Vue app（内部会 destroy tiptap、清理 provide/inject 状态） */
    destroy(): void
  }

  /**
   * 在宿主提供的 DOM 节点上挂载独立的 Vue 编辑器应用，返回命令式句柄。
   * @param el 挂载目标节点
   * @param options 透传给 UmoEditor 的 props（document / toolbar / page / locale / theme 等）
   * @param handlers 事件回调，键为 UmoEditor 的 emit 事件名（created / changed / saved ...）
   */
  export function mountParvisEditor(
    el: HTMLElement,
    options?: Record<string, any>,
    handlers?: Record<string, (...args: any[]) => void>,
  ): ParvisEditorInstance

  export const UmoEditor: any
  export const UmoDialog: any
  export const UmoMenuButton: any
  export const UmoTooltip: any
  export const useUmoEditor: { install: (app: import('vue').App, options?: any) => void }

  export default mountParvisEditor
}

declare module '@parvis/editor/parvis/style' {
  const css: string
  export default css
}
