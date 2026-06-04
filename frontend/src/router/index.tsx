import { createBrowserRouter, Navigate } from 'react-router-dom'
import AdminLayout from '../components/Layout/AdminLayout'
import Login from '../pages/admin/Login'
import EventList from '../pages/admin/EventList'
import EventDetail from '../pages/admin/EventDetail'
import ParticipantList from '../pages/admin/ParticipantList'
import VoteManage from '../pages/admin/VoteManage'
import LotteryManage from '../pages/admin/LotteryManage'
import DanmakuManage from '../pages/admin/DanmakuManage'
import CheckInManage from '../pages/admin/CheckInManage'
import ScoringManage from '../pages/admin/ScoringManage'
import DataOverview from '../pages/admin/DataOverview'
import PrizeManage from '../pages/admin/PrizeManage'
import TemplateManage from '../pages/admin/TemplateManage'
import SensitiveWordManage from '../pages/admin/SensitiveWordManage'
import DisplayMain from '../pages/display/DisplayMain'
import ParticipantVote from '../pages/participant/ParticipantVote'
import ParticipantDanmaku from '../pages/participant/ParticipantDanmaku'
import ParticipantCheckIn from '../pages/participant/ParticipantCheckIn'
import JudgeScoring from '../pages/judge/JudgeScoring'

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
        element: <EventDetail />,
      },
      {
        path: 'events/:id/participants',
        element: <ParticipantList />,
      },
      {
        path: 'events/:id/votes',
        element: <VoteManage />,
      },
      {
        path: 'events/:id/lottery',
        element: <LotteryManage />,
      },
      {
        path: 'events/:id/danmaku',
        element: <DanmakuManage />,
      },
      {
        path: 'events/:id/checkin',
        element: <CheckInManage />,
      },
      {
        path: 'events/:id/scoring',
        element: <ScoringManage />,
      },
      {
        path: 'events/:id/data',
        element: <DataOverview />,
      },
      {
        path: 'prizes',
        element: <PrizeManage />,
      },
      {
        path: 'templates',
        element: <TemplateManage />,
      },
      {
        path: 'sensitive-words',
        element: <SensitiveWordManage />,
      },
    ],
  },
  {
    path: '/display/:eventId',
    element: <DisplayMain />,
  },
  {
    path: '/participant/vote/:voteId',
    element: <ParticipantVote />,
  },
  {
    path: '/participant/danmaku/:eventId',
    element: <ParticipantDanmaku />,
  },
  {
    path: '/participant/checkin/:eventId',
    element: <ParticipantCheckIn />,
  },
  {
    path: '/judge/scoring/:scoringId',
    element: <JudgeScoring />,
  },
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
])

export default router
