<template>
  <menus-button
    v-if="options.onAIRewrite"
    ico="format-painter"
    :text="t('bubbleMenu.aiRewrite.title')"
    menu-type="popup"
    hide-text
    :disabled="loading"
    :popup-visible="popupVisible"
    @toggle-popup="togglePopup"
  >
    <template #content>
      <div class="umo-ai-rewrite-menu">
        <div
          v-for="action in AI_ACTIONS"
          :key="action.value"
          class="umo-ai-rewrite-item"
          @click="handleRewrite(action.value)"
        >
          {{ t(`bubbleMenu.aiRewrite.${action.value}`) }}
        </div>
      </div>
    </template>
  </menus-button>
</template>

<script setup>
import { getSelectionText } from '@/utils/selection'

const container = inject('container')
const editor = inject('editor')
const options = inject('options')

const { popupVisible, togglePopup } = usePopup()

const loading = ref(false)

const AI_ACTIONS = [
  { value: 'polish' },
  { value: 'expand' },
  { value: 'shorten' },
]

// 从选区提取文本 + 前后 80 字符上下文，打包成宿主回调契约
const buildInput = (action) => {
  const ed = editor.value
  const { from, to } = ed.state.selection
  const selectedText = getSelectionText(ed)
  const contextBefore = ed.state.doc.textBetween(Math.max(0, from - 80), from, '\n')
  const contextAfter = ed.state.doc.textBetween(to, to + 80, '\n')
  return { action, selectedText, selection: { from, to }, contextBefore, contextAfter }
}

const handleRewrite = async (action) => {
  if (loading.value) return
  const input = buildInput(action)
  if (!input.selectedText.trim()) {
    useMessage('error', { attach: container, content: t('bubbleMenu.selectTextFirst') })
    return
  }
  togglePopup(false)
  loading.value = true
  try {
    await options.value.onAIRewrite(input)
  } catch (err) {
    useMessage('error', {
      attach: container,
      content: err?.message || t('bubbleMenu.aiRewrite.failed'),
    })
  } finally {
    loading.value = false
  }
}
</script>

<style lang="less" scoped>
.umo-ai-rewrite-menu {
  display: flex;
  flex-direction: column;
  min-width: 96px;
  margin: -3px 0;
}
.umo-ai-rewrite-item {
  padding: 6px 12px;
  font-size: 13px;
  border-radius: var(--umo-radius);
  cursor: pointer;
  white-space: nowrap;
  color: var(--umo-text-color);
  &:hover {
    background-color: var(--umo-button-hover-background);
  }
}
</style>
