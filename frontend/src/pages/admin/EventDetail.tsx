import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { eventsAPI, templatesAPI } from '../../services/api'
import { wsService } from '../../services/websocket'
import type { Event, FlowStep, Template } from '../../types'
import type { FormEvent } from 'react'

interface SortableStepProps {
  step: FlowStep
  onEdit: (step: FlowStep) => void
  onDelete: (id: number) => void
  onActivate: (id: number) => void
}

const SortableStep: React.FC<SortableStepProps> = ({ step, onEdit, onDelete, onActivate }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const stepTypeConfig: Record<string, { icon: string; label: string; color: string }> = {
    opening: { icon: '🎬', label: '开场', color: 'from-blue-500 to-cyan-500' },
    voting: { icon: '🗳️', label: '投票', color: 'from-green-500 to-emerald-500' },
    lottery: { icon: '🎰', label: '抽奖', color: 'from-yellow-500 to-orange-500' },
    performance: { icon: '🎤', label: '表演', color: 'from-purple-500 to-pink-500' },
    award: { icon: '🏆', label: '颁奖', color: 'from-yellow-400 to-amber-500' },
    ending: { icon: '🎊', label: '结束', color: 'from-red-500 to-rose-500' },
  }

  const config = stepTypeConfig[step.step_type] || stepTypeConfig.opening

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-dark-card border border-dark-border rounded-xl p-4 mb-3 ${
        isDragging ? 'opacity-50 scale-105 shadow-2xl z-50' : ''
      } ${step.is_active ? 'border-gold gold-border' : 'hover:border-primary/50'} transition-all`}
    >
      <div className="flex items-center gap-4">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-2 hover:bg-dark-bg rounded-lg transition-colors"
        >
          <span className="text-gray-500 text-xl">⋮⋮</span>
        </div>

        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center text-2xl`}>
          {config.icon}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-lg font-semibold text-white">{step.title}</h4>
            <span className={`px-2 py-0.5 text-xs rounded-full bg-gradient-to-r ${config.color} text-white`}>
              {config.label}
            </span>
            {step.is_active && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-gold/20 text-gold animate-pulse">
                进行中
              </span>
            )}
          </div>
          {step.description && (
            <p className="text-gray-400 text-sm mt-1">{step.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!step.is_active && (
            <button
              onClick={() => onActivate(step.id)}
              className="px-3 py-2 bg-green-900/30 hover:bg-green-900/50 text-green-400 rounded-lg transition-colors text-sm"
            >
              激活
            </button>
          )}
          <button
            onClick={() => onEdit(step)}
            className="px-3 py-2 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors"
          >
            ✏️
          </button>
          <button
            onClick={() => onDelete(step.id)}
            className="px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  )
}

const EventDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const eventId = parseInt(id || '0')

  const [event, setEvent] = useState<Event | null>(null)
  const [flows, setFlows] = useState<FlowStep[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showStepModal, setShowStepModal] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showConfirm, setShowConfirm] = useState<{ show: boolean; stepId: number | null; action: string }>({ show: false, stepId: null, action: '' })
  const [editingStep, setEditingStep] = useState<FlowStep | null>(null)
  const [stepForm, setStepForm] = useState({
    step_type: 'opening' as FlowStep['step_type'],
    title: '',
    description: '',
  })
  const [settingsForm, setSettingsForm] = useState({
    allow_anonymous: false,
    password: '',
    max_participants: 100,
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    if (eventId) {
      loadData()
      const token = localStorage.getItem('token')
      if (token) {
        wsService.connectAdmin(eventId, token)
      }
    }
    return () => wsService.disconnectAdmin()
  }, [eventId])

  const loadData = async () => {
    try {
      setLoading(true)
      const [eventData, flowsData, templatesData] = await Promise.all([
        eventsAPI.get(eventId) as unknown as Promise<Event>,
        eventsAPI.getFlows(eventId) as unknown as Promise<FlowStep[]>,
        templatesAPI.list() as unknown as Promise<Template[]>,
      ])
      setEvent(eventData)
      setFlows(flowsData.sort((a, b) => a.order_index - b.order_index))
      setTemplates(templatesData)
      setSettingsForm({
        allow_anonymous: eventData.allow_anonymous,
        password: eventData.password || '',
        max_participants: eventData.max_participants,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = flows.findIndex((s) => s.id === active.id)
    const newIndex = flows.findIndex((s) => s.id === over.id)
    const newFlows = arrayMove(flows, oldIndex, newIndex)
    setFlows(newFlows)

    try {
      await eventsAPI.updateFlowOrder(eventId, newFlows.map((s) => s.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : '排序更新失败')
      loadData()
    }
  }

  const handleStepSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      if (editingStep) {
        await eventsAPI.updateFlow(eventId, editingStep.id, stepForm)
      } else {
        await eventsAPI.addFlow(eventId, stepForm)
      }
      setShowStepModal(false)
      resetStepForm()
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
  }

  const handleSettingsSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await eventsAPI.update(eventId, settingsForm)
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '设置保存失败')
    }
  }

  const handleApplyTemplate = async (templateId: number) => {
    try {
      await templatesAPI.apply(eventId, templateId)
      setShowTemplateModal(false)
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '模板应用失败')
    }
  }

  const handleDeleteStep = async () => {
    if (!showConfirm.stepId) return
    try {
      await eventsAPI.deleteFlow(eventId, showConfirm.stepId)
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
    setShowConfirm({ show: false, stepId: null, action: '' })
  }

  const handleActivateStep = async (stepId: number) => {
    try {
      await eventsAPI.setActiveFlow(eventId, stepId)
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '激活失败')
    }
  }

  const resetStepForm = () => {
    setStepForm({
      step_type: 'opening',
      title: '',
      description: '',
    })
    setEditingStep(null)
  }

  const handleEditStep = (step: FlowStep) => {
    setEditingStep(step)
    setStepForm({
      step_type: step.step_type,
      title: step.title,
      description: step.description || '',
    })
    setShowStepModal(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white">
        活动不存在
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
                onClick={() => navigate('/admin/events')}
                className="p-2 hover:bg-dark-card rounded-lg transition-colors"
              >
                ←
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white glow-text">{event.name}</h1>
                <p className="text-gray-400 text-sm">
                  {new Date(event.date).toLocaleString('zh-CN')} · {event.location}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowTemplateModal(true)}
                className="px-4 py-2 bg-dark-card hover:bg-dark-border text-gray-300 rounded-lg transition-colors flex items-center gap-2"
              >
                📋 应用模板
              </button>
              <button
                onClick={() => { resetStepForm(); setShowStepModal(true) }}
                className="px-4 py-2 bg-gradient-to-r from-primary to-red-600 text-white rounded-lg hover:from-red-600 hover:to-primary transition-all flex items-center gap-2"
              >
                + 添加环节
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-dark-card border border-dark-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gold mb-4">活动设置</h3>
              <form onSubmit={handleSettingsSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">最大参与人数</label>
                  <input
                    type="number"
                    value={settingsForm.max_participants}
                    onChange={(e) => setSettingsForm({ ...settingsForm, max_participants: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                    min="1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="allow_anonymous"
                    checked={settingsForm.allow_anonymous}
                    onChange={(e) => setSettingsForm({ ...settingsForm, allow_anonymous: e.target.checked })}
                    className="w-4 h-4 rounded border-dark-border bg-dark-bg text-primary focus:ring-primary"
                  />
                  <label htmlFor="allow_anonymous" className="text-sm text-gray-300">允许匿名参与</label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">参与密码</label>
                  <input
                    type="text"
                    value={settingsForm.password}
                    onChange={(e) => setSettingsForm({ ...settingsForm, password: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                    placeholder="留空则不需要密码"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-colors"
                >
                  保存设置
                </button>
              </form>
            </div>

            <div className="bg-dark-card border border-dark-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gold mb-4">快捷管理</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => navigate(`/admin/events/${eventId}/participants`)}
                  className="p-4 bg-dark-bg hover:bg-dark-border rounded-lg transition-colors text-center"
                >
                  <div className="text-2xl mb-1">👥</div>
                  <div className="text-sm text-gray-300">参与人</div>
                </button>
                <button
                  onClick={() => navigate(`/admin/events/${eventId}/votes`)}
                  className="p-4 bg-dark-bg hover:bg-dark-border rounded-lg transition-colors text-center"
                >
                  <div className="text-2xl mb-1">🗳️</div>
                  <div className="text-sm text-gray-300">投票</div>
                </button>
                <button
                  onClick={() => navigate(`/admin/events/${eventId}/lottery`)}
                  className="p-4 bg-dark-bg hover:bg-dark-border rounded-lg transition-colors text-center"
                >
                  <div className="text-2xl mb-1">🎰</div>
                  <div className="text-sm text-gray-300">抽奖</div>
                </button>
                <button
                  onClick={() => navigate(`/admin/events/${eventId}/danmaku`)}
                  className="p-4 bg-dark-bg hover:bg-dark-border rounded-lg transition-colors text-center"
                >
                  <div className="text-2xl mb-1">💬</div>
                  <div className="text-sm text-gray-300">弹幕</div>
                </button>
                <button
                  onClick={() => navigate(`/admin/events/${eventId}/checkin`)}
                  className="p-4 bg-dark-bg hover:bg-dark-border rounded-lg transition-colors text-center"
                >
                  <div className="text-2xl mb-1">✅</div>
                  <div className="text-sm text-gray-300">签到</div>
                </button>
                <button
                  onClick={() => navigate(`/admin/events/${eventId}/scoring`)}
                  className="p-4 bg-dark-bg hover:bg-dark-border rounded-lg transition-colors text-center"
                >
                  <div className="text-2xl mb-1">⭐</div>
                  <div className="text-sm text-gray-300">评分</div>
                </button>
                <button
                  onClick={() => navigate(`/admin/events/${eventId}/overview`)}
                  className="p-4 bg-dark-bg hover:bg-dark-border rounded-lg transition-colors text-center col-span-2"
                >
                  <div className="text-2xl mb-1">📊</div>
                  <div className="text-sm text-gray-300">数据总览</div>
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-dark-card border border-dark-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gold mb-4">流程编排</h3>
              <p className="text-gray-400 text-sm mb-4">拖拽环节卡片调整顺序，点击激活当前进行中的环节</p>

              {flows.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">📋</div>
                  <h4 className="text-lg font-semibold text-white mb-2">还没有流程环节</h4>
                  <p className="text-gray-400 mb-4">点击"添加环节"或"应用模板"开始编排</p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={flows.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {flows.map((step) => (
                      <SortableStep
                        key={step.id}
                        step={step}
                        onEdit={handleEditStep}
                        onDelete={(id) => setShowConfirm({ show: true, stepId: id, action: 'delete' })}
                        onActivate={handleActivateStep}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        </div>
      </div>

      {showStepModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-lg animate-slide-up">
            <div className="p-6 border-b border-dark-border">
              <h2 className="text-xl font-semibold text-gold">
                {editingStep ? '编辑环节' : '添加环节'}
              </h2>
            </div>
            <form onSubmit={handleStepSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">环节类型</label>
                <select
                  value={stepForm.step_type}
                  onChange={(e) => setStepForm({ ...stepForm, step_type: e.target.value as FlowStep['step_type'] })}
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                >
                  <option value="opening">🎬 开场</option>
                  <option value="voting">🗳️ 投票</option>
                  <option value="lottery">🎰 抽奖</option>
                  <option value="performance">🎤 表演</option>
                  <option value="award">🏆 颁奖</option>
                  <option value="ending">🎊 结束</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">环节标题 *</label>
                <input
                  type="text"
                  value={stepForm.title}
                  onChange={(e) => setStepForm({ ...stepForm, title: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">环节描述</label>
                <textarea
                  value={stepForm.description}
                  onChange={(e) => setStepForm({ ...stepForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary resize-none"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowStepModal(false); resetStepForm() }}
                  className="flex-1 px-4 py-3 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-primary to-red-600 text-white font-semibold rounded-lg hover:from-red-600 hover:to-primary transition-all"
                >
                  {editingStep ? '保存修改' : '添加环节'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-lg animate-slide-up">
            <div className="p-6 border-b border-dark-border">
              <h2 className="text-xl font-semibold text-gold">应用模板</h2>
            </div>
            <div className="p-6 max-h-96 overflow-y-auto">
              {templates.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">📋</div>
                  <p className="text-gray-400">暂无可用模板</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="p-4 bg-dark-bg hover:bg-dark-border border border-dark-border rounded-lg cursor-pointer transition-all hover:border-primary/50"
                      onClick={() => handleApplyTemplate(template.id)}
                    >
                      <h4 className="font-semibold text-white mb-1">{template.name}</h4>
                      {template.description && (
                        <p className="text-gray-400 text-sm mb-2">{template.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {template.steps.slice(0, 5).map((step, i) => (
                          <span key={i} className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded">
                            {step.title}
                          </span>
                        ))}
                        {template.steps.length > 5 && (
                          <span className="px-2 py-0.5 text-xs text-gray-400">+{template.steps.length - 5} 更多</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-dark-border">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="w-full px-4 py-3 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors"
              >
                取消
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
              <p className="text-gray-400 mb-6">确定要删除此环节吗？此操作无法撤销。</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm({ show: false, stepId: null, action: '' })}
                  className="flex-1 px-4 py-3 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleDeleteStep}
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

export default EventDetail
