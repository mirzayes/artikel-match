/**
 * Alman artikl duelləri — WebSocket server (Node + ws).
 * Statik: public/ (deutsch_quiz.html, vokabeln_FINAL.csv)
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3333;
const ROUND_MS = 60_000;
const WORDS_PER_DUEL = 12;
const PUBLIC_DIR = path.join(__dirname, 'public');

const ARTICLES = ['der', 'die', 'das'];

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (c === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

function parseAlmancaArticle(almancaRaw) {
  const almanca = almancaRaw.replace(/\s+/g, ' ').trim();
  const lower = almanca.toLowerCase();
  for (const a of ARTICLES) {
    const prefix = `${a} `;
    if (lower.startsWith(prefix)) {
      const word = almanca.slice(prefix.length).trim();
      if (!word) return null;
      return { article: a, word };
    }
  }
  return null;
}

function loadVokabeln() {
  const csvPath = path.join(PUBLIC_DIR, 'vokabeln_FINAL.csv');
  const text = fs.readFileSync(csvPath, 'utf8');
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    if (cells.length < 2) continue;
    const [deCell, azCell] = cells;
    if (!deCell || azCell === undefined) continue;
    if (/^almanca$/i.test(deCell.trim())) continue;
    const parsed = parseAlmancaArticle(deCell);
    if (!parsed) continue;
    rows.push({
      article: parsed.article,
      word: parsed.word,
      az: azCell.trim(),
    });
  }
  if (!rows.length) throw new Error('vokabeln_FINAL.csv boş və ya oxunmur');
  return rows;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** username → { xp, streak, wins, losses, correct, total } */
const stats = new Map();

function getOrCreate(username) {
  if (!stats.has(username)) {
    stats.set(username, { xp: 0, streak: 0, wins: 0, losses: 0, correct: 0, total: 0 });
  }
  return stats.get(username);
}

function leaderboardList() {
  return [...stats.entries()].map(([username, s]) => ({
    username,
    xp: s.xp,
    streak: s.streak,
    accuracy: s.total === 0 ? 0 : Math.round((s.correct / s.total) * 100),
  }));
}

function sortedLeaderboard() {
  return leaderboardList().sort(
    (a, b) => b.streak - a.streak || b.xp - a.xp || b.accuracy - a.accuracy || a.username.localeCompare(b.username),
  );
}

function rankOf(username) {
  const arr = sortedLeaderboard();
  const i = arr.findIndex((x) => x.username === username);
  return i >= 0 ? i + 1 : null;
}

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function sendLeaderboard(ws, username) {
  const top20 = sortedLeaderboard().slice(0, 20);
  send(ws, {
    type: 'leaderboard',
    top20,
    myRank: username ? rankOf(username) : null,
  });
}

const allWords = loadVokabeln();
const queue = [];
/** @type {Map<object, { username: string, duelId: number | null }>} */
const clientMeta = new Map();
let duelSeq = 1;
/** @type {Map<number, object>} */
const duels = new Map();

function removeFromQueue(ws) {
  const i = queue.indexOf(ws);
  if (i >= 0) queue.splice(i, 1);
}

function tryMatch() {
  while (queue.length >= 2) {
    const a = queue.shift();
    const b = queue.shift();
    if (!clientMeta.has(a) || !clientMeta.has(b)) continue;
    createDuel(a, b);
  }
}

function createDuel(ws1, ws2) {
  const m1 = clientMeta.get(ws1);
  const m2 = clientMeta.get(ws2);
  const id = duelSeq++;
  const words = shuffle(allWords).slice(0, WORDS_PER_DUEL);
  const room = {
    id,
    p1: ws1,
    p2: ws2,
    words,
    idx: 0,
    score1: 0,
    score2: 0,
    /** @type {Map<string, { art: string | null, timeMs: number }>} */
    roundAnswers: new Map(),
    timer: null,
    flushing: false,
  };
  duels.set(id, room);
  m1.duelId = id;
  m2.duelId = id;

  send(ws1, {
    type: 'matched',
    opponent: m2.username,
    wordCount: words.length,
  });
  send(ws2, {
    type: 'matched',
    opponent: m1.username,
    wordCount: words.length,
  });
  sendLeaderboard(ws1, m1.username);
  sendLeaderboard(ws2, m2.username);
  startRound(room);
}

