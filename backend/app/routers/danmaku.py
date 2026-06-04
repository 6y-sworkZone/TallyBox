from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.auth import get_current_admin
from backend.app.database import get_db
from backend.app.models import Danmaku, DanmakuConfig, SensitiveWord, Event, Participant, Admin
from backend.app.schemas import DanmakuSendRequest, DanmakuResponse, DanmakuConfigCreate, DanmakuConfigResponse, SensitiveWordCreate, SensitiveWordResponse
from backend.app.websocket import manager

router = APIRouter()


def filter_sensitive_words(content: str, db: Session) -> tuple[str, bool]:
    words = db.query(SensitiveWord).all()
    filtered = content
    has_sensitive = False
    for w in words:
        if w.word in filtered:
            filtered = filtered.replace(w.word, '*' * len(w.word))
            has_sensitive = True
    return filtered, has_sensitive


@router.get("/events/{event_id}/danmaku/config", response_model=DanmakuConfigResponse)
def get_danmaku_config(
    event_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    config = db.query(DanmakuConfig).filter(DanmakuConfig.event_id == event_id).first()
    if not config:
        config = DanmakuConfig(event_id=event_id)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


@router.post("/events/{event_id}/danmaku/config", response_model=DanmakuConfigResponse)
def update_danmaku_config(
    event_id: int,
    config_data: DanmakuConfigCreate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    config = db.query(DanmakuConfig).filter(DanmakuConfig.event_id == event_id).first()
    if config:
        update_data = config_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(config, key, value)
    else:
        config = DanmakuConfig(**config_data.model_dump())
        db.add(config)
    
    db.commit()
    db.refresh(config)
    return config


@router.get("/events/{event_id}/danmaku", response_model=List[DanmakuResponse])
def get_danmakus(
    event_id: int,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    query = db.query(Danmaku).filter(Danmaku.event_id == event_id)
    if status:
        query = query.filter(Danmaku.status == status)
    
    danmakus = query.order_by(Danmaku.submitted_at.desc()).all()
    result = []
    for d in danmakus:
        p = db.query(Participant).filter(Participant.id == d.participant_id).first() if d.participant_id else None
        result.append(DanmakuResponse(
            id=d.id,
            event_id=d.event_id,
            participant_id=d.participant_id,
            participant_name=p.name if p else None,
            content=d.content,
            color=d.color,
            font_size=d.font_size,
            speed=d.speed,
            status=d.status,
            is_pinned=d.is_pinned,
            submitted_at=d.submitted_at,
            approved_at=d.approved_at
        ))
    return result


@router.post("/danmaku/send")
async def send_danmaku(
    request: DanmakuSendRequest,
    db: Session = Depends(get_db)
):
    event = db.query(Event).filter(Event.id == request.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    if event.status != 'ongoing':
        raise HTTPException(status_code=400, detail="活动未进行中")
    
    config = db.query(DanmakuConfig).filter(DanmakuConfig.event_id == request.event_id).first()
    if config and len(request.content) > config.max_length:
        raise HTTPException(status_code=400, detail=f"弹幕内容不能超过{config.max_length}字")
    
    filtered_content, has_sensitive = filter_sensitive_words(request.content, db)
    
    status = 'approved'
    if config and config.require_approval:
        status = 'pending'
    if has_sensitive:
        status = 'pending'
    
    danmaku = Danmaku(
        event_id=request.event_id,
        participant_id=request.participant_id,
        content=filtered_content,
        color=request.color,
        font_size=request.font_size,
        speed=request.speed,
        status=status,
        approved_at=datetime.now() if status == 'approved' else None
    )
    db.add(danmaku)
    db.commit()
    db.refresh(danmaku)
    
    if status == 'approved':
        p = db.query(Participant).filter(Participant.id == danmaku.participant_id).first() if danmaku.participant_id else None
        await manager.broadcast_to_display(request.event_id, {
            "type": "danmaku_new",
            "id": danmaku.id,
            "content": filtered_content,
            "color": danmaku.color,
            "font_size": danmaku.font_size,
            "speed": danmaku.speed,
            "participant_name": p.name if p else None,
            "is_pinned": False
        })
    
    return {
        "success": True,
        "message": "弹幕发送成功" if status == 'approved' else "弹幕已发送，等待审核",
        "status": status
    }


@router.post("/danmaku/{danmaku_id}/approve")
async def approve_danmaku(
    danmaku_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    danmaku = db.query(Danmaku).filter(Danmaku.id == danmaku_id).first()
    if not danmaku:
        raise HTTPException(status_code=404, detail="弹幕不存在")
    
    danmaku.status = 'approved'
    danmaku.approved_at = datetime.now()
    db.commit()
    
    p = db.query(Participant).filter(Participant.id == danmaku.participant_id).first() if danmaku.participant_id else None
    await manager.broadcast_to_display(danmaku.event_id, {
        "type": "danmaku_new",
        "id": danmaku.id,
        "content": danmaku.content,
        "color": danmaku.color,
        "font_size": danmaku.font_size,
        "speed": danmaku.speed,
        "participant_name": p.name if p else None,
        "is_pinned": False
    })
    
    return {"success": True, "message": "审核通过"}


@router.post("/danmaku/{danmaku_id}/reject")
def reject_danmaku(
    danmaku_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    danmaku = db.query(Danmaku).filter(Danmaku.id == danmaku_id).first()
    if not danmaku:
        raise HTTPException(status_code=404, detail="弹幕不存在")
    
    danmaku.status = 'rejected'
    db.commit()
    
    return {"success": True, "message": "已拒绝"}


@router.post("/danmaku/{danmaku_id}/pin")
async def pin_danmaku(
    danmaku_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    danmaku = db.query(Danmaku).filter(Danmaku.id == danmaku_id).first()
    if not danmaku:
        raise HTTPException(status_code=404, detail="弹幕不存在")
    
    db.query(Danmaku).filter(
        Danmaku.event_id == danmaku.event_id,
        Danmaku.is_pinned == True
    ).update({"is_pinned": False})
    
    danmaku.is_pinned = True
    danmaku.status = 'approved'
    db.commit()
    
    p = db.query(Participant).filter(Participant.id == danmaku.participant_id).first() if danmaku.participant_id else None
    await manager.broadcast_to_display(danmaku.event_id, {
        "type": "danmaku_pinned",
        "id": danmaku.id,
        "content": danmaku.content,
        "participant_name": p.name if p else None
    })
    
    return {"success": True, "message": "已置顶"}


@router.post("/danmaku/{danmaku_id}/unpin")
async def unpin_danmaku(
    danmaku_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    danmaku = db.query(Danmaku).filter(Danmaku.id == danmaku_id).first()
    if not danmaku:
        raise HTTPException(status_code=404, detail="弹幕不存在")
    
    danmaku.is_pinned = False
    db.commit()
    
    await manager.broadcast_to_display(danmaku.event_id, {
        "type": "danmaku_unpinned"
    })
    
    return {"success": True, "message": "已取消置顶"}


@router.delete("/danmaku/{danmaku_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_danmaku(
    danmaku_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    danmaku = db.query(Danmaku).filter(Danmaku.id == danmaku_id).first()
    if not danmaku:
        raise HTTPException(status_code=404, detail="弹幕不存在")
    
    db.delete(danmaku)
    db.commit()


@router.get("/events/{event_id}/danmaku/stats")
def get_danmaku_stats(
    event_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    total = db.query(Danmaku).filter(Danmaku.event_id == event_id).count()
    approved = db.query(Danmaku).filter(Danmaku.event_id == event_id, Danmaku.status == 'approved').count()
    pending = db.query(Danmaku).filter(Danmaku.event_id == event_id, Danmaku.status == 'pending').count()
    rejected = db.query(Danmaku).filter(Danmaku.event_id == event_id, Danmaku.status == 'rejected').count()
    
    return {
        "total": total,
        "approved": approved,
        "pending": pending,
        "rejected": rejected
    }


@router.get("/sensitive-words", response_model=List[SensitiveWordResponse])
def get_sensitive_words(
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    words = db.query(SensitiveWord).all()
    return words


@router.post("/sensitive-words", response_model=SensitiveWordResponse)
def add_sensitive_word(
    word_data: SensitiveWordCreate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    existing = db.query(SensitiveWord).filter(SensitiveWord.word == word_data.word).first()
    if existing:
        raise HTTPException(status_code=400, detail="敏感词已存在")
    
    word = SensitiveWord(word=word_data.word)
    db.add(word)
    db.commit()
    db.refresh(word)
    return word


@router.delete("/sensitive-words/{word_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sensitive_word(
    word_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    word = db.query(SensitiveWord).filter(SensitiveWord.id == word_id).first()
    if not word:
        raise HTTPException(status_code=404, detail="敏感词不存在")
    
    db.delete(word)
    db.commit()
