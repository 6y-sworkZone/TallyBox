from datetime import datetime
from typing import Optional, List, Any, Union
from pydantic import BaseModel, Field, field_validator


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin: dict


class AdminResponse(BaseModel):
    id: int
    username: str
    name: Optional[str]

    class Config:
        from_attributes = True


class EventBase(BaseModel):
    name: str
    date: str
    location: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = "preparing"
    allow_anonymous: Optional[bool] = False
    join_password: Optional[str] = None
    max_participants: Optional[int] = None
    require_approval: Optional[bool] = False


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    allow_anonymous: Optional[bool] = None
    join_password: Optional[str] = None
    max_participants: Optional[int] = None
    require_approval: Optional[bool] = None


class EventResponse(EventBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ParticipantBase(BaseModel):
    name: str
    department: Optional[str] = None
    table_number: Optional[Union[int, str]] = None
    group_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    seat_number: Optional[str] = None
    is_judge: Optional[bool] = False

    @field_validator('table_number')
    @classmethod
    def convert_table_number(cls, v):
        if v is None:
            return None
        return str(v)


class ParticipantCreate(ParticipantBase):
    pass


class ParticipantUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    table_number: Optional[Union[int, str]] = None
    group_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    seat_number: Optional[str] = None
    is_judge: Optional[bool] = None
    status: Optional[str] = None


class ParticipantResponse(ParticipantBase):
    id: int
    event_id: int
    join_code: str
    check_in_time: Optional[datetime] = None
    is_late: bool = False
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class FlowStepBase(BaseModel):
    name: str
    type: str
    sort_order: int
    vote_id: Optional[int] = None
    lottery_id: Optional[int] = None
    scoring_id: Optional[int] = None
    duration: Optional[int] = None


class FlowStepCreate(FlowStepBase):
    pass


class FlowStepUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    sort_order: Optional[int] = None
    vote_id: Optional[int] = None
    lottery_id: Optional[int] = None
    scoring_id: Optional[int] = None
    duration: Optional[int] = None


class FlowStepResponse(FlowStepBase):
    id: int
    event_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class VoteOptionBase(BaseModel):
    text: str
    sort_order: Optional[int] = None


class VoteOptionCreate(VoteOptionBase):
    pass


class VoteOptionResponse(VoteOptionBase):
    id: int
    vote_id: int
    vote_count: int = 0

    class Config:
        from_attributes = True


class VoteBase(BaseModel):
    title: str
    type: Optional[str] = "single"
    is_anonymous: Optional[bool] = True
    show_results_realtime: Optional[bool] = True
    require_captcha: Optional[bool] = False
    end_time: Optional[datetime] = None
    max_rating: Optional[int] = 10


class VoteCreate(VoteBase):
    options: List[VoteOptionCreate]


class VoteUpdate(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    is_anonymous: Optional[bool] = None
    show_results_realtime: Optional[bool] = None
    require_captcha: Optional[bool] = None
    end_time: Optional[datetime] = None
    status: Optional[str] = None


class VoteResponse(VoteBase):
    id: int
    event_id: int
    status: str
    options: List[VoteOptionResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


class VoteSubmitRequest(BaseModel):
    participant_id: Optional[int] = None
    option_ids: Optional[List[int]] = None
    rating: Optional[int] = None
    device_id: str
    captcha: Optional[str] = None


class PrizeBase(BaseModel):
    name: str
    quantity: int = 1
    image_url: Optional[str] = None


class PrizeCreate(PrizeBase):
    pass


class PrizeUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[int] = None
    image_url: Optional[str] = None
    distributed: Optional[int] = None


class PrizeResponse(PrizeBase):
    id: int
    event_id: int
    distributed: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class LotteryBase(BaseModel):
    prize_id: int
    name: str
    scope: Optional[str] = "all"
    scope_value: Optional[str] = None
    draw_method: Optional[str] = "scroll"
    winner_count: Optional[int] = 1
    exclude_previous_winners: Optional[bool] = True


class LotteryCreate(LotteryBase):
    pass


class LotteryUpdate(BaseModel):
    name: Optional[str] = None
    scope: Optional[str] = None
    scope_value: Optional[str] = None
    draw_method: Optional[str] = None
    winner_count: Optional[int] = None
    exclude_previous_winners: Optional[bool] = None
    status: Optional[str] = None


class WinnerResponse(BaseModel):
    id: int
    lottery_id: int
    participant_id: int
    participant_name: str
    participant_avatar: Optional[str]
    prize_name: str
    won_at: datetime
    notified: bool
    claimed: bool

    class Config:
        from_attributes = True


class LotteryResponse(LotteryBase):
    id: int
    event_id: int
    status: str
    prize: Optional[PrizeResponse] = None
    winners: List[WinnerResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


class DanmakuBase(BaseModel):
    content: str
    color: Optional[str] = "#FFFFFF"
    font_size: Optional[int] = 24
    speed: Optional[int] = 5


class DanmakuSendRequest(DanmakuBase):
    event_id: int
    participant_id: Optional[int] = None


class DanmakuResponse(DanmakuBase):
    id: int
    event_id: int
    participant_id: Optional[int] = None
    participant_name: Optional[str] = None
    status: str
    is_pinned: bool
    submitted_at: datetime
    approved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SensitiveWordCreate(BaseModel):
    word: str


class SensitiveWordResponse(BaseModel):
    id: int
    word: str
    created_at: datetime

    class Config:
        from_attributes = True


class DanmakuConfigBase(BaseModel):
    require_approval: Optional[bool] = False
    default_color: Optional[str] = "#FFFFFF"
    default_font_size: Optional[int] = 24
    default_speed: Optional[int] = 5
    allow_color_change: Optional[bool] = True
    max_length: Optional[int] = 50


class DanmakuConfigCreate(DanmakuConfigBase):
    event_id: int


class DanmakuConfigResponse(DanmakuConfigBase):
    id: int
    event_id: int

    class Config:
        from_attributes = True


class ScoringDimensionBase(BaseModel):
    name: str
    weight: Optional[float] = 1.0
    max_score: Optional[int] = 10


class ScoringDimensionCreate(ScoringDimensionBase):
    pass


class ScoringDimensionResponse(ScoringDimensionBase):
    id: int
    scoring_id: int

    class Config:
        from_attributes = True


class ScoringTargetBase(BaseModel):
    name: str
    sort_order: Optional[int] = None


class ScoringTargetCreate(ScoringTargetBase):
    pass


class JudgeScoreSubmit(BaseModel):
    dimension_id: int
    target_id: int
    score: int


class ScoringBase(BaseModel):
    name: str
    remove_highest_lowest: Optional[bool] = True


class ScoringCreate(ScoringBase):
    dimensions: List[ScoringDimensionCreate]
    targets: List[ScoringTargetCreate]
    judge_ids: List[int]


class ScoringUpdate(BaseModel):
    name: Optional[str] = None
    remove_highest_lowest: Optional[bool] = None
    status: Optional[str] = None


class JudgeScoreResponse(BaseModel):
    id: int
    judge_id: int
    dimension_id: int
    target_id: int
    score: int
    submitted_at: datetime

    class Config:
        from_attributes = True


class ScoringTargetResponse(ScoringTargetBase):
    id: int
    scoring_id: int
    final_score: Optional[float] = None
    scores: List[JudgeScoreResponse] = []

    class Config:
        from_attributes = True


class ScoringResponse(ScoringBase):
    id: int
    event_id: int
    status: str
    dimensions: List[ScoringDimensionResponse] = []
    targets: List[ScoringTargetResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


class ScoringSubmitRequest(BaseModel):
    judge_id: int
    scores: List[JudgeScoreSubmit]


class TemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    flow_data: str


class TemplateCreate(TemplateBase):
    pass


class TemplateResponse(TemplateBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CheckInResponse(BaseModel):
    success: bool
    message: str
    participant: Optional[ParticipantResponse] = None


class CheckInStats(BaseModel):
    total: int
    checked_in: int
    late: int
    rate: float
    check_in_trend: List[dict] = []


class DashboardStats(BaseModel):
    total_participants: int
    checked_in_count: int
    check_in_rate: float
    total_votes: int
    vote_count: int
    total_danmakus: int
    approved_danmakus: int
    total_lotteries: int
    total_winners: int
    activity_trend: List[dict] = []
    step_participation: List[dict] = []
    active_users: List[dict] = []


class CaptchaResponse(BaseModel):
    captcha_id: str
    image_base64: str
