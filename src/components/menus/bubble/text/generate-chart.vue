<template>
  <menus-button
    v-if="options.onGenerateChart"
    ico="echarts"
    :text="t('bubbleMenu.generateChart.title')"
    menu-type="popup"
    hide-text
    :disabled="loading"
    :popup-visible="popupVisible"
    @toggle-popup="togglePopup"
  >
    <template #content>
      <div class="umo-generate-chart-menu">
        <div
          v-for="chart in CHART_ACTIONS"
          :key="chart.value"
          class="umo-generate-chart-item"
          @click="handleGenerate(chart.value)"
        >
          {{ t(`bubbleMenu.generateChart.${chart.value}`) }}
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

const CHART_ACTIONS = [
  { value: 'pie' },
  { value: 'bar' },
  { value: 'line' },
]

// 从选区提取文本 + 前后 80 字符上下文，打包成宿主回调契约
const buildInput = (chartType) => {
  const ed = editor.value
  const { from, to } = ed.state.selection
  const selectedText = getSelectionText(ed)
  const contextBefore = ed.state.doc.textBetween(Math.max(0, from - 80), from, '\n')
  const contextAfter = ed.state.doc.textBetween(to, to + 80, '\n')
  return { chartType, selectedText, selection: { from, to }, contextBefore, contextAfter }
}

const handleGenerate = async (chartType) => {
  if (loading.value) return
  const input = buildInput(chartType)
  if (!input.selectedText.trim()) {
    useMessage('error', { attach: container, content: t('bubbleMenu.selectTextFirst') })
    return
  }
  togglePopup(false)
  loading.value = true
  try {
    await options.value.onGenerateChart(input)
  } catch (err) {
    useMessage('error', {
      attach: container,
      content: err?.message || t('bubbleMenu.generateChart.failed'),
    })
  } finally {
    loading.value = false
  }
}
</script>

<style lang="less" scoped>
.umo-generate-chart-menu {
  display: flex;
  flex-direction: column;
  min-width: 96px;
  margin: -3px 0;
}
.umo-generate-chart-item {
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
