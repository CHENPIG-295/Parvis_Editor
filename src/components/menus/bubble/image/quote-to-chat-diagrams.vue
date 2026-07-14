<template>
  <menus-button
    v-if="options.onQuoteToChat"
    ico="quote"
    :text="t('bubbleMenu.quoteToChat.flowchart')"
    hide-text
    @menu-click="handleQuote"
  />
</template>

<script setup>
import { getSelectionNode } from '@/utils/selection'

const container = inject('container')
const editor = inject('editor')
const options = inject('options')

// 把选中的流程图（diagrams）节点的裸 mxfile XML 交给宿主，
// 宿主将其作为「流程图引用」带入对话，供 AI 看着现有 XML 修改后重新生成、再插回写作。
const handleQuote = () => {
  const node = getSelectionNode(editor.value)
  const attrs = node?.attrs || {}
  const content = attrs.content
  if (attrs.type !== 'diagrams' || !content) {
    useMessage('error', {
      attach: container,
      content: t('bubbleMenu.quoteToChat.noFlowchart'),
    })
    return
  }
  options.value.onQuoteToChat({
    kind: 'flowchart',
    data: content,
    title: attrs.name || '',
  })
}
</script>
