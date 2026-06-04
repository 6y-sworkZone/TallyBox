import type { ReactNode } from 'react'

interface Column<T> {
  key: keyof T | string
  title: string
  width?: string
  render?: (record: T, index: number) => ReactNode
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyText?: string
  rowKey?: keyof T | ((record: T) => string | number)
  onRowClick?: (record: T, index: number) => void
}

function Table<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  emptyText = '暂无数据',
  rowKey = 'id' as keyof T,
  onRowClick,
}: TableProps<T>) {
  const getRowKey = (record: T, index: number): string | number => {
    if (typeof rowKey === 'function') {
      return rowKey(record)
    }
    return (record[rowKey] as string | number) ?? index
  }

  const getValue = (record: T, key: keyof T | string): unknown => {
    return record[key as keyof T]
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-dark-border bg-dark-card">
      <table className="w-full">
        <thead>
          <tr className="border-b border-dark-border bg-dark-bg/50">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className="px-5 py-4 text-left text-sm font-semibold text-gray-300"
                style={{ width: col.width }}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-12 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-gray-400">加载中...</span>
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-12 text-center">
                <div className="flex flex-col items-center gap-3">
                  <span className="text-5xl opacity-30">📭</span>
                  <span className="text-gray-400">{emptyText}</span>
                </div>
              </td>
            </tr>
          ) : (
            data.map((record, index) => (
              <tr
                key={getRowKey(record, index)}
                onClick={() => onRowClick?.(record, index)}
                className={`border-b border-dark-border/50 last:border-0 transition-colors ${
                  onRowClick ? 'cursor-pointer hover:bg-dark-border/30' : ''
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className="px-5 py-4 text-sm text-gray-300"
                  >
                    {col.render ? col.render(record, index) : String(getValue(record, col.key) ?? '-')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default Table
