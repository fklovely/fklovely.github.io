<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useData, useRoute } from 'vitepress'

// 只在普通文章页显示（首页 home、瞬间 page 等独立布局不出现）
const { frontmatter } = useData()
const route = useRoute()
const isDocPage = computed(() => !frontmatter.value.layout)

const progress = ref(0)
let ticking = false

function update() {
  const doc = document.documentElement
  const total = doc.scrollHeight - doc.clientHeight
  progress.value = total > 0
    ? Math.min(100, Math.max(0, (window.scrollY / total) * 100))
    : 0
  ticking = false
}

function onScrollOrResize() {
  if (!ticking) {
    ticking = true
    requestAnimationFrame(update)
  }
}

onMounted(() => {
  window.addEventListener('scroll', onScrollOrResize, { passive: true })
  window.addEventListener('resize', onScrollOrResize, { passive: true })
  update()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScrollOrResize)
  window.removeEventListener('resize', onScrollOrResize)
})

// SPA 切页后重置并从新页面高度重新计算
watch(() => route.path, () => {
  progress.value = 0
  nextTick(update)
})
</script>

<template>
  <div
    v-show="isDocPage"
    class="reading-progress"
    role="progressbar"
    aria-label="阅读进度"
    :aria-valuenow="Math.round(progress)"
    :style="{ transform: `scaleX(${progress / 100})` }"
  />
</template>

<style scoped>
.reading-progress {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 70;
  width: 100%;
  height: 3px;
  border-radius: 0 2px 2px 0;
  background: linear-gradient(90deg, var(--vp-c-brand-2), var(--vp-c-brand-1));
  transform-origin: 0 50%;
  transition: transform 0.15s ease-out;
  pointer-events: none;
}
</style>
