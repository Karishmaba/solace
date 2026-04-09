# Solace 🌿

A private, real-time chat app built for two. End-to-end encrypted messaging with a smart trigger engine that quietly turns conversations into actions — grocery lists, calendar events, expense logs, and saved notes.

![React Native](https://img.shields.io/badge/React_Native-Expo-0052CC?logo=expo)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js)
![WebSocket](https://img.shields.io/badge/Protocol-WebSocket-brightgreen)
![License](https://img.shields.io/badge/License-Private-lightgrey)

---

## Features

- **Real-time 2-way messaging** — WebSocket-based, instant delivery with sent/read receipts
- **Smart trigger engine** — detects intent in messages and surfaces actionable chips:
  - `buy oat milk` → adds to grocery list
  - `dinner at 7:30` → creates a calendar event
  - `budget $60 restaurant` → logs an expense
  - `note: call dentist` → saves to notebook
- **Relationship Pulse** — on-device sentiment analysis (joy, affection, stress, conflict) scored from recent messages, never sent to any server
- **Room-based private rooms** — share a 6-character code with your partner to join the same room
- **Partner presence** — live online/offline indicator and typing indicator
- **Message history** — last 100 messages are held in memory per room

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile / Web | React Native (Expo SDK 55) |
| State | React `useState` (Zustand ready) |
| Real-time | WebSocket (`ws`) |
| Server | Node.js + Express |
| Encryption | Matrix SDK + `@matrix-org/olm` (wiring in progress) |
| Deployment | AWS EC2 + Nginx / Fly.io |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Install dependencies

```bash
npm install
```

### Run locally (two terminals)

**Terminal 1 — WebSocket server:**
```bash
npm run server
# Server running on http://0.0.0.0:3000
```

**Terminal 2 — Expo web app:**
```bash
npm run web
# App running on http://localhost:8081
```

Open `http://localhost:8081` in two browser tabs (or two different browsers), enter a name and the same room code in both — messages flow in real time.

### Try the trigger engine

Type any of these in the chat input:
```
buy avocados
dinner at 8pm
budget $45 groceries
note: call dentist
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | WebSocket server port |
| `NODE_ENV` | — | Set to `production` to serve static build |
| `EXPO_PUBLIC_WS_URL` | `ws://<hostname>:3000` | Override WebSocket URL (e.g. for ngrok or custom domain) |

---

## Deployment

### Build the web app

```bash
npm run build
# Output → dist/
```

In production, `server.js` serves the `dist/` folder automatically when `NODE_ENV=production`.

---

### AWS EC2

**1. Launch an EC2 instance**
- AMI: **Ubuntu 24.04 LTS** or **Amazon Linux 2023**
- Instance type: `t3.micro`
- Security group: allow inbound on ports 22 (SSH), 80 (HTTP), 443 (HTTPS)

**2. Install Node.js**

Ubuntu:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
```

Amazon Linux 2023:
```bash
sudo dnf install -y nodejs npm git
```

**3. Deploy the app**

```bash
git clone https://github.com/your-username/solace.git
cd solace
npm install
npm run build
```

**4. Start with PM2**

```bash
sudo npm install -g pm2
NODE_ENV=production PORT=3000 pm2 start server.js --name solace
pm2 save && pm2 startup
```

**5. Nginx reverse proxy**

```bash
sudo apt-get install -y nginx     # Ubuntu
# sudo dnf install -y nginx       # Amazon Linux
```

Create `/etc/nginx/sites-available/solace`:

```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/solace /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
```

**6. HTTPS (optional but recommended)**

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

**Redeploy after changes:**
```bash
git pull && npm install && npm run build && pm2 restart solace
```

---

### Fly.io (alternative)

```bash
fly launch   # first time
fly deploy   # subsequent deploys
```

App is pre-configured as `solace-matrix` in `yyz` region via `fly.toml`.

---

### Sharing with your partner

| Scenario | Steps |
|---|---|
| Same WiFi | Partner opens `http://<your-local-ip>:8081` — no setup needed |
| Different network (ngrok) | `ngrok http 3000` → set `EXPO_PUBLIC_WS_URL=wss://xxxx.ngrok.io` |
| AWS / custom domain | Both open `https://yourdomain.com` |

---

## Project Structure

```
solace/
├── App.tsx                  # Root component — mounts SolaceChatScreen
├── index.ts                 # Expo entry point
├── server.js                # WebSocket + HTTP server
├── SolaceChatScreen.jsx     # Full chat UI (join screen + chat screen)
│   ├── SetupScreen          # Name + room code entry
│   ├── ChatScreen           # Real-time chat with WebSocket
│   ├── detectTriggers()     # Regex-based intent parser
│   └── scoreSentiment()     # On-device sentiment scorer
├── app.json                 # Expo config
└── fly.toml                 # Fly.io deployment config
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run server` | Start the WebSocket server (port 3000) |
| `npm run web` | Start the Expo web dev server (port 8081) |
| `npm run build` | Export the Expo web app to `dist/` |
| `npm run ios` | Run on iOS simulator |
| `npm run android` | Run on Android emulator |
