const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PUBLIC = path.join(__dirname, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

const server = http.createServer((req, res) => {
  let f = decodeURIComponent(req.url.split('?')[0]);
  if (f === '/') f = '/index.html';
  const full = path.join(PUBLIC, path.normalize(f));
  if (!full.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(full)] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
const rooms = new Map();
const DIFFS = ['easy', 'medium', 'hard'];

const send = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
const other = ws => ws.room && ws.room.players.find(p => p !== ws);

function newCode() {
  let c;
  do {
    c = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random() * 24 | 0]).join('');
  } while (rooms.has(c));
  return c;
}

function startRoom(room) {
  room.winner = null;
  room.rematch.clear();
  const seed = Math.random() * 2 ** 31 | 0;
  const players = room.players.map(p => ({ id: p.id, name: p.name }));
  room.players.forEach(p => send(p, { t: 'start', seed, diff: room.diff, players }));
}

wss.on('connection', ws => {
  ws.id = Math.random().toString(36).slice(2, 8);
  ws.room = null;
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });

  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }

    if (m.t === 'create') {
      const code = newCode();
      ws.name = String(m.name || 'Player').slice(0, 16);
      const room = {
        code, players: [ws], winner: null, rematch: new Set(),
        diff: DIFFS.includes(m.diff) ? m.diff : 'easy'
      };
      ws.room = room;
      rooms.set(code, room);
      return send(ws, { t: 'created', code, id: ws.id });
    }

    if (m.t === 'join') {
      const room = rooms.get(String(m.code || '').toUpperCase());
      if (!room) return send(ws, { t: 'err', msg: 'Room not found' });
      if (room.players.length >= 2) return send(ws, { t: 'err', msg: 'Room is full' });
      ws.name = String(m.name || 'Player').slice(0, 16);
      ws.room = room;
      room.players.push(ws);
      send(ws, { t: 'joined', id: ws.id });
      return startRoom(room);
    }

    if (!ws.room) return;
    const opp = other(ws);

    if (m.t === 'p') {
      if (opp) send(opp, { t: 'p', id: ws.id, pos: +m.pos || 0, v: +m.v || 0, wpm: +m.wpm || 0 });
    } else if (m.t === 'fin') {
      if (!ws.room.winner) {
        ws.room.winner = ws.id;
        ws.room.players.forEach(p => send(p, { t: 'end', winner: ws.id }));
      }
    } else if (m.t === 'rematch') {
      ws.room.rematch.add(ws.id);
      if (ws.room.players.length === 2 && ws.room.rematch.size === 2) startRoom(ws.room);
    }
  });

  ws.on('close', () => {
    const room = ws.room;
    if (!room) return;
    room.players = room.players.filter(p => p !== ws);
    if (room.players.length === 0) rooms.delete(room.code);
    else room.players.forEach(p => send(p, { t: 'left' }));
  });
});

// drop dead connections so rooms don't linger
setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.alive) return ws.terminate();
    ws.alive = false;
    ws.ping();
  });
}, 30000);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log('Turbo Type running on http://localhost:' + PORT));
