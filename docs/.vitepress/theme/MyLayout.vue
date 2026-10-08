<script setup lang="ts">
import { nextTick, onMounted, watch } from 'vue'
import { useRoute } from 'vitepress'
import BlogTheme from '@sugarat/theme'
import ReadingProgress from './components/ReadingProgress.vue'

const { Layout } = BlogTheme
const route = useRoute()

// 文章图片点击放大。medium-zoom 只在客户端动态引入，避免 SSR 期触碰 DOM。
let zoom: Awaited<ReturnType<typeof initZoom>> | null = null

async function initZoom() {
  const { default: mediumZoom } = await import('medium-zoom')
  return mediumZoom({
  // 遮罩颜色跟随明/暗主题：inline style 里的 var() 会按 :root 上的变量解析
    background: 'var(--vp-c-bg)',
    margin: 24
  })
}

async function attachZoom() {
  zoom ??= await initZoom()
  // 已绑定过的图片会被 medium-zoom 自动跳过
  zoom.attach('.VPDoc .vp-doc img')
}

onMounted(() => nextTick(attachZoom))
watch(() => route.path, () => nextTick(attachZoom))
</script>

<template>
  <Layout>
    <template #layout-top>
      <ReadingProgress />
    </template>
  </Layout>
</template>
