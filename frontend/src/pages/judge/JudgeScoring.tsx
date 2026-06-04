import React, { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import type { Scoring, ScoringDimension } from '../../types'
import { scoringAPI } from '../../services/api'
import { getDeviceId } from '../../utils'

interface TargetScore {
  targetName: string
  scores: Record<number, number>
  submitted: boolean
}

const JudgeScoring: React.FC = () => {
  const { scoringId } = useParams<{ scoringId: string }>()
  const [searchParams] = useSearchParams()
  const eventId = searchParams.get('eventId')

  const [judgeName, setJudgeName] = useState('')
  const [scoring, setScoring] = useState<Scoring | null>(null)
  const [dimensions, setDimensions] = useState<ScoringDimension[]>([])
  const [targets, setTargets] = useState<TargetScore[]>([])
  const [currentTargetIndex, setCurrentTargetIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'name' | 'scoring'>('name')
  const [allSubmitted, setAllSubmitted] = useState(false)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    if (!scoringId || hasLoadedRef.current) return
    hasLoadedRef.current = true

    const loadScoringData = async () => {
      try {
        setLoading(true)
        const [scoringData, resultsData] = await Promise.all([
          scoringAPI.get(Number(scoringId)),
          scoringAPI.results(Number(scoringId))
        ])

        const scoringInfo = scoringData as Scoring
        setScoring(scoringInfo)

        const dims = (resultsData as { dimensions: ScoringDimension[] }).dimensions || []
        setDimensions(dims)

        const targetNames = (resultsData as { targets: string[] }).targets || ['选手1', '选手2', '选手3']
        
        const scoredKey = `scored_${scoringId}_${getDeviceId()}`
        const savedJudge = localStorage.getItem(`${scoredKey}_judge`)
        const savedScores = localStorage.getItem(scoredKey)
        
        if (savedJudge && savedScores) {
          setJudgeName(savedJudge)
          const parsed = JSON.parse(savedScores) as TargetScore[]
          setTargets(parsed)
          setAllSubmitted(parsed.every(t => t.submitted))
          setStep('scoring')
        } else {
          const initialTargets = targetNames.map(name => ({
            targetName: name,
            scores: dims.reduce((acc, dim) => ({ ...acc, [dim.id]: 0 }), {}),
            submitted: false
          }))
          setTargets(initialTargets)
        }

        setError('')
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载评分信息失败')
      } finally {
        setLoading(false)
      }
    }

    loadScoringData()
  }, [scoringId])

  const handleStartScoring = () => {
    if (!judgeName.trim()) {
      setError('请输入评委姓名')
      return
    }
    setStep('scoring')
  }

  const handleScoreChange = (dimensionId: number, value: number) => {
    setTargets(prev => {
      const updated = [...prev]
      updated[currentTargetIndex] = {
        ...updated[currentTargetIndex],
        scores: {
          ...updated[currentTargetIndex].scores,
          [dimensionId]: value
        }
      }
      return updated
    })
  }

  const handleSubmitScore = async () => {
    if (!scoringId || !judgeName.trim()) return

    const currentTarget = targets[currentTargetIndex]
    const allScored = dimensions.every(dim => currentTarget.scores[dim.id] > 0)

    if (!allScored) {
      setError('请为所有维度评分')
      return
    }

    try {
      setSubmitting(true)
      setError('')

      for (const dim of dimensions) {
        await scoringAPI.submit(Number(scoringId), {
          judge_name: judgeName.trim(),
          target_name: currentTarget.targetName,
          dimension_id: dim.id,
          score: currentTarget.scores[dim.id]
        })
      }

      const updatedTargets = [...targets]
      updatedTargets[currentTargetIndex] = {
        ...updatedTargets[currentTargetIndex],
        submitted: true
      }
      setTargets(updatedTargets)

      const scoredKey = `scored_${scoringId}_${getDeviceId()}`
      localStorage.setItem(`${scoredKey}_judge`, judgeName.trim())
      localStorage.setItem(scoredKey, JSON.stringify(updatedTargets))

      if (updatedTargets.every(t => t.submitted)) {
        setAllSubmitted(true)
      } else {
        setCurrentTargetIndex(prev => Math.min(prev + 1, targets.length - 1))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  const calculateAverage = (scores: Record<number, number>) => {
    const values = Object.values(scores).filter(s => s > 0)
    if (values.length === 0) return 0
    return values.reduce((sum, s) => sum + s, 0) / values.length
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

  if (error && !scoring) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <p className="text-red-400 text-lg mb-6">{error}</p>
          <button
            onClick={loadScoringData}
            className="w-full py-3 bg-primary text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            重新加载
          </button>
        </div>
      </div>
    )
  }

  if (allSubmitted) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="text-center max-w-sm w-full animate-bounce-in">
          <div className="w-20 h-20 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 gold-border">
            <span className="text-5xl">✅</span>
          </div>
          <h2 className="text-2xl font-bold text-gold gold-glow mb-4">评分完成</h2>
          <p className="text-gray-400 mb-2">评委：{judgeName}</p>
          <p className="text-gray-400 mb-6">感谢您的专业评分！</p>
          
          <div className="bg-dark-card border border-dark-border rounded-xl p-4 mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">评分结果</h3>
            <div className="space-y-3">
              {targets.map((target, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-dark-border last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 text-xs">
                      ✓
                    </span>
                    <span className="text-white">{target.targetName}</span>
                  </div>
                  <span className="text-gold font-bold">
                    {calculateAverage(target.scores).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'name') {
    return (
      <div className="min-h-screen bg-dark-bg py-6 px-4 flex items-center justify-center">
        <div className="max-w-[480px] w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-red-700 mb-4 gold-border">
              <span className="text-4xl">⚖️</span>
            </div>
            <h1 className="text-3xl font-bold text-gold gold-glow mb-2">
              {scoring?.name || '评分'}
            </h1>
            <p className="text-gray-400">请输入您的姓名作为评委标识</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-xl text-red-400 text-center">
              {error}
            </div>
          )}

          <div className="bg-dark-card border border-dark-border rounded-xl p-6 mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              评委姓名
            </label>
            <input
              type="text"
              value={judgeName}
              onChange={(e) => setJudgeName(e.target.value)}
              placeholder="请输入您的姓名"
              className="w-full px-4 py-4 bg-dark-bg border border-dark-border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all text-center text-xl"
              maxLength={20}
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleStartScoring()
                }
              }}
            />
          </div>

          <button
            onClick={handleStartScoring}
            disabled={!judgeName.trim()}
            className="w-full py-4 bg-gradient-to-r from-primary to-red-600 hover:from-red-600 hover:to-primary text-white font-bold text-lg rounded-xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 gold-border"
          >
            开始评分
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

  const currentTarget = targets[currentTargetIndex]
  const currentAvg = calculateAverage(currentTarget.scores)
  const allScored = dimensions.every(dim => currentTarget.scores[dim.id] > 0)

  return (
    <div className="min-h-screen bg-dark-bg py-6 px-4">
      <div className="max-w-[480px] mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-red-700 mb-4 gold-border">
            <span className="text-3xl">⚖️</span>
          </div>
          <h1 className="text-2xl font-bold text-gold gold-glow mb-1">
            {scoring?.name || '评分'}
          </h1>
          <p className="text-gray-400 text-sm">评委：{judgeName}</p>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {targets.map((target, index) => (
            <button
              key={index}
              onClick={() => setCurrentTargetIndex(index)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg border-2 transition-all ${
                currentTargetIndex === index
                  ? 'bg-primary/20 border-gold text-gold'
                  : target.submitted
                    ? 'bg-green-900/20 border-green-500/50 text-green-400'
                    : 'bg-dark-card border-dark-border text-gray-400'
              }`}
            >
              <span className="flex items-center gap-2">
                {target.submitted && <span>✓</span>}
                {target.targetName}
              </span>
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <div className="bg-dark-card border border-dark-border rounded-xl p-4 mb-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">{currentTarget.targetName}</h2>
            <div className="text-right">
              <p className="text-sm text-gray-400">平均分</p>
              <p className={`text-3xl font-bold ${allScored ? 'text-gold gold-glow' : 'text-gray-500'}`}>
                {allScored ? currentAvg.toFixed(2) : '--'}
              </p>
            </div>
          </div>
          
          {currentTarget.submitted && (
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 mb-4">
              <p className="text-green-400 text-sm text-center">✓ 已提交评分</p>
            </div>
          )}
        </div>

        {!currentTarget.submitted && (
          <div className="space-y-4 mb-6">
            {dimensions.map(dim => (
              <div
                key={dim.id}
                className="bg-dark-card border border-dark-border rounded-xl p-4"
              >
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h3 className="font-medium text-white">{dim.name}</h3>
                    {dim.description && (
                      <p className="text-xs text-gray-500 mt-1">{dim.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${
                      currentTarget.scores[dim.id] > 0 ? 'text-gold' : 'text-gray-500'
                    }`}>
                      {currentTarget.scores[dim.id] || '-'}
                      <span className="text-sm text-gray-500">/{dim.max_score}</span>
                    </p>
                    {dim.weight !== 1 && (
                      <p className="text-xs text-gray-500">权重 {dim.weight}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs text-gray-500">1</span>
                  <input
                    type="range"
                    min="1"
                    max={dim.max_score}
                    value={currentTarget.scores[dim.id] || 1}
                    onChange={(e) => handleScoreChange(dim.id, Number(e.target.value))}
                    className="flex-1 h-3 bg-dark-border rounded-lg appearance-none cursor-pointer accent-gold"
                  />
                  <span className="text-xs text-gray-500">{dim.max_score}</span>
                </div>

                <div className="flex justify-center gap-1">
                  {Array.from({ length: dim.max_score }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => handleScoreChange(dim.id, i + 1)}
                      className={`w-8 h-8 rounded text-sm font-medium transition-all ${
                        currentTarget.scores[dim.id] === i + 1
                          ? 'bg-gold text-primary'
                          : 'bg-dark-border text-gray-400 hover:bg-primary/30'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!currentTarget.submitted && (
          <button
            onClick={handleSubmitScore}
            disabled={submitting || !allScored}
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
            ) : (
              currentTargetIndex < targets.length - 1 
                ? '提交并继续下一个' 
                : '提交完成'
            )}
          </button>
        )}

        <div className="mt-4 flex justify-between items-center text-sm">
          <span className="text-gray-500">
            进度：{targets.filter(t => t.submitted).length} / {targets.length}
          </span>
          <div className="flex gap-1">
            {targets.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  targets[i].submitted 
                    ? 'bg-green-500' 
                    : i === currentTargetIndex 
                      ? 'bg-gold' 
                      : 'bg-gray-600'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default JudgeScoring
