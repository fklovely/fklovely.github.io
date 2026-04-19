import { defineConfig } from 'vitepress'
import { getThemeConfig } from '@sugarat/theme/node'

const blogTheme = await getThemeConfig({
  themeColor: 'vp-default',
  author: 'fklovely',
  friend: [],
  footer: {
    message: 'Powered by VitePress & @sugarat/theme',
    copyright: `© ${new Date().getFullYear()} fklovely`
  }
})

export default defineConfig({
  extends: blogTheme,
  lang: 'zh-CN',
  title: '我的博客',
  description: '个人技术博客',
  lastUpdated: true,
  cleanUrls: true,

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }]
  ],

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '生活随笔', link: '/?tag=生活随笔' },
      { text: 'Agent', link: '/?tag=Agent' },
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
