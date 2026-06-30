<template>
  <menus-button
    ico="video"
    :text="t('insert.video')"
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
  openFileSelector('video', editor.value, container, uploadFileMap.value)
}
</script>
