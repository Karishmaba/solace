/**
 * Solace — Private Couple's Chat
 * Real-time 2-way messaging over WebSocket.
 * Trigger engine + sentiment scorer run on-device (no server-side processing).
 */

import { useState, useRef, useEffect, useCallback } from "react";

// ─── Config ───────────────────────────────────────────────────────────────────

function getWsUrl() {
  if (process.env.EXPO_PUBLIC_WS_URL) return process.env.EXPO_PUBLIC_WS_URL;
  if (typeof window !== "undefined") {
    return `ws://${window.location.hostname}:3000`;
  }
  return "ws://localhost:3000";
}

function getUserId() {
  if (typeof window === "undefined") return "user-" + Math.random().toString(36).slice(2);
  let id = localStorage.getItem("solace_user_id");
  if (!id) {
    id = "user-" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("solace_user_id", id);
  }
  return id;
}

// ─── Trigger Engine ───────────────────────────────────────────────────────────

const TRIGGERS = [
  {
    id: "grocery",
    label: "Grocery list",
    pattern: /buy\s+(?<item>[^,.!?]+)/i,
    action: "grocery_add",
    color: { bg: "#E1F5EE", text: "#085041", dot: "#1D9E75", border: "#9FE1CB" },
    icon: "🛒",
    confirm: (m) => `Added "${m.item}" to grocery list`,
  },
  {
    id: "calendar",
    label: "Calendar event",
    pattern: /dinner\s*(at|@)?\s*(?<time>[\d:apm\s]+)/i,
    action: "calendar_create",
    color: { bg: "#EEEDFE", text: "#26215C", dot: "#7F77DD", border: "#CECBF6" },
    icon: "📅",
    confirm: (m) => `Dinner at ${m.time.trim()} added to calendar`,
  },
  {
    id: "budget",
    label: "Expense logged",
    pattern: /budget\s+\$?(?<amount>[\d.]+)\s*(?<desc>.*)?/i,
    action: "expense_log",
    color: { bg: "#FAEEDA", text: "#412402", dot: "#BA7517", border: "#FAC775" },
    icon: "💰",
    confirm: (m) => `$${m.amount}${m.desc?.trim() ? ` — ${m.desc.trim()}` : ""} logged`,
  },
  {
    id: "note",
    label: "Note saved",
    pattern: /^note[:\s]+(?<text>.+)/i,
    action: "note_save",
    color: { bg: "#FAECE7", text: "#4A1B0C", dot: "#D85A30", border: "#F5C4B3" },
    icon: "📝",
    confirm: (m) => `"${m.text}" saved to notebook`,
  },
];

function detectTriggers(text) {
  const found = [];
  for (const trigger of TRIGGERS) {
    const match = text.match(trigger.pattern);
    if (match?.groups) found.push({ ...trigger, matched: match.groups });
  }
  return found;
}

function scoreSentiment(text) {
  const lower = text.toLowerCase();
  return {
    joy: /love|happy|excited|great|wonderful|yes|perfect|amazing|yay/.test(lower) ? 0.85 : 0.4,
    affection: /love|miss|❤|heart|darling|sweetheart|babe|honey/.test(lower) ? 0.9 : 0.35,
    stress: /busy|late|tired|can't|problem|sorry|work|ugh/.test(lower) ? 0.65 : 0.1,
    conflict: /no|but|wrong|upset|mad|angry|stop/.test(lower) ? 0.4 : 0.05,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TriggerChip({ trigger, visible }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 5,
      padding: "4px 10px", borderRadius: 20,
      background: trigger.color.bg, border: `1px solid ${trigger.color.border}`,
      fontSize: 11, fontWeight: 500, color: trigger.color.text,
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0) scale(1)" : "translateY(-4px) scale(0.95)",
      transition: "all 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)",
      maxWidth: "fit-content", fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: trigger.color.dot, flexShrink: 0 }} />
      {trigger.confirm(trigger.matched)}
    </div>
  );
}