function startRound(room) {
  if (!duels.has(room.id)) return;
  clearTimeout(room.timer);
  room.timer = null;
  if (room.idx >= room.words.length) {
    endDuel(room);
    return;
  }
  room.roundAnswers = new Map();
  const w = room.words[room.idx];
  const endsAt = Date.now() + ROUND_MS;
  const payload = {
    type: 'word',
    idx: room.idx,
    word: w.word,
    az: w.az,
    endsAt,
  };
  send(room.p1, payload);
  send(room.p2, payload);
  room.timer = setTimeout(() => flushRound(room, true), ROUND_MS);
}

function flushRound(room, timedOut) {
  if (room.flushing) return;
  if (!duels.has(room.id)) return;
  room.flushing = true;
  clearTimeout(room.timer);
  room.timer = null;

  try {
    const w = room.words[room.idx];
    const correct = w.article;
    let a1 = room.roundAnswers.get('p1');
    let a2 = room.roundAnswers.get('p2');
    if (timedOut) {
      if (!a1) a1 = { art: null, timeMs: ROUND_MS };
      if (!a2) a2 = { art: null, timeMs: ROUND_MS };
    } else if (!a1 || !a2) {
      return;
    }

    const m1 = clientMeta.get(room.p1);
    const m2 = clientMeta.get(room.p2);
    const u1 = m1?.username ?? '?';
    const u2 = m2?.username ?? '?';

    const c1 = a1.art === correct;
    const c2 = a2.art === correct;

    const s1 = getOrCreate(u1);
    const s2 = getOrCreate(u2);
    s1.total++;
    s2.total++;
    if (c1) {
      s1.correct++;
      s1.xp += 10;
      room.score1 += 10;
    }
    if (c2) {
      s2.correct++;
      s2.xp += 10;
      room.score2 += 10;
    }

    const idxDone = room.idx;
    room.idx++;

    send(room.p1, {
      type: 'score_update',
      yourScore: room.score1,
      opponentScore: room.score2,
      lastRound: {
        idx: idxDone,
        correctArt: correct,
        az: w.az,
        youCorrect: c1,
        opponentCorrect: c2,
      },
    });
    send(room.p2, {
      type: 'score_update',
      yourScore: room.score2,
      opponentScore: room.score1,
      lastRound: {
        idx: idxDone,
        correctArt: correct,
        az: w.az,
        youCorrect: c2,
        opponentCorrect: c1,
      },
    });

    sendLeaderboard(room.p1, u1);
    sendLeaderboard(room.p2, u2);

    if (room.idx >= room.words.length) {
      endDuel(room);
    } else {
      startRound(room);
    }
  } finally {
    room.flushing = false;
  }
}

function endDuel(room) {
  clearTimeout(room.timer);
  duels.delete(room.id);

  const m1 = clientMeta.get(room.p1);
  const m2 = clientMeta.get(room.p2);
  if (m1) m1.duelId = null;
  if (m2) m2.duelId = null;

  const u1 = m1?.username ?? '?';
  const u2 = m2?.username ?? '?';
  const s1 = getOrCreate(u1);
  const s2 = getOrCreate(u2);

  let r1 = 'draw';
  let r2 = 'draw';
  if (room.score1 > room.score2) {
    r1 = 'win';
    r2 = 'loss';
    s1.wins++;
    s1.streak++;
    s2.losses++;
    s2.streak = 0;
  } else if (room.score2 > room.score1) {
    r1 = 'loss';
    r2 = 'win';
    s2.wins++;
    s2.streak++;
    s1.losses++;
    s1.streak = 0;
  }

  send(room.p1, {
    type: 'duel_end',
    result: r1,
    youScore: room.score1,
    opponentScore: room.score2,
  });
  send(room.p2, {
    type: 'duel_end',
    result: r2,
    youScore: room.score2,
    opponentScore: room.score1,
  });

  sendLeaderboard(room.p1, u1);
  sendLeaderboard(room.p2, u2);
}

