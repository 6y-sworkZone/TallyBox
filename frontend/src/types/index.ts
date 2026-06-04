export interface Event {
  id: number
  name: string
  date: string
  location: string
  description: string
  status: 'preparing' | 'ongoing' | 'ended'
  allow_anonymous: boolean
  password?: string
  max_participants: number
  created_at: string
  updated_at: string
}

export interface Participant {
  id: number
  event_id: number
  name: string
  department?: string
  table_number?: number
  group_name?: string
  join_code: string
  avatar?: string
  email?: string
  phone?: string
  is_checked_in: boolean
  check_in_time?: string
  is_late: boolean
  seat_number?: string
  joined_at: string
}

export interface FlowStep {
  id: number
  event_id: number
  step_type: 'opening' | 'voting' | 'lottery' | 'performance' | 'award' | 'ending'
  title: string
  description?: string
  order_index: number
  vote_id?: number
  lottery_id?: number
  is_active: boolean
  created_at: string
}

export interface Vote {
  id: number
  event_id: number
  title: string
  description?: string
  vote_type: 'single' | 'multiple' | 'rating'
  is_anonymous: boolean
  show_results_real_time: boolean
  end_time?: string
  is_active: boolean
  max_selections?: number
  rating_max?: number
  created_at: string
}

export interface VoteOption {
  id: number
  vote_id: number
  text: string
  description?: string
  image_url?: string
  vote_count: number
  order_index: number
}

export interface VoteRecord {
  id: number
  vote_id: number
  participant_id?: number
  option_id?: number
  rating?: number
  device_id: string
  is_anonymous: boolean
  created_at: string
}

export interface Prize {
  id: number
  name: string
  description?: string
  image_url?: string
  total_quantity: number
  distributed_quantity: number
  created_at: string
}

export interface Lottery {
  id: number
  event_id: number
  title: string
  prize_id: number
  prize: Prize
  winner_count: number
  scope_type: 'all' | 'group' | 'exclude_winners'
  scope_value?: string
  draw_type: 'random' | 'scroll' | '摇号'
  is_active: boolean
  created_at: string
}

export interface Winner {
  id: number
  lottery_id: number
  participant_id: number
  participant: Participant
  prize_id: number
  prize: Prize
  is_notified: boolean
  is_claimed: boolean
  created_at: string
}

export interface Danmaku {
  id: number
  event_id: number
  participant_id?: number
  content: string
  color: string
  font_size: number
  speed: number
  is_approved: boolean
  is_pinned: boolean
  created_at: string
}

export interface Scoring {
  id: number
  event_id: number
  name: string
  description?: string
  is_active: boolean
  created_at: string
}

export interface ScoringDimension {
  id: number
  scoring_id: number
  name: string
  description?: string
  weight: number
  max_score: number
  order_index: number
}

export interface JudgeScore {
  id: number
  scoring_id: number
  judge_name: string
  target_name: string
  dimension_id: number
  score: number
  created_at: string
}

export interface Template {
  id: number
  name: string
  description?: string
  steps: Array<{
    step_type: string
    title: string
    description?: string
  }>
  created_at: string
}

export interface DashboardStats {
  total_participants: number
  checked_in_count: number
  check_in_rate: number
  total_votes: number
  total_danmaku: number
  active_votes: number
  active_lotteries: number
}

export interface CheckInStats {
  total: number
  checked_in: number
  not_checked_in: number
  late_count: number
  check_in_rate: number
  by_department: Record<string, { total: number; checked_in: number }>
  recent_checkins: Participant[]
}

export interface DanmakuConfig {
  enabled: boolean
  require_approval: boolean
  default_color: string
  default_font_size: number
  default_speed: number
  max_length: number
}
