import BlogTheme from '@sugarat/theme'
import './style.css'

export default {
  ...BlogTheme,
  enhanceApp(ctx: any) {
    BlogTheme.enhanceApp?.(ctx)
    if (typeof window === 'undefined') return

    // sugarat 主题内部用 useBrowserLocation 监听 URL，但 VitePress 路由
    // 用的是 pushState，不会触发 popstate → 带 ?tag= 的站内跳转无法触发
    // 标签过滤。这里拦截这类链接，改为整页跳转。
    document.addEventListener(
      'click',
      (e) => {
        const a = (e.target as HTMLElement | null)?.closest?.('a') as HTMLAnchorElement | null
        if (!a) return
        const href = a.getAttribute('href') || ''
        if (!href.includes('?tag=')) return
        try {
          const url = new URL(href, window.location.origin)
          if (url.origin !== window.location.origin) return
          e.preventDefault()
          e.stopPropagation()
          window.location.assign(url.href)
        } catch {
          /* noop */
        }
      },
      true
    )
  }
}
