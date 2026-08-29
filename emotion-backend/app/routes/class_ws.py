"""WebSocket signaling channel for live-class screen share + chat.

Two endpoints, one per role, both scoped to the currently live class
session (validated against class_session_store - the same "is this
session_id still the live one" check class_session.join() already does).
This relays SDP offers/answers and ICE candidates between the teacher and
each student's browser so they can establish a direct WebRTC connection
(mesh topology: the teacher opens one RTCPeerConnection per student) -
this server never sees the actual screen/audio media, only the signaling
messages needed to set the connection up.

Scope, deliberately: one-way teacher -> students screen (+ optional
teacher mic/system audio) and text chat. Students do not send their own
audio/video into this channel - that would be a full N-way conferencing
build, not "add screen share", and this platform's students already have
their webcam going to a completely separate place (emotion-service, for
inference only, never for another person to watch).

No TURN server is configured (see README note in this file's PR/commit) -
on the same LAN (the actual deployment target here: one teacher's laptop,
students on the same classroom Wi-Fi) ICE will connect via host/STUN
candidates without one. Across different networks/NATs this would need a
TURN relay to be reliable, which is a real infrastructure dependency this
project doesn't have.
"""

from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.class_ws_manager import class_ws_manager
from app.services.class_session import class_session_store
from app.services.anonymize import anonymize_student_id

router = APIRouter(tags=["class-ws"])


def _live_session_id() -> str | None:
    state = class_session_store.get_state()
    return state.get("session_id") if state.get("is_live") else None


@router.websocket("/ws/class-session/teacher")
async def teacher_socket(websocket: WebSocket, session_id: str):
    if session_id != _live_session_id():
        await websocket.close(code=4001)
        return

    await class_ws_manager.connect_teacher(session_id, websocket)
    try:
        while True:
            message = await websocket.receive_json()
            msg_type = message.get("type")

            if msg_type in ("offer", "ice-candidate"):
                target = message.get("target")
                if target:
                    await class_ws_manager.send_to_student(session_id, target, message)
            elif msg_type in ("screen-share-started", "screen-share-stopped"):
                await class_ws_manager.broadcast(session_id, message, exclude_teacher=True)
            elif msg_type == "chat":
                await class_ws_manager.broadcast(session_id, {
                    "type": "chat",
                    "from": "teacher",
                    "name": message.get("name", "Teacher"),
                    "text": message.get("text", "")[:1000],
                }, exclude_teacher=True)
    except WebSocketDisconnect:
        pass
    finally:
        class_ws_manager.disconnect_teacher(session_id)
        await class_ws_manager.broadcast(session_id, {"type": "teacher-left"})


@router.websocket("/ws/class-session/student")
async def student_socket(websocket: WebSocket, session_id: str, student_id: str, name: str = ""):
    if session_id != _live_session_id():
        await websocket.close(code=4001)
        return

    pseudonym = anonymize_student_id(student_id)
    await class_ws_manager.connect_student(session_id, pseudonym, websocket)
    await class_ws_manager.send_to_teacher(session_id, {
        "type": "student-ready",
        "pseudonym": pseudonym,
        "name": name or pseudonym,
    })

    try:
        while True:
            message = await websocket.receive_json()
            msg_type = message.get("type")

            if msg_type in ("answer", "ice-candidate"):
                message["from"] = pseudonym
                await class_ws_manager.send_to_teacher(session_id, message)
            elif msg_type == "chat":
                await class_ws_manager.broadcast(session_id, {
                    "type": "chat",
                    "from": pseudonym,
                    "name": name or pseudonym,
                    "text": message.get("text", "")[:1000],
                }, exclude_pseudonym=pseudonym)
    except WebSocketDisconnect:
        pass
    finally:
        class_ws_manager.disconnect_student(session_id, pseudonym)
        await class_ws_manager.send_to_teacher(session_id, {"type": "student-left", "pseudonym": pseudonym})
