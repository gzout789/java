import { ref } from 'vue'
import { currentUser } from './useTheme'

/**
 * 联机牌局 WebSocket 会话。
 *
 * 浏览器原生 WebSocket 无法自定义请求头，所以将军令牌走 URL query，
 * 由后端 GameHandshakeInterceptor 在握手阶段校验。
 * 断线自动重连三次；重连成功后服务端会补发最近一份快照，牌局不会丢状态。
 */
export function useGameSocket(options = {}) {
  const connected = ref(false)
  const error = ref('')

  let ws = null
  let retryTimer = null
  let retries = 0
  let closedByUser = false

  function buildUrl() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const token = (currentUser.value && currentUser.value.token) || ''
    return `${proto}//${location.host}/ws/game`
      + `?token=${encodeURIComponent(token)}&code=${encodeURIComponent(options.code || '')}`
  }

  function connect() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return
    closedByUser = false
    let socket
    try {
      socket = new WebSocket(buildUrl())
    } catch (e) {
      error.value = '联机通道建立失败：' + (e && e.message ? e.message : '网络异常')
      return
    }
    ws = socket

    socket.onopen = () => {
      connected.value = true
      error.value = ''
      retries = 0
    }

    socket.onmessage = (event) => {
      let msg
      try { msg = JSON.parse(event.data) } catch { return }
      if (options.onMessage) options.onMessage(msg)
    }

    socket.onerror = () => {
      // 具体原因由 onclose 统一处理，这里不重复提示
    }

    socket.onclose = () => {
      connected.value = false
      if (ws === socket) ws = null
      if (closedByUser) return
      if (retries < 3) {
        retries++
        retryTimer = setTimeout(connect, 1200 * retries)
      } else {
        error.value = '联机通道已断开，请返回中军大帐重新整队出征'
      }
    }
  }

  /** 返回是否成功发出（未连上时静默丢弃，由 UI 的连接状态提示兜底） */
  function send(payload) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    try {
      ws.send(JSON.stringify(payload))
      return true
    } catch {
      return false
    }
  }

  function close() {
    closedByUser = true
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
    if (ws) {
      try { ws.close() } catch { /* 已断开 */ }
      ws = null
    }
    connected.value = false
  }

  return { connected, error, connect, send, close }
}
