import BlogTheme from '@sugarat/theme'
import './style.css'

export default {
  ...BlogTheme,
  enhanceApp(ctx: any) {
    BlogTheme.enhanceApp?.(ctx)
    if (typeof window === 'undefined') return

    // sugarat 主题用 useBrowserLocation 监听 URL 变化，但 vueuse 的这个 hook
    // 只响应浏览器原生 popstate/hashchange。VitePress 路由走的是 pushState，
    // URL 变了但不触发 popstate → sugarat 的 tag 过滤无响应。
    //
    // 只给 pushState 打补丁，调用后补发一次 popstate，其中 state 设为 null：
    //  - useBrowserLocation 只看 URL，照常响应 → tag 过滤正常工作
    //  - VitePress 自己的 popstate handler 见 state === null 会直接 return，
    //    不会重复触发 loadPage。这样快速连点也不会堆积异步任务导致卡顿。
    const originalPushState = history.pushState
    history.pushState = function (...args: any[]) {
      const ret = (originalPushState as any).apply(this, args)
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
      return ret
    }
  }
}
