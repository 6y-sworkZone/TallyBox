import type { ReactNode } from 'react'
import { useEffect } from 'react'
import Button from './Button'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  onConfirm?: () => void
  children: ReactNode
  confirmText?: string
  cancelText?: string
  confirmLoading?: boolean
  showFooter?: boolean
  width?: string
}

const Modal = ({
  open,
  title,
  onClose,
  onConfirm,
  children,
  confirmText = '确认',
  cancelText = '取消',
  confirmLoading = false,
  showFooter = true,
  width = 'w-96',
}: ModalProps) => {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={`relative ${width} bg-dark-card rounded-xl border border-dark-border shadow-2xl animate-bounce-in`}>
        <div className="flex items-center justify-between p-5 border-b border-dark-border">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl"
          >
            ✕
          </button>
        </div>

        <div className="p-5 text-gray-300">
          {children}
        </div>

        {showFooter && (
          <div className="flex justify-end gap-3 p-5 border-t border-dark-border">
            <Button variant="secondary" onClick={onClose}>
              {cancelText}
            </Button>
            <Button variant="primary" onClick={onConfirm} loading={confirmLoading}>
              {confirmText}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Modal
