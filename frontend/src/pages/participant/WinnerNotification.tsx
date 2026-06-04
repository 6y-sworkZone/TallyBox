import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import type { Winner } from '../../types'
import { lotteryAPI } from '../../services/api'
import { getAvatarColor, getInitials } from '../../utils'

const confettiColors = ['#E53935', '#FFD700', '#FF6B6B', '#FFE066', '#4ECDC4']

interface ConfettiData {
  left: string
  color: string
  delay: string
  duration: string
}

function generateConfettiData(): ConfettiData[] {
  return Array.from({ length: 50 }).map(() => ({
    left: `${Math.random() * 100}%`,
    color: confettiColors[Math.floor(Math.random() * 5)],
    delay: `${Math.random() * 2}s`,
    duration: `${2 + Math.random() * 2}s`
  }))
}

const WinnerNotification: React.FC = () => {
  const { winnerId } = useParams<{ winnerId: string }>()

  const [winner, setWinner] = useState<Winner | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [error, setError] = useState('')
  const [showConfetti, setShowConfetti] = useState(true)
  const [confettiData] = useState<ConfettiData[]>(generateConfettiData)

  useEffect(() => {
    if (!winnerId) return

    const loadWinner = async () => {
      try {
        setLoading(true)
        const winners = await lotteryAPI.winners(0)
        const allWinners = winners as Winner[]
        const winnerData = allWinners.find(w => w.id === Number(winnerId))
        
        if (!winnerData) {
          setError('未找到中奖信息')
          return
        }

        setWinner(winnerData)
        setClaimed(winnerData.is_claimed)
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载中奖信息失败')
      } finally {
        setLoading(false)
      }
    }

    loadWinner()

    const timer = setTimeout(() => setShowConfetti(false), 5000)
    return () => clearTimeout(timer)
  }, [winnerId])

  const handleClaim = async () => {
    if (!winner) return

    try {
      setClaiming(true)
      setError('')

      await lotteryAPI.markClaimed(winner.id)
      setClaimed(true)
      setWinner(prev => prev ? { ...prev, is_claimed: true } : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '确认失败，请重试')
    } finally {
      setClaiming(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gold border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">加载中...</p>
        </div>
      </div>
    )
  }

  if (error || !winner) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <p className="text-red-400 text-lg mb-6">{error || '未找到中奖信息'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-bg py-6 px-4 relative overflow-hidden">
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-0">
          {confettiData.map((data, i) => (
            <div
              key={i}
              className="confetti"
              style={{
                left: data.left,
                backgroundColor: data.color,
                animationDelay: data.delay,
                animationDuration: data.duration
              }}
            />
          ))}
        </div>
      )}

      <div className="max-w-[480px] mx-auto relative z-10">
        <div className="text-center animate-bounce-in">
          <div className="mb-6">
            <span className="text-6xl">🎉</span>
          </div>

          <h1 className="text-4xl font-black text-gold gold-glow mb-2">
            恭喜中奖！
          </h1>
          <p className="text-gray-400 mb-8">
            您在本次活动中幸运中奖
          </p>

          <div className="bg-dark-card border-2 border-gold rounded-2xl p-6 mb-6 gold-border">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold text-white border-4 border-gold"
                style={{ backgroundColor: getAvatarColor(winner.participant.name) }}
              >
                {winner.participant.avatar ? (
                  <img
                    src={winner.participant.avatar}
                    alt={winner.participant.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  getInitials(winner.participant.name)
                )}
              </div>
            </div>

            <h2 className="text-3xl font-bold text-gold gold-glow mb-2">
              {winner.participant.name}
            </h2>
            {winner.participant.department && (
              <p className="text-gray-400 mb-6">{winner.participant.department}</p>
            )}

            <div className="bg-gradient-to-r from-primary/20 to-gold/20 rounded-xl p-6 border border-gold/30">
              <div className="mb-4">
                {winner.prize.image_url && (
                  <img
                    src={winner.prize.image_url}
                    alt={winner.prize.name}
                    className="w-32 h-32 object-cover rounded-xl mx-auto mb-4 gold-border"
                  />
                )}
                {!winner.prize.image_url && (
                  <div className="w-24 h-24 bg-gold/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-5xl">🎁</span>
                  </div>
                )}
              </div>
              
              <h3 className="text-2xl font-bold text-gold gold-glow mb-2">
                {winner.prize.name}
              </h3>
              {winner.prize.description && (
                <p className="text-gray-300 mt-2">{winner.prize.description}</p>
              )}
            </div>
          </div>

          <div className="bg-dark-card border border-dark-border rounded-xl p-5 mb-6 text-left">
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span>📍</span> 领奖信息
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">领奖地点</span>
                <span className="text-white font-medium">活动现场服务台</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">领奖时间</span>
                <span className="text-white font-medium">活动结束后30分钟内</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-dark-border">
                <span className="text-gray-400">状态</span>
                <span className={`font-medium ${
                  claimed ? 'text-green-400' : 'text-gold'
                }`}>
                  {claimed ? '✓ 已确认' : '待确认'}
                </span>
              </div>
            </div>
          </div>

          {!claimed ? (
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="w-full py-4 bg-gradient-to-r from-gold to-yellow-500 hover:from-yellow-500 hover:to-gold text-primary font-bold text-xl rounded-xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-gold/30"
            >
              {claiming ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  确认中...
                </span>
              ) : '确认领奖'}
            </button>
          ) : (
            <div className="bg-green-900/30 border border-green-500/50 rounded-xl p-4 text-center">
              <p className="text-green-400 font-medium text-lg">
                ✅ 您已确认领奖
              </p>
              <p className="text-gray-400 text-sm mt-1">
                请前往服务台出示此页面领取奖品
              </p>
            </div>
          )}

          <div className="mt-6 p-4 bg-primary/10 border border-primary/30 rounded-xl">
            <p className="text-primary text-sm">
              ⚠️ 请妥善保管此页面，领奖时需出示
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WinnerNotification