function MessageBubble({ msg, showTime, isMe }) {
  const [chipsVisible, setChipsVisible] = useState(false);

  useEffect(() => {
    if (msg.triggers?.length) {
      const t = setTimeout(() => setChipsVisible(true), 350);
      return () => clearTimeout(t);
    }
  }, [msg.triggers]);

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: isMe ? "flex-end" : "flex-start",
      marginBottom: msg.triggers?.length ? 4 : 2,
    }}>
      {showTime && (
        <div style={{
          fontSize: 10, color: "#a0a0a8", textAlign: "center",
          width: "100%", marginBottom: 8, marginTop: 4,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {msg.time}
        </div>
      )}

      {!isMe && msg.senderName && (
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 2, paddingLeft: 2, fontFamily: "'DM Sans', sans-serif" }}>
          {msg.senderName}
        </div>
      )}

      <div style={{
        maxWidth: "72%", padding: "9px 14px",
        borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        background: isMe
          ? "linear-gradient(135deg, #C84B7A 0%, #A03868 100%)"
          : "rgba(255,255,255,0.07)",
        border: isMe ? "none" : "1px solid rgba(255,255,255,0.1)",
        color: isMe ? "#fff" : "#f0e8ec",
        fontSize: 14, lineHeight: 1.45,
        fontFamily: "'DM Sans', sans-serif", letterSpacing: "-0.1px",
        backdropFilter: "blur(8px)",
        boxShadow: isMe ? "0 2px 12px rgba(180,56,100,0.3)" : "0 2px 8px rgba(0,0,0,0.2)",
      }}>
        {msg.text}
      </div>

      {isMe && (
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2, marginRight: 2 }}>
          {msg.status === "sending" ? "sending…" : msg.status === "sent" ? "✓" : "✓✓"}
        </div>
      )}

      {msg.triggers?.map((trigger, i) => (
        <div key={i} style={{ marginTop: 4 }}>
          <TriggerChip trigger={trigger} visible={chipsVisible} />
        </div>
      ))}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4,
      padding: "10px 14px", borderRadius: "18px 18px 18px 4px",
      background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
      width: 56, backdropFilter: "blur(8px)",
    }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.5)",
          animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

function InputPreviewChip({ trigger }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 5,
      padding: "3px 9px", borderRadius: 20,
      background: trigger.color.bg, border: `1px solid ${trigger.color.border}`,
      fontSize: 11, color: trigger.color.text, fontWeight: 500,
      fontFamily: "'DM Sans', sans-serif", animation: "fade-in 0.2s ease",
    }}>
      <div style={{ width: 5, height: 5, borderRadius: "50%", background: trigger.color.dot }} />
      {trigger.label} detected
    </div>
  );
}

// ─── Setup / Join Screen ──────────────────────────────────────────────────────

function SetupScreen({ onJoin }) {
  const [name, setName] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("solace_name") || "" : ""
  );
  const [room, setRoom] = useState("");
  const [error, setError] = useState("");

  function generateCode() {
    setRoom(Math.random().toString(36).slice(2, 8).toUpperCase());
  }

  function handleJoin() {
    if (!name.trim()) return setError("Enter your name");
    if (!room.trim()) return setError("Enter or generate a room code");
    if (typeof window !== "undefined") localStorage.setItem("solace_name", name.trim());
    onJoin(name.trim(), room.trim().toUpperCase());
  }

  return (
    <div style={{
      width: 390, minHeight: 844, margin: "0 auto",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "#1a0d14", fontFamily: "'DM Sans', sans-serif", position: "relative",
      borderRadius: 44,
      boxShadow: "0 40px 80px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.08)",
    }}>
      {/* Ambient background */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
        background: `
          radial-gradient(ellipse 320px 280px at 15% 20%, rgba(180,56,100,0.22) 0%, transparent 70%),
          radial-gradient(ellipse 260px 200px at 88% 80%, rgba(127,119,221,0.15) 0%, transparent 65%)
        `,
      }} />

      <div style={{ zIndex: 1, width: "100%", padding: "0 36px", boxSizing: "border-box" }}>
        {/* Logo / title */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 38, marginBottom: 8 }}>🌿</div>
          <div style={{
            fontSize: 32, fontWeight: 700, color: "#fff",
            fontFamily: "'DM Serif Display', serif", letterSpacing: "-0.5px",
          }}>Solace</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
            Private space for two
          </div>
        </div>

        {/* Name input */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
            Your name
          </label>
          <input
            value={name}
            onChange={e => { setName(e.target.value); setError(""); }}
            placeholder="e.g. Alex"
            onKeyDown={e => e.key === "Enter" && handleJoin()}
            style={{
              width: "100%", boxSizing: "border-box",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 14, padding: "12px 16px", color: "rgba(255,255,255,0.9)",
              fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: "none",
            }}
          />
        </div>

        {/* Room code input */}
        <div style={{ marginBottom: 28 }}>
          <label style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
            Room code
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={room}
              onChange={e => { setRoom(e.target.value.toUpperCase()); setError(""); }}
              placeholder="e.g. AB12CD"
              onKeyDown={e => e.key === "Enter" && handleJoin()}
              style={{
                flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 14, padding: "12px 16px", color: "rgba(255,255,255,0.9)",
                fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: "none",
                letterSpacing: 3, fontWeight: 600,
              }}
            />
            <button
              onClick={generateCode}
              style={{
                padding: "12px 16px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)",
                fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                whiteSpace: "nowrap",
              }}
            >
              Generate
            </button>
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>
            Share this code with your partner so they can join the same room.
          </div>
        </div>

        {error && (
          <div style={{ fontSize: 12, color: "#F5A3C0", marginBottom: 12, textAlign: "center" }}>{error}</div>
        )}

        <button
          onClick={handleJoin}
          style={{
            width: "100%", padding: "14px", borderRadius: 16, border: "none",
            background: "linear-gradient(135deg, #C84B7A, #A03868)",
            color: "#fff", fontSize: 16, fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
            boxShadow: "0 4px 20px rgba(200,75,122,0.4)",
          }}
        >
          Enter Room
        </button>
      </div>
    </div>
  );
}

