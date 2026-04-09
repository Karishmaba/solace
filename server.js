const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// rooms: Map<roomId, { clients: Map<ws, {userId, name}>, history: Message[] }>
const rooms = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { clients: new Map(), history: [] });
  }
  return rooms.get(roomId);
}

function broadcast(room, data, exclude = null) {
  const payload = JSON.stringify(data);
  room.clients.forEach((_, ws) => {
    if (ws !== exclude && ws.readyState === 1) {
      ws.send(payload);
    }
  });
}

wss.on('connection', (ws) => {
  let roomId = null;
  let userId = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'join') {
      roomId = msg.roomId;
      userId = msg.userId;
      const room = getRoom(roomId);
      room.clients.set(ws, { userId, name: msg.name });

      // Send history to the joiner
      ws.send(JSON.stringify({ type: 'history', messages: room.history }));

      // Tell existing members a partner joined
      broadcast(room, { type: 'partner_joined', name: msg.name }, ws);

      // Tell joiner if a partner is already present
      if (room.clients.size > 1) {
        const others = [...room.clients.values()].filter(c => c.userId !== userId);
        ws.send(JSON.stringify({ type: 'partner_online', name: others[0]?.name }));
      }
    }

    if (msg.type === 'message' && roomId) {
      const room = rooms.get(roomId);
      if (!room) return;

      const stored = {
        id: msg.payload.tempId,
        senderId: msg.payload.senderId,
        senderName: msg.payload.senderName,
        text: msg.payload.text,
        time: msg.payload.time,
        triggers: msg.payload.triggers,
      };

      room.history = [...room.history.slice(-99), stored];

      // Echo back to sender (for delivery confirmation)
      ws.send(JSON.stringify({ type: 'message_ack', tempId: stored.id }));

      // Broadcast to others
      broadcast(room, { type: 'message', message: stored }, ws);
    }

    if (msg.type === 'typing' && roomId) {
      const room = rooms.get(roomId);
      if (room) broadcast(room, { type: 'typing' }, ws);
    }
  });

  ws.on('close', () => {
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        room.clients.delete(ws);
        broadcast(room, { type: 'partner_left' });
        if (room.clients.size === 0) rooms.delete(roomId);
      }
    }
  });

  ws.on('error', () => ws.terminate());
});

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', rooms: rooms.size }));

// Serve static Expo web build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Solace server running on http://0.0.0.0:${PORT}`);
});
