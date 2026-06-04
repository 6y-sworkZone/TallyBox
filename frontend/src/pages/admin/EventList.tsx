import React, { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { eventsAPI } from '../../services/api'
import { wsService } from '../../services/websocket'
import type { Event as EventType } from '../../types'

const EventList: React.FC = () => {
  const [events, setEvents] = useState<EventType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventType | null>(null)
  const [showConfirm, setShowConfirm] = useState<{ show: boolean; eventId: number | null; action: string }>({ show: false, eventId: null, action: '' })
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    location: '',
    description: '',
    max_participants: 100,
    allow_anonymous: false,
    password: '',
  })
  const navigate = useNavigate()

  useEffect(() => {
    loadEvents()
    const token = localStorage.getItem('token')
    if (token) {
      wsService.connectAdmin(0, token)
    }
    return () => wsService.disconnectAdmin()
  }, [])

  const loadEvents = async () => {
    try {
      setLoading(true)
      const data = await eventsAPI.list() as unknown as EventType[]
      setEvents(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      if (editingEvent) {
        await eventsAPI.update(editingEvent.id, formData)
      } else {
        await eventsAPI.create(formData)
      }
      setShowModal(false)
      resetForm()
      loadEvents()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
  }

  const handleEdit = (event: EventType) => {
    setEditingEvent(event)
    setFormData({
      name: event.name,
      date: event.date.slice(0, 16),
      location: event.location,
      description: event.description,
      max_participants: event.max_participants,
      allow_anonymous: event.allow_anonymous,
      password: event.password || '',
    })
    setShowModal(true)
  }

  const handleDelete = async () => {
    if (!showConfirm.eventId) return
    try {
      await eventsAPI.delete(showConfirm.eventId)
      loadEvents()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
    setShowConfirm({ show: false, eventId: null, action: '' })
  }

  const handleStatusChange = async (event: EventType, status: 'preparing' | 'ongoing' | 'ended') => {
    try {
      await eventsAPI.setStatus(event.id, status)
      loadEvents()
    } catch (err) {
      setError(err instanceof Error ? err.message : '状态更新失败')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      date: '',
      location: '',
      description: '',
      max_participants: 100,
      allow_anonymous: false,
      password: '',
    })
    setEditingEvent(null)
  }

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { bg: string; text: string; label: string }> = {
      preparing: { bg: 'bg-yellow-900/30', text: 'text-yellow-400', label: '准备中' },
      ongoing: { bg: 'bg-green-900/30', text: 'text-green-400', label: '进行中' },
      ended: { bg: 'bg-gray-700/50', text: 'text-gray-400', label: '已结束' },
    }
    const config = configs[status] || configs.preparing
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    )
  }

  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-bg p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 glow-text">活动管理</h1>
            <p className="text-gray-400">管理您的所有活动</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true) }}
            className="px-6 py-3 bg-gradient-to-r from-primary to-red-600 hover:from-red-600 hover:to-primary text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 gold-border flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            创建活动
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <div
              key={event.id}
              className="bg-dark-card border border-dark-border rounded-xl overflow-hidden hover:border-primary/50 transition-all duration-300 group animate-fade-in"
            >
              <div className="h-3 bg-gradient-to-r from-primary to-gold"></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-1 group-hover:text-gold transition-colors">
                      {event.name}
                    </h3>
                    {getStatusBadge(event.status)}
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-400 mb-4">
                  <div className="flex items-center gap-2">
                    <span>📅</span>
                    <span>{new Date(event.date).toLocaleString('zh-CN')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>📍</span>
                    <span>{event.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>👥</span>
                    <span>最多 {event.max_participants} 人</span>
                  </div>
                </div>

                {event.description && (
                  <p className="text-gray-500 text-sm mb-4 line-clamp-2">
                    {event.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 mb-4">
                  {event.allow_anonymous && (
                    <span className="px-2 py-1 bg-blue-900/30 text-blue-400 text-xs rounded">
                      允许匿名
                    </span>
                  )}
                  {event.password && (
                    <span className="px-2 py-1 bg-purple-900/30 text-purple-400 text-xs rounded">
                      需密码
                    </span>
                  )}
                </div>

                <div className="border-t border-dark-border pt-4">
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => navigate(`/admin/events/${event.id}`)}
                      className="flex-1 px-3 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-colors text-sm font-medium"
                    >
                      管理
                    </button>
                    <button
                      onClick={() => handleEdit(event)}
                      className="px-3 py-2 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setShowConfirm({ show: true, eventId: event.id, action: 'delete' })}
                      className="px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors"
                    >
                      🗑️
                    </button>
                  </div>

                  <div className="flex gap-2">
                    {event.status === 'preparing' && (
                      <button
                        onClick={() => handleStatusChange(event, 'ongoing')}
                        className="flex-1 px-3 py-2 bg-green-900/30 hover:bg-green-900/50 text-green-400 rounded-lg transition-colors text-sm"
                      >
                        开始活动
                      </button>
                    )}
                    {event.status === 'ongoing' && (
                      <button
                        onClick={() => handleStatusChange(event, 'ended')}
                        className="flex-1 px-3 py-2 bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors text-sm"
                      >
                        结束活动
                      </button>
                    )}
                    {event.status === 'ended' && (
                      <button
                        onClick={() => handleStatusChange(event, 'preparing')}
                        className="flex-1 px-3 py-2 bg-yellow-900/30 hover:bg-yellow-900/50 text-yellow-400 rounded-lg transition-colors text-sm"
                      >
                        重新准备
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {events.length === 0 && !loading && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-semibold text-white mb-2">还没有活动</h3>
            <p className="text-gray-400 mb-6">点击上方按钮创建您的第一个活动</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-lg animate-slide-up">
            <div className="p-6 border-b border-dark-border">
              <h2 className="text-xl font-semibold text-gold">
                {editingEvent ? '编辑活动' : '创建新活动'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">活动名称 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">活动时间 *</label>
                  <input
                    type="datetime-local"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">最大人数</label>
                  <input
                    type="number"
                    value={formData.max_participants}
                    onChange={(e) => setFormData({ ...formData, max_participants: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                    min="1"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">活动地点 *</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">活动描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary resize-none"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allow_anonymous}
                    onChange={(e) => setFormData({ ...formData, allow_anonymous: e.target.checked })}
                    className="w-4 h-4 rounded border-dark-border bg-dark-bg text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-300">允许匿名参与</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">参与密码（可选）</label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                  placeholder="留空则不需要密码"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm() }}
                  className="flex-1 px-4 py-3 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-primary to-red-600 text-white font-semibold rounded-lg hover:from-red-600 hover:to-primary transition-all"
                >
                  {editingEvent ? '保存修改' : '创建活动'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showConfirm.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-red-500/50 rounded-2xl w-full max-w-md p-6 animate-slide-up">
            <div className="text-center">
              <div className="text-5xl mb-4">⚠️</div>
              <h3 className="text-xl font-semibold text-white mb-2">确认操作</h3>
              <p className="text-gray-400 mb-6">
                {showConfirm.action === 'delete' ? '确定要删除此活动吗？此操作无法撤销。' : '确定要执行此操作吗？'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm({ show: false, eventId: null, action: '' })}
                  className="flex-1 px-4 py-3 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EventList
