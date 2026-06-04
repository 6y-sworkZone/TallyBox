import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { lotteryAPI } from '../../services/api'
import { wsService } from '../../services/websocket'
import type { Prize } from '../../types'

const PrizeManage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>()
  const id = parseInt(eventId || '0')
  const navigate = useNavigate()

  const [prizes, setPrizes] = useState<Prize[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null)
  const [showConfirm, setShowConfirm] = useState<{ show: boolean; prizeId: number | null; action: string }>({ show: false, prizeId: null, action: '' })

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image_url: '',
    total_quantity: 1,
  })

  useEffect(() => {
    loadPrizes()
    return () => {
      wsService.disconnectAdmin()
    }
  }, [])

  const loadPrizes = async () => {
    try {
      setLoading(true)
      const data = await lotteryAPI.prizes() as unknown as Prize[]
      setPrizes(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    try {
      if (editingPrize) {
        await lotteryAPI.updatePrize(editingPrize.id, formData)
      } else {
        await lotteryAPI.createPrize(formData)
      }
      loadPrizes()
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
  }

  const handleEdit = (prize: Prize) => {
    setEditingPrize(prize)
    setFormData({
      name: prize.name,
      description: prize.description || '',
      image_url: prize.image_url || '',
      total_quantity: prize.total_quantity,
    })
    setShowModal(true)
  }

  const handleDelete = async () => {
    if (!showConfirm.prizeId) return
    try {
      await lotteryAPI.deletePrize(showConfirm.prizeId)
      loadPrizes()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
    setShowConfirm({ show: false, prizeId: null, action: '' })
  }

  const handleMarkDistributed = async (prizeId: number) => {
    try {
      await lotteryAPI.markDistributed(prizeId)
      loadPrizes()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingPrize(null)
    setFormData({
      name: '',
      description: '',
      image_url: '',
      total_quantity: 1,
    })
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
                onClick={() => navigate(`/admin/events/${id}/lottery`)}
                className="p-2 hover:bg-dark-card rounded-lg transition-colors"
              >
                ←
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white glow-text">奖品管理</h1>
                <p className="text-gray-400 text-sm">管理奖品库，共 {prizes.length} 个奖品</p>
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-2 bg-gradient-to-r from-primary to-red-600 hover:from-red-600 hover:to-primary text-white rounded-lg transition-all"
            >
              ➕ 添加奖品
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {prizes.map((prize) => (
            <div
              key={prize.id}
              className="bg-dark-card border border-dark-border rounded-xl overflow-hidden hover:border-primary/50 transition-all group"
            >
              <div className="relative h-48 bg-dark-bg overflow-hidden">
                {prize.image_url ? (
                  <img
                    src={prize.image_url}
                    alt={prize.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-primary/20 to-gold/20">
                    🎁
                  </div>
                )}
                <div className="absolute top-3 right-3">
                  <span className="px-3 py-1 bg-dark-bg/80 backdrop-blur-sm text-gold text-sm font-semibold rounded-full">
                    库存 {prize.total_quantity - prize.distributed_quantity}/{prize.total_quantity}
                  </span>
                </div>
              </div>
              <div className="p-5">
                <h3 className="text-lg font-bold text-white mb-2">{prize.name}</h3>
                {prize.description && (
                  <p className="text-gray-400 text-sm mb-4 line-clamp-2">{prize.description}</p>
                )}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">发放进度</span>
                    <span className="text-gold">{prize.distributed_quantity}/{prize.total_quantity}</span>
                  </div>
                  <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-gold rounded-full transition-all"
                      style={{ width: `${(prize.distributed_quantity / prize.total_quantity) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(prize)}
                    className="flex-1 px-4 py-2 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors text-sm"
                  >
                    ✏️ 编辑
                  </button>
                  {prize.distributed_quantity < prize.total_quantity && (
                    <button
                      onClick={() => handleMarkDistributed(prize.id)}
                      className="flex-1 px-4 py-2 bg-green-900/30 hover:bg-green-900/50 text-green-400 rounded-lg transition-colors text-sm"
                    >
                      ✅ 标记已发
                    </button>
                  )}
                  <button
                    onClick={() => setShowConfirm({ show: true, prizeId: prize.id, action: 'delete' })}
                    className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors text-sm"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {prizes.length === 0 && (
          <div className="bg-dark-card border border-dark-border rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">🎁</div>
            <h3 className="text-xl font-semibold text-white mb-2">奖品库为空</h3>
            <p className="text-gray-400 mb-6">添加奖品后可用于抽奖环节</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-primary to-red-600 hover:from-red-600 hover:to-primary text-white rounded-lg transition-all"
            >
              添加第一个奖品
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-lg animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-dark-border">
              <h3 className="text-xl font-bold text-white">
                {editingPrize ? '编辑奖品' : '添加奖品'}
              </h3>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-dark-bg rounded-lg transition-colors text-gray-400"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">奖品名称 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                  placeholder="请输入奖品名称"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">奖品描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary resize-none"
                  rows={3}
                  placeholder="请输入奖品描述"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">奖品图片URL</label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">总数 *</label>
                <input
                  type="number"
                  value={formData.total_quantity}
                  onChange={(e) => setFormData({ ...formData, total_quantity: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                  min="1"
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-6 py-3 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-primary to-red-600 hover:from-red-600 hover:to-primary text-white font-semibold rounded-lg transition-all"
                >
                  {editingPrize ? '保存修改' : '添加奖品'}
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
              <h3 className="text-xl font-semibold text-white mb-2">确认删除</h3>
              <p className="text-gray-400 mb-6">确定要删除这个奖品吗？此操作不可恢复。</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm({ show: false, prizeId: null, action: '' })}
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

export default PrizeManage
