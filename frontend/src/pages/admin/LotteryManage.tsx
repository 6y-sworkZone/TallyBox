import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { lotteryAPI } from '../../services/api'
import { wsService } from '../../services/websocket'
import type { Lottery, Winner, Prize } from '../../types'
import type { FormEvent } from 'react'

const LotteryManage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>()
  const id = parseInt(eventId || '0')
  const navigate = useNavigate()

  const [lotteries, setLotteries] = useState<Lottery[]>([])
  const [winners, setWinners] = useState<Winner[]>([])
  const [prizes, setPrizes] = useState<Prize[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'lotteries' | 'winners' | 'prizes'>('lotteries')
  const [showModal, setShowModal] = useState(false)
  const [showConfirm, setShowConfirm] = useState<{ show: boolean; id: number | null; type: string }>({ show: false, id: null, type: '' })
  const [showDrawModal, setShowDrawModal] = useState(false)
  const [drawingLottery, setDrawingLottery] = useState<Lottery | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawResult, setDrawResult] = useState<Winner[]>([])
  const [editingLottery, setEditingLottery] = useState<Lottery | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    prize_id: 0,
    winner_count: 1,
    scope_type: 'all' as Lottery['scope_type'],
    scope_value: '',
    draw_type: 'random' as Lottery['draw_type'],
  })

  useEffect(() => {
    if (id) {
      loadData()
      const token = localStorage.getItem('token')
      if (token) {
        wsService.connectAdmin(id, token)
      }
    }
    return () => wsService.disconnectAdmin()
  }, [id])

  const loadData = async () => {
    try {
      setLoading(true)
      const [lotteriesData, winnersData, prizesData] = await Promise.all([
        lotteryAPI.list(id) as unknown as Promise<Lottery[]>,
        lotteryAPI.winners(id) as unknown as Promise<Winner[]>,
        lotteryAPI.prizes() as unknown as Promise<Prize[]>,
      ])
      setLotteries(lotteriesData)
      setWinners(winnersData)
      setPrizes(prizesData)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      if (editingLottery) {
        await lotteryAPI.update(editingLottery.id, formData)
      } else {
        await lotteryAPI.create(id, formData)
      }
      setShowModal(false)
      resetForm()
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
  }

  const handleDraw = async (lottery: Lottery) => {
    setDrawingLottery(lottery)
    setShowDrawModal(true)
    setIsDrawing(true)
    setDrawResult([])

    try {
      const result = await lotteryAPI.draw(lottery.id) as unknown as Winner[]
      setDrawResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '抽奖失败')
    } finally {
      setIsDrawing(false)
    }
  }

  const handleNotify = async (winnerId: number) => {
    try {
      await lotteryAPI.notifyWinner(winnerId)
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '通知失败')
    }
  }

  const handleMarkClaimed = async (winnerId: number) => {
    try {
      await lotteryAPI.markClaimed(winnerId)
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    }
  }

  const handleDelete = async () => {
    if (!showConfirm.id) return
    try {
      if (showConfirm.type === 'lottery') {
        await lotteryAPI.delete(showConfirm.id)
      }
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
    setShowConfirm({ show: false, id: null, type: '' })
  }

  const handleEdit = (lottery: Lottery) => {
    setEditingLottery(lottery)
    setFormData({
      title: lottery.title,
      prize_id: lottery.prize_id,
      winner_count: lottery.winner_count,
      scope_type: lottery.scope_type,
      scope_value: lottery.scope_value || '',
      draw_type: lottery.draw_type,
    })
    setShowModal(true)
  }

  const resetForm = () => {
    setFormData({
      title: '',
      prize_id: 0,
      winner_count: 1,
      scope_type: 'all',
      scope_value: '',
      draw_type: 'random',
    })
    setEditingLottery(null)
  }

  const getPrizeName = (prizeId: number) => {
    return prizes.find((p) => p.id === prizeId)?.name || '未知奖品'
  }

  const getScopeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      all: '全部参与人',
      group: '指定分组',
      exclude_winners: '排除已中奖者',
    }
    return labels[type] || type
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
                <h1 className="text-2xl font-bold text-white glow-text">抽奖管理</h1>
                <p className="text-gray-400 text-sm">
                  共 {lotteries.length} 个抽奖 · {winners.length} 位中奖者
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/admin/events/${id}/prizes`)}
                className="px-4 py-2 bg-dark-card hover:bg-dark-border text-gray-300 rounded-lg transition-colors"
              >
                🎁 奖品管理
              </button>
              <button
                onClick={() => { resetForm(); setShowModal(true) }}
                className="px-4 py-2 bg-gradient-to-r from-primary to-red-600 text-white rounded-lg hover:from-red-600 hover:to-primary transition-all flex items-center gap-2"
              >
                + 创建抽奖
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

        <div className="flex gap-2 mb-6">
          {(['lotteries', 'winners', 'prizes'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-lg transition-colors ${
                activeTab === tab
                  ? 'bg-primary text-white'
                  : 'bg-dark-card text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'lotteries' && '🎰 抽奖列表'}
              {tab === 'winners' && '🏆 中奖记录'}
              {tab === 'prizes' && '🎁 奖品库'}
            </button>
          ))}
        </div>

        {activeTab === 'lotteries' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lotteries.map((lottery) => (
              <div
                key={lottery.id}
                className="bg-dark-card border border-dark-border rounded-xl overflow-hidden hover:border-primary/50 transition-all animate-fade-in"
              >
                <div className={`h-2 ${lottery.is_active ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-gray-600'}`}></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">{lottery.title}</h3>
                      <div className="flex items-center gap-2">
                        {lottery.is_active ? (
                          <span className="px-2 py-0.5 text-xs bg-yellow-900/30 text-yellow-400 rounded animate-pulse">
                            可抽奖
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs bg-gray-700/50 text-gray-400 rounded">
                            已结束
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-gray-400 mb-4">
                    <div className="flex justify-between">
                      <span>奖品</span>
                      <span className="text-gold">{getPrizeName(lottery.prize_id)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>中奖人数</span>
                      <span className="text-white">{lottery.winner_count} 人</span>
                    </div>
                    <div className="flex justify-between">
                      <span>参与范围</span>
                      <span className="text-white">{getScopeTypeLabel(lottery.scope_type)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>抽奖方式</span>
                      <span className="text-white">
                        {lottery.draw_type === 'random' ? '随机抽取' : lottery.draw_type === 'scroll' ? '滚动抽取' : '摇号'}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {lottery.is_active && (
                      <button
                        onClick={() => handleDraw(lottery)}
                        className="flex-1 px-3 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white rounded-lg transition-all text-sm font-semibold"
                      >
                        🎰 开始抽奖
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(lottery)}
                      className="px-3 py-2 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setShowConfirm({ show: true, id: lottery.id, type: 'lottery' })}
                      className="px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'winners' && (
          <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-dark-bg border-b border-dark-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">中奖人</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">奖品</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">抽奖</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">部门</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">中奖时间</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">状态</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {winners.map((winner) => (
                    <tr key={winner.id} className="hover:bg-dark-bg/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold to-yellow-600 flex items-center justify-center text-white font-bold">
                            {winner.participant?.name.charAt(0)}
                          </div>
                          <span className="text-white font-medium">{winner.participant?.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gold">{winner.prize?.name}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {lotteries.find((l) => l.id === winner.lottery_id)?.title}
                      </td>
                      <td className="px-4 py-3 text-gray-400">{winner.participant?.department || '-'}</td>
                      <td className="px-4 py-3 text-gray-400">
                        {new Date(winner.created_at).toLocaleString('zh-CN')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {winner.is_notified ? (
                            <span className="px-2 py-0.5 text-xs bg-green-900/30 text-green-400 rounded">已通知</span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs bg-yellow-900/30 text-yellow-400 rounded">待通知</span>
                          )}
                          {winner.is_claimed ? (
                            <span className="px-2 py-0.5 text-xs bg-green-900/30 text-green-400 rounded">已领取</span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs bg-red-900/30 text-red-400 rounded">待领取</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {!winner.is_notified && (
                            <button
                              onClick={() => handleNotify(winner.id)}
                              className="px-3 py-1 bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 rounded-lg transition-colors text-sm"
                            >
                              通知
                            </button>
                          )}
                          {!winner.is_claimed && (
                            <button
                              onClick={() => handleMarkClaimed(winner.id)}
                              className="px-3 py-1 bg-green-900/30 hover:bg-green-900/50 text-green-400 rounded-lg transition-colors text-sm"
                            >
                              已领取
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {winners.length === 0 && (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">🏆</div>
                <h4 className="text-lg font-semibold text-white mb-2">暂无中奖记录</h4>
                <p className="text-gray-400">开始抽奖后中奖记录将显示在这里</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'prizes' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {prizes.map((prize) => (
              <div
                key={prize.id}
                className="bg-dark-card border border-dark-border rounded-xl p-4 hover:border-gold/50 transition-all"
              >
                <div className="text-4xl mb-3">🎁</div>
                <h4 className="text-white font-semibold mb-1">{prize.name}</h4>
                {prize.description && (
                  <p className="text-gray-400 text-sm mb-3">{prize.description}</p>
                )}
                <div className="text-sm text-gray-400">
                  <div>总数: {prize.total_quantity}</div>
                  <div>已发放: {prize.distributed_quantity}</div>
                  <div className="mt-2 bg-dark-bg rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-gold to-yellow-500"
                      style={{ width: `${(prize.distributed_quantity / prize.total_quantity) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {lotteries.length === 0 && activeTab === 'lotteries' && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎰</div>
            <h3 className="text-xl font-semibold text-white mb-2">还没有抽奖</h3>
            <p className="text-gray-400">点击上方按钮创建您的第一个抽奖</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-lg animate-slide-up">
            <div className="p-6 border-b border-dark-border">
              <h2 className="text-xl font-semibold text-gold">
                {editingLottery ? '编辑抽奖' : '创建抽奖'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">抽奖名称 *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">奖品 *</label>
                  <select
                    value={formData.prize_id}
                    onChange={(e) => setFormData({ ...formData, prize_id: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                    required
                  >
                    <option value={0}>请选择奖品</option>
                    {prizes.map((prize) => (
                      <option key={prize.id} value={prize.id}>
                        {prize.name} (剩余 {prize.total_quantity - prize.distributed_quantity})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">中奖人数</label>
                  <input
                    type="number"
                    value={formData.winner_count}
                    onChange={(e) => setFormData({ ...formData, winner_count: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                    min="1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">参与范围</label>
                  <select
                    value={formData.scope_type}
                    onChange={(e) => setFormData({ ...formData, scope_type: e.target.value as Lottery['scope_type'] })}
                    className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                  >
                    <option value="all">全部参与人</option>
                    <option value="group">指定分组</option>
                    <option value="exclude_winners">排除已中奖者</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">抽奖方式</label>
                  <select
                    value={formData.draw_type}
                    onChange={(e) => setFormData({ ...formData, draw_type: e.target.value as Lottery['draw_type'] })}
                    className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                  >
                    <option value="random">随机抽取</option>
                    <option value="scroll">滚动抽取</option>
                    <option value="摇号">摇号</option>
                  </select>
                </div>
              </div>
              {formData.scope_type === 'group' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">分组名称</label>
                  <input
                    type="text"
                    value={formData.scope_value}
                    onChange={(e) => setFormData({ ...formData, scope_value: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                    placeholder="请输入分组名称"
                  />
                </div>
              )}
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
                  {editingLottery ? '保存修改' : '创建抽奖'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDrawModal && drawingLottery && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-gold/50 rounded-2xl w-full max-w-2xl animate-slide-up gold-border">
            <div className="p-6 border-b border-dark-border text-center">
              <h2 className="text-2xl font-bold text-gold gold-glow">{drawingLottery.title}</h2>
              <p className="text-gray-400 mt-2">
                {isDrawing ? '正在抽奖...' : '抽奖结果'}
              </p>
            </div>
            <div className="p-8">
              {isDrawing ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin text-6xl mb-4">🎰</div>
                  <p className="text-xl text-gold animate-pulse">抽奖中...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-center text-xl font-semibold text-white mb-6">🎉 恭喜以下获奖者！</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {drawResult.map((winner, index) => (
                      <div
                        key={winner.id}
                        className="bg-gradient-to-br from-gold/20 to-yellow-900/20 border border-gold/50 rounded-xl p-4 text-center animate-bounce-in"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-gold to-yellow-600 flex items-center justify-center text-2xl text-white font-bold">
                          {winner.participant?.name.charAt(0)}
                        </div>
                        <div className="text-white font-semibold">{winner.participant?.name}</div>
                        <div className="text-gold text-sm">{winner.participant?.department || '-'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-dark-border">
              <button
                onClick={() => {
                  setShowDrawModal(false)
                  setDrawingLottery(null)
                  setDrawResult([])
                  loadData()
                }}
                className="w-full px-4 py-3 bg-gradient-to-r from-primary to-red-600 text-white font-semibold rounded-lg hover:from-red-600 hover:to-primary transition-all"
                disabled={isDrawing}
              >
                {isDrawing ? '抽奖中...' : '完成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirm.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-red-500/50 rounded-2xl w-full max-w-md p-6 animate-slide-up">
            <div className="text-center">
              <div className="text-5xl mb-4">⚠️</div>
              <h3 className="text-xl font-semibold text-white mb-2">确认删除</h3>
              <p className="text-gray-400 mb-6">确定要删除此抽奖吗？此操作无法撤销。</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm({ show: false, id: null, type: '' })}
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

export default LotteryManage
