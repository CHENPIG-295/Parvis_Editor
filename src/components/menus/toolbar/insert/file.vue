<template>
  <menus-button
    ico="file"
    :text="t('insert.file')"
    huge
    @menu-click="insertFile"
  />
</template>

<script setup>
import { openFileSelector } from '@/extensions/file'

const container = inject('container')
const editor = inject('editor')
const uploadFileMap = inject('uploadFileMap')

const insertFile = () => {
  openFileSelector('file', editor.value, container, uploadFileMap.value)
}
</script>
