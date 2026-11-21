/* ============================================================
 * LÔ TÔ TẾT - SERVER
 * - Vé dò: 9 ô ngang x 9 ô dọc. 90 số (1..90) chia random cho 200 vé.
 * - Mỗi cột là một chục: 1-10, 11-20, ... 81-90, xếp tăng dần từ trên xuống.
 * - Người chơi: ĐỔI VÉ (chọn bộ khác) -> CHỐT VÉ.
 * - Màn hình chính chỉ hiện danh sách người ĐÃ CHỐT.
 * - KINH khi một hàng ngang đủ số. Hàng còn 1 số -> báo đợi số đó.
 * - Lưu mọi lượt xổ + lịch sử ván.
 * ============================================================ */

const express = require('express');
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const STATE_FILE = path.join(DATA_DIR, 'game-state.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/* ---------------- Tiện ích ---------------- */
function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}
function writeJSON(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); }
  catch (e) { console.error('[Lỗi ghi file]', e.message); }
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}
function makeId() {
  return Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

/* ---------------- Tạo lưới vé 9x9 ----------------
 * - Mỗi HÀNG có 9 ô: ĐỤC 4 ô (trống) -> còn ĐÚNG 5 ô có số.
 * - Mỗi CỘT là một chục: cột 1 = 1..9, cột 2 = 10..19, ... cột 9 = 80..90.
 * - Số trong mỗi cột xếp TĂNG DẦN từ trên xuống (số nhỏ nhất ở hàng trên cùng).
 * - Vị trí các ô bị đục được xáo trộn mỗi vé nên vé nào cũng khác nhau.
 */
const ROWS = 9;
const COLS = 9;
const PER_ROW = 5;   // 5 số / hàng (đục 4 ô)
function buildGrid(drawn) {
  const used = new Set(drawn || []);
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const offsets = shuffle([...Array(COLS).keys()]);   // xáo trộn vị trí các cột

  for (let c = 0; c < COLS; c++) {
    const lo = c === 0 ? 1 : c * 10;
    const hi = c === COLS - 1 ? 90 : c * 10 + 9;

    // Chọn 5 số ngẫu nhiên trong chục của cột, rồi xếp tăng dần
    const pool = [];
    for (let n = lo; n <= hi; n++) pool.push(n);
    shuffle(pool);
    const nums = pool.slice(0, PER_ROW).sort((a, b) => a - b);

    // 5 hàng nhận số của cột này (mỗi hàng cũng nhận đúng 5 số tổng cộng)
    const rowSlots = [];
    for (let j = 0; j < PER_ROW; j++) rowSlots.push((offsets[c] + j) % ROWS);
    rowSlots.sort((a, b) => a - b);

    nums.forEach((value, i) => {
      grid[rowSlots[i]][c] = { value, matched: used.has(value) };
    });
  }

  return grid.map((cells) => {
    const unmatched = cells.filter(Boolean).filter((cell) => !cell.matched).length;
    return {
      cells,
      complete: unmatched === 0,
      awarded: unmatched === 0,   // hàng đã đủ trước khi nhận vé -> không tính giải
      waitingNotified: false,
      kinhPosition: null,
    };
  });
}

/* ---------------- Trạng thái game ---------------- */
// Chữ ký của vé = toàn bộ lưới (giá trị số + ô đục). Dùng để đảm bảo 200 vé KHÔNG trùng nhau.
function gridSignature(rows) {
  return rows.map((r) => r.cells.map((c) => (c ? c.value : '_')).join(',')).join('|');
}

function freshGame(config) {
  const cfg = Object.assign({
    maxPlayers: 200,
    betPerTicket: 5000,
    rollSeconds: 6,
    autoRollSeconds: 2,
    minNumber: 1,
    maxNumber: 90,
  }, config || {});
  const g = {
    id: makeId(),
    startedAt: Date.now(),
    config: cfg,
    tickets: [],   // 200 vé: { code, owner, name, locked, socketId, rows, won, joinedAt }
    drawn: [],
    winners: [],
  };
  const seen = new Set();
  for (let i = 0; i < cfg.maxPlayers; i++) {
    let rows;
    let signature;
    let tries = 0;
    // Sinh lại ngay nếu trùng một vé đã có trong kho
    do {
      rows = buildGrid([]);
      signature = gridSignature(rows);
      tries++;
    } while (seen.has(signature) && tries < 200);
    seen.add(signature);
    g.tickets.push({
      code: 'V' + String(i + 1).padStart(3, '0'),
      owner: null, name: '', locked: false, socketId: null,
      rows, won: false, joinedAt: null,
    });
  }
  return g;
}

let game = readJSON(STATE_FILE, null);
if (!game || !game.config || !Array.isArray(game.drawn) || !Array.isArray(game.tickets)) {
  game = freshGame();
}
game.config = Object.assign({ maxPlayers: 200, betPerTicket: 5000, rollSeconds: 6, autoRollSeconds: 2, minNumber: 1, maxNumber: 90 }, game.config || {});

// Đang trong lượt quay số (chưa chốt kết quả)
let rolling = false;

// Chế độ tự xổ liên tục cho đến khi có người KINH
let autoRunning = false;
let roundStartWinners = 0;
let roundClosed = false;   // lượt đã chốt (có kinh / đã dừng) -> người mới chờ lượt sau

// Vé dùng để XEM TRƯỚC trên trang quản lý (tách riêng, không tính vào 200 vé)
let previewTickets = [];

function persistState() { writeJSON(STATE_FILE, game); }
function appendHistory() {
  const history = readJSON(HISTORY_FILE, []);
  history.unshift({
    id: game.id, startedAt: game.startedAt, endedAt: Date.now(),
    config: game.config, drawn: game.drawn, winners: game.winners,
    players: lockedPlayers().length, issued: game.tickets.filter((t) => t.owner).length,
  });
  writeJSON(HISTORY_FILE, history.slice(0, 50));
}
// Tổng giải = tổng tiền cược thực thu = số vé đã bán × mức cược/vé
function prizePool() {
  const sold = game.tickets.filter((t) => t.owner).length;
  return sold * (Number(game.config.betPerTicket) || 0);
}
function prizePerWinner() {
  const pool = prizePool();
  return game.winners.length ? Math.floor(pool / game.winners.length) : pool;
}
function lockedPlayers() {
  return game.tickets
    .filter((t) => t.locked && t.owner)
    .map((t) => ({ code: t.code, name: t.name, kinh: t.won ? game.winners.filter((w) => w.playerId === t.owner).length : 0 }));
}
function rowNumbers(row) { return row.cells.filter(Boolean); }
function countWaiting() {
  let n = 0;
  game.tickets.forEach((t) => {
    if (!t.owner) return;
    t.rows.forEach((r) => {
      if (!r.complete && rowNumbers(r).filter((c) => !c.matched).length === 1) n++;
    });
  });
  return n;
}
function serializeRows(ticket) {
  return ticket.rows.map((row, i) => {
    const nums = rowNumbers(row);
    const waiting = !row.complete && nums.filter((n) => !n.matched).length === 1;
    const missing = waiting ? nums.find((n) => !n.matched).value : null;
    return {
      index: i + 1,
      cells: row.cells.map((c) => (c ? { value: c.value, matched: c.matched } : null)),
      complete: row.complete, kinhPosition: row.kinhPosition,
      waiting, missing,
    };
  });
}
function serializeTicket(ticket) {
  return {
    code: ticket.code, name: ticket.name, locked: ticket.locked,
    rows: serializeRows(ticket), drawn: game.drawn,
    config: game.config,
  };
}
function findTickets(playerId) { return game.tickets.filter((t) => t.owner === playerId); }

// Gói dữ liệu tất cả vé của một người chơi (hỗ trợ mua nhiều vé)
function multiPayload(playerId, activeCode) {
  const owned = findTickets(playerId);
  const active = owned.find((t) => t.code === activeCode) || owned[0];
  return {
    code: active ? active.code : '',
    name: active ? active.name : '',
    locked: active ? active.locked : false,
    rows: active ? serializeRows(active) : [],
    activeCode: active ? active.code : '',
    tickets: owned.map((t) => ({
      code: t.code, name: t.name, locked: t.locked, won: t.won,
      rows: serializeRows(t),
    })),
    drawn: game.drawn,
    config: game.config,
  };
}
function previewPayload(pv) {
  return previewMultiPayload(pv.playerId, pv.code);
}
function previewMultiPayload(playerId, activeCode) {
  const owned = previewTickets.filter((t) => t.playerId === playerId);
  const active = owned.find((t) => t.code === activeCode) || owned[0];
  return {
    code: active ? active.code : '',
    name: active ? active.name : '',
    locked: active ? active.locked : false,
    rows: active ? serializeRows(active) : [],
    activeCode: active ? active.code : '',
    tickets: owned.map((t) => ({
      code: t.code, name: t.name, locked: t.locked, won: t.won, rows: serializeRows(t),
    })),
    drawn: game.drawn, config: game.config,
  };
}
function emitHostState() {
  io.emit('host:state', {
    config: game.config,
    drawn: game.drawn,
    playerCount: lockedPlayers().length,
    issuedCount: game.tickets.filter((t) => t.owner).length,
    maxPlayers: game.config.maxPlayers,
    waitingCount: countWaiting(),
    winners: game.winners,
    prize: prizePool(),
    prizePerWinner: prizePerWinner(),
    players: lockedPlayers(),
    history: readJSON(HISTORY_FILE, []),
  });
}

/* ---------------- QR ---------------- */
function buildJoinUrl() { return `http://${getLocalIP()}:${PORT}/play.html`; }
function sendQR(target) {
  const joinUrl = buildJoinUrl();
  QRCode.toDataURL(joinUrl, {
    width: 360, margin: 1, errorCorrectionLevel: 'M',
    color: { dark: '#8a0f10', light: '#fff8e7' },
  }).then((dataUrl) => {
    (target ? io.to(target) : io).emit('qr:ready', { dataUrl, joinUrl });
  }).catch((e) => console.error('[QR]', e.message));
}

/* ---------------- Gán / đổi vé ---------------- */
function releaseTicket(ticket) {
  ticket.owner = null;
  ticket.socketId = null;
  ticket.name = '';
  ticket.won = false;
  ticket.joinedAt = null;
  ticket.rows.forEach((r) => {
    r.cells.forEach((c) => { if (c) c.matched = false; });
    r.complete = false; r.awarded = false;
    r.waitingNotified = false; r.kinhPosition = null;
  });
}
function giveTicket(ticket, playerId, name, socketId) {
  ticket.owner = playerId;
  ticket.socketId = socketId;
  ticket.name = String(name || 'Người chơi').slice(0, 20);
  ticket.joinedAt = Date.now();
  // Đánh dấu các số đã xổ trước đó
  ticket.rows.forEach((r) => {
    r.cells.forEach((c) => { if (c && game.drawn.includes(c.value)) c.matched = true; });
    const unmatched = rowNumbers(r).filter((c) => !c.matched).length;
    r.complete = unmatched === 0;
    r.awarded = unmatched === 0;
    r.waitingNotified = false;
    r.kinhPosition = null;
  });
  ticket.won = false;
}
function pickFreeTicket(exclude) {
  const free = game.tickets.filter((t) => !t.owner && t !== exclude);
  return free.length ? free[Math.floor(Math.random() * free.length)] : null;
}

/* ---------------- Xổ số (quay rồi chốt) ---------------- */
function doDraw(manualNumber, onDone, durationOverride) {
  if (rolling) {
    io.emit('draw:error', { message: 'Đang quay số, vui lòng đợi…' });
    return;
  }
  const cfg = game.config;
  let num;
  if (manualNumber !== undefined && manualNumber !== null && manualNumber !== '') {
    num = Number(manualNumber);
    if (!Number.isInteger(num) || num < cfg.minNumber || num > cfg.maxNumber || game.drawn.includes(num)) {
      io.emit('draw:error', { message: 'Số không hợp lệ hoặc đã được xổ.' });
      return;
    }
  } else {
    const available = [];
    for (let n = cfg.minNumber; n <= cfg.maxNumber; n++) if (!game.drawn.includes(n)) available.push(n);
    if (!available.length) { io.emit('draw:error', { message: 'Đã xổ hết các số!' }); return; }
    num = available[Math.floor(Math.random() * available.length)];
  }

  const duration = durationOverride
    ? Math.max(300, Math.min(20000, Number(durationOverride)))
    : Math.max(1000, Math.min(20000, (Number(cfg.rollSeconds) || 6) * 1000));
  const snapshot = game;              // nếu đổi ván trong lúc quay thì bỏ kết quả cũ
  rolling = true;
  io.emit('draw:rolling', { duration, min: cfg.minNumber, max: cfg.maxNumber });

  setTimeout(() => {
    if (game !== snapshot) { rolling = false; return; }
    game.drawn.push(num);

    const newKinh = [];
    const newWaiting = [];

    game.tickets.forEach((ticket) => {
      if (!ticket.owner) return;
      ticket.rows.forEach((row, ri) => {
        rowNumbers(row).forEach((c) => { if (c.value === num) c.matched = true; });
        const unmatched = rowNumbers(row).filter((c) => !c.matched);
        row.complete = unmatched.length === 0;

        if (row.complete && !row.awarded) {
          row.awarded = true;
          ticket.won = true;
          row.kinhPosition = game.winners.length + 1;
          const winner = {
            playerId: ticket.owner, code: ticket.code, name: ticket.name, row: ri + 1,
            position: row.kinhPosition, time: Date.now(), acked: false,
          };
          game.winners.push(winner);
          newKinh.push({ ticket, winner });
        } else if (!row.complete && unmatched.length === 1 && !row.waitingNotified) {
          row.waitingNotified = true;
          newWaiting.push({ ticket, row: ri + 1, missing: unmatched[0].value });
        }
      });
    });

    // Vé xem trước: đánh dấu & báo kinh/đợi nhưng KHÔNG tính vào giải/danh sách
    previewTickets.forEach((ticket) => {
      ticket.rows.forEach((row, ri) => {
        rowNumbers(row).forEach((c) => { if (c.value === num) c.matched = true; });
        const unmatched = rowNumbers(row).filter((c) => !c.matched);
        row.complete = unmatched.length === 0;

        if (row.complete && !row.awarded) {
          row.awarded = true;
          ticket.won = true;
          ticket.previewKinhCount = (ticket.previewKinhCount || 0) + 1;
          row.kinhPosition = ticket.previewKinhCount;
          if (ticket.socketId) {
            io.to(ticket.socketId).emit('kinh:notify', {
              winner: {
                playerId: ticket.playerId, code: ticket.code, name: 'XEM TRƯỚC',
                row: ri + 1, position: row.kinhPosition, time: Date.now(),
              },
              prize: prizePool(), prizePerWinner: prizePool(), totalWinners: 1,
            });
          }
        } else if (!row.complete && unmatched.length === 1 && !row.waitingNotified) {
          row.waitingNotified = true;
          if (ticket.socketId) {
            io.to(ticket.socketId).emit('row:waiting', {
              row: ri + 1, missing: unmatched[0].value, name: 'XEM TRƯỚC',
            });
          }
        }
      });
    });
    const previewSockets = new Set();
    previewTickets.forEach((ticket) => {
      if (ticket.socketId && !previewSockets.has(ticket.socketId)) {
        previewSockets.add(ticket.socketId);
        io.to(ticket.socketId).emit('ticket:update', previewMultiPayload(ticket.playerId));
      }
    });

    persistState();
    io.emit('draw:result', { number: num, drawn: game.drawn });

    const updatedSockets = new Set();
    game.tickets.forEach((ticket) => {
      if (ticket.socketId && !updatedSockets.has(ticket.socketId)) {
        updatedSockets.add(ticket.socketId);
        io.to(ticket.socketId).emit('ticket:update', multiPayload(ticket.owner));
      }
    });
    newWaiting.forEach(({ ticket, row, missing }) => {
      if (ticket.socketId) {
        io.to(ticket.socketId).emit('row:waiting', { row, missing, name: ticket.name });
      }
    });
    newKinh.forEach(({ ticket, winner }) => {
      if (ticket.socketId) {
        io.to(ticket.socketId).emit('kinh:notify', {
          winner, prize: prizePool(),
          prizePerWinner: prizePerWinner(), totalWinners: game.winners.length,
        });
      }
    });
    if (newKinh.length) {
      io.emit('host:kinh', {
        winners: game.winners, prizePerWinner: prizePerWinner(),
        latest: newKinh.map((w) => w.winner),
      });
    }
    rolling = false;
    emitHostState();
    if (typeof onDone === 'function') onDone();
  }, duration);
}

/* ---------------- Tự xổ đến khi có KINH ---------------- */
function buildRoundSummary() {
  const pool = prizePool();
  const roundWinners = game.winners.slice(roundStartWinners);
  const per = roundWinners.length ? Math.floor(pool / roundWinners.length) : 0;

  const map = new Map();
  game.tickets.filter((t) => t.owner).forEach((t) => {
    let p = map.get(t.owner);
    if (!p) {
      p = { playerId: t.owner, name: t.name, tickets: 0, bet: 0, kinh: 0, win: 0, net: 0 };
      map.set(t.owner, p);
    }
    p.tickets++;
    p.bet += Number(game.config.betPerTicket) || 0;
  });
  roundWinners.forEach((w) => {
    const p = map.get(w.playerId);
    if (p) { p.kinh++; p.win += per; }
  });
  const players = [...map.values()].map((p) => Object.assign(p, { net: p.win - p.bet }));
  players.sort((a, b) => b.net - a.net);

  return {
    pool, per, winnerCount: roundWinners.length,
    winners: roundWinners, players,
    drawn: game.drawn.slice(),
  };
}

function nextAutoDraw() {
  if (!autoRunning) return;
  // Hết số thì dừng
  const available = [];
  for (let n = game.config.minNumber; n <= game.config.maxNumber; n++) {
    if (!game.drawn.includes(n)) available.push(n);
  }
  if (!available.length) {
    autoRunning = false;
    roundClosed = true;
    io.emit('auto:stopped', Object.assign(buildRoundSummary(), { exhausted: true }));
    io.emit('auto:state', { running: false });
    return;
  }
  const autoMs = Math.max(300, Math.min(20000, (Number(game.config.autoRollSeconds) || 2) * 1000));
  doDraw(undefined, () => {
    if (!autoRunning) return;
    if (game.winners.length > roundStartWinners) {
      autoRunning = false;
      roundClosed = true;
      io.emit('auto:state', { running: false });
      io.emit('auto:stopped', buildRoundSummary());
    } else {
      setTimeout(nextAutoDraw, 400);
    }
  }, autoMs);
}

/* ---------------- Socket ---------------- */
io.on('connection', (socket) => {
  socket.on('host:register', () => { emitHostState(); sendQR(socket.id); });

  // Chỉ đổi thời gian quay, không làm mất ván đang chơi
  socket.on('settings:update', (s) => {
    if (!s) return;
    if (s.rollSeconds !== undefined) {
      game.config.rollSeconds = Math.max(2, Math.min(15, Number(s.rollSeconds) || 6));
    }
    if (s.autoRollSeconds !== undefined) {
      game.config.autoRollSeconds = Math.max(0.3, Math.min(15, Number(s.autoRollSeconds) || 2));
    }
    persistState();
    emitHostState();
  });

  socket.on('config:update', (cfg) => {
    const maxPlayers = Math.max(1, Math.min(1000, Number(cfg.maxPlayers) || 200));
    const rollSeconds = Math.max(2, Math.min(15, Number(cfg.rollSeconds) || game.config.rollSeconds || 6));
    const autoRollSeconds = Math.max(0.3, Math.min(15, Number(cfg.autoRollSeconds) || game.config.autoRollSeconds || 2));
    const betPerTicket = Math.max(0, Number(cfg.betPerTicket) || 5000);
    rolling = false;
    autoRunning = false;
    roundClosed = false;
    previewTickets = [];
    io.emit('draw:cancel');
    game = freshGame({ maxPlayers, rollSeconds, autoRollSeconds, betPerTicket });
    persistState();
    io.emit('game:reset', { config: game.config });
    emitHostState();
    sendQR();
  });

  socket.on('game:new', () => {
    rolling = false;
    autoRunning = false;
    roundClosed = false;
    previewTickets = [];
    io.emit('draw:cancel');
    game = freshGame(game.config);
    persistState();
    io.emit('game:reset', { config: game.config });
    io.emit('auto:state', { running: false });
    emitHostState();
    sendQR();
  });

  socket.on('game:finish', () => {
    appendHistory();
    io.emit('game:finished', { winners: game.winners, drawn: game.drawn });
    emitHostState();
  });

  socket.on('draw:request', (payload) => {
    if (autoRunning) {
      io.emit('draw:error', { message: 'Đang tự xổ… bấm DỪNG nếu muốn dừng.' });
      return;
    }
    doDraw(payload && payload.manual);
  });

  socket.on('auto:start', () => {
    if (rolling || autoRunning) {
      io.emit('draw:error', { message: 'Đang quay rồi, vui lòng đợi…' });
      return;
    }
    autoRunning = true;
    roundClosed = false;
    roundStartWinners = game.winners.length;
    io.emit('auto:state', { running: true, round: roundStartWinners + 1 });
    nextAutoDraw();
  });

  socket.on('auto:stop', () => {
    if (!autoRunning) return;
    autoRunning = false;
    roundClosed = true;
    io.emit('auto:state', { running: false });
    io.emit('auto:stopped', Object.assign(buildRoundSummary(), { cancelled: true }));
  });

  socket.on('player:join', (payload) => {
    const playerId = payload && payload.playerId;
    if (!playerId) return;

    // Chế độ XEM TRƯỚC: vé riêng, không tính vào kho 200 vé / danh sách chốt
    if (payload.preview) {
      const want = Math.max(1, Math.min(4, Number(payload.ticketCount) || 1));
      let owned = previewTickets.filter((t) => t.playerId === playerId);
      // Đổi số vé muốn mua trong khung xem trước -> tạo lại bộ vé xem trước
      if (owned.length !== want) {
        previewTickets = previewTickets.filter((t) => t.playerId !== playerId);
        owned = [];
        for (let i = 0; i < want; i++) {
          const rows = buildGrid(game.drawn);
          rows.forEach((r) => { if (r.complete) r.awarded = true; });
          const pv = {
            playerId, code: i === 0 ? 'PREVIEW' : 'PREVIEW-' + (i + 1),
            name: 'XEM TRƯỚC', locked: false, socketId: socket.id,
            rows, won: false, previewKinhCount: 0,
          };
          previewTickets.push(pv);
          owned.push(pv);
        }
      }
      owned.forEach((t) => { t.socketId = socket.id; });
      socket.emit('ticket:assigned', previewMultiPayload(playerId, owned[0] && owned[0].code));
      return;
    }

    // Số vé người chơi muốn mua (tối đa 4 vé/người)
    const want = Math.max(1, Math.min(4, Number(payload.ticketCount) || 1));
    let owned = findTickets(playerId);
    if (!owned.length && (rolling || autoRunning || roundClosed)) {
      socket.emit('player:rejected', {
        message: 'Đang trong lượt xổ, vui lòng chờ lượt tiếp theo!',
      });
      return;
    }
    if (!owned.length) {
      const free = game.tickets.filter((t) => !t.owner);
      if (free.length < want) {
        socket.emit('player:rejected', {
          message: `Chỉ còn ${free.length} vé trống, không đủ ${want} vé. Vui lòng giảm số vé!`,
        });
        return;
      }
      shuffle(free);
      owned = free.slice(0, want);
      owned.forEach((t) => giveTicket(t, playerId, payload.name, socket.id));
    }
    owned.forEach((t) => {
      t.socketId = socket.id;
      if (payload.name) t.name = String(payload.name).slice(0, 20);
    });
    persistState();
    socket.emit('ticket:assigned', multiPayload(playerId));
    emitHostState();
  });

  // Đổi sang một vé random khác (chưa ai giữ)
  socket.on('ticket:change', (payload) => {
    const playerId = payload && payload.playerId;
    const pvList = previewTickets.filter((t) => t.playerId === playerId);
    if (pvList.length) {
      const pv = pvList.find((t) => t.code === payload.code) || pvList[0];
      pv.rows = buildGrid(game.drawn);
      pv.rows.forEach((r) => { if (r.complete) r.awarded = true; });
      pv.won = false;
      pv.previewKinhCount = 0;
      socket.emit('ticket:assigned', previewMultiPayload(playerId, pv.code));
      socket.emit('ticket:changed', { code: pv.code });
      return;
    }
    const owned = findTickets(playerId);
    if (!owned.length) return;
    const cur = owned.find((t) => t.code === payload.code) || owned[0];
    if (cur.locked) {
      socket.emit('ticket:error', { message: 'Bạn đã chốt vé, không thể đổi nữa!' });
      return;
    }
    const name = cur.name;
    const next = pickFreeTicket(cur);
    if (!next) {
      socket.emit('ticket:error', { message: 'Không còn vé nào để đổi.' });
      return;
    }
    releaseTicket(cur);
    giveTicket(next, playerId, name, socket.id);
    persistState();
    socket.emit('ticket:assigned', multiPayload(playerId, next.code));
    socket.emit('ticket:changed', { code: next.code });
    emitHostState();
  });

  // Chốt vé -> xuất hiện trong danh sách người chơi trên màn hình chính
  socket.on('ticket:lock', (payload) => {
    const pvOwned = previewTickets.filter((t) => t.playerId === payload.playerId);
    if (pvOwned.length) {
      pvOwned.forEach((t) => { t.locked = true; });
      socket.emit('ticket:locked', {
        code: pvOwned[0].code, name: 'XEM TRƯỚC', codes: pvOwned.map((t) => t.code),
      });
      return;
    }
    const owned = findTickets(payload && payload.playerId);
    if (!owned.length) return;
    owned.forEach((t) => { t.locked = true; });
    persistState();
    socket.emit('ticket:locked', { code: owned[0].code, name: owned[0].name, codes: owned.map((t) => t.code) });
    io.emit('host:players', { players: lockedPlayers() });
    emitHostState();
  });

  socket.on('player:ack', (payload) => {
    const ticket = game.tickets.find((t) => t.owner === (payload && payload.playerId));
    if (!ticket || !ticket.won) return;
    game.winners.forEach((w) => { if (w.playerId === ticket.owner) w.acked = true; });
    persistState();
    io.emit('host:ack', { name: ticket.name, code: ticket.code, winners: game.winners });
    emitHostState();
  });

  socket.on('player:rename', (payload) => {
    const owned = findTickets(payload && payload.playerId);
    if (!owned.length || !payload.name) return;
    const name = String(payload.name).slice(0, 20);
    owned.forEach((t) => { t.name = name; });
    game.winners.forEach((w) => { if (w.playerId === payload.playerId) w.name = name; });
    persistState();
    emitHostState();
  });

  socket.on('disconnect', () => {
    game.tickets.forEach((t) => { if (t.socketId === socket.id) t.socketId = null; });
    previewTickets.forEach((t) => { if (t.socketId === socket.id) t.socketId = null; });
  });
});

/* ---------------- Static ---------------- */
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/state', (req, res) => {
  res.json({
    serverTime: Date.now(), joinUrl: buildJoinUrl(),
    config: game.config, drawn: game.drawn,
    playerCount: lockedPlayers().length,
    issued: game.tickets.filter((t) => t.owner).length,
    waitingCount: countWaiting(),
    players: lockedPlayers(), winners: game.winners,
    prize: prizePool(), prizePerWinner: prizePerWinner(),
    history: readJSON(HISTORY_FILE, []),
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const signatures = game.tickets.map((t) => gridSignature(t.rows));
  const unique = new Set(signatures).size;
  const dup = game.tickets.length - unique;
  console.log('================================================');
  console.log(`  Kiểm tra vé: ${game.tickets.length} vé, ${unique} vé khác nhau, ${dup} vé trùng`);
  console.log('  LÔ TÔ TẾT - Máy chủ đã sẵn sàng');
  console.log(`  Màn hình chính: http://localhost:${PORT}`);
  console.log(`  Người chơi quét QR: ${buildJoinUrl()}`);
  console.log(`  Vé 9x9 · ${game.config.maxPlayers} vé · cược ${game.config.betPerTicket.toLocaleString('vi-VN')}đ/vé`);
  console.log('================================================');
});
