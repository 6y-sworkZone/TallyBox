import React, { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { VoteOption } from '../../types'
import { formatNumber } from '../../utils'

interface VoteResultsProps {
  voteId: number
  options: VoteOption[]
  title: string
}

const VoteResults: React.FC<VoteResultsProps> = ({ voteId, options, title }) => {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'dark')
    }

    const total = options.reduce((sum, o) => sum + o.vote_count, 0)

    const sortedOptions = [...options].sort((a, b) => b.vote_count - a.vote_count)

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
        axisLine: {
          lineStyle: { color: '#64748B' }
        },
        axisLabel: {
          color: '#94A3B8',
          fontSize: 16,
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
        data: sortedOptions.map(o => o.text),
        axisLine: {
          lineStyle: { color: '#64748B' }
        },
        axisLabel: {
          color: '#E2E8F0',
          fontSize: 18,
          fontFamily: 'Noto Sans SC',
          interval: 0,
          margin: 15
        }
      },
      series: [
        {
          type: 'bar',
          data: sortedOptions.map((o, index) => ({
            value: o.vote_count,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: index === 0 ? '#FFD700' : '#E53935' },
                { offset: 1, color: index === 0 ? '#FFA500' : '#C62828' }
              ]),
              borderRadius: [0, 8, 8, 0],
              shadowColor: index === 0 ? 'rgba(255, 215, 0, 0.5)' : 'rgba(229, 57, 53, 0.3)',
              shadowBlur: index === 0 ? 20 : 10
            }
          })),
          barWidth: '50%',
          label: {
            show: true,
            position: 'right',
            formatter: (params: { dataIndex: number }) => {
              const opt = sortedOptions[params.dataIndex]
              const percent = total > 0 ? ((opt.vote_count / total) * 100).toFixed(1) : '0'
              return `${formatNumber(opt.vote_count)}票 (${percent}%)`
            },
            color: (params: { dataIndex: number }) => params.dataIndex === 0 ? '#FFD700' : '#F1F5F9',
            fontSize: 18,
            fontWeight: 'bold',
            fontFamily: 'Noto Sans SC',
            textShadowColor: params.dataIndex === 0 ? 'rgba(255, 215, 0, 0.5)' : 'rgba(0,0,0,0.5)',
            textShadowBlur: 4
          },
          animationDuration: 1500,
          animationEasing: 'elasticOut'
        }
      ],
      animationDurationUpdate: 1000,
      animationEasingUpdate: 'quinticInOut'
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
  }, [options, voteId])

  return (
    <div className="w-full h-full flex flex-col">
      <div className="text-center mb-4">
        <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-bold text-gold gold-glow mb-2">
          {title}
        </h2>
        <p className="text-[clamp(1rem,1.5vw,1.5rem)] text-gray-400">
          总投票数：<span className="text-primary font-bold">{formatNumber(options.reduce((s, o) => s + o.vote_count, 0))}</span>
        </p>
      </div>
      <div ref={chartRef} className="flex-1 min-h-[400px]" />
    </div>
  )
}

export default VoteResults
