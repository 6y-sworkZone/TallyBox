import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { templatesAPI, eventsAPI } from '../../services/api'
import { wsService } from '../../services/websocket'
import type { Template, FlowStep } from '../../types'

interface TemplateStep {
  step_type: string
  title: string
  description?: string
}

const TemplateManage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>()
  const id = parseInt(eventId || '0')
  const navigate = useNavigate()

  const [templates, setTemplates] = useState<Template[]>([])
  const [flows, setFlows] = useState<FlowStep[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [showConfirm, setShowConfirm] = useState<{ show: boolean; templateId: number | null; action: string }>({ show: false, templateId: null, action: '' })
  const [showApplyConfirm, setShowApplyConfirm] = useState<{ show: boolean; templateId: number | null; templateName: string }>({ show: false, templateId: null, templateName: '' })

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    steps: [] as TemplateStep[],
  })

  const stepTypes = [
    { value: 'opening', label: '🎤 开场' },
    { value: 'voting', label: '🗳️ 投票' },
    { value: 'lottery', label: '🎁 抽奖' },
    { value: 'performance', label: '🎵 表演' },
    { value: 'award', label: '🏆 颁奖' },
    { value: 'ending', label: '🎬 结束' },
  ]

  useEffect(() => {
    loadData()
    return () => {
      wsService.disconnectAdmin()
    }
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [templatesData, flowsData] = await Promise.all([
        templatesAPI.list() as unknown as Promise<Template[]>,
        id ? eventsAPI.getFlows(id) as unknown as Promise<FlowStep[]> : Promise.resolve([]),
      ])
      setTemplates(templatesData)
      setFlows(flowsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return
    if (formData.steps.length === 0) {
      setError('请至少添加一个环节')
      return
    }

    try {
      if (editingTemplate) {
        await templatesAPI.update(editingTemplate.id, formData)
      } else {
        await templatesAPI.create(formData)
      }
      loadData()
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
  }

  const handleEdit = (template: Template) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      description: template.description || '',
      steps: template.steps,
    })
    setShowModal(true)
  }

  const handleDelete = async () => {
    if (!showConfirm.templateId) return
    try {
      await templatesAPI.delete(showConfirm.templateId)
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
    setShowConfirm({ show: false, templateId: null, action: '' })
  }

  const handleApply = async () => {
    if (!showApplyConfirm.templateId || !id) return
    try {
      await templatesAPI.apply(id, showApplyConfirm.templateId)
      navigate(`/admin/events/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '应用失败')
    }
    setShowApplyConfirm({ show: false, templateId: null, templateName: '' })
  }

  const handleCreateFromFlow = () => {
    if (flows.length === 0) {
      setError('当前活动没有流程环节可保存')
      return
    }
    const steps = flows.map((f) => ({
      step_type: f.step_type,
      title: f.title,
      description: f.description || '',
    }))
    setFormData({
      name: '',
      description: '',
      steps,
    })
    setEditingTemplate(null)
    setShowModal(true)
  }

  const addStep = () => {
    setFormData({
      ...formData,
      steps: [
        ...formData.steps,
        { step_type: 'opening', title: '', description: '' },
      ],
    })
  }

  const updateStep = (index: number, field: keyof TemplateStep, value: string) => {
    const newSteps = [...formData.steps]
    newSteps[index] = { ...newSteps[index], [field]: value }
    setFormData({ ...formData, steps: newSteps })
  }

  const removeStep = (index: number) => {
    const newSteps = formData.steps.filter((_, i) => i !== index)
    setFormData({ ...formData, steps: newSteps })
  }

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === formData.steps.length - 1) return
    const newSteps = [...formData.steps]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    ;[newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]]
    setFormData({ ...formData, steps: newSteps })
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingTemplate(null)
    setFormData({
      name: '',
      description: '',
      steps: [],
    })
  }

  const getStepTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      opening: '🎤 开场',
      voting: '🗳️ 投票',
      lottery: '🎁 抽奖',
      performance: '🎵 表演',
      award: '🏆 颁奖',
      ending: '🎬 结束',
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
                onClick={() => navigate(id ? `/admin/events/${id}` : '/admin/events')}
                className="p-2 hover:bg-dark-card rounded-lg transition-colors"
              >
                ←
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white glow-text">模板管理</h1>
                <p className="text-gray-400 text-sm">管理活动流程模板，共 {templates.length} 个模板</p>
              </div>
            </div>
            <div className="flex gap-3">
              {id && flows.length > 0 && (
                <button
                  onClick={handleCreateFromFlow}
                  className="px-4 py-2 bg-gold/20 hover:bg-gold/30 text-gold rounded-lg transition-colors"
                >
                  📋 从当前流程保存
                </button>
              )}
              <button
                onClick={() => setShowModal(true)}
                className="px-6 py-2 bg-gradient-to-r from-primary to-red-600 hover:from-red-600 hover:to-primary text-white rounded-lg transition-all"
              >
                ➕ 创建模板
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-dark-card border border-dark-border rounded-xl overflow-hidden hover:border-primary/50 transition-all group"
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">{template.name}</h3>
                    {template.description && (
                      <p className="text-gray-400 text-sm line-clamp-2">{template.description}</p>
                    )}
                  </div>
                  <span className="px-2 py-1 bg-primary/20 text-primary text-xs font-semibold rounded">
                    {template.steps.length} 环节
                  </span>
                </div>
                <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                  {template.steps.map((step, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 bg-dark-bg rounded-lg text-sm"
                    >
                      <span className="w-6 h-6 rounded-full bg-dark-border flex items-center justify-center text-xs text-gray-400">
                        {index + 1}
                      </span>
                      <span className="text-gold text-sm">{getStepTypeLabel(step.step_type)}</span>
                      <span className="text-gray-300 truncate">{step.title}</span>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-gray-500 mb-4">
                  创建于 {new Date(template.created_at).toLocaleDateString('zh-CN')}
                </div>
                <div className="flex gap-2">
                  {id && (
                    <button
                      onClick={() => setShowApplyConfirm({ show: true, templateId: template.id, templateName: template.name })}
                      className="flex-1 px-3 py-2 bg-gold/20 hover:bg-gold/30 text-gold rounded-lg transition-colors text-sm"
                    >
                      ✨ 应用模板
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(template)}
                    className="px-3 py-2 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors text-sm"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => setShowConfirm({ show: true, templateId: template.id, action: 'delete' })}
                    className="px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors text-sm"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {templates.length === 0 && (
          <div className="bg-dark-card border border-dark-border rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-white mb-2">暂无模板</h3>
            <p className="text-gray-400 mb-6">创建流程模板可快速应用到新活动</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-primary to-red-600 hover:from-red-600 hover:to-primary text-white rounded-lg transition-all"
            >
              创建第一个模板
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-slide-up flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-dark-border flex-shrink-0">
              <h3 className="text-xl font-bold text-white">
                {editingTemplate ? '编辑模板' : '创建模板'}
              </h3>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-dark-bg rounded-lg transition-colors text-gray-400"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">模板名称 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                  placeholder="请输入模板名称"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">模板描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary resize-none"
                  rows={2}
                  placeholder="请输入模板描述"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-300">流程环节 ({formData.steps.length})</label>
                  <button
                    type="button"
                    onClick={addStep}
                    className="px-3 py-1 bg-primary/20 hover:bg-primary/30 text-primary text-sm rounded-lg transition-colors"
                  >
                    ➕ 添加环节
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.steps.map((step, index) => (
                    <div key={index} className="p-4 bg-dark-bg rounded-xl border border-dark-border">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                          {index + 1}
                        </div>
                        <select
                          value={step.step_type}
                          onChange={(e) => updateStep(index, 'step_type', e.target.value)}
                          className="px-3 py-2 bg-dark-border border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                        >
                          {stepTypes.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={step.title}
                            onChange={(e) => updateStep(index, 'title', e.target.value)}
                            className="w-full px-3 py-2 bg-dark-border border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                            placeholder="环节标题"
                            required
                          />
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => moveStep(index, 'up')}
                            disabled={index === 0}
                            className="p-2 hover:bg-dark-border rounded-lg transition-colors text-gray-400 disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveStep(index, 'down')}
                            disabled={index === formData.steps.length - 1}
                            className="p-2 hover:bg-dark-border rounded-lg transition-colors text-gray-400 disabled:opacity-30"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => removeStep(index)}
                            className="p-2 hover:bg-red-900/30 rounded-lg transition-colors text-red-400"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={step.description || ''}
                        onChange={(e) => updateStep(index, 'description', e.target.value)}
                        className="w-full px-3 py-2 bg-dark-border border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary text-sm"
                        placeholder="环节描述（可选）"
                      />
                    </div>
                  ))}
                  {formData.steps.length === 0 && (
                    <div className="text-center py-8 border-2 border-dashed border-dark-border rounded-xl">
                      <div className="text-4xl mb-2">📝</div>
                      <p className="text-gray-500">点击上方"添加环节"按钮开始创建流程</p>
                    </div>
                  )}
                </div>
              </div>
            </form>
            <div className="flex gap-3 p-6 border-t border-dark-border flex-shrink-0">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 px-6 py-3 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={formData.steps.length === 0}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-primary to-red-600 hover:from-red-600 hover:to-primary text-white font-semibold rounded-lg transition-all disabled:opacity-50"
              >
                {editingTemplate ? '保存修改' : '创建模板'}
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
              <p className="text-gray-400 mb-6">确定要删除这个模板吗？此操作不可恢复。</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm({ show: false, templateId: null, action: '' })}
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

      {showApplyConfirm.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-gold/50 rounded-2xl w-full max-w-md p-6 animate-slide-up">
            <div className="text-center">
              <div className="text-5xl mb-4">✨</div>
              <h3 className="text-xl font-semibold text-white mb-2">应用模板</h3>
              <p className="text-gray-400 mb-6">
                确定要将模板 "<span className="text-gold">{showApplyConfirm.templateName}</span>" 应用到当前活动吗？
                <br />
                <span className="text-red-400 text-sm">现有流程将被替换</span>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowApplyConfirm({ show: false, templateId: null, templateName: '' })}
                  className="flex-1 px-4 py-3 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-primary to-red-600 hover:from-red-600 hover:to-primary text-white font-semibold rounded-lg transition-all"
                >
                  确认应用
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TemplateManage
