import json
from typing import Dict, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

ws_router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.display_connections: Dict[int, List[WebSocket]] = {}
        self.admin_connections: Dict[int, List[WebSocket]] = {}

    async def connect_display(self, websocket: WebSocket, event_id: int):
        await websocket.accept()
        if event_id not in self.display_connections:
            self.display_connections[event_id] = []
        self.display_connections[event_id].append(websocket)

    async def connect_admin(self, websocket: WebSocket, event_id: int):
        await websocket.accept()
        if event_id not in self.admin_connections:
            self.admin_connections[event_id] = []
        self.admin_connections[event_id].append(websocket)

    def disconnect_display(self, websocket: WebSocket, event_id: int):
        if event_id in self.display_connections:
            if websocket in self.display_connections[event_id]:
                self.display_connections[event_id].remove(websocket)

    def disconnect_admin(self, websocket: WebSocket, event_id: int):
        if event_id in self.admin_connections:
            if websocket in self.admin_connections[event_id]:
                self.admin_connections[event_id].remove(websocket)

    async def broadcast_to_display(self, event_id: int, message: dict):
        if event_id in self.display_connections:
            for connection in self.display_connections[event_id]:
                try:
                    await connection.send_json(message)
                except:
                    pass

    async def broadcast_to_admin(self, event_id: int, message: dict):
        if event_id in self.admin_connections:
            for connection in self.admin_connections[event_id]:
                try:
                    await connection.send_json(message)
                except:
                    pass

    async def broadcast_all(self, event_id: int, message: dict):
        await self.broadcast_to_display(event_id, message)
        await self.broadcast_to_admin(event_id, message)


manager = ConnectionManager()


@ws_router.websocket("/ws/display/{event_id}")
async def websocket_display(websocket: WebSocket, event_id: int):
    await manager.connect_display(websocket, event_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except:
                pass
    except WebSocketDisconnect:
        manager.disconnect_display(websocket, event_id)


@ws_router.websocket("/ws/admin/{event_id}")
async def websocket_admin(websocket: WebSocket, event_id: int):
    await manager.connect_admin(websocket, event_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except:
                pass
    except WebSocketDisconnect:
        manager.disconnect_admin(websocket, event_id)
