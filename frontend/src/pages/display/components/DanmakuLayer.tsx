import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { Danmaku } from '../../types'
import { wsService } from '../../services/websocket'
import { generateId } from '../../utils'

interface DanmakuItem extends Danmaku {
  top: number
  duration: number
  animationId: string
  animationDelay: string
}

interface DanmakuLayerProps {
  eventId: number
  maxDanmaku?: number
}

const DanmakuLayer: React.FC<DanmakuLayerProps> = ({ eventId, maxDanmaku = 50 }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [danmakuList, setDanmakuList] = useState<DanmakuItem[]>([])
  const [pinnedDanmaku, setPinnedDanmaku] = useState<Danmaku | null>(null)
  const trackOccupied = useRef<number[]>([])
  const trackHeight = 50
  const maxTracks = 8

  const findAvailableTrack = useCallback((): number => {
    const now = Date.now()
    const trackOccupancyTime = 3000

    for (let i = 0; i < maxTracks; i++) {
      const lastUsed = trackOccupied.current[i] || 0
      if (now - lastUsed > trackOccupancyTime) {
        trackOccupied.current[i] = now
        return i
      }
    }

    const oldestTrack = trackOccupied.current.indexOf(Math.min(...trackOccupied.current))
    trackOccupied.current[oldestTrack] = now
    return oldestTrack
  }, [])

  const addDanmaku = useCallback((danmaku: Danmaku) => {
    if (!danmaku.is_approved && !danmaku.is_pinned) return

    if (danmaku.is_pinned) {
      setPinnedDanmaku(danmaku)
      return
    }

    const track = findAvailableTrack()
    const newDanmaku: DanmakuItem = {
      ...danmaku,
      top: track * trackHeight + 10,
      duration: 8 + Math.random() * 4,
      animationId: generateId(),
      animationDelay: `${Math.random() * 0.5}s`
    }

    setDanmakuList(prev => {
      const updated = [...prev, newDanmaku]
      if (updated.length > maxDanmaku) {
        return updated.slice(-maxDanmaku)
      }
      return updated
    })

    setTimeout(() => {
      setDanmakuList(prev => prev.filter(d => d.animationId !== newDanmaku.animationId))
    }, newDanmaku.duration * 1000)
  }, [findAvailableTrack, maxDanmaku])

  useEffect(() => {
    const unsubNew = wsService.onDisplay('danmaku_new', (data: { danmaku: Danmaku }) => {
      if (data.danmaku) {
        addDanmaku(data.danmaku)
      }
    })

    const unsubPin = wsService.onDisplay('danmaku_pinned', (data: { danmaku: Danmaku | null }) => {
      setPinnedDanmaku(data.danmaku || null)
    })

    const unsubUnpin = wsService.onDisplay('danmaku_unpinned', () => {
      setPinnedDanmaku(null)
    })

    return () => {
      unsubNew()
      unsubPin()
      unsubUnpin()
    }
  }, [eventId, addDanmaku])

  return (
    <div className="relative w-full h-full overflow-hidden pointer-events-none">
      {pinnedDanmaku && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 px-8 py-4 bg-gold/90 border-4 border-primary rounded-xl animate-pulse-gold">
          <p 
            className="text-2xl font-bold text-primary text-center whitespace-nowrap"
            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
          >
            📌 {pinnedDanmaku.content}
          </p>
        </div>
      )}

      <div ref={containerRef} className="relative w-full h-full">
        {danmakuList.map(danmaku => (
          <div
            key={danmaku.animationId}
            className="absolute whitespace-nowrap"
            style={{
              top: danmaku.top,
              right: '-100%',
              color: danmaku.color,
              fontSize: `${danmaku.font_size}px`,
              fontWeight: danmaku.font_size >= 24 ? 'bold' : 'normal',
              textShadow: '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.5)',
              animation: `danmakuMove ${danmaku.duration}s linear forwards`,
              animationDelay: danmaku.animationDelay,
              zIndex: 10
            }}
          >
            {danmaku.content}
          </div>
        ))}
      </div>
    </div>
  )
}

export default DanmakuLayer
