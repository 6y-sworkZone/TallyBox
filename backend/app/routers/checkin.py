from datetime import datetime, timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.responses import StreamingResponse

import io
import csv
import qrcode
import qrcode.image.svg

from backend.app.auth import get_current_admin
from backend.app.database import get_db
from backend.app.models import Participant, Event, Admin
from backend.app.schemas import ParticipantResponse, CheckInStats

router = APIRouter()


@router.post("/checkin/{event_id}/{join_code}")
async def checkin(
    event_id: int,
    join_code: str,
    db: Session = Depends(get_db)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    participant = db.query(Participant).filter(
        Participant.join_code == join_code.upper(),
        Participant.event_id == event_id
    ).first()
    
    if not participant:
        raise HTTPException(status_code=404, detail="参与人不存在")
    
    if participant.check_in_time:
        return {
            "success": True,
            "message": "已签到",
            "already_checked": True,
            "participant": {
                "id": participant.id,
                "name": participant.name,
                "seat_number": participant.seat_number,
                "check_in_time": participant.check_in_time
            }
        }
    
    now = datetime.now()
    participant.check_in_time = now
    
    if event.date:
        try:
            event_start = datetime.strptime(f"{event.date} 09:00", "%Y-%m-%d %H:%M")
            if now > event_start + timedelta(minutes=15):
                participant.is_late = True
        except:
            pass
    
    db.commit()
    db.refresh(participant)
    
    from backend.app.websocket import manager
    await manager.broadcast_all(event_id, {
        "type": "checkin_update",
        "participant_id": participant.id,
        "name": participant.name,
        "avatar": participant.avatar_url,
        "is_late": participant.is_late,
        "seat_number": participant.seat_number
    })
    
    return {
        "success": True,
        "message": "签到成功",
        "already_checked": False,
        "participant": {
            "id": participant.id,
            "name": participant.name,
            "seat_number": participant.seat_number,
            "check_in_time": participant.check_in_time,
            "is_late": participant.is_late
        }
    }


@router.get("/events/{event_id}/checkin/stats", response_model=CheckInStats)
def get_checkin_stats(
    event_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    total = db.query(Participant).filter(Participant.event_id == event_id).count()
    checked_in = db.query(Participant).filter(
        Participant.event_id == event_id,
        Participant.check_in_time.isnot(None)
    ).count()
    late = db.query(Participant).filter(
        Participant.event_id == event_id,
        Participant.is_late == True
    ).count()
    
    rate = round((checked_in / total * 100), 2) if total > 0 else 0
    
    checkins = db.query(Participant).filter(
        Participant.event_id == event_id,
        Participant.check_in_time.isnot(None)
    ).order_by(Participant.check_in_time).all()
    
    trend = []
    if checkins:
        start_hour = checkins[0].check_in_time.hour
        end_hour = checkins[-1].check_in_time.hour
        for hour in range(start_hour, end_hour + 1):
            count = sum(1 for c in checkins if c.check_in_time.hour == hour)
            trend.append({"time": f"{hour}:00", "count": count})
    
    return CheckInStats(
        total=total,
        checked_in=checked_in,
        late=late,
        rate=rate,
        check_in_trend=trend
    )


@router.get("/events/{event_id}/checkin/qrcode")
def get_checkin_qrcode(
    event_id: int,
    base_url: str = "http://localhost",
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    qr_url = f"{base_url}/join/{event_id}"
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(qr_url)
    qr.make(fit=True)
    
    img = qr.make_image(image_factory=qrcode.image.svg.SvgImage)
    
    buf = io.BytesIO()
    img.save(buf)
    svg_content = buf.getvalue().decode('utf-8')
    
    return {"qrcode_svg": svg_content, "url": qr_url}


@router.get("/events/{event_id}/checkin/list")
def get_checkin_list(
    event_id: int,
    only_checked: bool = False,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    query = db.query(Participant).filter(Participant.event_id == event_id)
    if only_checked:
        query = query.filter(Participant.check_in_time.isnot(None))
    
    participants = query.order_by(Participant.check_in_time.desc()).all()
    
    result = []
    for p in participants:
        result.append({
            "id": p.id,
            "name": p.name,
            "department": p.department,
            "table_number": p.table_number,
            "group_name": p.group_name,
            "seat_number": p.seat_number,
            "check_in_time": p.check_in_time,
            "is_late": p.is_late,
            "status": "已签到" if p.check_in_time else "未签到"
        })
    
    return result


@router.get("/events/{event_id}/checkin/export")
def export_checkin(
    event_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    participants = db.query(Participant).filter(
        Participant.event_id == event_id
    ).order_by(Participant.check_in_time.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['姓名', '部门', '桌号', '分组', '座位号', '签到状态', '签到时间', '是否迟到'])
    
    for p in participants:
        status = "已签到" if p.check_in_time else "未签到"
        checkin_time = p.check_in_time.strftime("%Y-%m-%d %H:%M:%S") if p.check_in_time else ""
        late = "是" if p.is_late else "否"
        writer.writerow([p.name, p.department, p.table_number, p.group_name, p.seat_number, status, checkin_time, late])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=checkin_{event_id}.csv"}
    )


@router.post("/checkin/{participant_id}/manual")
async def manual_checkin(
    participant_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    participant = db.query(Participant).filter(Participant.id == participant_id).first()
    if not participant:
        raise HTTPException(status_code=404, detail="参与人不存在")
    
    if participant.check_in_time:
        return {"success": True, "message": "已签到", "already_checked": True}
    
    now = datetime.now()
    participant.check_in_time = now
    
    event = db.query(Event).filter(Event.id == participant.event_id).first()
    if event and event.date:
        try:
            event_start = datetime.strptime(f"{event.date} 09:00", "%Y-%m-%d %H:%M")
            if now > event_start + timedelta(minutes=15):
                participant.is_late = True
        except:
            pass
    
    db.commit()
    
    from backend.app.websocket import manager
    await manager.broadcast_all(participant.event_id, {
        "type": "checkin_update",
        "participant_id": participant.id,
        "name": participant.name,
        "avatar": participant.avatar_url,
        "is_late": participant.is_late,
        "seat_number": participant.seat_number
    })
    
    return {"success": True, "message": "签到成功"}


@router.post("/checkin/{participant_id}/undo")
async def undo_checkin(
    participant_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    participant = db.query(Participant).filter(Participant.id == participant_id).first()
    if not participant:
        raise HTTPException(status_code=404, detail="参与人不存在")
    
    participant.check_in_time = None
    participant.is_late = False
    db.commit()
    
    from backend.app.websocket import manager
    await manager.broadcast_all(participant.event_id, {
        "type": "checkin_undo",
        "participant_id": participant.id
    })
    
    return {"success": True, "message": "已撤销签到"}
