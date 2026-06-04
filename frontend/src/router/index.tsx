import { createBrowserRouter, Navigate } from 'react-router-dom'
import AdminLayout from '../components/Layout/AdminLayout'
import Login from '../pages/admin/Login'
import EventList from '../pages/admin/EventList'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/admin/events" replace />,
      },
      {
        path: 'events',
        element: <EventList />,
      },
      {
        path: 'events/:id',
        element: <div className="p-6 text-gray-300">活动详情页面开发中...</div>,
      },
      {
        path: 'events/:id/participants',
        element: <div className="p-6 text-gray-300">参与人管理页面开发中...</div>,
      },
      {
        path: 'events/:id/votes',
        element: <div className="p-6 text-gray-300">投票管理页面开发中...</div>,
      },
      {
        path: 'events/:id/lottery',
        element: <div className="p-6 text-gray-300">抽奖管理页面开发中...</div>,
      },
      {
        path: 'events/:id/danmaku',
        element: <div className="p-6 text-gray-300">弹幕管理页面开发中...</div>,
      },
      {
        path: 'events/:id/checkin',
        element: <div className="p-6 text-gray-300">签到管理页面开发中...</div>,
      },
      {
        path: 'events/:id/scoring',
        element: <div className="p-6 text-gray-300">评分管理页面开发中...</div>,
      },
      {
        path: 'events/:id/data',
        element: <div className="p-6 text-gray-300">数据总览页面开发中...</div>,
      },
      {
        path: 'prizes',
        element: <div className="p-6 text-gray-300">奖品管理页面开发中...</div>,
      },
      {
        path: 'templates',
        element: <div className="p-6 text-gray-300">模板管理页面开发中...</div>,
      },
      {
        path: 'sensitive-words',
        element: <div className="p-6 text-gray-300">敏感词管理页面开发中...</div>,
      },
    ],
  },
  {
    path: '/display/:eventId',
    element: <div className="min-h-screen bg-dark-bg text-white">大屏端开发中...</div>,
  },
  {
    path: '/participant/vote/:voteId',
    element: <div className="min-h-screen bg-dark-bg text-white">参与端投票页开发中...</div>,
  },
  {
    path: '/participant/danmaku/:eventId',
    element: <div className="min-h-screen bg-dark-bg text-white">参与端弹幕页开发中...</div>,
  },
  {
    path: '/participant/checkin/:eventId',
    element: <div className="min-h-screen bg-dark-bg text-white">参与端签到页开发中...</div>,
  },
  {
    path: '/judge/scoring/:scoringId',
    element: <div className="min-h-screen bg-dark-bg text-white">评委评分页开发中...</div>,
  },
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
])

export default router
