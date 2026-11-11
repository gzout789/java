import { authHeaders } from './useTheme'

/* ---------------- 同袍系统接口 ----------------
 * 所有接口都要求将军令牌；统一在这里补 Authorization，
 * 并把 {success,message,data} 拆成 data，失败直接抛 Error。 */
async function call(url, options = {}) {
  const extra = { ...(options.headers || {}) }
  if (options.body) extra['Content-Type'] = 'application/json'
  const res = await fetch(url, {
    ...options,
    headers: authHeaders(extra)
  })

  let body = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (res.status === 401) {
    const err = new Error('凭信已失效，请重新点兵入帐')
    err.unauthorized = true
    throw err
  }
  if (!body || !body.success) {
    throw new Error((body && body.message) || '军中传令受阻，请稍后再试')
  }
  return body.data
}

const get = (url) => call(url)
const post = (url, data) =>
  call(url, { method: 'POST', body: JSON.stringify(data || {}) })

export const socialApi = {
  /* 好友与私信 */
  overview: () => get('/api/friends'),
  search: (keyword) => get('/api/friends/search?keyword=' + encodeURIComponent(keyword)),
  addRequest: (username, message = '') => post('/api/friends/request', { username, message }),
  acceptRequest: (id) => post('/api/friends/request/accept', { id }),
  rejectRequest: (id) => post('/api/friends/request/reject', { id }),
  removeFriend: (username) => post('/api/friends/remove', { username }),
  loadMessages: (withUser, after = 0) =>
    post('/api/friends/messages/load', { with: withUser, after }),
  sendMessage: (to, content) => post('/api/friends/messages', { to, content }),

  /* 联队房间 */
  teamOverview: () => get('/api/team'),
  createTeam: (name) => post('/api/team/create', { name }),
  invite: (username) => post('/api/team/invite', { username }),
  acceptInvite: (id) => post('/api/team/invite/accept', { id }),
  rejectInvite: (id) => post('/api/team/invite/reject', { id }),
  joinTeam: (code) => post('/api/team/join', { code }),
  leaveTeam: () => post('/api/team/leave'),
  startTeam: () => post('/api/team/start'),
  loadTeamMessages: (after = 0) => post('/api/team/messages/load', { after }),
  postTeamMessage: (content) => post('/api/team/messages', { content }),
  postReport: (content) => post('/api/team/report', { content })
}
