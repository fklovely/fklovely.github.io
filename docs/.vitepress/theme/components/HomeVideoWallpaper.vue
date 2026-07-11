<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const isHome = ref(false)
const videoFailed = ref(false)
const reduceMotion = ref(false)

function syncLocation() {
  const url = new URL(window.location.href)
  const pathname = url.pathname.replace(/\/$/, '') || '/'

  // 只在不带筛选参数的首页播放，其他页面继续使用原来的静态壁纸。
  isHome.value = pathname === '/' && url.search === ''
  videoFailed.value = false
  document.body.classList.toggle('home-video-wallpaper', isHome.value)
}

onMounted(() => {
  reduceMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  syncLocation()
  window.addEventListener('popstate', syncLocation)
  window.addEventListener('hashchange', syncLocation)
})

onBeforeUnmount(() => {
  window.removeEventListener('popstate', syncLocation)
  window.removeEventListener('hashchange', syncLocation)
  document.body.classList.remove('home-video-wallpaper')
})
</script>

<template>
  <div
    v-if="isHome"
    class="home-video-wallpaper-layer"
    aria-hidden="true"
  >
    <video
      v-if="!reduceMotion && !videoFailed"
      autoplay
      muted
      loop
      playsinline
      preload="metadata"
      poster="/bg.jpg"
      @error="videoFailed = true"
    >
      <source src="/wallpapers/home.mp4" type="video/mp4">
    </video>
  </div>
</template>

<style>
.home-video-wallpaper-layer {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: url('/bg.jpg') center center / cover no-repeat;
}

.home-video-wallpaper-layer video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center center;
}

/* 首页由 video 层接管背景，带标签筛选的首页仍使用原来的静态图。 */
body.home-video-wallpaper .VPHome::before {
  display: none !important;
}
</style>
