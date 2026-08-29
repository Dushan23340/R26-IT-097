import { useCallback, useEffect, useRef, useState } from "react";

// No TURN server - relies on host/STUN candidates connecting directly,
// which works on the same LAN (this platform's actual deployment target:
// one teacher's laptop, students on the same classroom Wi-Fi) but isn't
// guaranteed across different networks/NATs without a TURN relay.
const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

function wsUrl(path) {
  const base = import.meta.env.VITE_EMOTION_API_URL || "http://localhost:8000";
  return base.replace(/^http/, "ws") + path;
}

/**
 * Teacher side of the live-class screen-share + chat channel. One
 * RTCPeerConnection per connected student (mesh topology) - fine for a
 * single-classroom scale, not meant to scale to hundreds of students.
 */
export function useTeacherScreenShare({ sessionId, enabled }) {
  const [isSharing, setIsSharing] = useState(false);
  const [connectedStudents, setConnectedStudents] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map());
  const localVideoRef = useRef(null);
  const connectedStudentsRef = useRef([]);

  useEffect(() => {
    connectedStudentsRef.current = connectedStudents;
  }, [connectedStudents]);

  const cleanupPeer = useCallback((pseudonym) => {
    const pc = peersRef.current.get(pseudonym);
    if (pc) {
      pc.close();
      peersRef.current.delete(pseudonym);
    }
  }, []);

  const createPeerForStudent = useCallback(async (pseudonym) => {
    if (!localStreamRef.current || !wsRef.current) return;
    cleanupPeer(pseudonym);
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ice-candidate", target: pseudonym, candidate: event.candidate }));
      }
    };
    peersRef.current.set(pseudonym, pc);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    wsRef.current.send(JSON.stringify({ type: "offer", target: pseudonym, sdp: offer }));
  }, [cleanupPeer]);

  useEffect(() => {
    if (!enabled || !sessionId) return undefined;

    const ws = new WebSocket(wsUrl(`/ws/class-session/teacher?session_id=${encodeURIComponent(sessionId)}`));
    wsRef.current = ws;

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "student-ready") {
        setConnectedStudents((prev) =>
          prev.some((s) => s.pseudonym === msg.pseudonym) ? prev : [...prev, { pseudonym: msg.pseudonym, name: msg.name }]
        );
        if (localStreamRef.current) {
          await createPeerForStudent(msg.pseudonym);
        }
      } else if (msg.type === "answer") {
        const pc = peersRef.current.get(msg.from);
        if (pc) await pc.setRemoteDescription(msg.sdp);
      } else if (msg.type === "ice-candidate") {
        const pc = peersRef.current.get(msg.from);
        if (pc) await pc.addIceCandidate(msg.candidate).catch(() => {});
      } else if (msg.type === "student-left") {
        cleanupPeer(msg.pseudonym);
        setConnectedStudents((prev) => prev.filter((s) => s.pseudonym !== msg.pseudonym));
      } else if (msg.type === "chat") {
        setChatMessages((prev) => [...prev, msg]);
      }
    };

    return () => {
      ws.close();
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      wsRef.current = null;
    };
  }, [enabled, sessionId, createPeerForStudent, cleanupPeer]);

  const startSharing = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      const [videoTrack] = stream.getVideoTracks();
      if (videoTrack) {
        // Fires when the user clicks the browser's own "Stop sharing" bar,
        // not just our in-app button - keeps state honest either way.
        videoTrack.onended = () => stopSharingRef.current();
      }

      setIsSharing(true);
      wsRef.current?.readyState === WebSocket.OPEN &&
        wsRef.current.send(JSON.stringify({ type: "screen-share-started" }));

      connectedStudentsRef.current.forEach((student) => createPeerForStudent(student.pseudonym));
    } catch (err) {
      setError(err?.message || "Could not start screen sharing");
    }
  }, [createPeerForStudent]);

  const stopSharing = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    setIsSharing(false);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "screen-share-stopped" }));
    }
  }, []);

  // startSharing's onended callback needs a stable reference to the
  // latest stopSharing without re-subscribing on every render.
  const stopSharingRef = useRef(stopSharing);
  useEffect(() => {
    stopSharingRef.current = stopSharing;
  }, [stopSharing]);

  const sendChat = useCallback((text, name) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    // The server doesn't echo a chat message back to whoever sent it (to
    // avoid double-delivering it to that same client) - so the sender's
    // own copy has to be added locally, not waited for over the socket.
    setChatMessages((prev) => [...prev, { type: "chat", from: "teacher", name: name || "Teacher", text: trimmed, self: true }]);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat", text: trimmed, name }));
    }
  }, []);

  return {
    isSharing,
    startSharing,
    stopSharing,
    connectedStudents,
    error,
    localVideoRef,
    chatMessages,
    sendChat,
  };
}
