import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { participantsAPI } from '../../services/api'
import { wsService } from '../../services/websocket'
import type { Participant } from '../../types'
import type { FormEvent, ChangeEvent } from 'react'

const ParticipantList: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>()
  const id = parseInt(eventId || '0')
  const navigate = useNavigate()

  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDepartment, setFilterDepartment] = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [showConfirm, setShowConfirm] = useState<{ show: boolean; participantId: number | null }>({ show: false, participantId: null })
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    name: '',
    department: '',
    table_number: '',
    group_name: '',
    email: '',
    phone: '',
  })

  const [groupData, setGroupData] = useState({
    type: 'department' as 'department' | 'table' | 'custom',
    groupName: '',
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

  useEffect(() => {
    const depts = [...new Set(participants.map((p) => p.department).filter(Boolean))]
    const grps = [...new Set(participants.map((p) => p.group_name).filter(Boolean))]
    setDepartments(depts as string[])
    setGroups(grps as string[])
  }, [participants])

  const loadData = async () => {
    try {
      setLoading(true)
      const data = await participantsAPI.list(id) as unknown as Participant[]
      setParticipants(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAddSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const data = {
        ...formData,
        table_number: formData.table_number ? parseInt(formData.table_number) : undefined,
      }
      await participantsAPI.add(id, data)
      setShowAddModal(false)
      resetForm()
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败')
    }
  }

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setLoading(true)
      await participantsAPI.importCSV(id, file)
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败')
    } finally {
      setLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDelete = async () => {
    if (!showConfirm.participantId) return
    try {
      await participantsAPI.delete(id, showConfirm.participantId)
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
    setShowConfirm({ show: false, participantId: null })
  }

  const handleGroupAction = async () => {
    if (selectedIds.length === 0) return

    let groupName = ''
    if (groupData.type === 'custom') {
      groupName = groupData.groupName
    }

    try {
      await participantsAPI.updateGroup(id, selectedIds, groupName)
      setShowGroupModal(false)
      setSelectedIds([])
      setGroupData({ type: 'department', groupName: '' })
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '分组失败')
    }
  }

  const handleSelectAll = () => {
    if (selectedIds.length === filteredParticipants.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredParticipants.map((p) => p.id))
    }
  }

  const handleSelect = (participantId: number) => {
    setSelectedIds((prev) =>
      prev.includes(participantId)
        ? prev.filter((id) => id !== participantId)
        : [...prev, participantId]
    )
  }

  const resetForm = () => {
    setFormData({
      name: '',
      department: '',
      table_number: '',
      group_name: '',
      email: '',
      phone: '',
    })
  }

  const filteredParticipants = participants.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone?.includes(searchTerm)
    const matchDept = !filterDepartment || p.department === filterDepartment
    const matchGroup = !filterGroup || p.group_name === filterGroup
    return matchSearch && matchDept && matchGroup
  })

  if (loading && participants.length === 0) {
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
                <h1 className="text-2xl font-bold text-white glow-text">参与人管理</h1>
                <p className="text-gray-400 text-sm">共 {participants.length} 位参与人</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowGroupModal(true)}
                disabled={selectedIds.length === 0}
                className="px-4 py-2 bg-dark-card hover:bg-dark-border text-gray-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                📦 批量分组 ({selectedIds.length})
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-dark-card hover:bg-dark-border text-gray-300 rounded-lg transition-colors flex items-center gap-2"
              >
                📁 CSV导入
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => { resetForm(); setShowAddModal(true) }}
                className="px-4 py-2 bg-gradient-to-r from-primary to-red-600 text-white rounded-lg hover:from-red-600 hover:to-primary transition-all flex items-center gap-2"
              >
                + 添加参与人
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

        <div className="bg-dark-card border border-dark-border rounded-xl p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <input
                type="text"
                placeholder="搜索姓名、邮箱、电话..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary"
              />
            </div>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
            >
              <option value="">所有部门</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
            >
              <option value="">所有分组</option>
              {groups.map((group) => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-bg border-b border-dark-border">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === filteredParticipants.length && filteredParticipants.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-dark-border bg-dark-bg text-primary focus:ring-primary"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">姓名</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">部门</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">桌号</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">分组</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">邮箱</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">电话</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">状态</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">参与码</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {filteredParticipants.map((participant) => (
                  <tr
                    key={participant.id}
                    className={`hover:bg-dark-bg/50 transition-colors ${
                      selectedIds.includes(participant.id) ? 'bg-primary/10' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(participant.id)}
                        onChange={() => handleSelect(participant.id)}
                        className="w-4 h-4 rounded border-dark-border bg-dark-bg text-primary focus:ring-primary"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-gold flex items-center justify-center text-white text-sm font-medium">
                          {participant.name.charAt(0)}
                        </div>
                        <span className="text-white font-medium">{participant.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{participant.department || '-'}</td>
                    <td className="px-4 py-3 text-gray-400">{participant.table_number || '-'}</td>
                    <td className="px-4 py-3">
                      {participant.group_name ? (
                        <span className="px-2 py-1 bg-gold/20 text-gold text-xs rounded">
                          {participant.group_name}
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{participant.email || '-'}</td>
                    <td className="px-4 py-3 text-gray-400">{participant.phone || '-'}</td>
                    <td className="px-4 py-3">
                      {participant.is_checked_in ? (
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          participant.is_late
                            ? 'bg-yellow-900/30 text-yellow-400'
                            : 'bg-green-900/30 text-green-400'
                        }`}>
                          {participant.is_late ? '迟到' : '已签到'}
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-700/50 text-gray-400 rounded-full text-xs">
                          未签到
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <code className="px-2 py-1 bg-dark-bg rounded text-gold text-sm font-mono">
                        {participant.join_code}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowConfirm({ show: true, participantId: participant.id })}
                          className="p-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredParticipants.length === 0 && (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">👥</div>
              <h4 className="text-lg font-semibold text-white mb-2">暂无参与人</h4>
              <p className="text-gray-400">添加参与人或导入CSV文件开始</p>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-lg animate-slide-up">
            <div className="p-6 border-b border-dark-border">
              <h2 className="text-xl font-semibold text-gold">添加参与人</h2>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">姓名 *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">部门</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">桌号</label>
                  <input
                    type="number"
                    value={formData.table_number}
                    onChange={(e) => setFormData({ ...formData, table_number: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">分组</label>
                  <input
                    type="text"
                    value={formData.group_name}
                    onChange={(e) => setFormData({ ...formData, group_name: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">邮箱</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">电话</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetForm() }}
                  className="flex-1 px-4 py-3 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-primary to-red-600 text-white font-semibold rounded-lg hover:from-red-600 hover:to-primary transition-all"
                >
                  添加
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showGroupModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-md animate-slide-up">
            <div className="p-6 border-b border-dark-border">
              <h2 className="text-xl font-semibold text-gold">批量分组</h2>
              <p className="text-gray-400 text-sm mt-1">已选择 {selectedIds.length} 位参与人</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">分组方式</label>
                <select
                  value={groupData.type}
                  onChange={(e) => setGroupData({ ...groupData, type: e.target.value as 'department' | 'table' | 'custom' })}
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                >
                  <option value="department">按部门分组</option>
                  <option value="table">按桌号分组</option>
                  <option value="custom">自定义分组</option>
                </select>
              </div>
              {groupData.type === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">分组名称</label>
                  <input
                    type="text"
                    value={groupData.groupName}
                    onChange={(e) => setGroupData({ ...groupData, groupName: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary"
                    placeholder="请输入分组名称"
                    required
                  />
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => { setShowGroupModal(false); setSelectedIds([]) }}
                  className="flex-1 px-4 py-3 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleGroupAction}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-primary to-red-600 text-white font-semibold rounded-lg hover:from-red-600 hover:to-primary transition-all"
                >
                  确认分组
                </button>
              </div>
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
              <p className="text-gray-400 mb-6">确定要删除此参与人吗？此操作无法撤销。</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm({ show: false, participantId: null })}
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

export default ParticipantList
