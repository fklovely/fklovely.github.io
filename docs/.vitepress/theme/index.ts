import BlogTheme from '@sugarat/theme'
import './style.css'

export default {
  ...BlogTheme,
  enhanceApp(ctx: any) {
    BlogTheme.enhanceApp?.(ctx)
    if (typeof window === 'undefined') return

    // sugarat 主题用 useBrowserLocation 监听 URL 变化，但 vueuse 的这个 hook
    // 只响应浏览器原生 popstate/hashchange 事件。VitePress 路由走的是
    // pushState，URL 变了但不会触发 popstate → sugarat 的 tag 过滤没反应。
    //
    // 给 history.pushState / replaceState 打个补丁：调用后额外派发一次
    // popstate，让 useBrowserLocation 感知到 URL 变化，触发下游 watcher。
    // 这样 SPA 内跳转 /?tag=xxx 时不用整页刷新，过滤也能正常工作。
    const patch = (method: 'pushState' | 'replaceState') => {
      const original = history[method]
      history[method] = function (...args: any[]) {
        const ret = (original as any).apply(this, args)
        window.dispatchEvent(new PopStateEvent('popstate', { state: args[0] }))
        return ret
      }
    }
    patch('pushState')
    patch('replaceState')
  }
}
