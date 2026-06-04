from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.auth import get_current_admin
from backend.app.database import get_db
from backend.app.models import Template, FlowStep, Admin
from backend.app.schemas import TemplateCreate, TemplateResponse

router = APIRouter()


@router.get("", response_model=List[TemplateResponse])
def get_templates(
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    templates = db.query(Template).order_by(Template.created_at.desc()).all()
    return templates


@router.post("", response_model=TemplateResponse)
def create_template(
    template_data: TemplateCreate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    template = Template(**template_data.model_dump())
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.post("/{template_id}/apply/{event_id}")
def apply_template(
    template_id: int,
    event_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    from backend.app.models import Event
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    import json
    try:
        flow_data = json.loads(template.flow_data)
    except:
        raise HTTPException(status_code=400, detail="模板数据格式错误")
    
    db.query(FlowStep).filter(FlowStep.event_id == event_id).delete()
    
    for i, step_data in enumerate(flow_data):
        step = FlowStep(
            event_id=event_id,
            name=step_data.get('name', ''),
            type=step_data.get('type', 'custom'),
            sort_order=i,
            duration=step_data.get('duration')
        )
        db.add(step)
    
    db.commit()
    
    return {"success": True, "message": "模板应用成功"}


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    db.delete(template)
    db.commit()
