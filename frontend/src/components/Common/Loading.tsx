interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullScreen?: boolean
}

const Loading = ({ size = 'md', text = '加载中...', fullScreen = false }: LoadingProps) => {
  const sizeStyles = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  }

  const content = (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`${sizeStyles[size]} border-primary border-t-transparent rounded-full animate-spin`}
      />
      {text && <span className="text-gray-400">{text}</span>}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-dark-bg/80 backdrop-blur-sm flex items-center justify-center z-50">
        {content}
      </div>
    )
  }

  return content
}

export default Loading
