import React, { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import type { Vote, VoteOption } from '../../types'
import { votesAPI } from '../../services/api'
import { getDeviceId } from '../../utils'

interface SubmitData {
  device_id: string
  captcha: string
  option_id?: number
  option_ids?: number[]
  ratings?: Record<number, number>
}

const ParticipantVote: React.FC = () => {
  const { voteId } = useParams<{ voteId: string }>()
  const [searchParams] = useSearchParams()
  const eventId = searchParams.get('eventId')

  const [vote, setVote] = useState<Vote | null>(null)
  const [options, setOptions] = useState<VoteOption[]>([])
  const [selectedOptions, setSelectedOptions] = useState<number[]>([])
  const [rating, setRating] = useState<Record<number, number>>({})
  const [captcha, setCaptcha] = useState('')
  const [captchaImage, setCaptchaImage] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [hasVoted, setHasVoted] = useState(false)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    if (!voteId || hasLoadedRef.current) return
    hasLoadedRef.current = true

    const loadVoteData = async () => {
      try {
        setLoading(true)
        const [voteData, optionsData, captchaBlob] = await Promise.all([
          votesAPI.get(Number(voteId)),
          votesAPI.results(Number(voteId)),
          votesAPI.captcha(Number(voteId))
        ])

        setVote(voteData as Vote)
        setOptions(optionsData as VoteOption[])

        const url = URL.createObjectURL(captchaBlob as Blob)
        setCaptchaImage(url)

        const votedKey = `voted_${voteId}_${getDeviceId()}`
        if (localStorage.getItem(votedKey)) {
          setHasVoted(true)
        }

        setError('')
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载投票信息失败')
      } finally {
        setLoading(false)
      }
    }

    loadVoteData()
  }, [voteId])

  const refreshCaptcha = async () => {
    if (!voteId) return
    try {
      const captchaBlob = await votesAPI.captcha(Number(voteId))
      const url = URL.createObjectURL(captchaBlob as Blob)
      setCaptchaImage(url)
      setCaptcha('')
    } catch (err) {
      console.error('刷新验证码失败:', err)
    }
  }

  const handleOptionSelect = (optionId: number) => {
    if (!vote || hasVoted) return

    if (vote.vote_type === 'single') {
      setSelectedOptions([optionId])
    } else if (vote.vote_type === 'multiple') {
      const maxSelections = vote.max_selections || options.length
      setSelectedOptions(prev => {
        if (prev.includes(optionId)) {
          return prev.filter(id => id !== optionId)
        }
        if (prev.length >= maxSelections) {
          setError(`最多只能选择 ${maxSelections} 项`)
          return prev
        }
        return [...prev, optionId]
      })
    }
  }

  const handleRatingChange = (optionId: number, value: number) => {
    if (hasVoted) return
    setRating(prev => ({ ...prev, [optionId]: value }))
  }

  const handleSubmit = async () => {
    if (!voteId || !vote) return

    if (captcha.length < 4) {
      setError('请输入正确的验证码')
      return
    }

    if (vote.vote_type !== 'rating' && selectedOptions.length === 0) {
      setError('请至少选择一个选项')
      return
    }

    if (vote.vote_type === 'rating') {
      const allRated = options.every(opt => rating[opt.id] !== undefined)
      if (!allRated) {
        setError('请为所有选项评分')
        return
      }
    }

    try {
      setSubmitting(true)
      setError('')

      const submitData: SubmitData = {
        device_id: getDeviceId(),
        captcha: captcha.toLowerCase()
      }

      if (vote.vote_type === 'single') {
        submitData.option_id = selectedOptions[0]
      } else if (vote.vote_type === 'multiple') {
        submitData.option_ids = selectedOptions
      } else if (vote.vote_type === 'rating') {
        submitData.ratings = Object.entries(rating).map(([optionId, score]) => ({
          option_id: Number(optionId),
          score
        }))
      }

      await votesAPI.submit(Number(voteId), submitData)

      const votedKey = `voted_${voteId}_${getDeviceId()}`
      localStorage.setItem(votedKey, 'true')
      
      setSubmitted(true)
      setHasVoted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败，请重试')
      refreshCaptcha()
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-gold rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">加载中...</p>
        </div>
      </div>
    )
  }

  if (error && !vote) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <p className="text-red-400 text-lg mb-6">{error}</p>
          <button
            onClick={loadVoteData}
            className="w-full py-3 bg-primary text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            重新加载
          </button>
        </div>
      </div>
    )
  }

  if (submitted || hasVoted) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="text-center max-w-sm w-full animate-bounce-in">
          <div className="w-20 h-20 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 gold-border">
            <span className="text-5xl">✅</span>
          </div>
          <h2 className="text-2xl font-bold text-gold gold-glow mb-4">提交成功</h2>
          <p className="text-gray-400 mb-6">感谢您的参与！</p>
          {vote?.show_results_real_time && (
            <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
              <h3 className="text-lg font-semibold text-white mb-4">实时结果</h3>
              <div className="space-y-3">
                {options.map(option => {
                  const total = options.reduce((s, o) => s + o.vote_count, 0)
                  const percent = total > 0 ? ((option.vote_count / total) * 100).toFixed(1) : '0'
                  return (
                    <div key={option.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-300">{option.text}</span>
                        <span className="text-primary">{percent}%</span>
                      </div>
                      <div className="h-2 bg-dark-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-red-600 rounded-full transition-all duration-1000"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-bg py-6 px-4">
      <div className="max-w-[480px] mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-red-700 mb-4 gold-border">
            <span className="text-3xl">🗳️</span>
          </div>
          <h1 className="text-2xl font-bold text-gold gold-glow mb-2">
            {vote?.title || '投票'}
          </h1>
          {vote?.description && (
            <p className="text-gray-400">{vote.description}</p>
          )}
          {vote?.vote_type === 'multiple' && vote.max_selections && (
            <p className="text-sm text-primary mt-2">
              最多选择 {vote.max_selections} 项
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <div className="space-y-3 mb-6">
          {vote?.vote_type === 'rating' ? (
            options.map(option => (
              <div
                key={option.id}
                className="bg-dark-card border border-dark-border rounded-xl p-4"
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="text-white font-medium">{option.text}</span>
                  <span className="text-gold font-bold text-xl">
                    {rating[option.id] !== undefined ? rating[option.id] : '-'}
                    <span className="text-sm text-gray-400">/{vote.rating_max || 10}</span>
                  </span>
                </div>
                <div className="flex items-center gap-1 justify-center mb-2">
                  {Array.from({ length: vote.rating_max || 10 }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => handleRatingChange(option.id, i + 1)}
                      className="text-3xl transition-transform hover:scale-110"
                    >
                      <span className={rating[option.id] !== undefined && rating[option.id] > i ? 'text-gold' : 'text-gray-600'}>
                        ★
                      </span>
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min="1"
                  max={vote.rating_max || 10}
                  value={rating[option.id] || 1}
                  onChange={(e) => handleRatingChange(option.id, Number(e.target.value))}
                  className="w-full h-2 bg-dark-border rounded-lg appearance-none cursor-pointer accent-gold"
                />
              </div>
            ))
          ) : (
            options.map(option => (
              <button
                key={option.id}
                onClick={() => handleOptionSelect(option.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                  selectedOptions.includes(option.id)
                    ? 'bg-primary/20 border-gold gold-border'
                    : 'bg-dark-card border-dark-border hover:border-primary/50'
                }`}
              >
                <div className={`w-6 h-6 flex items-center justify-center flex-shrink-0 ${
                  vote?.vote_type === 'single' ? 'rounded-full' : 'rounded-md'
                } border-2 ${
                  selectedOptions.includes(option.id)
                    ? 'border-gold bg-gold'
                    : 'border-gray-500'
                }`}>
                  {selectedOptions.includes(option.id) && (
                    <span className="text-primary text-sm font-bold">✓</span>
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className={`font-medium ${
                    selectedOptions.includes(option.id) ? 'text-gold' : 'text-white'
                  }`}>
                    {option.text}
                  </p>
                  {option.description && (
                    <p className="text-sm text-gray-400 mt-1">{option.description}</p>
                  )}
                </div>
                {option.image_url && (
                  <img
                    src={option.image_url}
                    alt={option.text}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                )}
              </button>
            ))
          )}
        </div>

        <div className="bg-dark-card border border-dark-border rounded-xl p-4 mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            验证码
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={captcha}
              onChange={(e) => {
                const value = e.target.value.slice(0, 4)
                setCaptcha(value)
                const { hasSensitive, filteredText } = checkSensitiveWords(value, sensitiveWords)
                if (hasSensitive) {
                  setCaptcha(filteredText)
                }
              }}
              placeholder="请输入验证码"
              className="flex-1 px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all"
              maxLength={4}
              autoComplete="off"
            />
            <button
              onClick={refreshCaptcha}
              className="px-4 py-2 bg-dark-bg border border-dark-border rounded-lg hover:bg-dark-border transition-colors overflow-hidden"
              title="点击刷新"
            >
              {captchaImage && (
                <img
                  src={captchaImage}
                  alt="验证码"
                  className="h-10 w-auto"
                />
              )}
            </button>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-4 bg-gradient-to-r from-primary to-red-600 hover:from-red-600 hover:to-primary text-white font-bold text-lg rounded-xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 gold-border"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              提交中...
            </span>
          ) : '提交投票'}
        </button>

        {eventId && (
          <p className="text-center text-gray-500 text-sm mt-6">
            活动编号: {eventId}
          </p>
        )}
      </div>
    </div>
  )
}

export default ParticipantVote
