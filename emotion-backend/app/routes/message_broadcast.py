from fastapi import APIRouter
from typing import Dict

from app.services.message_broadcast import message_broadcast_store

router = APIRouter(prefix="/message-broadcast", tags=["message-broadcast"])


@router.get("/state")
async def get_message_broadcast_state() -> Dict:
    """Students poll this to detect a new teacher broadcast message."""
    return message_broadcast_store.get_state()


@router.post("/send")
async def send_message_broadcast(body: Dict) -> Dict:
    """Body: {"message": "...", "sent_by": "..."}."""
    message = (body.get("message") or "").strip()
    if not message:
        return {"success": False, "error": "message is required"}
    message_broadcast_store.send(message=message, sent_by=body.get("sent_by"))
    return {"success": True, **message_broadcast_store.get_state()}


@router.post("/clear")
async def clear_message_broadcast() -> Dict:
    message_broadcast_store.clear()
    return {"success": True, "is_active": False}
