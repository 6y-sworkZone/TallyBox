import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import type { Participant } from '../../types'
import { participantsAPI, checkinAPI } from '../../services/api'
import { getAvatarColor, getInitials } from '../../utils'

const ParticipantCheckIn: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>()
  const [searchParams] = useSearchParams()
  const codeParam = searchParams.get('code')

  const [joinCode, setJoinCode] = useState(codeParam || '')
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'input' | 'confirm' | 'success'>('input')
  const hasLoadedRef = useRef(false)

  const handleCodeLookup = useCallback(async (code: string) => {
    if (!code.trim()) {
      setError('请输入参与码')
      return
    }

    try {
      setLoading(true)
      setError('')

      const data = await participantsAPI.byJoinCode(code.trim())
      const participantData = data as Participant

      if (participantData.event_id !== Number(eventId)) {
        setError('该参与码不属于当前活动')
        return
      }

      setParticipant(participantData)
      setStep('confirm')

      if (participantData.is_checked_in) {
        setStep('success')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未找到该参与码对应的参与者')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  const handleCheckIn = async () => {
    if (!participant) return

    try {
      setCheckingIn(true)
      setError('')

      await checkinAPI.doCheckIn(participant.id)

      setStep('success')

      setParticipant(prev => prev ? { ...prev, is_checked_in: true } : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '签到失败，请重试')
    } finally {
      setCheckingIn(false)
    }
  }

  const resetForm = () => {
    setJoinCode('')
    setParticipant(null)
    setStep('input')
    setError('')
  }

  useEffect(() => {
    if (codeParam && eventId && !hasLoadedRef.current) {
      hasLoadedRef.current = true
      handleCodeLookup(codeParam)
    }
  }, [codeParam, eventId, handleCodeLookup])

  if (step === 'success' && participant) {
    return (
      <div className="min-h-screen bg-dark-bg py-6 px-4 flex items-center justify-center">
        <div className="max-w-[480px] w-full">
          <div className="text-center animate-bounce-in">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${
              participant.is_late 
                ? 'bg-red-900/30 border-4 border-primary' 
                : 'bg-green-900/30 gold-border'
            }`}>
              <span className="text-6xl">
                {participant.is_late ? '⚠️' : '✅'}
              </span>
            </div>
            
            <h1 className="text-3xl font-bold text-gold gold-glow mb-2">
              {participant.is_late ? '签到成功（迟到）' : '签到成功！'}
            </h1>
            
            {participant.is_late && (
              <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 mb-4">
                <p className="text-red-400 text-sm">
                  您已迟到，请尽快就座
                </p>
              </div>
            )}

            <div className="bg-dark-card border border-dark-border rounded-xl p-6 mb-6 mt-6">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white"
                  style={{ backgroundColor: getAvatarColor(participant.name) }}
                >
                  {participant.avatar ? (
                    <img
                      src={participant.avatar}
                      alt={participant.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials(participant.name)
                  )}
                </div>
              </div>

              <div className="space-y-3 text-left">
                <div className="flex justify-between">
                  <span className="text-gray-400">姓名</span>
                  <span className="text-white font-medium">{participant.name}</span>
                </div>
                {participant.department && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">部门</span>
                    <span className="text-white font-medium">{participant.department}</span>
                  </div>
                )}
                {participant.seat_number && (
                  <div className="flex justify-between items-center py-2 border-t border-dark-border mt-2 pt-4">
                    <span className="text-gray-400">座位号</span>
                    <span className="text-gold font-bold text-2xl gold-glow">
                      {participant.seat_number}
                    </span>
                  </div>
                )}
                {participant.table_number !== undefined && (
                  <div className="flex justify-between items-center py-2 border-t border-dark-border">
                    <span className="text-gray-400">桌号</span>
                    <span className="text-gold font-bold text-2xl gold-glow">
                      {participant.table_number} 号桌
                    </span>
                  </div>
                )}
                {participant.group_name && (
                  <div className="flex justify-between items-center py-2 border-t border-dark-border">
                    <span className="text-gray-400">组别</span>
                    <span className="text-primary font-bold text-xl">
                      {participant.group_name}
                    </span>
                  </div>
                )}
                {participant.check_in_time && (
                  <div className="flex justify-between items-center py-2 border-t border-dark-border">
                    <span className="text-gray-400">签到时间</span>
                    <span className="text-white font-medium">
                      {new Date(participant.check_in_time).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={resetForm}
              className="w-full py-4 bg-dark-card border border-dark-border text-gray-300 font-medium rounded-xl hover:bg-dark-border transition-colors"
            >
              返回重新签到
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'confirm' && participant) {
    return (
      <div className="min-h-screen bg-dark-bg py-6 px-4 flex items-center justify-center">
        <div className="max-w-[480px] w-full">
          <div className="text-center animate-fade-in">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-red-700 mb-6 gold-border">
              <span className="text-3xl">👤</span>
            </div>
            
            <h1 className="text-2xl font-bold text-gold gold-glow mb-2">
              确认信息
            </h1>
            <p className="text-gray-400 mb-6">请确认以下信息是否正确</p>

            {error && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <div className="bg-dark-card border border-dark-border rounded-xl p-6 mb-6">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white"
                  style={{ backgroundColor: getAvatarColor(participant.name) }}
                >
                  {participant.avatar ? (
                    <img
                      src={participant.avatar}
                      alt={participant.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials(participant.name)
                  )}
                </div>
              </div>

              <div className="space-y-3 text-left">
                <div className="flex justify-between">
                  <span className="text-gray-400">姓名</span>
                  <span className="text-white font-medium">{participant.name}</span>
                </div>
                {participant.department && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">部门</span>
                    <span className="text-white font-medium">{participant.department}</span>
                  </div>
                )}
                {participant.seat_number && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">座位号</span>
                    <span className="text-gold font-bold">{participant.seat_number}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleCheckIn}
                disabled={checkingIn}
                className="w-full py-4 bg-gradient-to-r from-primary to-red-600 hover:from-red-600 hover:to-primary text-white font-bold text-lg rounded-xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 gold-border"
              >
                {checkingIn ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    签到中...
                  </span>
                ) : '确认签到'}
              </button>

              <button
                onClick={resetForm}
                className="w-full py-3 bg-dark-card border border-dark-border text-gray-400 font-medium rounded-xl hover:bg-dark-border transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-bg py-6 px-4 flex items-center justify-center">
      <div className="max-w-[480px] w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-red-700 mb-4 gold-border">
            <span className="text-4xl">🎫</span>
          </div>
          <h1 className="text-3xl font-bold text-gold gold-glow mb-2">
            活动签到
          </h1>
          <p className="text-gray-400">输入参与码或扫码完成签到</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-xl text-red-400 text-center">
            {error}
          </div>
        )}

        <div className="bg-dark-card border border-dark-border rounded-xl p-6 mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            参与码
          </label>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="请输入参与码"
            className="w-full px-4 py-4 bg-dark-bg border border-dark-border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all text-center text-2xl font-mono tracking-widest"
            maxLength={8}
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCodeLookup(joinCode)
              }
            }}
          />
          
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => {
                if ('scanner' in navigator) {
                  alert('扫码功能需要设备支持')
                } else {
                  alert('当前浏览器不支持扫码功能，请手动输入参与码')
                }
              }}
              className="flex-1 py-3 bg-dark-bg border border-dark-border rounded-lg text-gray-300 hover:bg-dark-border transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-xl">📷</span>
              扫码
            </button>
          </div>
        </div>

        <button
          onClick={() => handleCodeLookup(joinCode)}
          disabled={loading || !joinCode.trim()}
          className="w-full py-4 bg-gradient-to-r from-primary to-red-600 hover:from-red-600 hover:to-primary text-white font-bold text-lg rounded-xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 gold-border"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              查询中...
            </span>
          ) : '查询信息'}
        </button>

        <p className="text-center text-gray-500 text-sm mt-6">
          活动编号: {eventId}
        </p>
      </div>
    </div>
  )
}

export default ParticipantCheckIn
