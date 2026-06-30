<template>
  <menus-button
    ico="audio"
    :text="t('insert.audio')"
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
  openFileSelector('audio', editor.value, container, uploadFileMap.value)
}
</script>
