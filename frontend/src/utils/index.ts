import type { Event, FlowStep, Vote } from '../types'

export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const formatTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

export const getStatusText = (status: Event['status']): string => {
  const statusMap: Record<Event['status'], string> = {
    preparing: '筹备中',
    ongoing: '进行中',
    ended: '已结束',
  }
  return statusMap[status] || status
}

export const getStepTypeText = (stepType: FlowStep['step_type']): string => {
  const stepTypeMap: Record<FlowStep['step_type'], string> = {
    opening: '开场',
    voting: '投票',
    lottery: '抽奖',
    performance: '表演',
    award: '颁奖',
    ending: '结束',
  }
  return stepTypeMap[stepType] || stepType
}

export const getVoteTypeText = (voteType: Vote['vote_type']): string => {
  const voteTypeMap: Record<Vote['vote_type'], string> = {
    single: '单选',
    multiple: '多选',
    rating: '评分',
  }
  return voteTypeMap[voteType] || voteType
}

export const generateDeviceId = (): string => {
  const STORAGE_KEY = 'tallybox_device_id'
  let deviceId = localStorage.getItem(STORAGE_KEY)
  if (!deviceId) {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 10)
    deviceId = `${timestamp}-${random}`
    localStorage.setItem(STORAGE_KEY, deviceId)
  }
  return deviceId
}

export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
