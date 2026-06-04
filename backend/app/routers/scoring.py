from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.responses import StreamingResponse

import io
import csv

from backend.app.auth import get_current_admin
from backend.app.database import get_db
from backend.app.models import Scoring, ScoringDimension, ScoringTarget, JudgeScore, Participant, Event, Admin
from backend.app.schemas import ScoringCreate, ScoringUpdate, ScoringResponse, ScoringSubmitRequest
from backend.app.websocket import manager

router = APIRouter()


@router.get("/events/{event_id}/scorings", response_model=List[ScoringResponse])
def get_scorings(
    event_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    scorings = db.query(Scoring).filter(Scoring.event_id == event_id).order_by(Scoring.created_at.desc()).all()
    return scorings


@router.post("/events/{event_id}/scorings", response_model=ScoringResponse)
def create_scoring(
    event_id: int,
    scoring_data: ScoringCreate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    db_scoring = Scoring(
        event_id=event_id,
        name=scoring_data.name,
        remove_highest_lowest=scoring_data.remove_highest_lowest,
        status="pending"
    )
    db.add(db_scoring)
    db.flush()
    
    for dim in scoring_data.dimensions:
        db_dim = ScoringDimension(
            scoring_id=db_scoring.id,
            name=dim.name,
            weight=dim.weight,
            max_score=dim.max_score
        )
        db.add(db_dim)
    
    for i, target in enumerate(scoring_data.targets):
        db_target = ScoringTarget(
            scoring_id=db_scoring.id,
            name=target.name,
            sort_order=i if target.sort_order is None else target.sort_order
        )
        db.add(db_target)
    
    db.commit()
    db.refresh(db_scoring)
    return db_scoring


@router.get("/scorings/{scoring_id}", response_model=ScoringResponse)
def get_scoring(
    scoring_id: int,
    db: Session = Depends(get_db)
):
    scoring = db.query(Scoring).filter(Scoring.id == scoring_id).first()
    if not scoring:
        raise HTTPException(status_code=404, detail="评分项不存在")
    return scoring


@router.put("/scorings/{scoring_id}", response_model=ScoringResponse)
def update_scoring(
    scoring_id: int,
    scoring_update: ScoringUpdate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    scoring = db.query(Scoring).filter(Scoring.id == scoring_id).first()
    if not scoring:
        raise HTTPException(status_code=404, detail="评分项不存在")
    
    update_data = scoring_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(scoring, key, value)
    
    db.commit()
    db.refresh(scoring)
    return scoring


@router.delete("/scorings/{scoring_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scoring(
    scoring_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    scoring = db.query(Scoring).filter(Scoring.id == scoring_id).first()
    if not scoring:
        raise HTTPException(status_code=404, detail="评分项不存在")
    
    db.delete(scoring)
    db.commit()


def calculate_final_score(scoring: Scoring, target: ScoringTarget, db: Session) -> float:
    dimensions = scoring.dimensions
    total_score = 0
    total_weight = sum(d.weight for d in dimensions)
    
    for dim in dimensions:
        scores = db.query(JudgeScore).filter(
            JudgeScore.scoring_id == scoring.id,
            JudgeScore.dimension_id == dim.id,
            JudgeScore.target_id == target.id
        ).all()
        
        if not scores:
            continue
        
        score_values = [s.score for s in scores]
        
        if scoring.remove_highest_lowest and len(score_values) >= 3:
            score_values.sort()
            score_values = score_values[1:-1]
        
        if score_values:
            avg = sum(score_values) / len(score_values)
            total_score += avg * dim.weight
    
    if total_weight > 0:
        return round(total_score / total_weight, 2)
    return 0


@router.post("/scorings/{scoring_id}/submit")
async def submit_scoring(
    scoring_id: int,
    submit_data: ScoringSubmitRequest,
    db: Session = Depends(get_db)
):
    scoring = db.query(Scoring).filter(Scoring.id == scoring_id).first()
    if not scoring:
        raise HTTPException(status_code=404, detail="评分项不存在")
    
    if scoring.status != 'active':
        raise HTTPException(status_code=400, detail="评分未开始或已结束")
    
    for score_data in submit_data.scores:
        existing = db.query(JudgeScore).filter(
            JudgeScore.scoring_id == scoring_id,
            JudgeScore.judge_id == submit_data.judge_id,
            JudgeScore.dimension_id == score_data.dimension_id,
            JudgeScore.target_id == score_data.target_id
        ).first()
        
        if existing:
            existing.score = score_data.score
            existing.submitted_at = datetime.now()
        else:
            db_score = JudgeScore(
                scoring_id=scoring_id,
                judge_id=submit_data.judge_id,
                dimension_id=score_data.dimension_id,
                target_id=score_data.target_id,
                score=score_data.score
            )
            db.add(db_score)
    
    db.commit()
    
    for target in scoring.targets:
        target.final_score = calculate_final_score(scoring, target, db)
    
    db.commit()
    
    results = get_scoring_results_internal(scoring_id, db)
    await manager.broadcast_all(scoring.event_id, {
        "type": "scoring_updated",
        "scoring_id": scoring_id,
        "results": results
    })
    
    return {"success": True, "message": "评分提交成功"}


def get_scoring_results_internal(scoring_id: int, db: Session):
    scoring = db.query(Scoring).filter(Scoring.id == scoring_id).first()
    if not scoring:
        return None
    
    targets = sorted(scoring.targets, key=lambda t: t.final_score or 0, reverse=True)
    
    return {
        "scoring_id": scoring_id,
        "name": scoring.name,
        "targets": [
            {
                "id": t.id,
                "name": t.name,
                "final_score": t.final_score,
                "rank": i + 1
            }
            for i, t in enumerate(targets)
        ]
    }


@router.get("/scorings/{scoring_id}/results")
def get_scoring_results(
    scoring_id: int,
    db: Session = Depends(get_db)
):
    results = get_scoring_results_internal(scoring_id, db)
    if results is None:
        raise HTTPException(status_code=404, detail="评分项不存在")
    return results


@router.get("/scorings/{scoring_id}/judge/{judge_id}/scores")
def get_judge_scores(
    scoring_id: int,
    judge_id: int,
    db: Session = Depends(get_db)
):
    scoring = db.query(Scoring).filter(Scoring.id == scoring_id).first()
    if not scoring:
        raise HTTPException(status_code=404, detail="评分项不存在")
    
    scores = db.query(JudgeScore).filter(
        JudgeScore.scoring_id == scoring_id,
        JudgeScore.judge_id == judge_id
    ).all()
    
    result = []
    for s in scores:
        dim = db.query(ScoringDimension).filter(ScoringDimension.id == s.dimension_id).first()
        target = db.query(ScoringTarget).filter(ScoringTarget.id == s.target_id).first()
        result.append({
            "dimension_id": s.dimension_id,
            "dimension_name": dim.name if dim else "",
            "target_id": s.target_id,
            "target_name": target.name if target else "",
            "score": s.score,
            "submitted_at": s.submitted_at
        })
    
    return result


@router.get("/scorings/{scoring_id}/export")
def export_scoring_results(
    scoring_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    scoring = db.query(Scoring).filter(Scoring.id == scoring_id).first()
    if not scoring:
        raise HTTPException(status_code=404, detail="评分项不存在")
    
    targets = sorted(scoring.targets, key=lambda t: t.final_score or 0, reverse=True)
    dimensions = scoring.dimensions
    judges = db.query(Participant).filter(Participant.is_judge == True, Participant.event_id == scoring.event_id).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow(['评分项', scoring.name])
    writer.writerow([])
    writer.writerow(['排名', '评分对象'] + [d.name for d in dimensions] + ['最终得分'])
    
    for i, target in enumerate(targets, 1):
        row = [i, target.name]
        for dim in dimensions:
            scores = db.query(JudgeScore).filter(
                JudgeScore.scoring_id == scoring_id,
                JudgeScore.dimension_id == dim.id,
                JudgeScore.target_id == target.id
            ).all()
            if scores:
                score_values = [s.score for s in scores]
                if scoring.remove_highest_lowest and len(score_values) >= 3:
                    score_values.sort()
                    score_values = score_values[1:-1]
                avg = round(sum(score_values) / len(score_values), 2) if score_values else 0
                row.append(avg)
            else:
                row.append(0)
        row.append(target.final_score or 0)
        writer.writerow(row)
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=scoring_{scoring_id}_results.csv"}
    )
