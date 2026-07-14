<template>
  <menus-button
    v-if="options.onQuoteToChat"
    ico="quote"
    :text="t('bubbleMenu.quoteToChat.chart')"
    hide-text
    @menu-click="handleQuote"
  />
</template>

<script setup>
import { getSelectionNode } from '@/utils/selection'

const container = inject('container')
const editor = inject('editor')
const options = inject('options')

// 把选中的 echarts 节点数据（完整 echartsOption + 图表类型 + 标题）交给宿主，
// 宿主将其作为「图表引用」带入对话，供 AI 看着现有配置修改后重新生成、再插回写作。
const handleQuote = () => {
  const node = getSelectionNode(editor.value)
  const attrs = node?.attrs || {}
  const chartOptions = attrs.chartOptions
  if (!chartOptions) {
    useMessage('error', {
      attach: container,
      content: t('bubbleMenu.quoteToChat.noChart'),
    })
    return
  }
  // series[0].type 决定图表类型（pie/bar/line）；取不到时留空交宿主兜底
  const series = Array.isArray(chartOptions.series)
    ? chartOptions.series[0]
    : chartOptions.series
  const chartType = series?.type
  const title =
    attrs.name ||
    (Array.isArray(chartOptions.title)
      ? chartOptions.title[0]?.text
      : chartOptions.title?.text) ||
    ''
  options.value.onQuoteToChat({
    kind: 'chart',
    data: JSON.stringify(chartOptions),
    chartType,
    title,
  })
}
</script>
