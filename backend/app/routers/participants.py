import uuid
import csv
import io
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.orm import Session

from backend.app.auth import get_current_admin
from backend.app.database import get_db
from backend.app.models import Participant, Event, Admin
from backend.app.schemas import ParticipantCreate, ParticipantUpdate, ParticipantResponse

router = APIRouter()


def generate_join_code():
    return str(uuid.uuid4())[:8].upper()


@router.get("/events/{event_id}/participants", response_model=List[ParticipantResponse])
def get_participants(
    event_id: int,
    group_name: Optional[str] = None,
    department: Optional[str] = None,
    is_judge: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    query = db.query(Participant).filter(Participant.event_id == event_id)
    
    if group_name:
        query = query.filter(Participant.group_name == group_name)
    if department:
        query = query.filter(Participant.department == department)
    if is_judge is not None:
        query = query.filter(Participant.is_judge == is_judge)
    
    participants = query.order_by(Participant.created_at.desc()).all()
    return participants


@router.post("/events/{event_id}/participants", response_model=ParticipantResponse)
def create_participant(
    event_id: int,
    participant: ParticipantCreate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    if event.max_participants:
        count = db.query(Participant).filter(Participant.event_id == event_id).count()
        if count >= event.max_participants:
            raise HTTPException(status_code=400, detail="参与人数已达上限")
    
    join_code = generate_join_code()
    while db.query(Participant).filter(Participant.join_code == join_code).first():
        join_code = generate_join_code()
    
    db_participant = Participant(
        **participant.model_dump(),
        event_id=event_id,
        join_code=join_code
    )
    db.add(db_participant)
    db.commit()
    db.refresh(db_participant)
    return db_participant


@router.post("/events/{event_id}/participants/import")
def import_participants(
    event_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="请上传CSV文件")
    
    content = file.file.read().decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(content))
    
    imported = 0
    failed = 0
    errors = []
    
    for i, row in enumerate(reader):
        try:
            name = row.get('姓名') or row.get('name') or row.get('Name')
            if not name:
                failed += 1
                errors.append(f"第{i+2}行: 姓名不能为空")
                continue
            
            join_code = generate_join_code()
            while db.query(Participant).filter(Participant.join_code == join_code).first():
                join_code = generate_join_code()
            
            participant = Participant(
                event_id=event_id,
                name=name.strip(),
                department=row.get('部门') or row.get('department') or row.get('Department'),
                table_number=row.get('桌号') or row.get('table_number') or row.get('Table'),
                group_name=row.get('分组') or row.get('group') or row.get('Group'),
                phone=row.get('电话') or row.get('phone') or row.get('Phone'),
                email=row.get('邮箱') or row.get('email') or row.get('Email'),
                seat_number=row.get('座位号') or row.get('seat') or row.get('Seat'),
                join_code=join_code
            )
            db.add(participant)
            imported += 1
        except Exception as e:
            failed += 1
            errors.append(f"第{i+2}行: {str(e)}")
    
    db.commit()
    return {"imported": imported, "failed": failed, "errors": errors}


@router.get("/participants/{participant_id}", response_model=ParticipantResponse)
def get_participant(
    participant_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    participant = db.query(Participant).filter(Participant.id == participant_id).first()
    if not participant:
        raise HTTPException(status_code=404, detail="参与人不存在")
    return participant


@router.get("/participants/by-code/{join_code}", response_model=ParticipantResponse)
def get_participant_by_code(
    join_code: str,
    db: Session = Depends(get_db)
):
    participant = db.query(Participant).filter(Participant.join_code == join_code.upper()).first()
    if not participant:
        raise HTTPException(status_code=404, detail="参与人不存在")
    return participant


@router.put("/participants/{participant_id}", response_model=ParticipantResponse)
def update_participant(
    participant_id: int,
    participant_update: ParticipantUpdate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    participant = db.query(Participant).filter(Participant.id == participant_id).first()
    if not participant:
        raise HTTPException(status_code=404, detail="参与人不存在")
    
    update_data = participant_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(participant, key, value)
    
    db.commit()
    db.refresh(participant)
    return participant


@router.delete("/participants/{participant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_participant(
    participant_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    participant = db.query(Participant).filter(Participant.id == participant_id).first()
    if not participant:
        raise HTTPException(status_code=404, detail="参与人不存在")
    
    db.delete(participant)
    db.commit()


@router.post("/events/{event_id}/participants/group-by-department")
def group_by_department(
    event_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    participants = db.query(Participant).filter(
        Participant.event_id == event_id,
        Participant.group_name.is_(None)
    ).all()
    
    for p in participants:
        if p.department:
            p.group_name = p.department
    
    db.commit()
    return {"message": "按部门分组完成", "count": len(participants)}


@router.post("/events/{event_id}/participants/group-by-table")
def group_by_table(
    event_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    participants = db.query(Participant).filter(
        Participant.event_id == event_id,
        Participant.group_name.is_(None)
    ).all()
    
    for p in participants:
        if p.table_number:
            p.group_name = f"{p.table_number}桌"
    
    db.commit()
    return {"message": "按桌号分组完成", "count": len(participants)}
