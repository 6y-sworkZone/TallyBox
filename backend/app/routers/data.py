from datetime import datetime, timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.responses import StreamingResponse

import io
import json
import csv

from backend.app.auth import get_current_admin
from backend.app.database import get_db
from backend.app.models import Event, Participant, Vote, VoteRecord, Danmaku, Lottery, Winner, Admin
from backend.app.schemas import DashboardStats

router = APIRouter()


@router.get("/events/{event_id}/dashboard", response_model=DashboardStats)
def get_dashboard(
    event_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    total_participants = db.query(Participant).filter(Participant.event_id == event_id).count()
    checked_in_count = db.query(Participant).filter(
        Participant.event_id == event_id,
        Participant.check_in_time.isnot(None)
    ).count()
    check_in_rate = round((checked_in_count / total_participants * 100), 2) if total_participants > 0 else 0
    
    total_votes = db.query(Vote).filter(Vote.event_id == event_id).count()
    vote_count = db.query(VoteRecord).join(Vote).filter(Vote.event_id == event_id).count()
    
    total_danmakus = db.query(Danmaku).filter(Danmaku.event_id == event_id).count()
    approved_danmakus = db.query(Danmaku).filter(
        Danmaku.event_id == event_id,
        Danmaku.status == 'approved'
    ).count()
    
    total_lotteries = db.query(Lottery).filter(Lottery.event_id == event_id).count()
    total_winners = db.query(Winner).join(Lottery).filter(Lottery.event_id == event_id).count()
    
    activity_trend = []
    all_records = db.query(VoteRecord).join(Vote).filter(
        Vote.event_id == event_id
    ).order_by(VoteRecord.submitted_at).all()
    all_danmakus = db.query(Danmaku).filter(
        Danmaku.event_id == event_id,
        Danmaku.submitted_at.isnot(None)
    ).order_by(Danmaku.submitted_at).all()
    all_checkins = db.query(Participant).filter(
        Participant.event_id == event_id,
        Participant.check_in_time.isnot(None)
    ).order_by(Participant.check_in_time).all()
    
    all_activities = []
    for r in all_records:
        all_activities.append(('vote', r.submitted_at))
    for d in all_danmakus:
        all_activities.append(('danmaku', d.submitted_at))
    for c in all_checkins:
        all_activities.append(('checkin', c.check_in_time))
    
    if all_activities:
        all_activities.sort(key=lambda x: x[1])
        start_hour = all_activities[0][1].hour
        end_hour = all_activities[-1][1].hour
        for hour in range(start_hour, end_hour + 1):
            count = sum(1 for a in all_activities if a[1].hour == hour)
            activity_trend.append({"time": f"{hour}:00", "count": count})
    
    step_participation = []
    votes = db.query(Vote).filter(Vote.event_id == event_id).all()
    for v in votes:
        record_count = db.query(VoteRecord).filter(VoteRecord.vote_id == v.id).count()
        step_participation.append({
            "type": "vote",
            "name": v.title,
            "participation": record_count
        })
    
    active_users = []
    participant_activities = {}
    for r in all_records:
        if r.participant_id:
            participant_activities[r.participant_id] = participant_activities.get(r.participant_id, 0) + 1
    for d in all_danmakus:
        if d.participant_id:
            participant_activities[d.participant_id] = participant_activities.get(d.participant_id, 0) + 1
    
    for pid, count in sorted(participant_activities.items(), key=lambda x: x[1], reverse=True)[:10]:
        p = db.query(Participant).filter(Participant.id == pid).first()
        if p:
            active_users.append({
                "id": p.id,
                "name": p.name,
                "avatar": p.avatar_url,
                "department": p.department,
                "activity_count": count
            })
    
    return DashboardStats(
        total_participants=total_participants,
        checked_in_count=checked_in_count,
        check_in_rate=check_in_rate,
        total_votes=total_votes,
        vote_count=vote_count,
        total_danmakus=total_danmakus,
        approved_danmakus=approved_danmakus,
        total_lotteries=total_lotteries,
        total_winners=total_winners,
        activity_trend=activity_trend,
        step_participation=step_participation,
        active_users=active_users
    )


@router.get("/events/{event_id}/export/json")
def export_all_data_json(
    event_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    participants = db.query(Participant).filter(Participant.event_id == event_id).all()
    votes = db.query(Vote).filter(Vote.event_id == event_id).all()
    lotteries = db.query(Lottery).filter(Lottery.event_id == event_id).all()
    danmakus = db.query(Danmaku).filter(Danmaku.event_id == event_id).all()
    winners = db.query(Winner).join(Lottery).filter(Lottery.event_id == event_id).all()
    
    data = {
        "event": {
            "id": event.id,
            "name": event.name,
            "date": event.date,
            "location": event.location,
            "description": event.description,
            "status": event.status,
            "created_at": event.created_at.isoformat() if event.created_at else None
        },
        "participants": [
            {
                "id": p.id,
                "name": p.name,
                "department": p.department,
                "table_number": p.table_number,
                "group_name": p.group_name,
                "phone": p.phone,
                "email": p.email,
                "seat_number": p.seat_number,
                "check_in_time": p.check_in_time.isoformat() if p.check_in_time else None,
                "is_late": p.is_late,
                "is_judge": p.is_judge
            } for p in participants
        ],
        "votes": [],
        "lotteries": [],
        "danmakus": [],
        "winners": []
    }
    
    for v in votes:
        options = db.query(VoteRecord).filter(VoteRecord.vote_id == v.id).all()
        data["votes"].append({
            "id": v.id,
            "title": v.title,
            "type": v.type,
            "status": v.status,
            "options": [{"id": o.id, "text": o.text, "count": o.vote_count} for o in v.options],
            "records": [
                {
                    "participant_name": db.query(Participant).filter(Participant.id == r.participant_id).first().name if r.participant_id else "匿名",
                    "option_ids": json.loads(r.option_ids) if r.option_ids else None,
                    "rating": r.rating,
                    "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None
                } for r in options
            ]
        })
    
    for l in lotteries:
        data["lotteries"].append({
            "id": l.id,
            "name": l.name,
            "prize_name": l.prize.name if l.prize else "",
            "winner_count": l.winner_count,
            "status": l.status
        })
    
    for d in danmakus:
        p = db.query(Participant).filter(Participant.id == d.participant_id).first()
        data["danmakus"].append({
            "id": d.id,
            "content": d.content,
            "participant_name": p.name if p else "匿名",
            "color": d.color,
            "status": d.status,
            "submitted_at": d.submitted_at.isoformat() if d.submitted_at else None
        })
    
    for w in winners:
        p = db.query(Participant).filter(Participant.id == w.participant_id).first()
        data["winners"].append({
            "id": w.id,
            "participant_name": p.name if p else "",
            "prize_name": w.prize_name,
            "won_at": w.won_at.isoformat() if w.won_at else None,
            "claimed": w.claimed
        })
    
    json_str = json.dumps(data, ensure_ascii=False, indent=2)
    
    return StreamingResponse(
        iter([json_str]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=event_{event_id}_data.json"}
    )


@router.get("/events/{event_id}/export/csv")
def export_all_data_csv(
    event_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow(['=== 活动信息 ==='])
    writer.writerow(['活动名称', event.name])
    writer.writerow(['活动日期', event.date])
    writer.writerow(['活动地点', event.location])
    writer.writerow([])
    
    writer.writerow(['=== 参与人信息 ==='])
    writer.writerow(['姓名', '部门', '桌号', '分组', '座位号', '签到时间', '是否迟到', '是否评委'])
    participants = db.query(Participant).filter(Participant.event_id == event_id).all()
    for p in participants:
        checkin_time = p.check_in_time.strftime("%Y-%m-%d %H:%M:%S") if p.check_in_time else ""
        writer.writerow([
            p.name, p.department, p.table_number, p.group_name, p.seat_number,
            checkin_time, "是" if p.is_late else "否", "是" if p.is_judge else "否"
        ])
    writer.writerow([])
    
    writer.writerow(['=== 中奖记录 ==='])
    writer.writerow(['抽奖名称', '奖品', '中奖人', '中奖时间', '是否已领取'])
    winners = db.query(Winner).join(Lottery).filter(Lottery.event_id == event_id).all()
    for w in winners:
        p = db.query(Participant).filter(Participant.id == w.participant_id).first()
        won_at = w.won_at.strftime("%Y-%m-%d %H:%M:%S") if w.won_at else ""
        writer.writerow([w.lottery.name if w.lottery else "", w.prize_name, p.name if p else "", won_at, "是" if w.claimed else "否"])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=event_{event_id}_data.csv"}
    )


@router.post("/events/{event_id}/report/pdf")
def generate_pdf_report(
    event_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活动不存在")
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, title=f"{event.name} 活动报告")
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#E53935'),
        spaceAfter=30,
        alignment=1
    )
    h2_style = ParagraphStyle(
        'CustomH2',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor('#1A237E'),
        spaceBefore=20,
        spaceAfter=10
    )
    normal_style = styles['Normal']
    normal_style.fontSize = 10
    
    story = []
    
    story.append(Paragraph(f"{event.name} 活动总结报告", title_style))
    story.append(Spacer(1, 0.2 * inch))
    
    basic_data = [
        ['活动名称', event.name],
        ['活动日期', event.date],
        ['活动地点', event.location or ''],
        ['活动状态', '准备中' if event.status == 'preparing' else '进行中' if event.status == 'ongoing' else '已结束'],
    ]
    basic_table = Table(basic_data, colWidths=[1.5 * inch, 4 * inch])
    basic_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#FFEBEE')),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#E53935')),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    story.append(basic_table)
    
    total_participants = db.query(Participant).filter(Participant.event_id == event_id).count()
    checked_in = db.query(Participant).filter(
        Participant.event_id == event_id,
        Participant.check_in_time.isnot(None)
    ).count()
    total_votes = db.query(VoteRecord).join(Vote).filter(Vote.event_id == event_id).count()
    total_danmakus = db.query(Danmaku).filter(Danmaku.event_id == event_id, Danmaku.status == 'approved').count()
    total_winners = db.query(Winner).join(Lottery).filter(Lottery.event_id == event_id).count()
    
    story.append(Paragraph("数据概览", h2_style))
    stats_data = [
        ['统计项', '数值'],
        ['总参与人数', str(total_participants)],
        ['签到人数', str(checked_in)],
        ['签到率', f"{round(checked_in/total_participants*100, 2)}%" if total_participants > 0 else "0%"],
        ['投票总数', str(total_votes)],
        ['弹幕总数', str(total_danmakus)],
        ['中奖人数', str(total_winners)],
    ]
    stats_table = Table(stats_data, colWidths=[2.5 * inch, 2.5 * inch])
    stats_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1A237E')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (1, 1), (1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#FFF3E0')]),
    ]))
    story.append(stats_table)
    
    story.append(Paragraph("中奖名单", h2_style))
    winners = db.query(Winner).join(Lottery).filter(Lottery.event_id == event_id).order_by(Winner.won_at).all()
    if winners:
        winner_data = [['序号', '抽奖名称', '奖品', '中奖人', '中奖时间']]
        for i, w in enumerate(winners, 1):
            p = db.query(Participant).filter(Participant.id == w.participant_id).first()
            won_at = w.won_at.strftime("%H:%M:%S") if w.won_at else ""
            winner_data.append([
                str(i),
                w.lottery.name if w.lottery else "",
                w.prize_name,
                p.name if p else "",
                won_at
            ])
        winner_table = Table(winner_data, colWidths=[0.5 * inch, 1.5 * inch, 1.5 * inch, 1.5 * inch, 1 * inch])
        winner_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#FFD700')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ]))
        story.append(winner_table)
    else:
        story.append(Paragraph("暂无中奖记录", normal_style))
    
    doc.build(story)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=event_{event_id}_report.pdf"}
    )


@router.get("/events/comparison")
def compare_events(
    event_ids: str,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    ids = [int(x) for x in event_ids.split(',')]
    results = []
    
    for eid in ids:
        event = db.query(Event).filter(Event.id == eid).first()
        if not event:
            continue
        
        total_participants = db.query(Participant).filter(Participant.event_id == eid).count()
        checked_in = db.query(Participant).filter(
            Participant.event_id == eid,
            Participant.check_in_time.isnot(None)
        ).count()
        vote_count = db.query(VoteRecord).join(Vote).filter(Vote.event_id == eid).count()
        danmaku_count = db.query(Danmaku).filter(Danmaku.event_id == eid, Danmaku.status == 'approved').count()
        winner_count = db.query(Winner).join(Lottery).filter(Lottery.event_id == eid).count()
        
        results.append({
            "event_id": eid,
            "event_name": event.name,
            "event_date": event.date,
            "total_participants": total_participants,
            "check_in_rate": round(checked_in/total_participants*100, 2) if total_participants > 0 else 0,
            "vote_count": vote_count,
            "danmaku_count": danmaku_count,
            "winner_count": winner_count,
            "engagement_score": round((vote_count + danmaku_count) / max(total_participants, 1), 2)
        })
    
    return results
