import { defineConfig } from 'vitepress'
import { getThemeConfig } from '@sugarat/theme/node'

const blogTheme = await getThemeConfig({
  themeColor: 'vp-default',
  author: 'fklovely',
  friend: [],
  darkTransition: false,
  // 评论系统：Giscus（基于 GitHub Discussions，无需后端）。
  // repo/repoId/category/categoryId 均为公开信息（GitHub GraphQL node ID），可安全提交。
  // 主题会自动激活 vitepress-plugin-giscus 并把评论组件注入到文章底部（doc-after），无需改 layout。
  comment: {
    type: 'giscus',
    options: {
      repo: 'fklovely/fklovely.github.io',
      repoId: 'R_kgDOSGEU0g',
      category: 'Announcements',
      categoryId: 'DIC_kwDOSGEU0s4C-jul',
      mapping: 'pathname',
      inputPosition: 'top',
      lang: 'zh-CN'
    },
    mobileMinify: true
  },
  footer: {
    message: 'Powered by VitePress & @sugarat/theme',
    copyright: `© ${new Date().getFullYear()} fklovely`
  }
})

export default defineConfig({
  extends: blogTheme,
  lang: 'zh-CN',
  title: 'fklovely',
  description: '个人技术博客',
  lastUpdated: true,
  cleanUrls: true,
  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-light'
    }
  },

  head: [
    ['link', { rel: 'icon', type: 'image/jpeg', href: '/avatar.jpg' }]
  ],

  themeConfig: {
    logo: '/avatar.jpg',

    nav: [
      { text: '首页', link: '/' },
      { text: 'Python', link: '/?tag=Python' },
      { text: '生活随笔', link: '/?tag=生活随笔' },
      { text: '<span class="nav-moments-emphasis">瞬间</span>', link: '/moments', activeMatch: '^/moments(/|$)' },
      { text: 'Agent', items: [
        { text: 'Claude Code', link: '/?tag=Claude Code' },
        { text: 'Generic', link: '/?tag=Generic' },
        { text: 'Hermes', link: '/?tag=Hermes' }
      ] },
      { text: '归档', link: '/archives' },
      { text: '关于', link: '/about' }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/fklovely' }
    ],

    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: '搜索文章', buttonAriaLabel: '搜索文章' },
              modal: {
                noResultsText: '无法找到相关结果',
                resetButtonTitle: '清除查询条件',
                footer: {
                  selectText: '选择',
                  navigateText: '切换',
                  closeText: '关闭'
                }
              }
            }
          }
        }
      }
    },

    outline: { level: [2, 3], label: '本页导航' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    lastUpdatedText: '上次更新'
  }
})
