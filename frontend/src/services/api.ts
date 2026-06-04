import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('admin')
      window.location.href = '/login'
    }
    return Promise.reject(error.response?.data?.detail || error.message)
  }
)

export const authAPI = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  logout: () => api.post('/auth/logout'),
}

export const eventsAPI = {
  list: () => api.get('/events'),
  get: (id: number) => api.get(`/events/${id}`),
  create: (data: any) => api.post('/events', data),
  update: (id: number, data: any) => api.put(`/events/${id}`, data),
  delete: (id: number) => api.delete(`/events/${id}`),
  setStatus: (id: number, status: string) =>
    api.patch(`/events/${id}/status`, { status }),
  getFlows: (id: number) => api.get(`/events/${id}/flows`),
  updateFlowOrder: (id: number, steps: number[]) =>
    api.patch(`/events/${id}/flows/order`, { step_ids: steps }),
  addFlow: (id: number, data: any) => api.post(`/events/${id}/flows`, data),
  updateFlow: (eventId: number, stepId: number, data: any) =>
    api.put(`/events/${eventId}/flows/${stepId}`, data),
  deleteFlow: (eventId: number, stepId: number) =>
    api.delete(`/events/${eventId}/flows/${stepId}`),
  setActiveFlow: (eventId: number, stepId: number) =>
    api.patch(`/events/${eventId}/flows/${stepId}/activate`),
}

