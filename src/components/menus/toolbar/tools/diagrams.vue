<template>
  <menus-button
    :ico="content ? 'edit' : 'diagrams'"
    :text="content ? t('tools.diagrams.edit') : t('tools.diagrams.text')"
    huge
    @menu-click="dialogVisible = true"
  >
    <modal
      :visible="dialogVisible"
      :footer="false"
      destroy-on-close
      class="umo-diagrams-dialog"
      mode="full-screen"
      @close="dialogVisible = false"
    >
      <template #header>
        <icon name="diagrams" />
        {{ content ? t('tools.diagrams.edit') : t('tools.diagrams.text') }}
      </template>
      <div v-if="loading" class="umo-diagrams-loading">
        <t-loading :text="t('tools.diagrams.loading')" size="small" />
      </div>
      <div class="umo-diagrams-container"></div>
    </modal>
  </menus-button>
</template>

<script setup>
import DiagramEditor from '@/utils/diagram-editor'
import { getSelectionNode } from '@/utils/selection'
import { shortId } from '@/utils/short-id'

const props = defineProps({
  content: {
    type: String,
    default: '',
  },
})

const container = inject('container')
const editor = inject('editor')
const options = inject('options')

let dialogVisible = $ref(false)
let loading = $ref(false)
const diagramEditor = new DiagramEditor({
  domain: options.value.diagrams?.domain || '',
  params: options.value.diagrams?.params || {},
  container: `${container} .umo-diagrams-container`,
})

let image = $ref(undefined)

const messageListener = async (evt) => {
  if (evt?.type !== 'message' || typeof evt?.data !== 'string') {
    return
  }

  const { event, bounds, data } = JSON.parse(evt.data)
  if (event === 'load') {
    loading = false
  }
  if (event === 'export') {
    if (!props.content || (props.content && props.content !== data)) {
      const { width, height } = bounds
      image = {
        id: shortId(10),
        type: 'diagrams',
        src: data,
        width,
        height,
        content: data,
      }
    }
    dialogVisible = false
    return
  }
  if (event === 'exit') {
    dialogVisible = false
  }
}

watch(
  () => dialogVisible,
  async (val) => {
    if (!val) {
      window.removeEventListener('message', messageListener)
      diagramEditor.stopEditing()
      if (image?.type) {
        editor.value?.chain().focus().setImage(image, !!props.content).run()
      }
      return
    }

    // 宿主注入了 onEdit：委托宿主弹窗，不打开编辑器自带的 iframe modal。
    const onEdit = options.value.diagrams?.onEdit
    if (typeof onEdit === 'function') {
      dialogVisible = false
      try {
        const result = await onEdit({ content: props.content || '' })
        if (result?.src) {
          const inserted = {
            id: shortId(10),
            type: 'diagrams',
            src: result.src,
            width: result.width,
            height: result.height,
            content: result.content ?? result.src,
          }
          editor.value
            ?.chain()
            .focus()
            .setImage(inserted, !!props.content)
            .run()
        }
      } catch (err) {
        console.error('[parvis-editor] diagrams.onEdit failed:', err)
      }
      return
    }

    // 回退：编辑器自带的 embed.diagrams.net iframe modal。
    await nextTick()
    loading = true
    diagramEditor.edit(props.content || '')
    window.addEventListener('message', messageListener)
    image = undefined
  },
  { immediate: true },
)
</script>

<style lang="less">
.umo-diagrams-dialog {
  .t-dialog {
    padding: 0 !important;
    &__header {
      background: var(--umo-color-white);
      height: var(--td-comp-size-xxxl);
    }
    &__body {
      padding: 0;
    }
  }
}
.umo-diagrams-loading {
  width: 100%;
  height: calc(100% - var(--td-comp-size-xxxl));
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  background-color: var(--umo-container-background);
}
.umo-diagrams-container {
  height: 100%;
  .umo-diagrams-iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
  }
}
</style>
