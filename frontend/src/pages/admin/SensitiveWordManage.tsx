import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { danmakuAPI } from '../../services/api'
import { wsService } from '../../services/websocket'

interface SensitiveWord {
  id: number
  word: string
  created_at: string
}

const SensitiveWordManage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>()
  const id = parseInt(eventId || '0')
  const navigate = useNavigate()

  const [words, setWords] = useState<SensitiveWord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [newWord, setNewWord] = useState('')
  const [showConfirm, setShowConfirm] = useState<{ show: boolean; wordId: number | null; word: string }>({ show: false, wordId: null, word: '' })

  useEffect(() => {
    loadWords()
    return () => {
      wsService.disconnectAdmin()
    }
  }, [])

  const loadWords = async () => {
    try {
      setLoading(true)
      const data = await danmakuAPI.sensitiveWords() as unknown as SensitiveWord[]
      setWords(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWord.trim()) return

    try {
      await danmakuAPI.addSensitiveWord(newWord.trim())
      setNewWord('')
      setShowModal(false)
      loadWords()
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败')
    }
  }

  const handleDelete = async () => {
    if (!showConfirm.wordId) return
    try {
      await danmakuAPI.deleteSensitiveWord(showConfirm.wordId)
      loadWords()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
    setShowConfirm({ show: false, wordId: null, word: '' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="sticky top-0 z-40 bg-dark-bg/80 backdrop-blur-lg border-b border-dark-border">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(id ? `/admin/events/${id}/danmaku` : '/admin/events')}
                className="p-2 hover:bg-dark-card rounded-lg transition-colors"
              >
                ←
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white glow-text">敏感词管理</h1>
                <p className="text-gray-400 text-sm">管理弹幕敏感词过滤库，共 {words.length} 个敏感词</p>
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-2 bg-gradient-to-r from-primary to-red-600 hover:from-red-600 hover:to-primary text-white rounded-lg transition-all"
            >
              ➕ 添加敏感词
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400">
            {error}
          </div>
        )}

        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          {words.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-6">
              {words.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center justify-between p-4 bg-dark-bg rounded-xl border border-dark-border hover:border-red-500/50 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-red-400 truncate">
                      {item.word}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(item.created_at).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowConfirm({ show: true, wordId: item.id, word: item.word })}
                    className="ml-3 p-2 opacity-0 group-hover:opacity-100 hover:bg-red-900/30 text-red-400 rounded-lg transition-all"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🔞</div>
              <h3 className="text-xl font-semibold text-white mb-2">敏感词库为空</h3>
              <p className="text-gray-400 mb-6">添加敏感词后，包含这些词的弹幕将被自动拦截或进入审核</p>
              <button
                onClick={() => setShowModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-primary to-red-600 hover:from-red-600 hover:to-primary text-white rounded-lg transition-all"
              >
                添加第一个敏感词
              </button>
            </div>
          )}
        </div>

        {words.length > 0 && (
          <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <h4 className="text-blue-300 font-semibold mb-1">敏感词过滤说明</h4>
                <p className="text-gray-400 text-sm">
                  敏感词库用于自动过滤弹幕内容。当用户发送的弹幕包含敏感词时，
                  如果开启了审核功能，弹幕会进入待审核状态；如果未开启审核，弹幕会被直接拦截。
                  敏感词匹配采用精确匹配模式，建议添加常见的违规词汇和不当用语。
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-dark-border">
              <h3 className="text-xl font-bold text-white">添加敏感词</h3>
              <button
                onClick={() => {
                  setShowModal(false)
                  setNewWord('')
                }}
                className="p-2 hover:bg-dark-bg rounded-lg transition-colors text-gray-400"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">敏感词 *</label>
                <input
                  type="text"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-primary font-mono"
                  placeholder="请输入敏感词"
                  autoFocus
                  required
                />
                <p className="text-gray-500 text-sm mt-2">
                  输入需要过滤的敏感词，支持中文、英文、数字等字符
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setNewWord('')
                  }}
                  className="flex-1 px-6 py-3 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-primary to-red-600 hover:from-red-600 hover:to-primary text-white font-semibold rounded-lg transition-all"
                >
                  添加
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showConfirm.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-red-500/50 rounded-2xl w-full max-w-md p-6 animate-slide-up">
            <div className="text-center">
              <div className="text-5xl mb-4">⚠️</div>
              <h3 className="text-xl font-semibold text-white mb-2">确认删除</h3>
              <p className="text-gray-400 mb-2">确定要删除敏感词：</p>
              <p className="text-red-400 font-mono text-lg mb-6">"{showConfirm.word}"</p>
              <p className="text-gray-500 text-sm mb-6">删除后该词将不再被过滤</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm({ show: false, wordId: null, word: '' })}
                  className="flex-1 px-4 py-3 bg-dark-bg hover:bg-dark-border text-gray-300 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SensitiveWordManage
