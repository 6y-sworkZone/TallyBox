import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as echarts from 'echarts'
import { checkinAPI } from '../../services/api'
import { wsService } from '../../services/websocket'
import type { CheckInStats, Participant } from '../../types'

const CheckInManage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>()
  const id = parseInt(eventId || '0')
  const navigate = useNavigate()

  const [stats, setStats] = useState<CheckInStats | null>(null)
  const [history, setHistory] = useState<Participant[]>([])
  const [qrCode, setQrCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showQrModal, setShowQrModal] = useState(false)

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
    if (stats) {
      initChart()
    }
  }, [stats])

  const loadData = async () => {
    try {
      setLoading(true)
      const [statsData, historyData, qrData] = await Promise.all([
        checkinAPI.stats(id) as unknown as Promise<CheckInStats>,
        checkinAPI.history(id) as unknown as Promise<Participant[]>,
        checkinAPI.qrCode(id) as unknown as Promise<string>,
      ])
      setStats(statsData)
      setHistory(historyData)
      setQrCode(qrData)
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

    const departments = Object.keys(stats.by_department)
    const totalData = departments.map((d) => stats.by_department[d].total)
    const checkedInData = departments.map((d) => stats.by_department[d].checked_in)

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(30, 41, 59, 0.9)',
        borderColor: '#334155',
        textStyle: { color: '#fff' },
      },
      legend: {
        data: ['总人数', '已签到'],
        textStyle: { color: '#9CA3AF' },
        top: 0,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: departments,
        axisLine: { lineStyle: { color: '#334155' } },
        axisLabel: { color: '#9CA3AF', rotate: 30 },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#334155' } },
        axisLabel: { color: '#9CA3AF' },
        splitLine: { lineStyle: { color: '#1E293B' } },
      },
      series: [
        {
          name: '总人数',
          type: 'bar',
          data: totalData,
          itemStyle: { color: '#334155', borderRadius: [4, 4, 0, 0] },
          barWidth: '35%',
        },
        {
          name: '已签到',
          type: 'bar',
          data: checkedInData,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#E53935' },
              { offset: 1, color: '#FFD700' },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
          barWidth: '35%',
        },
      ],
    }

    chartInstance.current.setOption(option)
  }

  const handleExportCSV = async () => {
    try {
      const blob = await checkinAPI.exportCSV(id) as unknown as Blob
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `checkin_records_${id}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败')
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
                <h1 className="text-2xl font-bold text-white glow-text">签到管理</h1>
                <p className="text-gray-400 text-sm">
                  签到率: {stats?.check_in_rate.toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowQrModal(true)}
                className="px-4 py-2 bg-dark-card hover:bg-dark-border text-gray-300 rounded-lg transition-colors flex items-center gap-2"
              >
                📱 签到二维码
              </button>
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-gradient-to-r from-primary to-red-600 text-white rounded-lg hover:from-red-600 hover:to-primary transition-all flex items-center gap-2"
              >
                📊 导出CSV
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

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-dark-card border border-dark-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">总人数</span>
                <span className="text-2xl">👥</span>
              </div>
              <div className="text-3xl font-bold text-white">{stats.total}</div>
            </div>
            <div className="bg-dark-card border border-dark-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">已签到</span>
                <span className="text-2xl">✅</span>
              </div>
              <div className="text-3xl font-bold text-green-400">{stats.checked_in}</div>
            </div>
            <div className="bg-dark-card border border-dark-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">未签到</span>
                <span className="text-2xl">⏳</span>
              </div>
              <div className="text-3xl font-bold text-yellow-400">{stats.not_checked_in}</div>
            </div>
            <div className="bg-dark-card border border-dark-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">迟到</span>
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="text-3xl font-bold text-red-400">{stats.late_count}</div>
            </div>
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-dark-card border border-dark-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gold mb-4">签到进度</h3>
              <div className="mb-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">总体签到率</span>
                  <span className="text-gold font-bold text-xl">{stats?.check_in_rate.toFixed(1)}%</span>
                </div>
                <div className="h-4 bg-dark-bg rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-gold rounded-full bar-grow"
                    style={{ width: `${stats?.check_in_rate}%` }}
                  />
                </div>
              </div>
              <div className="space-y-3">
                {Object.entries(stats.by_department).map(([dept, data]) => {
                  const rate = data.total > 0 ? (data.checked_in / data.total) * 100 : 0
                  return (
                    <div key={dept}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-300">{dept}</span>
                        <span className="text-gray-400">{data.checked_in}/{data.total}</span>
                      </div>
                      <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-gold rounded-full"
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-dark-card border border-dark-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gold mb-4">各部门签到统计</h3>
              <div ref={chartRef} className="h-72"></div>
            </div>
          </div>
        )}

        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          <div className="p-6 border-b border-dark-border">
            <h3 className="text-lg font-semibold text-gold">签到记录</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-bg border-b border-dark-border">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">姓名</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">部门</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">桌号</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">状态</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">签到时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {history.map((participant) => (
                  <tr key={participant.id} className="hover:bg-dark-bg/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${participant.is_checked_in ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-gray-500 to-gray-600'}`}>
                          {participant.name.charAt(0)}
                        </div>
                        <span className="text-white font-medium">{participant.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{participant.department || '-'}</td>
                    <td className="px-4 py-3 text-gray-400">{participant.table_number || '-'}</td>
                    <td className="px-4 py-3">
                      {participant.is_checked_in ? (
                        <span className={`px-2 py-1 rounded-full text-xs ${participant.is_late ? 'bg-yellow-900/30 text-yellow-400' : 'bg-green-900/30 text-green-400'}`}>
                          {participant.is_late ? '迟到' : '已签到'}
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-700/50 text-gray-400 rounded-full text-xs">
                          未签到
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {participant.check_in_time ? new Date(participant.check_in_time).toLocaleString('zh-CN') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {history.length === 0 && (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">✅</div>
              <h4 className="text-lg font-semibold text-white mb-2">暂无签到记录</h4>
              <p className="text-gray-400">参与者签到后记录将显示在这里</p>
            </div>
          )}
        </div>
      </div>

      {showQrModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-md animate-slide-up">
            <div className="p-6 border-b border-dark-border">
              <h2 className="text-xl font-semibold text-gold text-center">签到二维码</h2>
              <p className="text-gray-400 text-sm text-center mt-1">扫描二维码完成签到</p>
            </div>
            <div className="p-8">
              <div className="bg-white p-4 rounded-xl mx-auto" style={{ width: 'fit-content' }} dangerouslySetInnerHTML={{ __html: qrCode }} />
              <p className="text-center text-gray-400 text-sm mt-6">或使用参与码在移动端签到</p>
            </div>
            <div className="p-6 border-t border-dark-border">
              <button
                onClick={() => setShowQrModal(false)}
                className="w-full px-4 py-3 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CheckInManage
