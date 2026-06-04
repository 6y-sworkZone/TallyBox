import React, { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'
import type { Participant, CheckInStats } from '../../../types'
import { wsService } from '../../../services/websocket'
import { getAvatarColor, getInitials, animateNumber } from '../../../utils'

interface CheckInWallProps {
  eventId: number
  stats: CheckInStats
}

const CheckInWall: React.FC<CheckInWallProps> = ({ eventId, stats }) => {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)
  const [displayCount, setDisplayCount] = useState(0)
  const [recentCheckins, setRecentCheckins] = useState<Participant[]>([])

  useEffect(() => {
    animateNumber(displayCount, stats.checked_in, 1500, setDisplayCount)
  }, [stats.checked_in])

  useEffect(() => {
    if (stats.recent_checkins) {
      setRecentCheckins(stats.recent_checkins.slice(0, 50))
    }
  }, [stats.recent_checkins])

  useEffect(() => {
    if (!chartRef.current) return

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'dark')
    }

    const checkInRate = stats.check_in_rate || 0

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      series: [
        {
          type: 'gauge',
          startAngle: 90,
          endAngle: -270,
          pointer: {
            show: false
          },
          progress: {
            show: true,
            overlap: false,
            roundCap: true,
            clip: false,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 1, 1, [
                { offset: 0, color: '#E53935' },
                { offset: 1, color: '#FFD700' }
              ]),
              shadowColor: 'rgba(229, 57, 53, 0.5)',
              shadowBlur: 20
            }
          },
          axisLine: {
            lineStyle: {
              width: 30,
              color: [[1, 'rgba(51, 65, 85, 0.5)']]
            }
          },
          splitLine: {
            show: false
          },
          axisTick: {
            show: false
          },
          axisLabel: {
            show: false
          },
          data: [
            {
              value: checkInRate * 100,
              detail: {
                valueAnimation: true,
                offsetCenter: ['0%', '0%']
              }
            }
          ],
          detail: {
            width: 60,
            height: 30,
            fontSize: 48,
            fontWeight: 'bold',
            fontFamily: 'Noto Sans SC',
            color: '#FFD700',
            formatter: '{value}%',
            textShadowColor: 'rgba(255, 215, 0, 0.5)',
            textShadowBlur: 10
          }
        }
      ]
    }

    chartInstance.current.setOption(option, true)

    const handleResize = () => {
      chartInstance.current?.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chartInstance.current?.dispose()
      chartInstance.current = null
    }
  }, [stats.check_in_rate, eventId])

  useEffect(() => {
    const unsubCheckin = wsService.onDisplay('checkin_new', (data: { participant: Participant }) => {
      if (data.participant) {
        setRecentCheckins(prev => {
          const exists = prev.find(p => p.id === data.participant.id)
          if (exists) return prev
          const updated = [data.participant, ...prev]
          return updated.slice(0, 50)
        })
        animateNumber(displayCount, displayCount + 1, 800, setDisplayCount)
      }
    })

    return () => {
      unsubCheckin()
    }
  }, [eventId, displayCount])

  return (
    <div className="w-full h-full flex flex-col">
      <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-bold text-gold gold-glow mb-6 text-center">
        实时签到
      </h2>

      <div className="flex-1 flex gap-8 overflow-hidden">
        <div className="w-1/3 flex flex-col items-center justify-center p-8">
          <div className="w-full max-w-xs">
            <div ref={chartRef} className="w-full h-64" />
          </div>
          <div className="text-center mt-4">
            <p className="text-gray-400 text-xl mb-2">签到率</p>
            <p className="text-5xl font-bold text-white">
              <span className="text-primary">{displayCount}</span>
              <span className="text-gray-500 text-3xl mx-2">/</span>
              <span className="text-gray-400 text-3xl">{stats.total}</span>
            </p>
            {stats.late_count > 0 && (
              <p className="text-primary text-xl mt-4 flex items-center justify-center gap-2">
                <span className="text-2xl">⚠️</span>
                迟到 {stats.late_count} 人
              </p>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden p-4">
          <h3 className="text-2xl font-semibold text-gray-300 mb-4">
            最近签到 ({recentCheckins.length}人)
          </h3>
          <div className="grid grid-cols-8 gap-3 auto-rows-max overflow-y-auto h-[calc(100%-3rem)] scrollbar-hide">
            {recentCheckins.map((participant, index) => (
              <div
                key={participant.id}
                className={`flex flex-col items-center checkin-avatar ${
                  participant.is_late ? 'ring-4 ring-primary' : ''
                } rounded-full p-1`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white"
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
                <p className="text-sm text-gray-300 mt-1 truncate w-full text-center">
                  {participant.name}
                </p>
                {participant.is_late && (
                  <span className="text-xs text-primary font-bold">迟到</span>
                )}
              </div>
            ))}
          </div>
          {recentCheckins.length === 0 && (
            <div className="flex items-center justify-center h-full text-gray-500 text-xl">
              等待签到...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CheckInWall
