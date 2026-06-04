import random
import socket
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.database import init_db, create_default_admin
from backend.app.routers import auth, events, participants, votes, lottery, danmaku, checkin, scoring, data, templates
from backend.app.websocket import ws_router


def get_random_port():
    used_ports = [8080, 3000, 8000, 5000, 5173, 4200, 3001, 8001]
    while True:
        port = random.randint(10000, 65535)
        if port not in used_ports:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(1)
                result = sock.connect_ex(('127.0.0.1', port))
                sock.close()
                if result != 0:
                    return port
            except:
                continue


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    create_default_admin()
    yield


app = FastAPI(title="TallyBox - 年会互动工具", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(events.router, prefix="/api/events", tags=["活动"])
app.include_router(participants.router, prefix="/api", tags=["参与人"])
app.include_router(votes.router, prefix="/api", tags=["投票"])
app.include_router(lottery.router, prefix="/api", tags=["抽奖"])
app.include_router(danmaku.router, prefix="/api", tags=["弹幕"])
app.include_router(checkin.router, prefix="/api", tags=["签到"])
app.include_router(scoring.router, prefix="/api", tags=["评分"])
app.include_router(data.router, prefix="/api", tags=["数据"])
app.include_router(templates.router, prefix="/api/templates", tags=["模板"])
app.include_router(ws_router)

app.mount("/static", StaticFiles(directory="backend/static"), name="static")


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "TallyBox 服务运行正常"}


if __name__ == "__main__":
    import uvicorn
    port = get_random_port()
    print(f"\n{'='*60}")
    print(f"TallyBox 年会互动工具已启动")
    print(f"管理后台: http://localhost:{port}")
    print(f"API 文档: http://localhost:{port}/docs")
    print(f"{'='*60}\n")
    uvicorn.run(app, host="0.0.0.0", port=port)
