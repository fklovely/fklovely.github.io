<script setup lang="ts">
import BlogTheme from '@sugarat/theme'
import HomeVideoWallpaper from './components/HomeVideoWallpaper.vue'

const BlogLayout = BlogTheme.Layout
</script>

<template>
  <BlogLayout>
    <template #layout-top>
      <HomeVideoWallpaper />
    </template>
  </BlogLayout>
</template>
