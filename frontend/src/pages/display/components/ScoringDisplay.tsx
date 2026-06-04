import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as echarts from 'echarts'
import type { ScoringDimension, JudgeScore } from '../../types'
import { wsService } from '../../services/websocket'
import { formatNumber } from '../../utils'

interface ScoreResult {
  targetName: string
  finalScore: number
  rawScores: number[]
  dimensions: { name: string; score: number }[]
  judgeCount: number
}

interface ScoringDisplayProps {
  scoringId: number
  dimensions: ScoringDimension[]
  title: string
}

const ScoringDisplay: React.FC<ScoringDisplayProps> = ({ scoringId, dimensions, title }) => {
  const barChartRef = useRef<HTMLDivElement>(null)
  const radarChartRef = useRef<HTMLDivElement>(null)
  const barChartInstance = useRef<echarts.ECharts | null>(null)
  const radarChartInstance = useRef<echarts.ECharts | null>(null)
  const [scores, setScores] = useState<ScoreResult[]>([])
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)

  const processScores = useCallback((judgeScores: JudgeScore[]) => {
    const targetMap = new Map<string, Map<string, number[]>>()

    judgeScores.forEach(score => {
      if (!targetMap.has(score.target_name)) {
        targetMap.set(score.target_name, new Map())
      }
      const target = targetMap.get(score.target_name)!
      const dimName = dimensions.find(d => d.id === score.dimension_id)?.name || `维度${score.dimension_id}`
      if (!target.has(dimName)) {
        target.set(dimName, [])
      }
      target.get(dimName)!.push(score.score)
    })

    const results: ScoreResult[] = []
    targetMap.forEach((dimScores, targetName) => {
      const allScores: number[] = []
      const dimResults: { name: string; score: number }[] = []

      dimScores.forEach((scores, dimName) => {
        const sorted = [...scores].sort((a, b) => a - b)
        let filtered = sorted
        if (sorted.length >= 3) {
          filtered = sorted.slice(1, -1)
        }
        const avg = filtered.reduce((sum, s) => sum + s, 0) / filtered.length
        dimResults.push({ name: dimName, score: Number(avg.toFixed(2)) })
        allScores.push(...filtered)
      })

      const totalAvg = allScores.reduce((sum, s) => sum + s, 0) / allScores.length

      results.push({
        targetName,
        finalScore: Number(totalAvg.toFixed(2)),
        rawScores: allScores,
        dimensions: dimResults,
        judgeCount: Math.max(...dimResults.map(d => dimScores.get(d.name)?.length || 0))
      })
    })

    results.sort((a, b) => b.finalScore - a.finalScore)
    setScores(results)

    if (results.length > 0 && !selectedTarget) {
      setSelectedTarget(results[0].targetName)
    }
  }, [dimensions, selectedTarget])

  useEffect(() => {
    const unsubScore = wsService.onDisplay('scoring_update', (data: { scores: JudgeScore[] }) => {
      if (data.scores) {
        processScores(data.scores)
      }
    })

    return () => {
      unsubScore()
    }
  }, [scoringId, processScores])

  useEffect(() => {
    if (!barChartRef.current || scores.length === 0) return

    if (!barChartInstance.current) {
      barChartInstance.current = echarts.init(barChartRef.current, 'dark')
    }

    const sortedScores = [...scores].sort((a, b) => b.finalScore - a.finalScore)
    const maxScore = Math.max(...sortedScores.map(s => s.finalScore), 10)

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      grid: {
        left: '5%',
        right: '5%',
        top: '10%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'value',
        max: maxScore + 1,
        axisLine: {
          lineStyle: { color: '#64748B' }
        },
        axisLabel: {
          color: '#94A3B8',
          fontSize: 14,
          fontFamily: 'Noto Sans SC'
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(100, 116, 139, 0.2)',
            type: 'dashed'
          }
        }
      },
      yAxis: {
        type: 'category',
        data: sortedScores.map(s => s.targetName),
        axisLine: {
          lineStyle: { color: '#64748B' }
        },
        axisLabel: {
          color: (params: { dataIndex: number }) => {
            return params.dataIndex < 3 ? '#FFD700' : '#E2E8F0'
          },
          fontSize: 16,
          fontFamily: 'Noto Sans SC',
          fontWeight: (params: { dataIndex: number }) => {
            return params.dataIndex < 3 ? 'bold' : 'normal'
          },
          interval: 0,
          margin: 15
        }
      },
      series: [
        {
          type: 'bar',
          data: sortedScores.map((s, index) => ({
            value: s.finalScore,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#E53935' },
                { offset: 1, color: index === 0 ? '#FFA500' : index === 1 ? '#A0A0A0' : index === 2 ? '#B8860B' : '#C62828' }
              ]),
              borderRadius: [0, 8, 8, 0],
              shadowColor: index < 3 ? 'rgba(255, 215, 0, 0.4)' : 'rgba(229, 57, 53, 0.3)',
              shadowBlur: index < 3 ? 15 : 8
            }
          })),
          barWidth: '45%',
          label: {
            show: true,
            position: 'right',
            formatter: (params: { dataIndex: number }) => {
              const score = sortedScores[params.dataIndex]
              const rankIcon = params.dataIndex === 0 ? '🥇' : params.dataIndex === 1 ? '🥈' : params.dataIndex === 2 ? '🥉' : ''
              return `${rankIcon} ${score.finalScore.toFixed(2)}`
            },
            color: (params: { dataIndex: number }) => params.dataIndex < 3 ? '#FFD700' : '#F1F5F9',
            fontSize: 18,
            fontWeight: 'bold',
            fontFamily: 'Noto Sans SC'
          },
          animationDuration: 1500,
          animationEasing: 'elasticOut'
        }
      ],
      animationDurationUpdate: 1000,
      animationEasingUpdate: 'quinticInOut'
    }

    barChartInstance.current.setOption(option, true)

    const handleResize = () => {
      barChartInstance.current?.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [scores])

  useEffect(() => {
    if (!radarChartRef.current || !selectedTarget || scores.length === 0) return

    if (!radarChartInstance.current) {
      radarChartInstance.current = echarts.init(radarChartRef.current, 'dark')
    }

    const targetScore = scores.find(s => s.targetName === selectedTarget)
    if (!targetScore) return

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      title: {
        text: `${selectedTarget} 维度分析`,
        left: 'center',
        top: 0,
        textStyle: {
          color: '#FFD700',
          fontSize: 18,
          fontFamily: 'Noto Sans SC',
          fontWeight: 'bold'
        }
      },
      radar: {
        indicator: targetScore.dimensions.map(d => ({
          name: d.name,
          max: 10
        })),
        center: ['50%', '55%'],
        radius: '65%',
        splitNumber: 5,
        axisName: {
          color: '#94A3B8',
          fontSize: 12,
          fontFamily: 'Noto Sans SC'
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(100, 116, 139, 0.3)'
          }
        },
        splitArea: {
          areaStyle: {
            color: ['rgba(229, 57, 53, 0.05)', 'rgba(229, 57, 53, 0.1)']
          }
        },
        axisLine: {
          lineStyle: {
            color: 'rgba(100, 116, 139, 0.5)'
          }
        }
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: targetScore.dimensions.map(d => d.score),
              name: selectedTarget,
              areaStyle: {
                color: new echarts.graphic.RadialGradient(0.5, 0.5, 1, [
                  { offset: 0, color: 'rgba(229, 57, 53, 0.6)' },
                  { offset: 1, color: 'rgba(229, 57, 53, 0.2)' }
                ])
              },
              lineStyle: {
                color: '#E53935',
                width: 3
              },
              itemStyle: {
                color: '#FFD700',
                borderColor: '#E53935',
                borderWidth: 2
              }
            }
          ]
        }
      ]
    }

    radarChartInstance.current.setOption(option, true)

    const handleResize = () => {
      radarChartInstance.current?.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      radarChartInstance.current?.dispose()
      radarChartInstance.current = null
    }
  }, [selectedTarget, scores])

  useEffect(() => {
    return () => {
      barChartInstance.current?.dispose()
      radarChartInstance.current?.dispose()
    }
  }, [])

  return (
    <div className="w-full h-full flex flex-col">
      <div className="text-center mb-4">
        <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-bold text-gold gold-glow mb-2">
          {title}
        </h2>
        <p className="text-[clamp(1rem,1.5vw,1.5rem)] text-gray-400">
          已评分：<span className="text-primary font-bold">{formatNumber(scores.reduce((s, r) => s + r.judgeCount, 0))}</span> 人次
        </p>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        <div className="flex-1 flex flex-col">
          <div className="text-xl font-semibold text-gray-300 mb-3">实时排行</div>
          <div ref={barChartRef} className="flex-1 min-h-0" />
        </div>

        <div className="w-1/3 flex flex-col">
          <div className="text-xl font-semibold text-gray-300 mb-3">维度分析</div>
          <div ref={radarChartRef} className="flex-1 min-h-0" />
          
          <div className="mt-4 space-y-2">
            {scores.map((score, index) => (
              <button
                key={score.targetName}
                onClick={() => setSelectedTarget(score.targetName)}
                className={`w-full flex items-center justify-between px-4 py-2 rounded-lg transition-all ${
                  selectedTarget === score.targetName
                    ? 'bg-primary/20 border-2 border-gold'
                    : 'bg-dark-card/50 border border-dark-border hover:bg-dark-card'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                  </span>
                  <span className={`font-medium ${
                    index < 3 ? 'text-gold' : 'text-gray-300'
                  }`}>
                    {score.targetName}
                  </span>
                </div>
                <span className={`font-bold text-xl ${
                  index < 3 ? 'text-gold' : 'text-white'
                }`}>
                  {score.finalScore.toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ScoringDisplay
