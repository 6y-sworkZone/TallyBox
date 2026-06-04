import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as echarts from 'echarts'
import { dataAPI } from '../../services/api'
import { wsService } from '../../services/websocket'
import type { DashboardStats } from '../../types'

interface EngagementData {
  step_type: string
  title: string
  participation_count: number
  participation_rate: number
}

interface LeaderboardEntry {
  participant_id: number
  name: string
  department?: string
  activity_score: number
  check_in: boolean
  vote_count: number
  danmaku_count: number
}

interface EventComparison {
  id: number
  name: string
  date: string
  total_participants: number
  check_in_rate: number
  vote_count: number
  danmaku_count: number
}

const DataOverview: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>()
  const id = parseInt(eventId || '0')
  const navigate = useNavigate()

  const [dashboard, setDashboard] = useState<DashboardStats | null>(null)
  const [engagement, setEngagement] = useState<EngagementData[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [comparison, setComparison] = useState<EventComparison[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exportType, setExportType] = useState<'json' | 'csv' | null>(null)
  const [generatingReport, setGeneratingReport] = useState(false)

  const engagementChartRef = useRef<HTMLDivElement>(null)
  const comparisonChartRef = useRef<HTMLDivElement>(null)
  const engagementChartInstance = useRef<echarts.ECharts | null>(null)
  const comparisonChartInstance = useRef<echarts.ECharts | null>(null)

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
      if (engagementChartInstance.current) {
        engagementChartInstance.current.dispose()
      }
      if (comparisonChartInstance.current) {
        comparisonChartInstance.current.dispose()
      }
    }
  }, [id])

  useEffect(() => {
    if (engagement.length > 0) {
      initEngagementChart()
    }
  }, [engagement])

  useEffect(() => {
    if (comparison.length > 0) {
      initComparisonChart()
    }
  }, [comparison])

  const loadData = async () => {
    try {
      setLoading(true)
      const [dashboardData, engagementData, leaderboardData, comparisonData] = await Promise.all([
        dataAPI.dashboard(id) as unknown as Promise<DashboardStats>,
        dataAPI.engagement(id) as unknown as Promise<EngagementData[]>,
        dataAPI.leaderboard(id) as unknown as Promise<LeaderboardEntry[]>,
        dataAPI.compare() as unknown as Promise<EventComparison[]>,
      ])
      setDashboard(dashboardData)
      setEngagement(engagementData)
      setLeaderboard(leaderboardData)
      setComparison(comparisonData)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const initEngagementChart = () => {
    if (!engagementChartRef.current) return

    if (engagementChartInstance.current) {
      engagementChartInstance.current.dispose()
    }

    engagementChartInstance.current = echarts.init(engagementChartRef.current)

    const stepLabels = engagement.map((e) => e.title)
    const counts = engagement.map((e) => e.participation_count)
    const rates = engagement.map((e) => e.participation_rate)

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(30, 41, 59, 0.9)',
        borderColor: '#334155',
        textStyle: { color: '#fff' },
        axisPointer: {
          type: 'shadow',
        },
      },
      legend: {
        data: ['参与人数', '参与率'],
        textStyle: { color: '#9CA3AF' },
        top: 0,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: stepLabels,
        axisLine: { lineStyle: { color: '#334155' } },
        axisLabel: { color: '#9CA3AF', rotate: 30 },
      },
      yAxis: [
        {
          type: 'value',
          name: '参与人数',
          axisLine: { lineStyle: { color: '#334155' } },
          axisLabel: { color: '#9CA3AF' },
          splitLine: { lineStyle: { color: '#1E293B' } },
        },
        {
          type: 'value',
          name: '参与率',
          min: 0,
          max: 100,
          axisLine: { lineStyle: { color: '#334155' } },
          axisLabel: { color: '#9CA3AF', formatter: '{value}%' },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '参与人数',
          type: 'bar',
          data: counts,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#E53935' },
              { offset: 1, color: 'rgba(229, 57, 53, 0.3)' },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
          barWidth: '40%',
        },
        {
          name: '参与率',
          type: 'line',
          yAxisIndex: 1,
          data: rates,
          smooth: true,
          lineStyle: {
            color: '#FFD700',
            width: 3,
          },
          itemStyle: {
            color: '#FFD700',
          },
          symbol: 'circle',
          symbolSize: 8,
        },
      ],
    }

    engagementChartInstance.current.setOption(option)
  }

  const initComparisonChart = () => {
    if (!comparisonChartRef.current) return

    if (comparisonChartInstance.current) {
      comparisonChartInstance.current.dispose()
    }

    comparisonChartInstance.current = echarts.init(comparisonChartRef.current)

    const eventNames = comparison.map((e) => e.name)
    const checkInRates = comparison.map((e) => e.check_in_rate)
    const voteCounts = comparison.map((e) => e.vote_count)
    const danmakuCounts = comparison.map((e) => e.danmaku_count)

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(30, 41, 59, 0.9)',
        borderColor: '#334155',
        textStyle: { color: '#fff' },
      },
      legend: {
        data: ['签到率', '投票数', '弹幕数'],
        textStyle: { color: '#9CA3AF' },
        top: 0,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: eventNames,
        axisLine: { lineStyle: { color: '#334155' } },
        axisLabel: { color: '#9CA3AF', rotate: 30 },
      },
      yAxis: [
        {
          type: 'value',
          name: '签到率(%)',
          min: 0,
          max: 100,
          axisLine: { lineStyle: { color: '#334155' } },
          axisLabel: { color: '#9CA3AF', formatter: '{value}%' },
          splitLine: { lineStyle: { color: '#1E293B' } },
        },
        {
          type: 'value',
          name: '数量',
          axisLine: { lineStyle: { color: '#334155' } },
          axisLabel: { color: '#9CA3AF' },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '签到率',
          type: 'bar',
          data: checkInRates,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#E53935' },
              { offset: 1, color: 'rgba(229, 57, 53, 0.3)' },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
          barWidth: '25%',
        },
        {
          name: '投票数',
          type: 'line',
          yAxisIndex: 1,
          data: voteCounts,
          smooth: true,
          lineStyle: {
            color: '#FFD700',
            width: 3,
          },
          itemStyle: {
            color: '#FFD700',
          },
          symbol: 'circle',
          symbolSize: 8,
        },
        {
          name: '弹幕数',
          type: 'line',
          yAxisIndex: 1,
          data: danmakuCounts,
          smooth: true,
          lineStyle: {
            color: '#10B981',
            width: 3,
          },
          itemStyle: {
            color: '#10B981',
          },
          symbol: 'diamond',
          symbolSize: 8,
        },
      ],
    }

    comparisonChartInstance.current.setOption(option)
  }

  const handleGenerateReport = async () => {
    try {
      setGeneratingReport(true)
      const blob = await dataAPI.report(id) as unknown as Blob
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `活动报告_${new Date().toLocaleDateString('zh-CN')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成报告失败')
    } finally {
      setGeneratingReport(false)
    }
  }

  const handleExport = async (type: 'json' | 'csv') => {
    try {
      setExportType(type)
      const blob = type === 'json' 
        ? await dataAPI.exportJSON(id) as unknown as Blob
        : await dataAPI.exportCSV(id) as unknown as Blob
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `活动数据_${new Date().toLocaleDateString('zh-CN')}.${type}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败')
    } finally {
      setExportType(null)
    }
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
                <h1 className="text-2xl font-bold text-white glow-text">数据总览</h1>
                <p className="text-gray-400 text-sm">活动数据分析与可视化</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleExport('csv')}
                disabled={exportType !== null}
                className="px-4 py-2 bg-dark-card hover:bg-dark-border text-gray-300 rounded-lg transition-colors disabled:opacity-50"
              >
                {exportType === 'csv' ? '导出中...' : '📊 导出CSV'}
              </button>
              <button
                onClick={() => handleExport('json')}
                disabled={exportType !== null}
                className="px-4 py-2 bg-dark-card hover:bg-dark-border text-gray-300 rounded-lg transition-colors disabled:opacity-50"
              >
                {exportType === 'json' ? '导出中...' : '📄 导出JSON'}
              </button>
              <button
                onClick={handleGenerateReport}
                disabled={generatingReport}
                className="px-6 py-2 bg-gradient-to-r from-primary to-red-600 hover:from-red-600 hover:to-primary text-white rounded-lg transition-all disabled:opacity-50"
              >
                {generatingReport ? '生成中...' : '📑 生成PDF报告'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {dashboard && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-dark-card border border-dark-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">👥</span>
                </div>
                <span className="text-green-400 text-sm">+12%</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{dashboard.total_participants}</div>
              <div className="text-gray-400 text-sm">参与人数</div>
            </div>
            <div className="bg-dark-card border border-dark-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gold/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">🗳️</span>
                </div>
                <span className="text-green-400 text-sm">+8%</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{dashboard.total_votes}</div>
              <div className="text-gray-400 text-sm">投票次数</div>
            </div>
            <div className="bg-dark-card border border-dark-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">💬</span>
                </div>
                <span className="text-green-400 text-sm">+25%</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{dashboard.total_danmaku}</div>
              <div className="text-gray-400 text-sm">弹幕数量</div>
            </div>
            <div className="bg-dark-card border border-dark-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
                <span className="text-green-400 text-sm">{dashboard.check_in_rate}%</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{dashboard.check_in_rate}%</div>
              <div className="text-gray-400 text-sm">签到率</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-dark-card border border-dark-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gold mb-4">各环节参与度</h3>
            <div ref={engagementChartRef} className="h-80"></div>
          </div>
          <div className="bg-dark-card border border-dark-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gold mb-4">历史活动对比</h3>
            <div ref={comparisonChartRef} className="h-80"></div>
          </div>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gold mb-6">参与人活跃度排行榜</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-bg border-b border-dark-border">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">排名</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">姓名</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">部门</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">签到</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">投票</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">弹幕</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">活跃度</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {leaderboard.slice(0, 10).map((entry, index) => (
                  <tr key={entry.participant_id} className="hover:bg-dark-bg/50 transition-colors">
                    <td className="px-4 py-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                        index === 0 ? 'bg-gold' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-700' : 'bg-dark-bg'
                      }`}>
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-white font-medium">{entry.name}</td>
                    <td className="px-4 py-4 text-gray-400">{entry.department || '-'}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 text-xs rounded ${entry.check_in ? 'bg-green-900/30 text-green-400' : 'bg-gray-700/30 text-gray-400'}`}>
                        {entry.check_in ? '已签到' : '未签到'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-300">{entry.vote_count} 次</td>
                    <td className="px-4 py-4 text-gray-300">{entry.danmaku_count} 条</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-dark-bg rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-gold rounded-full"
                            style={{ width: `${Math.min(entry.activity_score, 100)}%` }}
                          />
                        </div>
                        <span className="text-gold font-semibold">{entry.activity_score}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {leaderboard.length === 0 && (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">📊</div>
              <h4 className="text-lg font-semibold text-white mb-2">暂无活跃数据</h4>
              <p className="text-gray-400">活动进行后将显示参与人活跃度排行</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DataOverview
