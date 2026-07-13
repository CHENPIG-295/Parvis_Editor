<template>
  <menus-button
    v-if="options.onQuoteToChat"
    ico="quote"
    :text="t('bubbleMenu.quoteToChat.title')"
    hide-text
    @menu-click="handleQuote"
  />
</template>

<script setup>
import { getSelectionText } from '@/utils/selection'

const container = inject('container')
const editor = inject('editor')
const options = inject('options')

const handleQuote = () => {
  const selectedText = getSelectionText(editor.value)
  if (!selectedText.trim()) {
    useMessage('error', { attach: container, content: t('bubbleMenu.selectTextFirst') })
    return
  }
  options.value.onQuoteToChat({ selectedText })
}
</script>
