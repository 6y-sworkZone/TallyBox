import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import type { Danmaku, DanmakuConfig } from '../../types'
import { danmakuAPI } from '../../services/api'
import { checkSensitiveWords } from '../../utils'

const colors = [
  { value: '#FFFFFF', label: '白色' },
  { value: '#FFD700', label: '金色' },
  { value: '#E53935', label: '红色' },
  { value: '#4ECDC4', label: '青色' },
  { value: '#45B7D1', label: '蓝色' },
  { value: '#96CEB4', label: '绿色' },
  { value: '#FFEAA7', label: '黄色' },
  { value: '#DDA0DD', label: '紫色' },
]

const fontSizes = [
  { value: 16, label: '小' },
  { value: 20, label: '中' },
  { value: 24, label: '大' },
]

const ParticipantDanmaku: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>()
  const [searchParams] = useSearchParams()
  const participantId = searchParams.get('participantId')

  const [content, setContent] = useState('')
  const [selectedColor, setSelectedColor] = useState('#FFFFFF')
  const [selectedSize, setSelectedSize] = useState(20)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [config, setConfig] = useState<DanmakuConfig | null>(null)
  const [history, setHistory] = useState<Danmaku[]>([])
  const [sensitiveWords, setSensitiveWords] = useState<string[]>([])
  const [hasSensitive, setHasSensitive] = useState(false)
  const hasLoadedRef = useRef(false)

  const loadHistory = useCallback(async () => {
    if (!eventId) return
    try {
      const data = await danmakuAPI.list(Number(eventId))
      const list = data as Danmaku[]
      setHistory(list.filter(d => d.is_approved).slice(0, 20).reverse())
    } catch (err) {
      console.error('加载历史弹幕失败:', err)
    }
  }, [eventId])

  useEffect(() => {
    if (!eventId || hasLoadedRef.current) return
    hasLoadedRef.current = true

    const loadData = async () => {
      try {
        const [configData, wordsData] = await Promise.all([
          danmakuAPI.config(Number(eventId)),
          danmakuAPI.sensitiveWords()
        ])
        setConfig(configData as DanmakuConfig)
        setSensitiveWords(wordsData as string[])
      } catch (err) {
        console.error('加载配置失败:', err)
      }
    }

    loadData()
    loadHistory()
  }, [eventId, loadHistory])

  const handleContentChange = (value: string) => {
    const maxLength = config?.max_length || 50
    if (value.length > maxLength) {
      setContent(value.slice(0, maxLength))
    } else {
      setContent(value)
    }

    const { hasSensitive: sensitive, filteredText } = checkSensitiveWords(value, sensitiveWords)
    setHasSensitive(sensitive)
    if (sensitive) {
      setContent(filteredText)
    }
  }

  const handleSend = async () => {
    if (!eventId || !content.trim()) return

    if (!config?.enabled) {
      setError('弹幕功能已关闭')
      return
    }

    if (hasSensitive) {
      setError('内容包含敏感词，请修改后再发送')
      return
    }

    try {
      setSending(true)
      setError('')

      await danmakuAPI.send(Number(eventId), {
        content: content.trim(),
        color: selectedColor,
        font_size: selectedSize,
        speed: 1,
        participant_id: participantId ? Number(participantId) : undefined
      })

      setContent('')
      setSuccess(true)
      
      if (config.require_approval) {
        setSuccess(false)
        setError('弹幕已发送，等待审核...')
      } else {
        setTimeout(() => loadHistory(), 1000)
      }

      setTimeout(() => {
        setSuccess(false)
        setError('')
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败，请重试')
    } finally {
      setSending(false)
    }
  }

  const maxLength = config?.max_length || 50

  return (
    <div className="min-h-screen bg-dark-bg py-6 px-4">
      <div className="max-w-[480px] mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-red-700 mb-4 gold-border">
            <span className="text-3xl">💬</span>
          </div>
          <h1 className="text-2xl font-bold text-gold gold-glow mb-2">
            发送弹幕
          </h1>
          <p className="text-gray-400">和大家一起互动吧！</p>
        </div>

        {error && (
          <div className={`mb-4 p-3 rounded-lg text-sm text-center ${
            error.includes('审核') 
              ? 'bg-blue-900/30 border border-blue-500/50 text-blue-400'
              : 'bg-red-900/30 border border-red-500/50 text-red-400'
          }`}>
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-500/50 rounded-lg text-green-400 text-sm text-center">
            ✅ 发送成功！
          </div>
        )}

        {hasSensitive && (
          <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-500/50 rounded-lg text-yellow-400 text-sm text-center">
            ⚠️ 内容包含敏感词，已自动过滤
          </div>
        )}

        <div className="bg-dark-card border border-dark-border rounded-xl p-4 mb-4">
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="说点什么吧..."
            className="w-full h-32 px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all resize-none"
            maxLength={maxLength}
          />
          <div className="flex justify-between items-center mt-2">
            <div className="flex items-center gap-2">
              <span className={`text-sm ${
                content.length >= maxLength ? 'text-red-400' : 'text-gray-500'
              }`}>
                {content.length}/{maxLength}
              </span>
              {config?.require_approval && (
                <span className="text-xs text-blue-400 bg-blue-900/30 px-2 py-1 rounded">
                  需审核
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-xl p-4 mb-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">弹幕颜色</h3>
          <div className="flex flex-wrap gap-2">
            {colors.map(color => (
              <button
                key={color.value}
                onClick={() => setSelectedColor(color.value)}
                className={`w-10 h-10 rounded-full border-2 transition-all ${
                  selectedColor === color.value
                    ? 'border-gold scale-110'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: color.value }}
                title={color.label}
              />
            ))}
          </div>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-xl p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-300 mb-3">字体大小</h3>
          <div className="flex gap-2">
            {fontSizes.map(size => (
              <button
                key={size.value}
                onClick={() => setSelectedSize(size.value)}
                className={`flex-1 py-3 rounded-lg border-2 transition-all ${
                  selectedSize === size.value
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-dark-border text-gray-400 hover:border-primary/50'
                }`}
              >
                <span style={{ fontSize: `${size.value}px` }}>{size.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-400 mb-3">预览效果：</p>
          <div className="bg-dark-bg rounded-lg p-4 overflow-hidden">
            <span
              style={{
                color: selectedColor,
                fontSize: `${selectedSize}px`,
                textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
              }}
              className={selectedSize >= 24 ? 'font-bold' : ''}
            >
              {content || '预览弹幕内容'}
            </span>
          </div>
        </div>

        <button
          onClick={handleSend}
          disabled={sending || !content.trim() || hasSensitive}
          className="w-full py-4 bg-gradient-to-r from-primary to-red-600 hover:from-red-600 hover:to-primary text-white font-bold text-lg rounded-xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 gold-border"
        >
          {sending ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              发送中...
            </span>
          ) : '发送弹幕'}
        </button>

        {history.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-400 mb-3">历史弹幕</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-hide">
              {history.map(danmaku => (
                <div
                  key={danmaku.id}
                  className="bg-dark-card/50 border border-dark-border/50 rounded-lg px-4 py-2"
                >
                  <p
                    style={{
                      color: danmaku.color,
                      fontSize: `${danmaku.font_size}px`
                    }}
                    className={danmaku.font_size >= 24 ? 'font-bold' : ''}
                  >
                    {danmaku.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-gray-500 text-sm mt-6">
          活动编号: {eventId}
        </p>
      </div>
    </div>
  )
}

export default ParticipantDanmaku