function forfeitDuel(ws) {
  const meta = clientMeta.get(ws);
  if (!meta?.duelId) return;
  const room = duels.get(meta.duelId);
  if (!room) return;

  const isP1 = ws === room.p1;
  const winner = isP1 ? room.p2 : room.p1;
  const loser = ws;

  clearTimeout(room.timer);
  duels.delete(room.id);

  const mw = clientMeta.get(winner);
  const ml = clientMeta.get(loser);
  if (mw) mw.duelId = null;
  if (ml) ml.duelId = null;

  const uw = mw?.username ?? '?';
  const ul = ml?.username ?? '?';
  const sw = getOrCreate(uw);
  const sl = getOrCreate(ul);
  sw.wins++;
  sw.streak++;
  sl.losses++;
  sl.streak = 0;

  send(winner, {
    type: 'duel_end',
    result: 'win',
    youScore: isP1 ? room.score2 : room.score1,
    opponentScore: isP1 ? room.score1 : room.score2,
    reason: 'forfeit',
  });
  send(loser, {
    type: 'duel_end',
    result: 'loss',
    youScore: isP1 ? room.score1 : room.score2,
    opponentScore: isP1 ? room.score2 : room.score1,
    reason: 'forfeit',
  });

  sendLeaderboard(winner, uw);
  sendLeaderboard(loser, ul);
}

function handleMessage(ws, raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  const meta = clientMeta.get(ws);
  if (!meta) return;

  if (msg.type === 'get_leaderboard') {
    const u = String(msg.username ?? '')
      .trim()
      .slice(0, 24);
    sendLeaderboard(ws, u || meta.username || '');
    return;
  }

  if (msg.type === 'join_queue') {
    const name = String(msg.username ?? '')
      .trim()
      .slice(0, 24);
    if (!name) {
      send(ws, { type: 'error', message: 'İstifadəçi adı boş ola bilməz' });
      return;
    }
    forfeitDuel(ws);
    removeFromQueue(ws);
    meta.username = name;
    getOrCreate(name);
    if (!queue.includes(ws)) queue.push(ws);
    send(ws, { type: 'queue', position: queue.length });
    tryMatch();
    sendLeaderboard(ws, name);
    return;
  }

  if (msg.type === 'leave') {
    removeFromQueue(ws);
    forfeitDuel(ws);
    send(ws, { type: 'left' });
    return;
  }

  if (msg.type === 'answer') {
    const duelId = meta.duelId;
    if (duelId == null) return;
    const room = duels.get(duelId);
    if (!room || room.flushing) return;
    if (msg.wordIdx !== room.idx) return;
    const art = msg.art;
    if (!ARTICLES.includes(art)) return;

    const key = ws === room.p1 ? 'p1' : 'p2';
    if (room.roundAnswers.has(key)) return;

    const timeMs = typeof msg.timeMs === 'number' ? msg.timeMs : 0;
    room.roundAnswers.set(key, { art, timeMs });

    const other = ws === room.p1 ? room.p2 : room.p1;
    send(other, { type: 'opponent_answered', wordIdx: room.idx });

    if (room.roundAnswers.size >= 2) {
      flushRound(room, false);
    }
  }
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/deutsch_quiz.html';
  const safe = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(PUBLIC_DIR, safe);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
    res.writeHead(200);
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  clientMeta.set(ws, { username: '', duelId: null });
  sendLeaderboard(ws, '');

  ws.on('message', (data) => {
    handleMessage(ws, data.toString());
  });

  ws.on('close', () => {
    removeFromQueue(ws);
    forfeitDuel(ws);
    clientMeta.delete(ws);
  });
});

server.listen(PORT, () => {
  console.log(`Artikl duel server: http://localhost:${PORT}/deutsch_quiz.html`);
});
