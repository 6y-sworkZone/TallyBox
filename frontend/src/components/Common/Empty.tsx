import type { ReactNode } from 'react'
import Button from './Button'

interface EmptyProps {
  icon?: ReactNode
  title?: string
  description?: string
  actionText?: string
  onAction?: () => void
}

const Empty = ({
  icon = '📭',
  title = '暂无数据',
  description,
  actionText,
  onAction,
}: EmptyProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-6xl opacity-30 mb-4">{icon}</div>
      <h3 className="text-lg font-medium text-gray-300 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 mb-6 max-w-md">{description}</p>
      )}
      {actionText && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  )
}

export default Empty
