<template>
  <menus-button
    ico="time"
    :text="t('history.text')"
    menu-type="popup"
    huge
    :popup-visible="popupVisible"
    @toggle-popup="onTogglePopup"
  >
    <template #content>
      <div class="umo-history-popup">
        <div v-if="loading" class="umo-history-popup__status">
          <t-loading size="small" />
        </div>
        <div
          v-else-if="versions.length === 0"
          class="umo-history-popup__status"
        >
          {{ t('history.empty') }}
        </div>
        <div v-else class="umo-dropdown__menu umo-history-popup__list">
          <li
            v-for="item in versions"
            :key="item.id"
            class="umo-dropdown__item umo-dropdown__item--theme-default umo-history-popup__item"
            @click="onSelect(item)"
          >
            <div class="umo-history-popup__item-main">
              <span
                class="umo-history-popup__badge"
                :class="`umo-history-popup__badge--${item.type}`"
              >
                {{ item.type === 'ai' ? t('history.ai') : t('history.manual') }}
              </span>
              <span class="umo-history-popup__label">{{ item.label }}</span>
            </div>
            <span class="umo-history-popup__time">
              {{ formatTime(item.createdAt) }}
            </span>
          </li>
        </div>
      </div>
    </template>
  </menus-button>
</template>

<script setup>
const options = inject('options')
const { popupVisible, togglePopup } = usePopup()

let versions = $ref([])
let loading = $ref(false)

const formatTime = (ts) => {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const fetchList = async () => {
  const onList = options.value.history?.onList
  if (typeof onList !== 'function') {
    versions = []
    return
  }
  loading = true
  try {
    const list = await onList()
    versions = Array.isArray(list) ? list : []
  } catch (err) {
    console.error('[parvis-editor] history.onList failed:', err)
    versions = []
  } finally {
    loading = false
  }
}

const onTogglePopup = (visible) => {
  togglePopup(visible)
  if (visible) {
    void fetchList()
  }
}

const onSelect = async (item) => {
  const onRestore = options.value.history?.onRestore
  togglePopup(false)
  if (typeof onRestore !== 'function') return
  try {
    await onRestore(item.id)
  } catch (err) {
    console.error('[parvis-editor] history.onRestore failed:', err)
  }
}
</script>

<style lang="less" scoped>
.umo-history-popup {
  // 抵消 .umo-popup-content 的 12px 内边距，避免列表四周留白过多。
  margin: calc(var(--umo-popup-content-padding) * -1);
  min-width: 220px;
  max-width: 300px;
  &__status {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px 8px;
    color: var(--umo-text-color-light);
    font-size: 12px;
  }
  &__list {
    max-height: 320px;
    overflow-y: auto;
    padding: 0;
    // 滚动条：默认隐藏，hover 列表时才显示，且更细。
    scrollbar-width: thin;
    scrollbar-color: transparent transparent;
    &::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    &::-webkit-scrollbar-thumb {
      background-color: transparent;
      border-radius: 3px;
    }
    &:hover {
      scrollbar-color: var(--umo-border-color) transparent;
      &::-webkit-scrollbar-thumb {
        background-color: var(--umo-border-color);
      }
    }
  }
  &__item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    height: auto;
    padding: 7px 8px;
    cursor: pointer;
    // 版本之间用浅灰色分隔线。
    border-bottom: 1px solid var(--umo-border-color-light);
    &:last-child {
      border-bottom: none;
    }
  }
  &__item-main {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
  }
  &__label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  &__badge {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: 40px;
    height: 18px;
    padding: 0 6px;
    font-size: 11px;
    line-height: 1;
    border-radius: 9px;
    color: var(--umo-text-color-light);
    background-color: var(--umo-button-hover-background, rgba(0, 0, 0, 0.06));
    &--ai {
      color: var(--umo-primary-color);
      background-color: var(--umo-primary-color-light, rgba(51, 112, 255, 0.1));
    }
  }
  &__time {
    font-size: 11px;
    color: var(--umo-text-color-light);
  }
}
</style>
