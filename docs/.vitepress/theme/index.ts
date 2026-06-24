import BlogTheme from '@sugarat/theme'
import './style.css'

export default {
  ...BlogTheme,
  enhanceApp(ctx: any) {
    BlogTheme.enhanceApp?.(ctx)
    if (typeof window === 'undefined') return

    const win = window as Window & {
      __blogRouteWallpaperCleanup?: () => void
      __blogCoverCardCleanup?: () => void
      __blogPushStatePatched?: boolean
      __blogReplaceStatePatched?: boolean
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

    function updateCoverCardLayout() {
      const items = Array.from(document.querySelectorAll<HTMLElement>('.blog-list-wrapper .blog-item'))
      let coverIndex = 0

      for (const item of items) {
        item.classList.remove('blog-cover-card', 'blog-cover-card--reverse')

        const cover = item.querySelector<HTMLElement>('.cover-img')
        if (!cover || getComputedStyle(cover).display === 'none') continue

        item.classList.add('blog-cover-card')
        item.classList.toggle('blog-cover-card--reverse', coverIndex % 2 === 0)
        coverIndex += 1
      }
    }

    let coverCardFrame = 0
    function scheduleCoverCardLayout() {
      cancelAnimationFrame(coverCardFrame)
      coverCardFrame = requestAnimationFrame(() => {
        updateCoverCardLayout()
        requestAnimationFrame(updateCoverCardLayout)
      })
    }

    win.__blogCoverCardCleanup?.()
    const coverCardObserver = new MutationObserver(scheduleCoverCardLayout)
    coverCardObserver.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('popstate', scheduleCoverCardLayout)
    window.addEventListener('hashchange', scheduleCoverCardLayout)
    win.__blogCoverCardCleanup = () => {
      cancelAnimationFrame(coverCardFrame)
      coverCardObserver.disconnect()
      window.removeEventListener('popstate', scheduleCoverCardLayout)
      window.removeEventListener('hashchange', scheduleCoverCardLayout)
    }
    scheduleCoverCardLayout()

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
  }
}
