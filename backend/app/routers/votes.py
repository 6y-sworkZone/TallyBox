from datetime import datetime
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.auth import get_current_admin
from backend.app.database import get_db
from backend.app.models import Vote, VoteOption, VoteRecord, Event, Participant, Admin
from backend.app.schemas import VoteCreate, VoteUpdate, VoteResponse, VoteSubmitRequest
from backend.app.websocket import manager

router = APIRouter()


@router.get("/events/{event_id}/votes", response_model=List[VoteResponse])
def get_votes(
    event_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    votes = db.query(Vote).filter(Vote.event_id == event_id).order_by(Vote.created_at.desc()).all()
    return votes


@router.post("/events/{event_id}/votes", response_model=VoteResponse)
def create_vote(
    event_id: int,
    vote_data: VoteCreate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    options_data = vote_data.options
    vote_dict = vote_data.model_dump(exclude={"options"})
    db_vote = Vote(**vote_dict, event_id=event_id)
    db.add(db_vote)
    db.flush()
    
    for i, opt in enumerate(options_data):
        db_option = VoteOption(
            vote_id=db_vote.id,
            text=opt.text,
            sort_order=i if opt.sort_order is None else opt.sort_order
        )
        db.add(db_option)
    
    db.commit()
    db.refresh(db_vote)
    return db_vote


@router.get("/votes/{vote_id}", response_model=VoteResponse)
def get_vote(
    vote_id: int,
    db: Session = Depends(get_db)
):
    vote = db.query(Vote).filter(Vote.id == vote_id).first()
    if not vote:
        raise HTTPException(status_code=404, detail="投票不存在")
    return vote


@router.put("/votes/{vote_id}", response_model=VoteResponse)
async def update_vote(
    vote_id: int,
    vote_update: VoteUpdate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    vote = db.query(Vote).filter(Vote.id == vote_id).first()
    if not vote:
        raise HTTPException(status_code=404, detail="投票不存在")
    
    old_status = vote.status
    update_data = vote_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(vote, key, value)
    
    db.commit()
    db.refresh(vote)
    
    if old_status != 'active' and vote.status == 'active':
        vote_data = {
            "type": "vote_started",
            "vote_id": vote.id,
            "title": vote.title,
            "vote_type": vote.type,
            "options": [{"id": o.id, "text": o.text, "count": o.vote_count} for o in vote.options]
        }
        await manager.broadcast_all(vote.event_id, vote_data)
    
    return vote


@router.delete("/votes/{vote_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vote(
    vote_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    vote = db.query(Vote).filter(Vote.id == vote_id).first()
    if not vote:
        raise HTTPException(status_code=404, detail="投票不存在")
    
    db.delete(vote)
    db.commit()


@router.post("/votes/{vote_id}/submit")
async def submit_vote(
    vote_id: int,
    submit_data: VoteSubmitRequest,
    db: Session = Depends(get_db)
):
    vote = db.query(Vote).filter(Vote.id == vote_id).first()
    if not vote:
        raise HTTPException(status_code=404, detail="投票不存在")
    
    if vote.status != 'active':
        raise HTTPException(status_code=400, detail="投票未开始或已结束")
    
    if vote.end_time and datetime.now() > vote.end_time:
        vote.status = 'ended'
        db.commit()
        raise HTTPException(status_code=400, detail="投票已结束")
    
    existing = db.query(VoteRecord).filter(
        VoteRecord.vote_id == vote_id,
        VoteRecord.device_id == submit_data.device_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="该设备已投过票")
    
    if submit_data.participant_id and not vote.is_anonymous:
        existing_p = db.query(VoteRecord).filter(
            VoteRecord.vote_id == vote_id,
            VoteRecord.participant_id == submit_data.participant_id
        ).first()
        if existing_p:
            raise HTTPException(status_code=400, detail="您已投过票")
    
    option_ids_str = None
    if submit_data.option_ids:
        option_ids_str = json.dumps(submit_data.option_ids)
        for opt_id in submit_data.option_ids:
            option = db.query(VoteOption).filter(VoteOption.id == opt_id).first()
            if option:
                option.vote_count += 1
    
    record = VoteRecord(
        vote_id=vote_id,
        participant_id=submit_data.participant_id,
        option_ids=option_ids_str,
        rating=submit_data.rating,
        device_id=submit_data.device_id,
        captcha=submit_data.captcha
    )
    db.add(record)
    db.commit()
    
    if vote.show_results_realtime:
        results = get_vote_results_internal(vote_id, db)
        result_data = {
            "type": "vote_updated",
            "vote_id": vote_id,
            "results": results
        }
        await manager.broadcast_all(vote.event_id, result_data)
    
    return {"success": True, "message": "投票成功"}


def get_vote_results_internal(vote_id: int, db: Session):
    vote = db.query(Vote).filter(Vote.id == vote_id).first()
    if not vote:
        return None
    
    if vote.type == 'rating':
        records = db.query(VoteRecord).filter(
            VoteRecord.vote_id == vote_id,
            VoteRecord.rating.isnot(None)
        ).all()
        if records:
            avg_rating = sum(r.rating for r in records) / len(records)
            return {
                "type": "rating",
                "average": round(avg_rating, 2),
                "count": len(records),
                "max_rating": vote.max_rating
            }
        return {"type": "rating", "average": 0, "count": 0, "max_rating": vote.max_rating}
    else:
        options = db.query(VoteOption).filter(VoteOption.vote_id == vote_id).order_by(VoteOption.sort_order).all()
        total = sum(o.vote_count for o in options)
        return {
            "type": vote.type,
            "total_votes": total,
            "options": [
                {
                    "id": o.id,
                    "text": o.text,
                    "count": o.vote_count,
                    "percentage": round((o.vote_count / total * 100), 1) if total > 0 else 0
                }
                for o in options
            ]
        }


@router.get("/votes/{vote_id}/results")
def get_vote_results(
    vote_id: int,
    db: Session = Depends(get_db)
):
    results = get_vote_results_internal(vote_id, db)
    if results is None:
        raise HTTPException(status_code=404, detail="投票不存在")
    return results


@router.get("/votes/{vote_id}/records")
def get_vote_records(
    vote_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    vote = db.query(Vote).filter(Vote.id == vote_id).first()
    if not vote:
        raise HTTPException(status_code=404, detail="投票不存在")
    
    records = db.query(VoteRecord).filter(VoteRecord.vote_id == vote_id).all()
    result = []
    for r in records:
        p = db.query(Participant).filter(Participant.id == r.participant_id).first() if r.participant_id else None
        result.append({
            "id": r.id,
            "participant_name": p.name if p else "匿名",
            "option_ids": json.loads(r.option_ids) if r.option_ids else None,
            "rating": r.rating,
            "submitted_at": r.submitted_at
        })
    return result


@router.get("/votes/{vote_id}/export")
def export_vote_results(
    vote_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    from fastapi.responses import StreamingResponse
    import io
    
    vote = db.query(Vote).filter(Vote.id == vote_id).first()
    if not vote:
        raise HTTPException(status_code=404, detail="投票不存在")
    
    output = io.StringIO()
    import csv
    writer = csv.writer(output)
    
    if vote.type == 'rating':
        writer.writerow(['投票标题', vote.title])
        writer.writerow(['投票类型', '评分'])
        records = db.query(VoteRecord).filter(
            VoteRecord.vote_id == vote_id,
            VoteRecord.rating.isnot(None)
        ).all()
        writer.writerow(['序号', '参与人', '评分', '提交时间'])
        for i, r in enumerate(records, 1):
            p = db.query(Participant).filter(Participant.id == r.participant_id).first() if r.participant_id else None
            writer.writerow([i, p.name if p else '匿名', r.rating, r.submitted_at])
    else:
        writer.writerow(['投票标题', vote.title])
        writer.writerow(['投票类型', '单选' if vote.type == 'single' else '多选'])
        writer.writerow([])
        writer.writerow(['选项', '票数', '占比'])
        options = db.query(VoteOption).filter(VoteOption.vote_id == vote_id).all()
        total = sum(o.vote_count for o in options)
        for o in options:
            pct = round((o.vote_count / total * 100), 1) if total > 0 else 0
            writer.writerow([o.text, o.vote_count, f"{pct}%"])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=vote_{vote_id}_results.csv"}
    )
