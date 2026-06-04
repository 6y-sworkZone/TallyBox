import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { Participant, Winner } from '../../../types'
import { wsService } from '../../../services/websocket'
import { getAvatarColor, getInitials } from '../../../utils'

interface LotteryCanvasProps {
  participants: Participant[]
  winnerCount: number
  title: string
  onWinnersDrawn?: (winners: Winner[]) => void
}

interface Confetti {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  rotation: number
  rotationSpeed: number
}

const LotteryCanvas: React.FC<LotteryCanvasProps> = ({
  participants,
  winnerCount,
  title,
  onWinnersDrawn
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isRolling, setIsRolling] = useState(false)
  const [winners, setWinners] = useState<Participant[]>([])
  const [showConfetti, setShowConfetti] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const animationRef = useRef<number>()
  const speedRef = useRef(50)
  const confettiRef = useRef<Confetti[]>([])
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null)

  const confettiAnimRef = useRef<number | null>(null)

  const generateConfetti = useCallback((): Confetti[] => {
    const colors = ['#E53935', '#FFD700', '#FF6B6B', '#FFE066', '#4ECDC4', '#45B7D1']
    const confetti: Confetti[] = []
    for (let i = 0; i < 150; i++) {
      confetti.push({
        x: Math.random() * window.innerWidth,
        y: -10 - Math.random() * 100,
        vx: (Math.random() - 0.5) * 8,
        vy: 3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 6 + Math.random() * 8,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 15
      })
    }
    return confetti
  }, [])

  const animateConfetti = useCallback(() => {
    const canvas = confettiCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    confettiRef.current = confettiRef.current.filter(c => c.y < canvas.height + 20)

    confettiRef.current.forEach(c => {
      c.x += c.vx
      c.y += c.vy
      c.rotation += c.rotationSpeed
      c.vy += 0.1

      ctx.save()
      ctx.translate(c.x, c.y)
      ctx.rotate((c.rotation * Math.PI) / 180)
      ctx.fillStyle = c.color
      ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size)
      ctx.restore()
    })

    if (confettiRef.current.length > 0) {
      confettiAnimRef.current = requestAnimationFrame(animateConfetti)
    }
  }, [])

  const triggerConfetti = useCallback(() => {
    setShowConfetti(true)
    confettiRef.current = generateConfetti()
    
    const canvas = confettiCanvasRef.current
    if (canvas) {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    
    animateConfetti()
    
    setTimeout(() => setShowConfetti(false), 5000)
  }, [generateConfetti, animateConfetti])

  const startRolling = useCallback(() => {
    if (participants.length === 0 || isRolling) return

    setIsRolling(true)
    setWinners([])
    speedRef.current = 50
    let rollCount = 0
    const totalRolls = 100 + Math.random() * 50

    const roll = () => {
      rollCount++
      
      if (rollCount > totalRolls * 0.7) {
        speedRef.current = Math.max(2, speedRef.current - 1.5)
      } else if (rollCount > totalRolls * 0.4) {
        speedRef.current = Math.max(10, speedRef.current - 0.5)
      }

      setCurrentIndex(Math.floor(Math.random() * participants.length))

      if (rollCount < totalRolls || speedRef.current > 2) {
        animationRef.current = window.setTimeout(roll, speedRef.current)
      } else {
        const selectedWinners: Participant[] = []
        const availableParticipants = [...participants]
        
        for (let i = 0; i < Math.min(winnerCount, availableParticipants.length); i++) {
          const randomIndex = Math.floor(Math.random() * availableParticipants.length)
          selectedWinners.push(availableParticipants[randomIndex])
          availableParticipants.splice(randomIndex, 1)
        }

        setWinners(selectedWinners)
        setIsRolling(false)
        triggerConfetti()
      }
    }

    roll()
  }, [participants, winnerCount, isRolling, triggerConfetti])

  useEffect(() => {
    const unsubDraw = wsService.onDisplay('lottery_draw', () => {
      startRolling()
    })

    const unsubWinners = wsService.onDisplay('lottery_winners', (data: { winners: Winner[] }) => {
      if (data.winners) {
        setWinners(data.winners.map(w => w.participant))
        triggerConfetti()
        onWinnersDrawn?.(data.winners)
      }
    })

    return () => {
      unsubDraw()
      unsubWinners()
      if (animationRef.current) {
        clearTimeout(animationRef.current)
      }
    }
  }, [startRolling, triggerConfetti, onWinnersDrawn])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resizeCanvas = () => {
      const rect = canvas.parentElement?.getBoundingClientRect()
      if (rect) {
        canvas.width = rect.width
        canvas.height = rect.height
      }
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    const drawRolling = () => {
      if (!isRolling || participants.length === 0) return

      ctx.fillStyle = 'rgba(15, 23, 42, 0.15)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const centerY = canvas.height / 2
      const itemHeight = 80
      const visibleCount = 5
      const halfVisible = Math.floor(visibleCount / 2)

      for (let i = -halfVisible; i <= halfVisible; i++) {
        const idx = (currentIndex + i + participants.length * 3) % participants.length
        const participant = participants[idx]
        const y = centerY + i * itemHeight
        const distance = Math.abs(i)
        const opacity = 1 - distance * 0.2
        const scale = 1 - distance * 0.1

        ctx.save()
        ctx.globalAlpha = opacity
        ctx.translate(canvas.width / 2, y)
        ctx.scale(scale, scale)

        const gradient = ctx.createLinearGradient(-200, -35, 200, 35)
        gradient.addColorStop(0, 'rgba(229, 57, 53, 0.8)')
        gradient.addColorStop(0.5, 'rgba(229, 57, 53, 0.4)')
        gradient.addColorStop(1, 'rgba(229, 57, 53, 0.8)')
        
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.roundRect(-200, -35, 400, 70, 10)
        ctx.fill()

        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 28px "Noto Sans SC"'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(participant.name, 0, 0)

        ctx.restore()
      }

      ctx.strokeStyle = '#FFD700'
      ctx.lineWidth = 4
      ctx.shadowColor = 'rgba(255, 215, 0, 0.8)'
      ctx.shadowBlur = 20
      ctx.beginPath()
      ctx.moveTo(50, centerY - 35)
      ctx.lineTo(canvas.width - 50, centerY - 35)
      ctx.moveTo(50, centerY + 35)
      ctx.lineTo(canvas.width - 50, centerY + 35)
      ctx.stroke()
      ctx.shadowBlur = 0

      requestAnimationFrame(drawRolling)
    }

    if (isRolling) {
      drawRolling()
    } else if (winners.length === 0) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#64748B'
      ctx.font = 'bold 32px "Noto Sans SC"'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('等待抽奖开始...', canvas.width / 2, canvas.height / 2)
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [isRolling, currentIndex, participants, winners.length])

  const gridCols = winners.length <= 3 ? winners.length : winners.length <= 4 ? 2 : 3

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-bold text-gold gold-glow mb-8 text-center">
        {title}
      </h2>

      {isRolling && (
        <div className="relative w-full max-w-3xl h-96">
          <canvas ref={canvasRef} className="w-full h-full rounded-2xl neon-border" />
        </div>
      )}

      {!isRolling && winners.length > 0 && (
        <div 
          className="grid gap-8 w-full max-w-4xl px-8"
          style={{ 
            gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` 
          }}
        >
          {winners.map((winner, index) => (
            <div
              key={winner.id}
              className="flex flex-col items-center animate-bounce-in"
              style={{ animationDelay: `${index * 0.2}s` }}
            >
              <div className="relative">
                <div 
                  className="w-32 h-32 rounded-full flex items-center justify-center text-5xl font-bold text-white gold-border"
                  style={{ backgroundColor: getAvatarColor(winner.name) }}
                >
                  {winner.avatar ? (
                    <img 
                      src={winner.avatar} 
                      alt={winner.name} 
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials(winner.name)
                  )}
                </div>
                <div className="absolute -top-2 -right-2 w-10 h-10 bg-gold rounded-full flex items-center justify-center text-primary font-bold text-lg">
                  {index + 1}
                </div>
              </div>
              <h3 className="text-3xl font-bold text-gold gold-glow mt-4">
                {winner.name}
              </h3>
              {winner.department && (
                <p className="text-gray-400 text-xl mt-1">{winner.department}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {!isRolling && winners.length === 0 && participants.length === 0 && (
        <div className="text-center">
          <p className="text-2xl text-gray-500">暂无参与人员</p>
        </div>
      )}

      {showConfetti && (
        <canvas
          ref={confettiCanvasRef}
          className="fixed inset-0 pointer-events-none z-50"
        />
      )}
    </div>
  )
}

export default LotteryCanvas
