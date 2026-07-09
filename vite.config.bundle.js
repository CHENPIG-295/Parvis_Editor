import Vue from '@vitejs/plugin-vue'
import ReactivityTransform from '@vue-macros/reactivity-transform/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { TDesignResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import VueMacros from 'unplugin-vue-macros/vite'
import { defineConfig } from 'vite'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'

// Parvis 专用 bundle 构建配置。
//
// 与默认的 vite.config.js（标准 umodoc 库构建，把 vue/@tiptap/tdesign 等 external）
// 的关键差异：这里【不 external 任何依赖】，把 Vue 运行时 + tiptap + TDesign +
// vue-i18n + @vueuse 全部 bundle 进产物，产出自包含 ESM（dist/parvis-editor.js + .css），
// 供没有 Vue 运行时的 SolidJS 宿主（Parvis）以框架孤岛方式消费。
//
// 用法：vite build --config vite.config.bundle.js
// 入口：src/parvis-entry.js（导出 mountParvisEditor 孤岛挂载函数）

// Plugin configurations
const vuePlugins = {
  VueMacros: VueMacros({
    plugins: {
      vue: Vue(),
    },
  }),
  AutoImport: AutoImport({
    dirs: ['./src/composables'],
    imports: ['vue', '@vueuse/core'],
    resolvers: [TDesignResolver({ library: 'vue-next', esm: true })],
    dts: false,
  }),
  Components: Components({
    directoryAsNamespace: true,
    dirs: ['./src/components'],
    resolvers: [TDesignResolver({ library: 'vue-next', esm: true })],
    dts: false,
  }),
  SvgIcons: createSvgIconsPlugin({
    iconDirs: [`${process.cwd()}/src/assets/icons`],
    symbolId: 'umo-icon-[name]',
    customDomId: 'umo-icons',
  }),
}

const buildConfig = {
  target: 'es2018',
  lib: {
    entry: `${process.cwd()}/src/parvis-entry.js`,
    name: 'ParvisEditor',
    fileName: 'parvis-editor',
    formats: ['es'],
  },
  outDir: 'dist',
  copyPublicDir: false,
  minify: 'esbuild',
  cssMinify: true,
  rollupOptions: {
    output: {
      intro: `import './parvis-editor.css'`,
      format: 'es',
    },
    onwarn(warning, warn) {
      if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return
      warn(warning)
    },
  },
}

const cssConfig = {
  preprocessorOptions: {
    less: {
      modifyVars: { '@prefix': 'umo' },
      javascriptEnabled: true,
      // 添加 Less 插件来排除特定类名
      plugins: [
        {
          install(less, pluginManager) {
            pluginManager.addPostProcessor({
              process(css) {
                return css.replace(/\.flex-center(\s|\{|,)[^}]*\}/g, '')
              },
            })
          },
        },
      ],
    },
  },
}

export default defineConfig({
  plugins: [ReactivityTransform(), ...Object.values(vuePlugins)],
  css: cssConfig,
  build: buildConfig,
  // @turbodocx/html-to-docx 的 browser build 里有裸 `global` 引用（用于 Blob 兜底判断），
  // 浏览器/WKWebView 下没有 global 会抛 ReferenceError，映射到 globalThis。
  define: {
    global: 'globalThis',
  },
  esbuild: {
    drop: ['debugger'],
  },
  resolve: {
    alias: {
      '@': `${process.cwd()}/src`,
    },
  },
})