export const participantsAPI = {
  list: (eventId: number) => api.get(`/events/${eventId}/participants`),
  add: (eventId: number, data: any) =>
    api.post(`/events/${eventId}/participants`, data),
  update: (eventId: number, id: number, data: any) =>
    api.put(`/events/${eventId}/participants/${id}`, data),
  delete: (eventId: number, id: number) =>
    api.delete(`/events/${eventId}/participants/${id}`),
  importCSV: (eventId: number, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/events/${eventId}/participants/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  byJoinCode: (code: string) => api.get(`/participants/code/${code}`),
  groups: (eventId: number) => api.get(`/events/${eventId}/participants/groups`),
  updateGroup: (eventId: number, ids: number[], group: string) =>
    api.patch(`/events/${eventId}/participants/group`, {
      participant_ids: ids,
      group_name: group,
    }),
}

export const votesAPI = {
  list: (eventId: number) => api.get(`/events/${eventId}/votes`),
  get: (id: number) => api.get(`/votes/${id}`),
  create: (eventId: number, data: any) =>
    api.post(`/events/${eventId}/votes`, data),
  update: (id: number, data: any) => api.put(`/votes/${id}`, data),
  delete: (id: number) => api.delete(`/votes/${id}`),
  submit: (id: number, data: any) => api.post(`/votes/${id}/submit`, data),
  results: (id: number) => api.get(`/votes/${id}/results`),
  end: (id: number) => api.patch(`/votes/${id}/end`),
  exportCSV: (id: number) => api.get(`/votes/${id}/export`, { responseType: 'blob' }),
  captcha: (id: number) => api.get(`/votes/${id}/captcha`, { responseType: 'blob' }),
}

export const lotteryAPI = {
  prizes: () => api.get('/prizes'),
  createPrize: (data: any) => api.post('/prizes', data),
  updatePrize: (id: number, data: any) => api.put(`/prizes/${id}`, data),
  deletePrize: (id: number) => api.delete(`/prizes/${id}`),
  markDistributed: (id: number) => api.patch(`/prizes/${id}/distributed`),
  list: (eventId: number) => api.get(`/events/${eventId}/lotteries`),
  get: (id: number) => api.get(`/lotteries/${id}`),
  create: (eventId: number, data: any) =>
    api.post(`/events/${eventId}/lotteries`, data),
  update: (id: number, data: any) => api.put(`/lotteries/${id}`, data),
  delete: (id: number) => api.delete(`/lotteries/${id}`),
  draw: (id: number) => api.post(`/lotteries/${id}/draw`),
  winners: (eventId: number) => api.get(`/events/${eventId}/winners`),
  notifyWinner: (id: number) => api.post(`/winners/${id}/notify`),
  markClaimed: (id: number) => api.patch(`/winners/${id}/claimed`),
}

export const danmakuAPI = {
  list: (eventId: number) => api.get(`/events/${eventId}/danmaku`),
  send: (eventId: number, data: any) =>
    api.post(`/events/${eventId}/danmaku`, data),
  approve: (id: number) => api.patch(`/danmaku/${id}/approve`),
  reject: (id: number) => api.delete(`/danmaku/${id}`),
  pin: (id: number) => api.patch(`/danmaku/${id}/pin`),
  unpin: (id: number) => api.patch(`/danmaku/${id}/unpin`),
  pending: (eventId: number) => api.get(`/events/${eventId}/danmaku/pending`),
  config: (eventId: number) => api.get(`/events/${eventId}/danmaku/config`),
  updateConfig: (eventId: number, data: any) =>
    api.put(`/events/${eventId}/danmaku/config`, data),
  stats: (eventId: number) => api.get(`/events/${eventId}/danmaku/stats`),
  sensitiveWords: () => api.get('/sensitive-words'),
  addSensitiveWord: (word: string) =>
    api.post('/sensitive-words', { word }),
  deleteSensitiveWord: (id: number) =>
    api.delete(`/sensitive-words/${id}`),
}

export const checkinAPI = {
  stats: (eventId: number) => api.get(`/events/${eventId}/checkin/stats`),
  doCheckIn: (participantId: number, data?: any) =>
    api.post(`/participants/${participantId}/checkin`, data),
  qrCode: (eventId: number) =>
    api.get(`/events/${eventId}/checkin/qrcode`, { responseType: 'text' }),
  exportCSV: (eventId: number) =>
    api.get(`/events/${eventId}/checkin/export`, { responseType: 'blob' }),
  history: (eventId: number) => api.get(`/events/${eventId}/checkin/history`),
}

export const scoringAPI = {
  list: (eventId: number) => api.get(`/events/${eventId}/scoring`),
  get: (id: number) => api.get(`/scoring/${id}`),
  create: (eventId: number, data: any) =>
    api.post(`/events/${eventId}/scoring`, data),
  update: (id: number, data: any) => api.put(`/scoring/${id}`, data),
  delete: (id: number) => api.delete(`/scoring/${id}`),
  submit: (id: number, data: any) => api.post(`/scoring/${id}/submit`, data),
  results: (id: number) => api.get(`/scoring/${id}/results`),
  exportCSV: (id: number) =>
    api.get(`/scoring/${id}/export`, { responseType: 'blob' }),
}

export const dataAPI = {
  dashboard: (eventId: number) => api.get(`/events/${eventId}/dashboard`),
  engagement: (eventId: number) => api.get(`/events/${eventId}/engagement`),
  leaderboard: (eventId: number) =>
    api.get(`/events/${eventId}/leaderboard`),
  replay: (eventId: number) => api.get(`/events/${eventId}/replay`),
  report: (eventId: number) =>
    api.get(`/events/${eventId}/report/pdf`, { responseType: 'blob' }),
  compare: () => api.get('/events/compare'),
  exportJSON: (eventId: number) =>
    api.get(`/events/${eventId}/export/json`, { responseType: 'blob' }),
  exportCSV: (eventId: number) =>
    api.get(`/events/${eventId}/export/csv`, { responseType: 'blob' }),
}

export const templatesAPI = {
  list: () => api.get('/templates'),
  get: (id: number) => api.get(`/templates/${id}`),
  create: (data: any) => api.post('/templates', data),
  update: (id: number, data: any) => api.put(`/templates/${id}`, data),
  delete: (id: number) => api.delete(`/templates/${id}`),
  apply: (eventId: number, templateId: number) =>
    api.post(`/events/${eventId}/templates/${templateId}/apply`),
}

export default api
