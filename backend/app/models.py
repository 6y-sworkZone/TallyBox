from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Float
from sqlalchemy.orm import relationship

from backend.app.database import Base


class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    password_hash = Column(String(255))
    name = Column(String(50))
    created_at = Column(DateTime, default=datetime.now)


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    date = Column(String(20), nullable=False)
    location = Column(String(255))
    description = Column(Text)
    status = Column(String(20), default="preparing")
    allow_anonymous = Column(Boolean, default=False)
    join_password = Column(String(50))
    max_participants = Column(Integer)
    require_approval = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    participants = relationship("Participant", back_populates="event", cascade="all, delete-orphan")
    flow_steps = relationship("FlowStep", back_populates="event", cascade="all, delete-orphan")
    votes = relationship("Vote", back_populates="event", cascade="all, delete-orphan")
    prizes = relationship("Prize", back_populates="event", cascade="all, delete-orphan")
    lotteries = relationship("Lottery", back_populates="event", cascade="all, delete-orphan")
    danmakus = relationship("Danmaku", back_populates="event", cascade="all, delete-orphan")
    scorings = relationship("Scoring", back_populates="event", cascade="all, delete-orphan")


class Participant(Base):
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"))
    name = Column(String(100), nullable=False)
    department = Column(String(100))
    table_number = Column(String(20))
    group_name = Column(String(50))
    phone = Column(String(20))
    email = Column(String(100))
    avatar_url = Column(String(255))
    check_in_time = Column(DateTime)
    is_late = Column(Boolean, default=False)
    seat_number = Column(String(20))
    is_judge = Column(Boolean, default=False)
    join_code = Column(String(50), unique=True, index=True)
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.now)

    event = relationship("Event", back_populates="participants")
    vote_records = relationship("VoteRecord", back_populates="participant")
    danmakus = relationship("Danmaku", back_populates="participant")
    judge_scores = relationship("JudgeScore", back_populates="judge", foreign_keys="JudgeScore.judge_id")
    wins = relationship("Winner", back_populates="participant")


class FlowStep(Base):
    __tablename__ = "flow_steps"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"))
    name = Column(String(100), nullable=False)
    type = Column(String(20), nullable=False)
    sort_order = Column(Integer, nullable=False)
    vote_id = Column(Integer, ForeignKey("votes.id"))
    lottery_id = Column(Integer, ForeignKey("lotteries.id"))
    scoring_id = Column(Integer, ForeignKey("scorings.id"))
    duration = Column(Integer)
    created_at = Column(DateTime, default=datetime.now)

    event = relationship("Event", back_populates="flow_steps")


class Vote(Base):
    __tablename__ = "votes"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"))
    title = Column(String(255), nullable=False)
    type = Column(String(20), default="single")
    is_anonymous = Column(Boolean, default=True)
    show_results_realtime = Column(Boolean, default=True)
    require_captcha = Column(Boolean, default=False)
    end_time = Column(DateTime)
    status = Column(String(20), default="pending")
    max_rating = Column(Integer, default=10)
    created_at = Column(DateTime, default=datetime.now)

    event = relationship("Event", back_populates="votes")
    options = relationship("VoteOption", back_populates="vote", cascade="all, delete-orphan")
    records = relationship("VoteRecord", back_populates="vote", cascade="all, delete-orphan")


class VoteOption(Base):
    __tablename__ = "vote_options"

    id = Column(Integer, primary_key=True, index=True)
    vote_id = Column(Integer, ForeignKey("votes.id"))
    text = Column(String(255), nullable=False)
    vote_count = Column(Integer, default=0)
    sort_order = Column(Integer)

    vote = relationship("Vote", back_populates="options")


class VoteRecord(Base):
    __tablename__ = "vote_records"

    id = Column(Integer, primary_key=True, index=True)
    vote_id = Column(Integer, ForeignKey("votes.id"))
    participant_id = Column(Integer, ForeignKey("participants.id"))
    option_ids = Column(Text)
    rating = Column(Integer)
    device_id = Column(String(100), nullable=False)
    captcha = Column(String(10))
    submitted_at = Column(DateTime, default=datetime.now)

    vote = relationship("Vote", back_populates="records")
    participant = relationship("Participant", back_populates="vote_records")


class Prize(Base):
    __tablename__ = "prizes"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"))
    name = Column(String(100), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    image_url = Column(String(255))
    distributed = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)

    event = relationship("Event", back_populates="prizes")
    lotteries = relationship("Lottery", back_populates="prize")


