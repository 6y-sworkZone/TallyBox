import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as echarts from 'echarts'
import { danmakuAPI } from '../../services/api'
import { wsService } from '../../services/websocket'
import type { Danmaku, DanmakuConfig } from '../../types'

interface DanmakuStats {
  total: number
  approved: number
  pending: number
  rejected: number
  by_hour: Record<string, number>
  top_senders: Array<{ name: string; count: number }>
}

const DanmakuManage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>()
  const id = parseInt(eventId || '0')
  const navigate = useNavigate()

  const [danmakus, setDanmakus] = useState<Danmaku[]>([])
  const [pendingDanmakus, setPendingDanmakus] = useState<Danmaku[]>([])
  const [config, setConfig] = useState<DanmakuConfig | null>(null)
  const [stats, setStats] = useState<DanmakuStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'history' | 'pending' | 'config' | 'stats'>('history')
  const [showConfirm, setShowConfirm] = useState<{ show: boolean; danmakuId: number | null; action: string }>({ show: false, danmakuId: null, action: '' })
  const [configForm, setConfigForm] = useState<DanmakuConfig>({
    enabled: true,
    require_approval: true,
    default_color: '#FFFFFF',
    default_font_size: 24,
    default_speed: 5,
    max_length: 50,
  })

  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (id) {
      loadData()
      const token = localStorage.getItem('token')
      if (token) {
        wsService.connectAdmin(id, token)
      }
    }
    return () => {
      wsService.disconnectAdmin()
      if (chartInstance.current) {
        chartInstance.current.dispose()
      }
    }
  }, [id])

  useEffect(() => {
    if (activeTab === 'stats' && stats) {
      initChart()
    }
  }, [activeTab, stats])

  const loadData = async () => {
    try {
      setLoading(true)
      const [danmakusData, pendingData, configData, statsData] = await Promise.all([
        danmakuAPI.list(id) as unknown as Promise<Danmaku[]>,
        danmakuAPI.pending(id) as unknown as Promise<Danmaku[]>,
        danmakuAPI.config(id) as unknown as Promise<DanmakuConfig>,
        danmakuAPI.stats(id) as unknown as Promise<DanmakuStats>,
      ])
      setDanmakus(danmakusData)
      setPendingDanmakus(pendingData)
      setConfig(configData)
      setStats(statsData)
      setConfigForm(configData)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const initChart = () => {
    if (!chartRef.current || !stats) return

    if (chartInstance.current) {
      chartInstance.current.dispose()
    }

    chartInstance.current = echarts.init(chartRef.current)

    const hours = Object.keys(stats.by_hour).sort()
    const counts = hours.map((h) => stats.by_hour[h])

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(30, 41, 59, 0.9)',
        borderColor: '#334155',
        textStyle: { color: '#fff' },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: hours,
        axisLine: { lineStyle: { color: '#334155' } },
        axisLabel: { color: '#9CA3AF' },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#334155' } },
        axisLabel: { color: '#9CA3AF' },
        splitLine: { lineStyle: { color: '#1E293B' } },
      },
      series: [
        {
          data: counts,
          type: 'line',
          smooth: true,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(229, 57, 53, 0.5)' },
              { offset: 1, color: 'rgba(229, 57, 53, 0.05)' },
            ]),
          },
          lineStyle: {
            color: '#E53935',
            width: 3,
          },
          itemStyle: {
            color: '#FFD700',
          },
        },
      ],
    }

    chartInstance.current.setOption(option)
  }

  const handleApprove = async (danmakuId: number) => {
    try {
      await danmakuAPI.approve(danmakuId)
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    }
  }

  const handleReject = async () => {
    if (!showConfirm.danmakuId) return
    try {
      await danmakuAPI.reject(showConfirm.danmakuId)
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    }
    setShowConfirm({ show: false, danmakuId: null, action: '' })
  }

  const handlePin = async (danmakuId: number, isPinned: boolean) => {
    try {
      if (isPinned) {
        await danmakuAPI.unpin(danmakuId)
      } else {
        await danmakuAPI.pin(danmakuId)
      }
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    }
  }

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await danmakuAPI.updateConfig(id, configForm)
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
  }

  const getDanmakuList = () => {
    return activeTab === 'pending' ? pendingDanmakus : danmakus
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="sticky top-0 z-40 bg-dark-bg/80 backdrop-blur-lg border-b border-dark-border">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/admin/events/${id}`)}
                className="p-2 hover:bg-dark-card rounded-lg transition-colors"
              >
                ←
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white glow-text">弹幕管理</h1>
                <p className="text-gray-400 text-sm">
                  共 {stats?.total || 0} 条弹幕 · {pendingDanmakus.length} 条待审核
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/admin/events/${id}/sensitive-words`)}
              className="px-4 py-2 bg-dark-card hover:bg-dark-border text-gray-300 rounded-lg transition-colors"
            >
              🔞 敏感词管理
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-dark-card border border-dark-border rounded-xl p-4">
              <div className="text-3xl font-bold text-white mb-1">{stats.total}</div>
              <div className="text-gray-400 text-sm">总弹幕数</div>
            </div>
            <div className="bg-dark-card border border-dark-border rounded-xl p-4">
              <div className="text-3xl font-bold text-green-400 mb-1">{stats.approved}</div>
              <div className="text-gray-400 text-sm">已通过</div>
            </div>
            <div className="bg-dark-card border border-dark-border rounded-xl p-4">
              <div className="text-3xl font-bold text-yellow-400 mb-1">{stats.pending}</div>
              <div className="text-gray-400 text-sm">待审核</div>
            </div>
            <div className="bg-dark-card border border-dark-border rounded-xl p-4">
              <div className="text-3xl font-bold text-red-400 mb-1">{stats.rejected}</div>
              <div className="text-gray-400 text-sm">已拒绝</div>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-6">
          {(['history', 'pending', 'config', 'stats'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-lg transition-colors ${
                activeTab === tab
                  ? 'bg-primary text-white'
                  : 'bg-dark-card text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'history' && '📜 历史记录'}
              {tab === 'pending' && '⏳ 待审核'}
              {tab === 'config' && '⚙️ 配置'}
              {tab === 'stats' && '📊 统计'}
            </button>
          ))}
        </div>

        {(activeTab === 'history' || activeTab === 'pending') && (
          <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-dark-bg border-b border-dark-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">内容</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">发送者</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">样式</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">状态</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">时间</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {getDanmakuList().map((danmaku) => (
                    <tr key={danmaku.id} className="hover:bg-dark-bg/50 transition-colors">
                      <td className="px-4 py-3">
                        <span
                          style={{ color: danmaku.color, fontSize: `${danmaku.font_size}px` }}
                          className="font-medium"
                        >
                          {danmaku.content}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {danmaku.participant_id ? `用户 #${danmaku.participant_id}` : '匿名'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full border border-gray-600"
                            style={{ backgroundColor: danmaku.color }}
                          />
                          <span className="text-gray-400 text-sm">{danmaku.font_size}px</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {!danmaku.is_approved && activeTab === 'pending' ? (
                            <span className="px-2 py-0.5 text-xs bg-yellow-900/30 text-yellow-400 rounded">待审核</span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs bg-green-900/30 text-green-400 rounded">已通过</span>
                          )}
                          {danmaku.is_pinned && (
                            <span className="px-2 py-0.5 text-xs bg-gold/20 text-gold rounded">置顶</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {new Date(danmaku.created_at).toLocaleString('zh-CN')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {activeTab === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(danmaku.id)}
                                className="px-3 py-1 bg-green-900/30 hover:bg-green-900/50 text-green-400 rounded-lg transition-colors text-sm"
                              >
                                通过
                              </button>
                              <button
                                onClick={() => setShowConfirm({ show: true, danmakuId: danmaku.id, action: 'reject' })}
                                className="px-3 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors text-sm"
                              >
                                拒绝
                              </button>
                            </>
                          )}
                          {activeTab === 'history' && (
                            <button
                              onClick={() => handlePin(danmaku.id, danmaku.is_pinned)}
                              className={`px-3 py-1 rounded-lg transition-colors text-sm ${
                                danmaku.is_pinned
                                  ? 'bg-gold/20 hover:bg-gold/30 text-gold'
                                  : 'bg-dark-bg hover:bg-dark-border text-gray-300'
                              }`}
                            >
                              {danmaku.is_pinned ? '取消置顶' : '置顶'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {getDanmakuList().length === 0 && (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">{activeTab === 'pending' ? '✅' : '💬'}</div>
                <h4 className="text-lg font-semibold text-white mb-2">
                  {activeTab === 'pending' ? '暂无待审核弹幕' : '暂无弹幕记录'}
                </h4>
                <p className="text-gray-400">
                  {activeTab === 'pending' ? '所有弹幕都已审核' : '活动开始后弹幕将显示在这里'}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'config' && config && (
          <div className="bg-dark-card border border-dark-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gold mb-6">弹幕配置</h3>
            <form onSubmit={handleConfigSubmit} className="space-y-6 max-w-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-white font-medium">弹幕开关</label>
                  <p className="text-gray-400 text-sm">开启后用户可以发送弹幕</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={configForm.enabled}
                    onChange={(e) => setConfigForm({ ...configForm, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-white font-medium">审核开关</label>
                  <p className="text-gray-400 text-sm">开启后弹幕需要审核才能显示</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={configForm.require_approval}
                    onChange={(e) => setConfigForm({ ...configForm, require_approval: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">默认颜色</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={configForm.default_color}
                      onChange={(e) => setConfigForm({ ...configForm, default_color: e.target.value })}
                      className="w-12 h-10 rounded-lg cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={configForm.default_color}
                      onChange={(e) => setConfigForm({ ...configForm, default_color: e.target.value })}
                      className="flex-1 px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">默认字号</label>
                  <input
                    type="number"
                    value={configForm.default_font_size}
                    onChange={(e) => setConfigForm({ ...configForm, default_font_size: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                    min="12"
                    max="72"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">滚动速度</label>
                  <input
                    type="range"
                    value={configForm.default_speed}
                    onChange={(e) => setConfigForm({ ...configForm, default_speed: parseInt(e.target.value) })}
                    className="w-full h-2 bg-dark-bg rounded-lg appearance-none cursor-pointer accent-primary"
                    min="1"
                    max="10"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>慢</span>
                    <span>{configForm.default_speed}</span>
                    <span>快</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">最大字数</label>
                  <input
                    type="number"
                    value={configForm.max_length}
                    onChange={(e) => setConfigForm({ ...configForm, max_length: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                    min="10"
                    max="200"
                  />
                </div>
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full px-6 py-3 bg-gradient-to-r from-primary to-red-600 text-white font-semibold rounded-lg hover:from-red-600 hover:to-primary transition-all"
                >
                  保存配置
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'stats' && stats && (
          <div className="space-y-6">
            <div className="bg-dark-card border border-dark-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gold mb-4">弹幕发送趋势</h3>
              <div ref={chartRef} className="h-80"></div>
            </div>
            {stats.top_senders.length > 0 && (
              <div className="bg-dark-card border border-dark-border rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gold mb-4">活跃用户排行</h3>
                <div className="space-y-3">
                  {stats.top_senders.slice(0, 10).map((sender, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                        index === 0 ? 'bg-gold' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-700' : 'bg-dark-bg'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-white">{sender.name}</span>
                          <span className="text-gold">{sender.count} 条</span>
                        </div>
                        <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-gold rounded-full"
                            style={{ width: `${(sender.count / stats.top_senders[0].count) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showConfirm.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-red-500/50 rounded-2xl w-full max-w-md p-6 animate-slide-up">
            <div className="text-center">
              <div className="text-5xl mb-4">⚠️</div>
              <h3 className="text-xl font-semibold text-white mb-2">确认拒绝</h3>
              <p className="text-gray-400 mb-6">确定要拒绝这条弹幕吗？</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm({ show: false, danmakuId: null, action: '' })}
                  className="flex-1 px-4 py-3 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleReject}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
                >
                  确认拒绝
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DanmakuManage
