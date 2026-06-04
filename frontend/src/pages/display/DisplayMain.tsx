import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import type { Event, FlowStep, Participant, VoteOption, CheckInStats, ScoringDimension, Prize } from '../../types'
import { eventsAPI, votesAPI, participantsAPI, checkinAPI, scoringAPI, lotteryAPI } from '../../services/api'
import { wsService } from '../../services/websocket'
import VoteResults from './components/VoteResults'
import LotteryCanvas from './components/LotteryCanvas'
import DanmakuLayer from './components/DanmakuLayer'
import CheckInWall from './components/CheckInWall'
import ScoringDisplay from './components/ScoringDisplay'
import { animateNumber } from '../../utils'

interface Particle {
  x: number
  y: number
  radius: number
  vx: number
  vy: number
  color: string
  alpha: number
}

const DisplayMain: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animationRef = useRef<number>()

  const [event, setEvent] = useState<Event | null>(null)
  const [activeStep, setActiveStep] = useState<FlowStep | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [showCountdown, setShowCountdown] = useState(false)

  const [voteOptions, setVoteOptions] = useState<VoteOption[]>([])
  const [voteTitle, setVoteTitle] = useState('')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [lotteryWinnerCount, setLotteryWinnerCount] = useState(1)
  const [currentPrize, setCurrentPrize] = useState<Prize | null>(null)
  const [checkInStats, setCheckInStats] = useState<CheckInStats>({
    total: 0,
    checked_in: 0,
    not_checked_in: 0,
    late_count: 0,
    check_in_rate: 0,
    by_department: {},
    recent_checkins: []
  })
  const [scoringDimensions, setScoringDimensions] = useState<ScoringDimension[]>([])
  const [scoringTitle, setScoringTitle] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [displayCount, setDisplayCount] = useState(0)

  const initParticles = useCallback((width: number, height: number): Particle[] => {
    const particles: Particle[] = []
    const colors = ['#E53935', '#FFD700', '#FF6B6B', '#FFE066']
    
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 3 + 1,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.5 + 0.3
      })
    }
    return particles
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      particlesRef.current = initParticles(canvas.width, canvas.height)
    }
    resizeCanvas()

    const animate = () => {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.05)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      particlesRef.current.forEach((p) => {
        p.x += p.vx
        p.y += p.vy

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.alpha
        ctx.fill()
        ctx.globalAlpha = 1
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()
    window.addEventListener('resize', resizeCanvas)

    return () => {
      cancelAnimationFrame(animationRef.current!)
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [initParticles])

  useEffect(() => {
    if (!eventId) return

    const loadData = async () => {
      try {
        setLoading(true)
        
        const [eventData, flows, participantsData, qrCode] = await Promise.all([
          eventsAPI.get(Number(eventId)),
          eventsAPI.getFlows(Number(eventId)),
          participantsAPI.list(Number(eventId)),
          checkinAPI.qrCode(Number(eventId))
        ])

        setEvent(eventData as Event)
        setParticipants(participantsData as Participant[])
        setQrCodeUrl(qrCode as string)

        const active = (flows as FlowStep[]).find(f => f.is_active)
        if (active) {
          setActiveStep(active)
          await loadStepContent(active)
        }

        const stats = await checkinAPI.stats(Number(eventId))
        setCheckInStats(stats as CheckInStats)
        animateNumber(0, (stats as CheckInStats).checked_in, 1500, setDisplayCount)

      } catch (err) {
        setError(err instanceof Error ? err.message : '加载数据失败')
      } finally {
        setLoading(false)
      }
    }

    loadData()
    wsService.connectDisplay(Number(eventId))

    const unsubStep = wsService.onDisplay('flow_change', async (data: { step: FlowStep }) => {
      if (data.step) {
        setActiveStep(data.step)
        await loadStepContent(data.step)
      }
    })

    const unsubVote = wsService.onDisplay('vote_update', (data: { options: VoteOption[] }) => {
      if (data.options) {
        setVoteOptions(data.options)
      }
    })

    const unsubCheckin = wsService.onDisplay('checkin_update', (data: { stats: CheckInStats }) => {
      if (data.stats) {
        setCheckInStats(data.stats)
        animateNumber(displayCount, data.stats.checked_in, 800, setDisplayCount)
      }
    })

    const unsubCountdown = wsService.onDisplay('countdown_start', (data: { seconds: number }) => {
      if (data.seconds) {
        setCountdown(data.seconds)
        setShowCountdown(true)
      }
    })

    return () => {
      unsubStep()
      unsubVote()
      unsubCheckin()
      unsubCountdown()
      wsService.disconnectDisplay()
    }
  }, [eventId])

  useEffect(() => {
    if (!showCountdown || countdown <= 0) return

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setShowCountdown(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [showCountdown, countdown])

  const loadStepContent = async (step: FlowStep) => {
    if (!eventId) return

    try {
      switch (step.step_type) {
        case 'voting':
          if (step.vote_id) {
            const [voteData, results] = await Promise.all([
              votesAPI.get(step.vote_id),
              votesAPI.results(step.vote_id)
            ])
            setVoteTitle((voteData as { title: string }).title)
            setVoteOptions(results as VoteOption[])
          }
          break
        case 'lottery':
          if (step.lottery_id) {
            const lotteryData = await lotteryAPI.get(step.lottery_id)
            const lottery = lotteryData as { winner_count: number; prize: Prize }
            setLotteryWinnerCount(lottery.winner_count)
            setCurrentPrize(lottery.prize)
          }
          break
        case 'performance':
        case 'award':
        case 'ending':
          break
        case 'opening':
          break
      }
    } catch (err) {
      console.error('加载环节内容失败:', err)
    }
  }

  const renderMainContent = () => {
    if (!activeStep) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-[clamp(2rem,4vw,4rem)] text-gray-500 animate-pulse">
              等待活动开始...
            </p>
          </div>
        </div>
      )
    }

    switch (activeStep.step_type) {
      case 'opening':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
            <h1 className="text-[clamp(3rem,6vw,6rem)] font-black text-gold gold-glow mb-8">
              {event?.name}
            </h1>
            <div className="text-[clamp(1.5rem,3vw,2.5rem)] text-gray-300 mb-12 max-w-3xl">
              {activeStep.description || '欢迎参加本次活动！'}
            </div>
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-6xl font-bold text-primary glow-text">{displayCount}</p>
                <p className="text-xl text-gray-400 mt-2">已签到</p>
              </div>
              <div className="w-px h-20 bg-gray-600" />
              <div className="text-center">
                <p className="text-6xl font-bold text-gold gold-glow">{checkInStats.total}</p>
                <p className="text-xl text-gray-400 mt-2">总人数</p>
              </div>
            </div>
            {showCountdown && (
              <div className="mt-16">
                <p className="text-2xl text-gray-400 mb-4">活动即将开始</p>
                <p className="text-[clamp(5rem,10vw,8rem)] font-black text-primary glow-text animate-bounce-in">
                  {countdown}
                </p>
              </div>
            )}
          </div>
        )

      case 'voting':
        if (activeStep.vote_id) {
          return (
            <VoteResults
              voteId={activeStep.vote_id}
              options={voteOptions}
              title={voteTitle || activeStep.title}
            />
          )
        }
        break

      case 'lottery':
        return (
          <div className="h-full flex flex-col">
            {currentPrize && (
              <div className="text-center mb-4">
                <p className="text-xl text-gray-400">
                  奖品：<span className="text-gold font-bold">{currentPrize.name}</span>
                </p>
              </div>
            )}
            <div className="flex-1">
              <LotteryCanvas
                participants={participants.filter(p => p.is_checked_in)}
                winnerCount={lotteryWinnerCount}
                title={activeStep.title}
              />
            </div>
          </div>
        )

      case 'performance':
      case 'award':
      case 'ending':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
            <div className="mb-8">
              <span className="text-8xl">
                {activeStep.step_type === 'performance' ? '🎭' : 
                 activeStep.step_type === 'award' ? '🏆' : '🎉'}
              </span>
            </div>
            <h2 className="text-[clamp(3rem,6vw,5rem)] font-black text-gold gold-glow mb-6">
              {activeStep.title}
            </h2>
            {activeStep.description && (
              <p className="text-[clamp(1.2rem,2.5vw,2rem)] text-gray-300 max-w-2xl">
                {activeStep.description}
              </p>
            )}
          </div>
        )
    }

    return null
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-dark-bg">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-gold rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xl text-gray-400">加载中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-dark-bg">
        <div className="text-center">
          <p className="text-2xl text-red-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            重新加载
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-dark-bg">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0"
      />

      <div className="particle-bg absolute inset-0 z-0" />

      <div className="relative z-10 flex flex-col h-full p-4">
        <div className="flex items-center justify-between mb-4 h-24">
          <div className="flex-1">
            <h1 className="text-[clamp(1.5rem,3vw,2.5rem)] font-bold text-gold gold-glow truncate">
              {event?.name}
            </h1>
            {activeStep && (
              <div className="flex items-center gap-3 mt-2">
                <span className="px-4 py-1 bg-primary/20 border border-primary rounded-full text-primary text-sm font-medium">
                  当前环节
                </span>
                <span className="text-[clamp(1rem,2vw,1.5rem)] text-white font-semibold">
                  {activeStep.title}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-sm text-gray-400">扫码参与</p>
              <p className="text-xl font-mono text-gold">{eventId}</p>
            </div>
            <div className="w-20 h-20 bg-white rounded-lg p-2 gold-border">
              {qrCodeUrl ? (
                <img
                  src={qrCodeUrl}
                  alt="扫码参与"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                  二维码
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {renderMainContent()}
        </div>

        <div className="h-32 mt-4 border-t border-dark-border/50 pt-2">
          <DanmakuLayer eventId={Number(eventId)} maxDanmaku={30} />
        </div>
      </div>

      {showCountdown && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="animate-bounce-in">
            <p className="text-[clamp(8rem,15vw,12rem)] font-black text-gold gold-glow">
              {countdown}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default DisplayMain