class Lottery(Base):
    __tablename__ = "lotteries"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"))
    prize_id = Column(Integer, ForeignKey("prizes.id"))
    name = Column(String(100), nullable=False)
    scope = Column(String(20), default="all")
    scope_value = Column(Text)
    draw_method = Column(String(20), default="scroll")
    winner_count = Column(Integer, default=1)
    exclude_previous_winners = Column(Boolean, default=True)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime, default=datetime.now)

    event = relationship("Event", back_populates="lotteries")
    prize = relationship("Prize", back_populates="lotteries")
    winners = relationship("Winner", back_populates="lottery", cascade="all, delete-orphan")


class Winner(Base):
    __tablename__ = "winners"

    id = Column(Integer, primary_key=True, index=True)
    lottery_id = Column(Integer, ForeignKey("lotteries.id"))
    participant_id = Column(Integer, ForeignKey("participants.id"))
    prize_name = Column(String(100), nullable=False)
    won_at = Column(DateTime, default=datetime.now)
    notified = Column(Boolean, default=False)
    claimed = Column(Boolean, default=False)

    lottery = relationship("Lottery", back_populates="winners")
    participant = relationship("Participant", back_populates="wins")


class Danmaku(Base):
    __tablename__ = "danmakus"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"))
    participant_id = Column(Integer, ForeignKey("participants.id"))
    content = Column(Text, nullable=False)
    color = Column(String(20), default="#FFFFFF")
    font_size = Column(Integer, default=24)
    speed = Column(Integer, default=5)
    status = Column(String(20), default="pending")
    is_pinned = Column(Boolean, default=False)
    submitted_at = Column(DateTime, default=datetime.now)
    approved_at = Column(DateTime)

    event = relationship("Event", back_populates="danmakus")
    participant = relationship("Participant", back_populates="danmakus")


class SensitiveWord(Base):
    __tablename__ = "sensitive_words"

    id = Column(Integer, primary_key=True, index=True)
    word = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.now)


class Scoring(Base):
    __tablename__ = "scorings"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"))
    name = Column(String(255), nullable=False)
    remove_highest_lowest = Column(Boolean, default=True)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime, default=datetime.now)

    event = relationship("Event", back_populates="scorings")
    dimensions = relationship("ScoringDimension", back_populates="scoring", cascade="all, delete-orphan")
    targets = relationship("ScoringTarget", back_populates="scoring", cascade="all, delete-orphan")
    judge_scores = relationship("JudgeScore", back_populates="scoring", cascade="all, delete-orphan")


class ScoringDimension(Base):
    __tablename__ = "scoring_dimensions"

    id = Column(Integer, primary_key=True, index=True)
    scoring_id = Column(Integer, ForeignKey("scorings.id"))
    name = Column(String(100), nullable=False)
    weight = Column(Float, default=1.0)
    max_score = Column(Integer, default=10)

    scoring = relationship("Scoring", back_populates="dimensions")


class ScoringTarget(Base):
    __tablename__ = "scoring_targets"

    id = Column(Integer, primary_key=True, index=True)
    scoring_id = Column(Integer, ForeignKey("scorings.id"))
    name = Column(String(100), nullable=False)
    final_score = Column(Float)
    sort_order = Column(Integer)

    scoring = relationship("Scoring", back_populates="targets")


class JudgeScore(Base):
    __tablename__ = "judge_scores"

    id = Column(Integer, primary_key=True, index=True)
    scoring_id = Column(Integer, ForeignKey("scorings.id"))
    judge_id = Column(Integer, ForeignKey("participants.id"))
    dimension_id = Column(Integer, ForeignKey("scoring_dimensions.id"))
    target_id = Column(Integer, ForeignKey("scoring_targets.id"))
    score = Column(Integer, nullable=False)
    submitted_at = Column(DateTime, default=datetime.now)

    scoring = relationship("Scoring", back_populates="judge_scores")
    judge = relationship("Participant", back_populates="judge_scores", foreign_keys=[judge_id])


class Template(Base):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    flow_data = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.now)


class DanmakuConfig(Base):
    __tablename__ = "danmaku_configs"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, unique=True)
    require_approval = Column(Boolean, default=False)
    default_color = Column(String(20), default="#FFFFFF")
    default_font_size = Column(Integer, default=24)
    default_speed = Column(Integer, default=5)
    allow_color_change = Column(Boolean, default=True)
    max_length = Column(Integer, default=50)
    created_at = Column(DateTime, default=datetime.now)
