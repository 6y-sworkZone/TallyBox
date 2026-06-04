import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'

const AdminLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const menuItems = [
    { path: '/admin/events', label: '活动管理', icon: '📅' },
    { path: '/admin/prizes', label: '奖品管理', icon: '🎁' },
    { path: '/admin/templates', label: '模板管理', icon: '📋' },
    { path: '/admin/sensitive-words', label: '敏感词管理', icon: '🔒' },
  ]

  const isEventDetail = location.pathname.includes('/admin/events/') && location.pathname !== '/admin/events'

  return (
    <div className="min-h-screen bg-dark-bg flex">
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-dark-card border-r border-dark-border transition-all duration-300 flex flex-col`}
      >
        <div className="p-4 border-b border-dark-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-xl">
              🎉
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="text-lg font-bold text-white">TallyBox</h1>
                <p className="text-xs text-gray-400">活动管理系统</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <nav className="flex-1 py-4">
          <ul className="space-y-1 px-3">
            {menuItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      isActive || (item.path === '/admin/events' && isEventDetail)
                        ? 'bg-primary text-white neon-border'
                        : 'text-gray-400 hover:bg-dark-border hover:text-white'
                    }`
                  }
                >
                  <span className="text-xl">{item.icon}</span>
                  {sidebarOpen && <span>{item.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {sidebarOpen && (
          <div className="p-4 border-t border-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-gold flex items-center justify-center text-white font-bold">
                A
              </div>
              <div>
                <p className="text-white font-medium">管理员</p>
                <p className="text-xs text-gray-400">admin@tallybox.com</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full py-2 px-4 rounded-lg bg-dark-border text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
            >
              <span>🚪</span>
              <span>退出登录</span>
            </button>
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="h-16 bg-dark-card border-b border-dark-border px-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              {menuItems.find((item) => item.path === '/admin/events' && isEventDetail)?.label ||
                menuItems.find((item) => location.pathname.startsWith(item.path))?.label ||
                '仪表盘'}
            </h2>
            {isEventDetail && (
              <p className="text-sm text-gray-400">活动详情管理</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 rounded-lg hover:bg-dark-border text-gray-400 hover:text-white transition-colors">
              🔔
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-colors"
            >
              🚪
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
