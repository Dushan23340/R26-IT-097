import { useEffect, useRef, useState } from "react";
import { Send, MessageCircle } from "lucide-react";

/**
 * Shared chat panel for the live-class WebSocket channel - used by both
 * TeacherDashboard and StudentDashboard's live-class views. Messages are
 * session-scoped and live only in memory (same ephemeral model as every
 * other live-class store in this platform) - closing the panel or ending
 * the class loses the history, there's no persistence here.
 */
function ClassChat({ messages, onSend, isSelf }) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    onSend(draft);
    setDraft("");
  }

  return (
    <div className="glass rounded-2xl p-4 flex flex-col h-80">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <MessageCircle className="h-4 w-4" />
        Class Chat
      </h3>
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 mb-3 pr-1">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center mt-8">No messages yet.</p>
        ) : (
          messages.map((msg, i) => {
            const self = isSelf(msg);
            return (
              <div key={i} className={`flex ${self ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-1.5 text-sm ${
                    self ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                  }`}
                >
                  {!self && <p className="text-xs font-medium opacity-70 mb-0.5">{msg.name}</p>}
                  <p className="break-words">{msg.text}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-full bg-secondary/60 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          maxLength={1000}
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="p-2 rounded-full bg-primary text-primary-foreground disabled:opacity-40 hover:scale-105 transition-transform"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

export default ClassChat;
