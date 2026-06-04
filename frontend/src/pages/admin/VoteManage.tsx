import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { votesAPI } from '../../services/api'
import { wsService } from '../../services/websocket'
import type { Vote, VoteOption, VoteRecord } from '../../types'
import type { FormEvent } from 'react'

interface VoteWithOptions extends Vote {
  options?: VoteOption[]
  records?: VoteRecord[]
}

const VoteManage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>()
  const id = parseInt(eventId || '0')
  const navigate = useNavigate()

  const [votes, setVotes] = useState<VoteWithOptions[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showResultsModal, setShowResultsModal] = useState(false)
  const [showConfirm, setShowConfirm] = useState<{ show: boolean; voteId: number | null; action: string }>({ show: false, voteId: null, action: '' })
  const [editingVote, setEditingVote] = useState<Vote | null>(null)
  const [selectedVote, setSelectedVote] = useState<VoteWithOptions | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    vote_type: 'single' as Vote['vote_type'],
    is_anonymous: false,
    show_results_real_time: true,
    end_time: '',
    max_selections: 1,
    rating_max: 5,
    options: [{ text: '', description: '' }],
  })

  useEffect(() => {
    if (id) {
      loadVotes()
      const token = localStorage.getItem('token')
      if (token) {
        wsService.connectAdmin(id, token)
      }
    }
    return () => wsService.disconnectAdmin()
  }, [id])

  const loadVotes = async () => {
    try {
      setLoading(true)
      const data = await votesAPI.list(id) as unknown as VoteWithOptions[]
      setVotes(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      if (editingVote) {
        await votesAPI.update(editingVote.id, formData)
      } else {
        await votesAPI.create(id, formData)
      }
      setShowModal(false)
      resetForm()
      loadVotes()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
  }

  const handleAddOption = () => {
    setFormData({
      ...formData,
      options: [...formData.options, { text: '', description: '' }],
    })
  }

  const handleRemoveOption = (index: number) => {
    if (formData.options.length <= 2) return
    setFormData({
      ...formData,
      options: formData.options.filter((_, i) => i !== index),
    })
  }

  const handleOptionChange = (index: number, field: string, value: string) => {
    const newOptions = [...formData.options]
    ;(newOptions[index] as any)[field] = value
    setFormData({ ...formData, options: newOptions })
  }

  const handleEdit = (vote: Vote) => {
    setEditingVote(vote)
    setFormData({
      title: vote.title,
      description: vote.description || '',
      vote_type: vote.vote_type,
      is_anonymous: vote.is_anonymous,
      show_results_real_time: vote.show_results_real_time,
      end_time: vote.end_time ? vote.end_time.slice(0, 16) : '',
      max_selections: vote.max_selections || 1,
      rating_max: vote.rating_max || 5,
      options: [{ text: '', description: '' }],
    })
    setShowModal(true)
  }

  const handleViewResults = async (vote: VoteWithOptions) => {
    try {
      const results = await votesAPI.results(vote.id) as unknown as VoteWithOptions
      setSelectedVote(results)
      setShowResultsModal(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载结果失败')
    }
  }

  const handleEndVote = async () => {
    if (!showConfirm.voteId) return
    try {
      await votesAPI.end(showConfirm.voteId)
      loadVotes()
    } catch (err) {
      setError(err instanceof Error ? err.message : '结束投票失败')
    }
    setShowConfirm({ show: false, voteId: null, action: '' })
  }

  const handleDelete = async () => {
    if (!showConfirm.voteId) return
    try {
      await votesAPI.delete(showConfirm.voteId)
      loadVotes()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
    setShowConfirm({ show: false, voteId: null, action: '' })
  }

  const handleExportCSV = async (voteId: number) => {
    try {
      const blob = await votesAPI.exportCSV(voteId) as unknown as Blob
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vote_${voteId}_results.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败')
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      vote_type: 'single',
      is_anonymous: false,
      show_results_real_time: true,
      end_time: '',
      max_selections: 1,
      rating_max: 5,
      options: [{ text: '', description: '' }],
    })
    setEditingVote(null)
  }

  const getVoteTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      single: '单选',
      multiple: '多选',
      rating: '评分',
    }
    return labels[type] || type
  }

  const getTotalVotes = (vote: VoteWithOptions) => {
    return vote.options?.reduce((sum, opt) => sum + opt.vote_count, 0) || 0
  }

  if (loading && votes.length === 0) {
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
                <h1 className="text-2xl font-bold text-white glow-text">投票管理</h1>
                <p className="text-gray-400 text-sm">共 {votes.length} 个投票</p>
              </div>
            </div>
            <button
              onClick={() => { resetForm(); setShowModal(true) }}
              className="px-4 py-2 bg-gradient-to-r from-primary to-red-600 text-white rounded-lg hover:from-red-600 hover:to-primary transition-all flex items-center gap-2"
            >
              + 创建投票
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
          {votes.map((vote) => (
            <div
              key={vote.id}
              className="bg-dark-card border border-dark-border rounded-xl overflow-hidden hover:border-primary/50 transition-all animate-fade-in"
            >
              <div className={`h-2 ${vote.is_active ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gray-600'}`}></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{vote.title}</h3>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded">
                        {getVoteTypeLabel(vote.vote_type)}
                      </span>
                      {vote.is_active ? (
                        <span className="px-2 py-0.5 text-xs bg-green-900/30 text-green-400 rounded animate-pulse">
                          进行中
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs bg-gray-700/50 text-gray-400 rounded">
                          已结束
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {vote.description && (
                  <p className="text-gray-400 text-sm mb-4 line-clamp-2">{vote.description}</p>
                )}

                <div className="space-y-2 text-sm text-gray-400 mb-4">
                  <div className="flex justify-between">
                    <span>总票数</span>
                    <span className="text-gold font-semibold">{getTotalVotes(vote)}</span>
                  </div>
                  {vote.end_time && (
                    <div className="flex justify-between">
                      <span>截止时间</span>
                      <span>{new Date(vote.end_time).toLocaleString('zh-CN')}</span>
                    </div>
                  )}
                  {vote.is_anonymous && (
                    <div className="flex justify-between">
                      <span>投票方式</span>
                      <span className="text-blue-400">匿名投票</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {vote.options?.slice(0, 3).map((opt) => (
                    <span key={opt.id} className="px-2 py-1 bg-dark-bg text-gray-300 text-xs rounded truncate max-w-full">
                      {opt.text}
                    </span>
                  ))}
                  {vote.options && vote.options.length > 3 && (
                    <span className="px-2 py-1 text-xs text-gray-500">+{vote.options.length - 3} 更多</span>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewResults(vote)}
                    className="flex-1 px-3 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-colors text-sm"
                  >
                    查看结果
                  </button>
                  {vote.is_active && (
                    <button
                      onClick={() => setShowConfirm({ show: true, voteId: vote.id, action: 'end' })}
                      className="px-3 py-2 bg-yellow-900/30 hover:bg-yellow-900/50 text-yellow-400 rounded-lg transition-colors text-sm"
                    >
                      结束
                    </button>
                  )}
                  <button
                    onClick={() => handleExportCSV(vote.id)}
                    className="px-3 py-2 bg-green-900/30 hover:bg-green-900/50 text-green-400 rounded-lg transition-colors text-sm"
                  >
                    📊
                  </button>
                  <button
                    onClick={() => handleEdit(vote)}
                    className="px-3 py-2 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => setShowConfirm({ show: true, voteId: vote.id, action: 'delete' })}
                    className="px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {votes.length === 0 && !loading && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🗳️</div>
            <h3 className="text-xl font-semibold text-white mb-2">还没有投票</h3>
            <p className="text-gray-400">点击上方按钮创建您的第一个投票</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="p-6 border-b border-dark-border">
              <h2 className="text-xl font-semibold text-gold">
                {editingVote ? '编辑投票' : '创建投票'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">投票标题 *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">投票描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">投票类型</label>
                  <select
                    value={formData.vote_type}
                    onChange={(e) => setFormData({ ...formData, vote_type: e.target.value as Vote['vote_type'] })}
                    className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                  >
                    <option value="single">单选</option>
                    <option value="multiple">多选</option>
                    <option value="rating">评分</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">截止时间</label>
                  <input
                    type="datetime-local"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              {formData.vote_type === 'multiple' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">最多可选数量</label>
                  <input
                    type="number"
                    value={formData.max_selections}
                    onChange={(e) => setFormData({ ...formData, max_selections: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                    min="2"
                  />
                </div>
              )}
              {formData.vote_type === 'rating' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">最高分</label>
                  <input
                    type="number"
                    value={formData.rating_max}
                    onChange={(e) => setFormData({ ...formData, rating_max: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                    min="5"
                    max="10"
                  />
                </div>
              )}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_anonymous}
                    onChange={(e) => setFormData({ ...formData, is_anonymous: e.target.checked })}
                    className="w-4 h-4 rounded border-dark-border bg-dark-bg text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-300">匿名投票</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.show_results_real_time}
                    onChange={(e) => setFormData({ ...formData, show_results_real_time: e.target.checked })}
                    className="w-4 h-4 rounded border-dark-border bg-dark-bg text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-300">实时显示结果</span>
                </label>
              </div>
              {formData.vote_type !== 'rating' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-300">投票选项 *</label>
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="text-sm text-primary hover:text-primary/80"
                    >
                      + 添加选项
                    </button>
                  </div>
                  <div className="space-y-3">
                    {formData.options.map((option, index) => (
                      <div key={index} className="flex gap-2">
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder={`选项 ${index + 1}`}
                            value={option.text}
                            onChange={(e) => handleOptionChange(index, 'text', e.target.value)}
                            className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                            required
                          />
                        </div>
                        {formData.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(index)}
                            className="px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
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
                  {editingVote ? '保存修改' : '创建投票'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showResultsModal && selectedVote && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="p-6 border-b border-dark-border">
              <h2 className="text-xl font-semibold text-gold">{selectedVote.title} - 投票结果</h2>
              <p className="text-gray-400 text-sm mt-1">总票数: {getTotalVotes(selectedVote)}</p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {selectedVote.options?.map((option) => {
                  const total = getTotalVotes(selectedVote)
                  const percentage = total > 0 ? (option.vote_count / total) * 100 : 0
                  return (
                    <div key={option.id} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-white">{option.text}</span>
                        <span className="text-gold">{option.vote_count} 票 ({percentage.toFixed(1)}%)</span>
                      </div>
                      <div className="h-3 bg-dark-bg rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-gold rounded-full bar-grow"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="p-6 border-t border-dark-border">
              <button
                onClick={() => { setShowResultsModal(false); setSelectedVote(null) }}
                className="w-full px-4 py-3 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors"
              >
                关闭
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
              <h3 className="text-xl font-semibold text-white mb-2">确认操作</h3>
              <p className="text-gray-400 mb-6">
                {showConfirm.action === 'delete'
                  ? '确定要删除此投票吗？此操作无法撤销。'
                  : '确定要结束此投票吗？结束后将无法继续投票。'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm({ show: false, voteId: null, action: '' })}
                  className="flex-1 px-4 py-3 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={showConfirm.action === 'delete' ? handleDelete : handleEndVote}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
                >
                  确认{showConfirm.action === 'delete' ? '删除' : '结束'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VoteManage
