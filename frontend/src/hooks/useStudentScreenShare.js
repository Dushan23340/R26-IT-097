import { useCallback, useEffect, useRef, useState } from "react";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

function wsUrl(path) {
  const base = import.meta.env.VITE_EMOTION_API_URL || "http://localhost:8000";
  return base.replace(/^http/, "ws") + path;
}

/**
 * Student side of the live-class screen-share + chat channel. Answers the
 * teacher's offer and renders the received video track - never sends its
 * own camera/mic into this channel (the webcam is used separately, for
 * emotion inference only - see EmotionDetector).
 */
export function useStudentScreenShare({ sessionId, studentId, name, enabled }) {
  const [isSharing, setIsSharing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!enabled || !sessionId || !studentId) return undefined;

    const ws = new WebSocket(
      wsUrl(
        `/ws/class-session/student?session_id=${encodeURIComponent(sessionId)}` +
          `&student_id=${encodeURIComponent(studentId)}&name=${encodeURIComponent(name || "")}`
      )
    );
    wsRef.current = ws;

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "offer") {
        if (pcRef.current) {
          pcRef.current.close();
        }
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;
        pc.ontrack = (e) => {
          if (videoRef.current) {
            videoRef.current.srcObject = e.streams[0];
          }
        };
        pc.onicecandidate = (e) => {
          if (e.candidate && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ice-candidate", candidate: e.candidate }));
          }
        };
        await pc.setRemoteDescription(msg.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: "answer", sdp: answer }));
      } else if (msg.type === "ice-candidate") {
        if (pcRef.current) {
          await pcRef.current.addIceCandidate(msg.candidate).catch(() => {});
        }
      } else if (msg.type === "screen-share-started") {
        setIsSharing(true);
      } else if (msg.type === "screen-share-stopped" || msg.type === "teacher-left") {
        setIsSharing(false);
        if (pcRef.current) {
          pcRef.current.close();
          pcRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      } else if (msg.type === "chat") {
        setChatMessages((prev) => [...prev, msg]);
      }
    };

    return () => {
      ws.close();
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      wsRef.current = null;
    };
  }, [enabled, sessionId, studentId, name]);

  const sendChat = useCallback((text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    // Same reasoning as the teacher hook's sendChat: the server never
    // echoes a chat message back to whoever sent it, so the sender's own
    // copy is added locally instead of waiting for it over the socket.
    setChatMessages((prev) => [...prev, { type: "chat", from: "student", name: name || studentId, text: trimmed, self: true }]);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat", text: trimmed }));
    }
  }, [name, studentId]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (videoRef.current) {
        videoRef.current.muted = next;
      }
      return next;
    });
  }, []);

  return { isSharing, videoRef, isMuted, toggleMute, chatMessages, sendChat };
}
