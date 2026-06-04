import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { scoringAPI } from '../../services/api'
import { wsService } from '../../services/websocket'
import type { Scoring, ScoringDimension, JudgeScore } from '../../types'

interface Judge {
  name: string
}

interface Dimension {
  name: string
  description: string
  weight: number
  max_score: number
}

interface ResultEntry {
  target_name: string
  average_score: number
  scores: JudgeScore[]
}

interface ScoringWithDetails extends Scoring {
  judges?: Judge[]
  dimensions?: ScoringDimension[]
  results?: ResultEntry[]
}

const ScoringManage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>()
  const id = parseInt(eventId || '0')
  const navigate = useNavigate()

  const [scorings, setScorings] = useState<ScoringWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingScoring, setEditingScoring] = useState<ScoringWithDetails | null>(null)
  const [showResultsModal, setShowResultsModal] = useState(false)
  const [selectedScoring, setSelectedScoring] = useState<ScoringWithDetails | null>(null)
  const [showConfirm, setShowConfirm] = useState<{ show: boolean; scoringId: number | null; action: string }>({ show: false, scoringId: null, action: '' })

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    judges: [{ name: '' }] as Judge[],
    dimensions: [{ name: '', description: '', weight: 25, max_score: 100 }] as Dimension[],
  })

  useEffect(() => {
    if (id) {
      loadScorings()
      const token = localStorage.getItem('token')
      if (token) {
        wsService.connectAdmin(id, token)
      }
    }
    return () => {
      wsService.disconnectAdmin()
    }
  }, [id])

  const loadScorings = async () => {
    try {
      setLoading(true)
      const data = await scoringAPI.list(id) as unknown as ScoringWithDetails[]
      setScorings(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const totalWeight = formData.dimensions.reduce((sum, d) => sum + d.weight, 0)

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      judges: [{ name: '' }],
      dimensions: [{ name: '', description: '', weight: 25, max_score: 100 }],
    })
    setEditingScoring(null)
  }

  const handleAddJudge = () => {
    setFormData({ ...formData, judges: [...formData.judges, { name: '' }] })
  }

  const handleRemoveJudge = (index: number) => {
    const newJudges = formData.judges.filter((_, i) => i !== index)
    setFormData({ ...formData, judges: newJudges })
  }

  const handleJudgeChange = (index: number, value: string) => {
    const newJudges = [...formData.judges]
    newJudges[index] = { name: value }
    setFormData({ ...formData, judges: newJudges })
  }

  const handleAddDimension = () => {
    const remainingWeight = Math.max(0, 100 - totalWeight)
    setFormData({
      ...formData,
      dimensions: [...formData.dimensions, { name: '', description: '', weight: remainingWeight, max_score: 100 }],
    })
  }

  const handleRemoveDimension = (index: number) => {
    const newDimensions = formData.dimensions.filter((_, i) => i !== index)
    setFormData({ ...formData, dimensions: newDimensions })
  }

  const handleDimensionChange = (index: number, field: keyof Dimension, value: string | number) => {
    const newDimensions = [...formData.dimensions]
    newDimensions[index] = { ...newDimensions[index], [field]: value }
    setFormData({ ...formData, dimensions: newDimensions })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return
    if (totalWeight !== 100) {
      setError('维度权重合计必须为100%')
      return
    }

    try {
      const submitData = {
        ...formData,
        judges: formData.judges.filter((j) => j.name.trim()),
        dimensions: formData.dimensions.filter((d) => d.name.trim()),
      }

      if (editingScoring) {
        await scoringAPI.update(editingScoring.id, submitData)
      } else {
        await scoringAPI.create(id, submitData)
      }
      loadScorings()
      setShowModal(false)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
  }

  const handleEdit = (scoring: ScoringWithDetails) => {
    setEditingScoring(scoring)
    setFormData({
      name: scoring.name,
      description: scoring.description || '',
      judges: scoring.judges?.length ? scoring.judges : [{ name: '' }],
      dimensions: scoring.dimensions?.length
        ? scoring.dimensions.map((d) => ({
            name: d.name,
            description: d.description || '',
            weight: d.weight,
            max_score: d.max_score,
          }))
        : [{ name: '', description: '', weight: 25, max_score: 100 }],
    })
    setShowModal(true)
  }

  const handleDelete = async () => {
    if (!showConfirm.scoringId) return
    try {
      await scoringAPI.delete(showConfirm.scoringId)
      loadScorings()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
    setShowConfirm({ show: false, scoringId: null, action: '' })
  }

  const handleViewResults = async (scoring: ScoringWithDetails) => {
    try {
      const results = await scoringAPI.results(scoring.id) as unknown as ResultEntry[]
      setSelectedScoring({ ...scoring, results })
      setShowResultsModal(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载结果失败')
    }
  }

  const handleExportCSV = async (scoringId: number) => {
    try {
      const blob = await scoringAPI.exportCSV(scoringId) as unknown as Blob
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `评分结果_${new Date().toLocaleDateString('zh-CN')}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败')
    }
  }

  const calculateFinalScore = (scores: JudgeScore[], dimensions: ScoringDimension[]) => {
    const judgeGroups: Record<string, Record<number, number>> = {}
    scores.forEach((s) => {
      if (!judgeGroups[s.judge_name]) {
        judgeGroups[s.judge_name] = {}
      }
      judgeGroups[s.judge_name][s.dimension_id] = s.score
    })

    const judgeScores = Object.values(judgeGroups).map((judgeDimScores) => {
      let total = 0
      dimensions.forEach((dim) => {
        const score = judgeDimScores[dim.id] || 0
        total += score * (dim.weight / 100)
      })
      return total
    })

    if (judgeScores.length <= 2) {
      return judgeScores.reduce((a, b) => a + b, 0) / judgeScores.length
    }
    const sorted = [...judgeScores].sort((a, b) => a - b)
    const trimmed = sorted.slice(1, -1)
    return trimmed.reduce((a, b) => a + b, 0) / trimmed.length
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
              <button onClick={() => navigate(`/admin/events/${id}`)} className="p-2 hover:bg-dark-card rounded-lg transition-colors">
                ←
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white glow-text">评分管理</h1>
                <p className="text-gray-400 text-sm">共 {scorings.length} 个评分项</p>
              </div>
            </div>
            <button onClick={() => { resetForm(); setShowModal(true) }} className="px-4 py-2 bg-gradient-to-r from-primary to-red-600 text-white rounded-lg hover:from-red-600 hover:to-primary transition-all flex items-center gap-2">
              + 创建评分
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
          {scorings.map((scoring) => (
            <div key={scoring.id} className="bg-dark-card border border-dark-border rounded-xl p-5 hover:border-primary/50 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-bold text-white">{scoring.name}</h3>
                  {scoring.description && (
                    <p className="text-gray-400 text-sm mt-1 line-clamp-2">{scoring.description}</p>
                  )}
                </div>
                <span className={`px-2 py-1 text-xs rounded ${scoring.is_active ? 'bg-green-900/30 text-green-400' : 'bg-gray-700/30 text-gray-400'}`}>
                  {scoring.is_active ? '进行中' : '已结束'}
                </span>
              </div>
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">评委数</span>
                  <span className="text-white">{scoring.judges?.length || 0} 人</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">评分维度</span>
                  <span className="text-white">{scoring.dimensions?.length || 0} 个</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleViewResults(scoring)} className="flex-1 px-3 py-2 bg-gold/20 hover:bg-gold/30 text-gold rounded-lg transition-colors text-sm">
                  📊 查看结果
                </button>
                <button onClick={() => handleEdit(scoring)} className="px-3 py-2 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors text-sm">
                  ✏️
                </button>
                <button onClick={() => handleExportCSV(scoring.id)} className="px-3 py-2 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors text-sm">
                  📥
                </button>
                <button onClick={() => setShowConfirm({ show: true, scoringId: scoring.id, action: 'delete' })} className="px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors text-sm">
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>

        {scorings.length === 0 && (
          <div className="bg-dark-card border border-dark-border rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold text-white mb-2">暂无评分项</h3>
            <p className="text-gray-400 mb-6">创建评分项用于评委打分环节</p>
            <button onClick={() => { resetForm(); setShowModal(true) }} className="px-6 py-3 bg-gradient-to-r from-primary to-red-600 hover:from-red-600 hover:to-primary text-white rounded-lg transition-all">
              创建第一个评分
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="p-6 border-b border-dark-border">
              <h2 className="text-xl font-semibold text-gold">
                {editingScoring ? '编辑评分' : '创建评分'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">评分名称 *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">评分描述</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary resize-none" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">评委列表 *</label>
                  <button type="button" onClick={handleAddJudge} className="text-sm text-primary hover:text-primary/80">
                    + 添加评委
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.judges.map((judge, index) => (
                    <div key={index} className="flex gap-2">
                      <input type="text" placeholder={`评委 ${index + 1}`} value={judge.name} onChange={(e) => handleJudgeChange(index, e.target.value)} className="flex-1 px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary" required />
                      {formData.judges.length > 1 && (
                        <button type="button" onClick={() => handleRemoveJudge(index)} className="px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors">
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">评分维度 *</label>
                  <div className="flex items-center gap-4">
                    <span className={`text-sm ${totalWeight !== 100 ? 'text-red-400' : 'text-green-400'}`}>
                      权重合计: {totalWeight}%
                    </span>
                    <button type="button" onClick={handleAddDimension} className="text-sm text-primary hover:text-primary/80">
                      + 添加维度
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {formData.dimensions.map((dim, index) => (
                    <div key={index} className="p-4 bg-dark-bg rounded-lg border border-dark-border">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
                          {index + 1}
                        </span>
                        <input type="text" placeholder="维度名称" value={dim.name} onChange={(e) => handleDimensionChange(index, 'name', e.target.value)} className="flex-1 px-3 py-2 bg-dark-border border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary" required />
                        {formData.dimensions.length > 1 && (
                          <button type="button" onClick={() => handleRemoveDimension(index)} className="p-2 hover:bg-red-900/30 text-red-400 rounded-lg transition-colors">
                            ✕
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">权重 (%)</label>
                          <input type="number" value={dim.weight} onChange={(e) => handleDimensionChange(index, 'weight', parseInt(e.target.value) || 0)} className="w-full px-3 py-2 bg-dark-border border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary" min="0" max="100" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">满分</label>
                          <input type="number" value={dim.max_score} onChange={(e) => handleDimensionChange(index, 'max_score', parseInt(e.target.value) || 0)} className="w-full px-3 py-2 bg-dark-border border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary" min="1" />
                        </div>
                      </div>
                      <input type="text" placeholder="维度说明（可选）" value={dim.description} onChange={(e) => handleDimensionChange(index, 'description', e.target.value)} className="w-full px-3 py-2 bg-dark-border border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary text-sm" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm() }} className="flex-1 px-4 py-3 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors">
                  取消
                </button>
                <button type="submit" disabled={totalWeight !== 100} className="flex-1 px-4 py-3 bg-gradient-to-r from-primary to-red-600 text-white font-semibold rounded-lg hover:from-red-600 hover:to-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {editingScoring ? '保存修改' : '创建评分'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showResultsModal && selectedScoring && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="p-6 border-b border-dark-border">
              <h2 className="text-xl font-semibold text-gold">{selectedScoring.name} - 评分结果</h2>
            </div>
            <div className="p-6">
              {selectedScoring.results && selectedScoring.results.length > 0 ? (
                <>
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-white mb-4">🏆 排名</h4>
                    <div className="space-y-3">
                      {[...selectedScoring.results].sort((a, b) => b.average_score - a.average_score).map((result, index) => {
                        const finalScore = selectedScoring.dimensions ? calculateFinalScore(result.scores, selectedScoring.dimensions) : result.average_score
                        const rankClass = index === 0 ? 'bg-gold' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-700' : 'bg-dark-border'
                        return (
                          <div key={result.target_name} className="flex items-center gap-4 p-4 bg-dark-bg rounded-lg">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${rankClass}`}>
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="text-white font-semibold">{result.target_name}</div>
                              <div className="flex items-center gap-4 mt-1">
                                <span className="text-gold text-xl font-bold">{finalScore.toFixed(2)}</span>
                                <span className="text-gray-500 text-sm">
                                  原始分: {result.average_score.toFixed(2)}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-gray-400 text-sm">{result.scores.length} 位评委</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {selectedScoring.dimensions && selectedScoring.dimensions.length > 0 && (
                    <div>
                      <h4 className="text-lg font-semibold text-white mb-4">📊 维度详情</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-dark-bg border-b border-dark-border">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">被评人</th>
                              {selectedScoring.dimensions.map((dim) => (
                                <th key={dim.id} className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                                  {dim.name} ({dim.weight}%)
                                </th>
                              ))}
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">最终得分</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-dark-border">
                            {[...selectedScoring.results].sort((a, b) => b.average_score - a.average_score).map((result) => {
                              const finalScore = selectedScoring.dimensions ? calculateFinalScore(result.scores, selectedScoring.dimensions) : result.average_score
                              return (
                                <tr key={result.target_name} className="hover:bg-dark-bg/50">
                                  <td className="px-4 py-3 text-white font-medium">{result.target_name}</td>
                                  {selectedScoring.dimensions?.map((dim) => {
                                    const dimScores = result.scores
                                      .filter((s) => s.dimension_id === dim.id)
                                      .map((s) => s.score)
                                    const avgDimScore = dimScores.length > 0 ? dimScores.reduce((a, b) => a + b, 0) / dimScores.length : 0
                                    return (
                                      <td key={dim.id} className="px-4 py-3 text-gray-300">
                                        {avgDimScore.toFixed(2)}
                                      </td>
                                    )
                                  })}
                                  <td className="px-4 py-3 text-gold font-semibold">{finalScore.toFixed(2)}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">📊</div>
                  <h4 className="text-lg font-semibold text-white mb-2">暂无评分数据</h4>
                  <p className="text-gray-400">评委开始打分后将显示结果</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-dark-border">
              <button onClick={() => setShowResultsModal(false)} className="w-full px-6 py-3 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors">
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
              <h3 className="text-xl font-semibold text-white mb-2">确认删除</h3>
              <p className="text-gray-400 mb-6">确定要删除这个评分项吗？此操作不可恢复。</p>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirm({ show: false, scoringId: null, action: '' })} className="flex-1 px-4 py-3 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors">
                  取消
                </button>
                <button onClick={handleDelete} className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors">
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

export default ScoringManage
