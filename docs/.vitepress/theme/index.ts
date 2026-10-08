import BlogTheme from '@sugarat/theme'
// 仅打包屏幕版常规字体；unicode-range 让浏览器按页面用字加载。
import 'lxgw-wenkai-screen-web/lxgwwenkaiscreen/result.css'
import './style.css'
import MyLayout from './MyLayout.vue'

export default {
  ...BlogTheme,
  Layout: MyLayout,
  enhanceApp(ctx: any) {
    BlogTheme.enhanceApp?.(ctx)
    if (typeof window === 'undefined') return

    const win = window as Window & {
      __blogRouteWallpaperCleanup?: () => void
      __blogPushStatePatched?: boolean
      __blogReplaceStatePatched?: boolean
      __blogScrollRevealSetup?: boolean
    }

    const lifeEssaysWallpaperClass = 'life-essays-wallpaper'

    function updateRouteWallpaper() {
      const url = new URL(window.location.href)
      const pathname = url.pathname.replace(/\/$/, '')
      const isLifeEssays =
        url.searchParams.get('tag') === '生活随笔'
        || pathname === '/essays'
        || pathname.startsWith('/essays/')

      document.body.classList.toggle(lifeEssaysWallpaperClass, isLifeEssays)
    }

    win.__blogRouteWallpaperCleanup?.()
    window.addEventListener('popstate', updateRouteWallpaper)
    window.addEventListener('hashchange', updateRouteWallpaper)
    win.__blogRouteWallpaperCleanup = () => {
      window.removeEventListener('popstate', updateRouteWallpaper)
      window.removeEventListener('hashchange', updateRouteWallpaper)
    }
    updateRouteWallpaper()

    // sugarat 主题用 useBrowserLocation 监听 URL 变化，但 vueuse 的这个 hook
    // 只响应浏览器原生 popstate/hashchange。VitePress 路由走的是 pushState，
    // URL 变了但不触发 popstate → sugarat 的 tag 过滤无响应。
    //
    // 只给 pushState 打补丁，调用后补发一次 popstate，其中 state 设为 null：
    //  - useBrowserLocation 只看 URL，照常响应 → tag 过滤正常工作
    //  - VitePress 自己的 popstate handler 见 state === null 会直接 return，
    //    不会重复触发 loadPage。这样快速连点也不会堆积异步任务导致卡顿。
    if (!win.__blogPushStatePatched) {
      const originalPushState = history.pushState
      history.pushState = function (...args: any[]) {
        const ret = (originalPushState as any).apply(this, args)
        window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
        return ret
      }
      win.__blogPushStatePatched = true
    }

    if (!win.__blogReplaceStatePatched) {
      const originalReplaceState = history.replaceState
      history.replaceState = function (...args: any[]) {
        const ret = (originalReplaceState as any).apply(this, args)
        updateRouteWallpaper()
        return ret
      }
      win.__blogReplaceStatePatched = true
    }

    // 首页文章卡片滚动渐入：IntersectionObserver 负责触发入场，MutationObserver
    // 负责接住标签筛选/分页后新渲染的卡片。尊重系统“减少动态效果”设置；
    // 不支持时 html 不加 .js-reveal，CSS 侧完全不生效，内容直接可见。
    if (!win.__blogScrollRevealSetup) {
      const canAnimate =
        'IntersectionObserver' in window
        && window.matchMedia('(prefers-reduced-motion: no-preference)').matches

      if (canAnimate) {
        document.documentElement.classList.add('js-reveal')

        const io = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('reveal-in')
              io.unobserve(entry.target)
            }
          }
        }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 })

        const bind = (root: ParentNode) => {
          root.querySelectorAll<HTMLElement>('.blog-item:not([data-reveal-bound])').forEach((el, i) => {
            el.setAttribute('data-reveal-bound', '')
            // 同批卡片错峰入场，避免整列同时弹
            el.style.setProperty('--reveal-delay', `${Math.min(i, 6) * 70}ms`)
            io.observe(el)
          })
        }

        bind(document)
        new MutationObserver((records) => {
          for (const record of records) {
            record.addedNodes.forEach((node) => {
              if (node instanceof HTMLElement) {
                // 新增节点自身就是 .blog-item 时，从父级重新扫描
                bind(node.matches('.blog-item') ? (node.parentElement ?? node) : node)
              }
            })
          }
        }).observe(document.body, { childList: true, subtree: true })
      }
      win.__blogScrollRevealSetup = true
    }
  }
}