// ─── Main Chat Screen ─────────────────────────────────────────────────────────

function ChatScreen({ myName, roomCode, onLeave }) {
  const myId = getUserId();

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerName, setPartnerName] = useState("");
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [previewTriggers, setPreviewTriggers] = useState([]);
  const [showPulse, setShowPulse] = useState(false);
  const [showEncBadge, setShowEncBadge] = useState(false);
  const [connStatus, setConnStatus] = useState("connecting");

  const wsRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const partnerTypingTimerRef = useRef(null);
  const reconnectRef = useRef(null);

  // ── WebSocket connection ──────────────────────────────────────────────────

  const connect = useCallback(() => {
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setConnStatus("connected");
      ws.send(JSON.stringify({ type: "join", roomId: roomCode, userId: myId, name: myName }));
    };

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }

      switch (msg.type) {
        case "history":
          setMessages(msg.messages.map(m => ({
            ...m,
            isMe: m.senderId === myId,
            status: "read",
          })));
          break;

        case "message":
          setMessages(prev => {
            const m = msg.message;
            // Already added optimistically? Skip.
            if (prev.some(x => x.id === m.id)) return prev;
            return [...prev, { ...m, isMe: m.senderId === myId, status: "read" }];
          });
          break;

        case "message_ack":
          setMessages(prev =>
            prev.map(m => m.id === msg.tempId ? { ...m, status: "sent" } : m)
          );
          // Mark read after a beat
          setTimeout(() => {
            setMessages(prev =>
              prev.map(m => m.id === msg.tempId ? { ...m, status: "read" } : m)
            );
          }, 1000);
          break;

        case "typing":
          setIsPartnerTyping(true);
          clearTimeout(partnerTypingTimerRef.current);
          partnerTypingTimerRef.current = setTimeout(() => setIsPartnerTyping(false), 2500);
          break;

        case "partner_joined":
          setPartnerOnline(true);
          setPartnerName(msg.name || "");
          break;

        case "partner_online":
          setPartnerOnline(true);
          setPartnerName(msg.name || "");
          break;

        case "partner_left":
          setPartnerOnline(false);
          break;
      }
    };

    ws.onclose = () => {
      setConnStatus("disconnected");
      setPartnerOnline(false);
      // Reconnect after 3s
      reconnectRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();
  }, [roomCode, myId, myName]);

  useEffect(() => {
    connect();
    setTimeout(() => setShowEncBadge(true), 600);
    setTimeout(() => setShowEncBadge(false), 3200);
    return () => {
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // Auto-scroll
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isPartnerTyping]);

  // ── Input handling ────────────────────────────────────────────────────────

  const handleInputChange = useCallback((e) => {
    const val = e.target.value;
    setInputText(val);
    setPreviewTriggers(val.trim().length > 3 ? detectTriggers(val) : []);

    // Send typing event to partner
    clearTimeout(typingTimerRef.current);
    if (val.length > 0 && wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: "typing", roomId: roomCode }));
    }
  }, [roomCode]);

  const sendMessage = useCallback(() => {
    const text = inputText.trim();
    if (!text || wsRef.current?.readyState !== 1) return;

    const triggers = detectTriggers(text);
    const sentiment = scoreSentiment(text);
    const tempId = `${myId}-${Date.now()}`;
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Optimistic local add
    setMessages(prev => [...prev, {
      id: tempId, senderId: myId, senderName: myName,
      text, time, triggers: triggers.length ? triggers : undefined,
      sentiment, status: "sending", isMe: true,
    }]);
    setInputText("");
    setPreviewTriggers([]);

    wsRef.current.send(JSON.stringify({
      type: "message",
      payload: { tempId, senderId: myId, senderName: myName, text, time, triggers: triggers.length ? triggers : undefined },
    }));
  }, [inputText, myId, myName]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const shouldShowTime = (idx) => idx === 0 || idx % 5 === 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      width: 390, height: 844, margin: "0 auto",
      display: "flex", flexDirection: "column",
      background: "#1a0d14", fontFamily: "'DM Sans', sans-serif",
      overflow: "hidden", position: "relative", borderRadius: 44,
      boxShadow: "0 40px 80px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.08)",
    }}>
      {/* Ambient background */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
        background: `
          radial-gradient(ellipse 320px 280px at 15% 8%, rgba(180,56,100,0.22) 0%, transparent 70%),
          radial-gradient(ellipse 260px 200px at 88% 92%, rgba(127,119,221,0.15) 0%, transparent 65%),
          radial-gradient(ellipse 200px 160px at 70% 35%, rgba(180,56,100,0.08) 0%, transparent 60%)
        `,
      }} />

      {/* Status bar */}
      <div style={{
        height: 44, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px", zIndex: 10, flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
          {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          {[3, 5, 7, 9].map((h, i) => (
            <div key={i} style={{
              width: 3, height: h, borderRadius: 1.5,
              background: i < 3 ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)",
            }} />
          ))}
          <div style={{
            width: 14, height: 7, borderRadius: 2, border: "1.5px solid rgba(255,255,255,0.6)",
            marginLeft: 2, position: "relative",
          }}>
            <div style={{ position: "absolute", inset: "1px 2px 1px 2px", borderRadius: 1, background: "#1D9E75" }} />
          </div>
        </div>
      </div>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", padding: "6px 16px 12px",
        zIndex: 10, flexShrink: 0, gap: 12,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <button
          onClick={onLeave}
          style={{
            width: 34, height: 34, borderRadius: 11, background: "transparent", border: "none",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Avatar */}
        <div style={{ position: "relative" }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "linear-gradient(135deg, #C84B7A, #7F77DD)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 600, color: "#fff",
            animation: partnerOnline ? "pulse-ring 2.5s ease-in-out infinite" : "none",
          }}>
            {partnerName ? partnerName[0].toUpperCase() : "?"}
          </div>
          <div style={{
            position: "absolute", bottom: 1, right: 1,
            width: 10, height: 10, borderRadius: "50%",
            background: partnerOnline ? "#1D9E75" : "#555",
            border: "2px solid #1a0d14",
          }} />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.95)",
            fontFamily: "'DM Serif Display', serif", letterSpacing: "-0.2px",
          }}>
            {partnerName || "Waiting…"}
          </div>
          <div style={{ fontSize: 11, fontWeight: 500, color: partnerOnline ? "#1D9E75" : "rgba(255,255,255,0.3)" }}>
            {connStatus === "connecting" ? "connecting…" : partnerOnline ? "Active now" : "Offline"}
          </div>
        </div>

        {/* Room code badge */}
        <div style={{
          fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, fontWeight: 600,
        }}>
          {roomCode}
        </div>

        {/* Pulse button */}
        <button
          onClick={() => setShowPulse(p => !p)}
          style={{
            width: 34, height: 34, borderRadius: 11, background: "transparent", border: "none",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}
          title="Relationship Pulse"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M3 12h4l3-8 4 16 3-8h4" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* E2E toast */}
      {showEncBadge && (
        <div style={{
          position: "absolute", top: 112, left: "50%", transform: "translateX(-50%)",
          background: "rgba(29,158,117,0.15)", border: "1px solid rgba(29,158,117,0.3)",
          borderRadius: 20, padding: "5px 14px",
          fontSize: 11, color: "#5DCAA5", fontWeight: 500,
          display: "flex", alignItems: "center", gap: 5, zIndex: 20,
          animation: "slide-down 0.25s ease", backdropFilter: "blur(12px)",
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#1D9E75" }} />
          End-to-end encrypted
        </div>
      )}

      {/* Pulse panel */}
      {showPulse && (() => {
        const recent = messages.slice(-20);
        const allText = recent.map(m => m.text).join(" ");
        const s = scoreSentiment(allText);
        return (
          <div style={{
            position: "absolute", top: 108, right: 12,
            background: "rgba(26,13,20,0.95)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16, padding: "14px 16px", width: 200, zIndex: 20,
            backdropFilter: "blur(20px)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            animation: "slide-down 0.2s ease",
          }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>
              Conversation pulse
            </div>
            {[
              { label: "Affection", pct: Math.round(s.affection * 100), color: "#C84B7A" },
              { label: "Joy", pct: Math.round(s.joy * 100), color: "#1D9E75" },
              { label: "Stress", pct: Math.round(s.stress * 100), color: "#BA7517" },
              { label: "Conflict", pct: Math.round(s.conflict * 100), color: "#7F77DD" },
            ].map(row => (
              <div key={row.label} style={{ marginBottom: 7 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                  <span style={{ color: "rgba(255,255,255,0.6)" }}>{row.label}</span>
                  <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>{row.pct}%</span>
                </div>
                <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.08)" }}>
                  <div style={{ height: "100%", width: `${row.pct}%`, borderRadius: 2, background: row.color }} />
                </div>
              </div>
            ))}
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 8 }}>
              Processed locally · not stored as text
            </div>
          </div>
        );
      })()}

      {/* Message list */}
      <div
        ref={listRef}
        className="msg-list"
        style={{
          flex: 1, overflowY: "auto", padding: "12px 16px 8px",
          zIndex: 10, display: "flex", flexDirection: "column", gap: 2,
        }}
      >
        <div style={{
          textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.25)",
          margin: "4px 0 12px", fontStyle: "italic",
        }}>
          Messages are end-to-end encrypted · Room {roomCode}
        </div>

        {messages.length === 0 && (
          <div style={{
            textAlign: "center", marginTop: 60,
            fontSize: 13, color: "rgba(255,255,255,0.2)",
            fontFamily: "'DM Sans', sans-serif",
          }}>
            {partnerOnline
              ? `${partnerName} is here. Say hi 👋`
              : "Share the room code to invite your partner."}
          </div>
        )}

        {messages.map((msg, idx) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isMe={msg.isMe}
            showTime={shouldShowTime(idx)}
          />
        ))}

        {isPartnerTyping && (
          <div style={{ animation: "fade-in 0.2s ease" }}>
            <TypingIndicator />
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={{
        padding: "8px 12px 28px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(26,13,20,0.8)", backdropFilter: "blur(20px)",
        zIndex: 10, flexShrink: 0,
      }}>
        {previewTriggers.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8, paddingLeft: 4 }}>
            {previewTriggers.map((t, i) => <InputPreviewChip key={i} trigger={t} />)}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          {/* Attachment placeholder */}
          <button className="action-btn" style={{
            width: 38, height: 38, borderRadius: 12,
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Text input */}
          <div style={{
            flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 20, padding: "9px 14px", display: "flex", alignItems: "center",
          }}>
            <textarea
              ref={inputRef}
              className="chat-input"
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={connStatus === "connected" ? "Say something…" : "Connecting…"}
              disabled={connStatus !== "connected"}
              rows={1}
              style={{
                flex: 1, background: "transparent", border: "none",
                color: "rgba(255,255,255,0.9)", fontSize: 14, lineHeight: 1.4,
                resize: "none", fontFamily: "'DM Sans', sans-serif",
                maxHeight: 80, overflowY: "auto",
              }}
            />
          </div>

          {/* Send button */}
          <button
            className="send-btn"
            onClick={sendMessage}
            disabled={connStatus !== "connected"}
            style={{
              width: 38, height: 38, borderRadius: "50%",
              background: inputText.trim()
                ? "linear-gradient(135deg, #C84B7A, #A03868)"
                : "rgba(255,255,255,0.07)",
              border: inputText.trim() ? "none" : "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0,
              transition: "all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)",
              boxShadow: inputText.trim() ? "0 2px 12px rgba(200,75,122,0.4)" : "none",
            }}
          >
            {inputText.trim() ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M12 2a3 3 0 013 3v7a3 3 0 01-6 0V5a3 3 0 013-3z" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8"/>
                <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v3M8 22h8" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display:ital@0;1&display=swap');
        @keyframes typing-dot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
        @keyframes fade-in { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slide-down { from { opacity: 0; transform: translateX(-50%) translateY(-8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes pulse-ring {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(200,75,122,0.4); }
          70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(200,75,122,0); }
          100% { transform: scale(0.95); }
        }
        .chat-input:focus { outline: none; }
        .chat-input::placeholder { color: rgba(255,255,255,0.3); }
        .send-btn:active { transform: scale(0.93); }
        .msg-list::-webkit-scrollbar { width: 0; }
        .action-btn:hover { background: rgba(255,255,255,0.08); }
      `}</style>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function SolaceChatScreen() {
  const [phase, setPhase] = useState("setup");
  const [myName, setMyName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  function handleJoin(name, room) {
    setMyName(name);
    setRoomCode(room);
    setPhase("chat");
  }

  if (phase === "setup") {
    return <SetupScreen onJoin={handleJoin} />;
  }

  return (
    <ChatScreen
      myName={myName}
      roomCode={roomCode}
      onLeave={() => setPhase("setup")}
    />
  );
}
