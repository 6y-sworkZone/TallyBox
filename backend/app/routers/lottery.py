import random
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime

from backend.app.auth import get_current_admin
from backend.app.database import get_db
from backend.app.models import Lottery, Prize, Winner, Participant, Event, Admin
from backend.app.schemas import LotteryCreate, LotteryUpdate, LotteryResponse, PrizeCreate, PrizeUpdate, PrizeResponse, WinnerResponse
from backend.app.websocket import manager

router = APIRouter()


@router.get("/events/{event_id}/prizes", response_model=List[PrizeResponse])
def get_prizes(
    event_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    prizes = db.query(Prize).filter(Prize.event_id == event_id).order_by(Prize.created_at.desc()).all()
    return prizes


@router.post("/events/{event_id}/prizes", response_model=PrizeResponse)
def create_prize(
    event_id: int,
    prize_data: PrizeCreate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    db_prize = Prize(**prize_data.model_dump(), event_id=event_id)
    db.add(db_prize)
    db.commit()
    db.refresh(db_prize)
    return db_prize


@router.put("/prizes/{prize_id}", response_model=PrizeResponse)
def update_prize(
    prize_id: int,
    prize_update: PrizeUpdate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    prize = db.query(Prize).filter(Prize.id == prize_id).first()
    if not prize:
        raise HTTPException(status_code=404, detail="奖品不存在")
    
    update_data = prize_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(prize, key, value)
    
    db.commit()
    db.refresh(prize)
    return prize


@router.delete("/prizes/{prize_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prize(
    prize_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    prize = db.query(Prize).filter(Prize.id == prize_id).first()
    if not prize:
        raise HTTPException(status_code=404, detail="奖品不存在")
    
    db.delete(prize)
    db.commit()


@router.get("/events/{event_id}/lotteries", response_model=List[LotteryResponse])
def get_lotteries(
    event_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    lotteries = db.query(Lottery).filter(Lottery.event_id == event_id).order_by(Lottery.created_at.desc()).all()
    return lotteries


@router.post("/events/{event_id}/lotteries", response_model=LotteryResponse)
def create_lottery(
    event_id: int,
    lottery_data: LotteryCreate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    prize = db.query(Prize).filter(Prize.id == lottery_data.prize_id).first()
    if not prize:
        raise HTTPException(status_code=404, detail="奖品不存在")
    
    db_lottery = Lottery(**lottery_data.model_dump(), event_id=event_id)
    db.add(db_lottery)
    db.commit()
    db.refresh(db_lottery)
    return db_lottery


@router.put("/lotteries/{lottery_id}", response_model=LotteryResponse)
def update_lottery(
    lottery_id: int,
    lottery_update: LotteryUpdate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    lottery = db.query(Lottery).filter(Lottery.id == lottery_id).first()
    if not lottery:
        raise HTTPException(status_code=404, detail="抽奖不存在")
    
    update_data = lottery_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(lottery, key, value)
    
    db.commit()
    db.refresh(lottery)
    return lottery


@router.delete("/lotteries/{lottery_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lottery(
    lottery_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    lottery = db.query(Lottery).filter(Lottery.id == lottery_id).first()
    if not lottery:
        raise HTTPException(status_code=404, detail="抽奖不存在")
    
    db.delete(lottery)
    db.commit()


def get_eligible_participants(lottery: Lottery, db: Session) -> List[Participant]:
    query = db.query(Participant).filter(
        Participant.event_id == lottery.event_id,
        Participant.status == 'active'
    )
    
    if lottery.scope == 'group' and lottery.scope_value:
        query = query.filter(Participant.group_name == lottery.scope_value)
    
    if lottery.exclude_previous_winners:
        previous_winner_ids = db.query(Winner.participant_id).join(Lottery).filter(
            Lottery.event_id == lottery.event_id
        ).distinct().all()
        previous_winner_ids = [w[0] for w in previous_winner_ids]
        if previous_winner_ids:
            query = query.filter(~Participant.id.in_(previous_winner_ids))
    
    return query.all()


@router.post("/lotteries/{lottery_id}/draw")
async def draw_lottery(
    lottery_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    lottery = db.query(Lottery).filter(Lottery.id == lottery_id).first()
    if not lottery:
        raise HTTPException(status_code=404, detail="抽奖不存在")
    
    if lottery.status == 'completed':
        raise HTTPException(status_code=400, detail="该抽奖已完成")
    
    eligible = get_eligible_participants(lottery, db)
    if len(eligible) == 0:
        raise HTTPException(status_code=400, detail="没有符合条件的参与者")
    
    winner_count = min(lottery.winner_count, len(eligible))
    winners = random.sample(eligible, winner_count)
    
    lottery.status = 'drawing'
    db.commit()
    
    participant_ids = [p.id for p in eligible]
    await manager.broadcast_all(lottery.event_id, {
        "type": "lottery_started",
        "lottery_id": lottery_id,
        "name": lottery.name,
        "prize_name": lottery.prize.name if lottery.prize else "",
        "participant_ids": participant_ids,
        "winner_count": winner_count
    })
    
    winner_list = []
    for winner in winners:
        db_winner = Winner(
            lottery_id=lottery_id,
            participant_id=winner.id,
            prize_name=lottery.prize.name if lottery.prize else ""
        )
        db.add(db_winner)
        winner_list.append({
            "id": winner.id,
            "name": winner.name,
            "avatar": winner.avatar_url,
            "department": winner.department
        })
    
    if lottery.prize:
        lottery.prize.distributed += winner_count
    
    lottery.status = 'completed'
    db.commit()
    
    await manager.broadcast_all(lottery.event_id, {
        "type": "lottery_result",
        "lottery_id": lottery_id,
        "winners": winner_list
    })
    
    return {"success": True, "winners": winner_list}


@router.get("/lotteries/{lottery_id}/winners", response_model=List[WinnerResponse])
def get_lottery_winners(
    lottery_id: int,
    db: Session = Depends(get_db)
):
    lottery = db.query(Lottery).filter(Lottery.id == lottery_id).first()
    if not lottery:
        raise HTTPException(status_code=404, detail="抽奖不存在")
    
    winners = []
    for w in lottery.winners:
        p = db.query(Participant).filter(Participant.id == w.participant_id).first()
        winners.append(WinnerResponse(
            id=w.id,
            lottery_id=w.lottery_id,
            participant_id=w.participant_id,
            participant_name=p.name if p else "",
            participant_avatar=p.avatar_url if p else None,
            prize_name=w.prize_name,
            won_at=w.won_at,
            notified=w.notified,
            claimed=w.claimed
        ))
    
    return winners


@router.get("/events/{event_id}/winners", response_model=List[WinnerResponse])
def get_event_winners(
    event_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    lotteries = db.query(Lottery).filter(Lottery.event_id == event_id).all()
    lottery_ids = [l.id for l in lotteries]
    
    all_winners = []
    if lottery_ids:
        winners = db.query(Winner).filter(Winner.lottery_id.in_(lottery_ids)).order_by(Winner.won_at.desc()).all()
        for w in winners:
            p = db.query(Participant).filter(Participant.id == w.participant_id).first()
            all_winners.append(WinnerResponse(
                id=w.id,
                lottery_id=w.lottery_id,
                participant_id=w.participant_id,
                participant_name=p.name if p else "",
                participant_avatar=p.avatar_url if p else None,
                prize_name=w.prize_name,
                won_at=w.won_at,
                notified=w.notified,
                claimed=w.claimed
            ))
    
    return all_winners


@router.post("/winners/{winner_id}/notify")
async def notify_winner(
    winner_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    winner = db.query(Winner).filter(Winner.id == winner_id).first()
    if not winner:
        raise HTTPException(status_code=404, detail="中奖记录不存在")
    
    winner.notified = True
    db.commit()
    
    lottery = db.query(Lottery).filter(Lottery.id == winner.lottery_id).first()
    if lottery:
        await manager.broadcast_to_display(lottery.event_id, {
            "type": "winner_notification",
            "winner_id": winner_id,
            "participant_id": winner.participant_id,
            "prize_name": winner.prize_name
        })
    
    return {"success": True, "message": "已发送通知"}


@router.post("/winners/{winner_id}/claim")
def mark_winner_claimed(
    winner_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    winner = db.query(Winner).filter(Winner.id == winner_id).first()
    if not winner:
        raise HTTPException(status_code=404, detail="中奖记录不存在")
    
    winner.claimed = True
    db.commit()
    
    return {"success": True, "message": "已标记为已领取"}
