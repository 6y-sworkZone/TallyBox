from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.auth import get_current_admin
from backend.app.database import get_db
from backend.app.models import Event, FlowStep, Admin
from backend.app.schemas import EventCreate, EventUpdate, EventResponse, FlowStepCreate, FlowStepUpdate, FlowStepResponse

router = APIRouter()


@router.get("", response_model=List[EventResponse])
def get_events(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    events = db.query(Event).order_by(Event.created_at.desc()).offset(skip).limit(limit).all()
    return events


@router.post("", response_model=EventResponse)
def create_event(
    event: EventCreate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    db_event = Event(**event.model_dump())
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event


@router.get("/{event_id}", response_model=EventResponse)
def get_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    return event


@router.put("/{event_id}", response_model=EventResponse)
def update_event(
    event_id: int,
    event_update: EventUpdate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    update_data = event_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(event, key, value)
    
    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    db.delete(event)
    db.commit()


@router.get("/{event_id}/flow", response_model=List[FlowStepResponse])
def get_flow_steps(
    event_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    steps = db.query(FlowStep).filter(FlowStep.event_id == event_id).order_by(FlowStep.sort_order).all()
    return steps


@router.post("/{event_id}/flow", response_model=FlowStepResponse)
def create_flow_step(
    event_id: int,
    step: FlowStepCreate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    db_step = FlowStep(**step.model_dump(), event_id=event_id)
    db.add(db_step)
    db.commit()
    db.refresh(db_step)
    return db_step


@router.put("/{event_id}/flow", response_model=List[FlowStepResponse])
def update_flow_steps(
    event_id: int,
    steps: List[FlowStepUpdate],
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    for i, step_data in enumerate(steps):
        if hasattr(step_data, 'id') and step_data.id:
            db_step = db.query(FlowStep).filter(FlowStep.id == step_data.id).first()
            if db_step:
                update_data = step_data.model_dump(exclude_unset=True)
                for key, value in update_data.items():
                    setattr(db_step, key, value)
                db_step.sort_order = i
        else:
            new_step = FlowStep(**step_data.model_dump(), event_id=event_id, sort_order=i)
            db.add(new_step)
    
    db.commit()
    
    updated_steps = db.query(FlowStep).filter(FlowStep.event_id == event_id).order_by(FlowStep.sort_order).all()
    return updated_steps


@router.put("/flow/{step_id}", response_model=FlowStepResponse)
def update_flow_step(
    step_id: int,
    step_update: FlowStepUpdate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    step = db.query(FlowStep).filter(FlowStep.id == step_id).first()
    if not step:
        raise HTTPException(status_code=404, detail="环节不存在")
    
    update_data = step_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(step, key, value)
    
    db.commit()
    db.refresh(step)
    return step


@router.delete("/flow/{step_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_flow_step(
    step_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    step = db.query(FlowStep).filter(FlowStep.id == step_id).first()
    if not step:
        raise HTTPException(status_code=404, detail="环节不存在")
    
    db.delete(step)
    db.commit()
