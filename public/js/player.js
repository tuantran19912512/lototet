/* ============================================================
   LÔ TÔ TẾT - Logic trang người chơi
   - Mua 1..4 vé, chuyển đổi giữa các vé bằng tab
   - Vé truyền thống 9x9: đủ một hàng ngang -> KINH
   - Hàng còn đúng 1 số -> banner "đợi số XX"
   - Số vừa xổ hiển thị ở đầu trang
   ============================================================ */
const socket = io();
const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ';
const pad = (n) => String(n).padStart(2, '0');

let playerId = sessionStorage.getItem('loto_player_id');
if (!playerId) {
  playerId = 'P' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  sessionStorage.setItem('loto_player_id', playerId);
}
let playerName = localStorage.getItem('loto_player_name') || '';
const nameLocked = !!playerName;
if (playerName) {
  $('nameInput').value = playerName;
  $('nameInput').disabled = true;
  $('btnSaveName').classList.add('hidden');
  $('nameLocked').classList.remove('hidden');
  $('lockedName').textContent = playerName;
}

const isPreview = new URLSearchParams(location.search).has('preview');
if (isPreview) $('previewBadge').classList.remove('hidden');

/* ---------------- Ví tiền trên client (chỉ cược + thưởng) ---------------- */
const CHARGE_KEY = 'loto_bet_charged';
let wallet;
try { wallet = JSON.parse(localStorage.getItem('loto_wallet')) || {}; } catch (e) { wallet = {}; }
wallet = {
  bet: Number(wallet.bet) || 0,
  won: Number(wallet.won) || 0,
  wins: Array.isArray(wallet.wins) ? wallet.wins : [],
};
function saveWallet() { localStorage.setItem('loto_wallet', JSON.stringify(wallet)); }
function renderWallet() {
  $('walletBet').textContent = fmt(wallet.bet);
  $('walletWon').textContent = fmt(wallet.won);
  $('walletBalance').textContent = fmt(wallet.won);
  const c = $('walletWinsCount');
  if (c) c.textContent = wallet.wins.length;
  renderWinHistory();
}

function renderWinHistory() {
  const box = $('walletWinHistory');
  if (!box) return;
  if (!wallet.wins.length) {
    box.innerHTML = '<div class="wallet-empty">Chưa thắng lượt nào.</div>';
    return;
  }
  box.innerHTML = wallet.wins.slice().reverse().map((w, i) => `
    <div class="wallet-win-row">
      <span>#${wallet.wins.length - i} · ${new Date(w.time).toLocaleString('vi-VN')}</span>
      <b>+${fmt(w.amount)}</b>
      <small>${w.code || ''} · hàng ${w.row}${w.position ? ' · kinh thứ ' + w.position : ''}</small>
    </div>`).join('');
}

$('btnToggleWinHistory') && $('btnToggleWinHistory').addEventListener('click', () => {
  $('walletWinHistory').classList.toggle('hidden');
});
renderWallet();

// Cập nhật dòng xem trước tiền cược theo số phiếu chọn
const betRate = () => Number($('cfgBetRate').value) || 5000;
function updateBetPreview() {
  const el = $('betPreview');
  if (el) el.textContent = fmt(Number($('ticketCount').value || 1) * betRate());
}
$('ticketCount').addEventListener('change', () => {
  updateBetPreview();
  if (myTickets.length && !myTickets.some((t) => t.locked)) joinGame();
});
updateBetPreview();

function joinGame() {
  socket.emit('player:join', {
    playerId,
    name: isPreview ? 'XEM TRƯỚC' : playerName,
    preview: isPreview,
    ticketCount: Number($('ticketCount').value || 1),
  });
}

let myTickets = [];
let activeCode = '';
let myWinInfo = null;
let acked = false;

function activeTicket() {
  return myTickets.find((t) => t.code === activeCode) || myTickets[0] || null;
}
function currentRows() {
  const t = activeTicket();
  return (t && t.rows) || [];
}

/* ---------------- Thông tin chung của ván (trang PC) ---------------- */
function renderGameInfo(s) {
  if (!$('pcPrize')) return;
  $('pcPrize').textContent = fmt(s.prize);
  $('pcPrizeNote').textContent = s.collectedTickets
    ? `${s.collectedTickets} vé đã chốt · ${fmt(s.collected)} tiền thu`
    : 'Chưa có vé nào chốt';
  const list = s.players || [];
  $('pcPlayerCount').textContent = list.length;
  const box = $('pcPlayerList');
  if (!list.length) {
    box.innerHTML = '<div class="game-empty">Chưa có người chơi</div>';
    return;
  }
  box.innerHTML = list.map((p) => {
    const me = p.playerId === playerId ? ' me' : '';
    const status = p.kinh ? `🏆 ${p.kinh} kinh` : '';
    const mark = !p.online ? '💤' : p.paused ? '⏸️' : '';
    return `<div class="game-player-row${me}">
      <span class="gp-name">${mark} ${escapeHtml(p.name)}${me ? ' (bạn)' : ''}</span>
      <span class="gp-tickets">${p.tickets} vé</span>
      ${status ? `<span class="gp-kinh">${status}</span>` : ''}
    </div>`;
  }).join('');
}
socket.on('host:state', renderGameInfo);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

/* ---------------- Kết nối ---------------- */
function setStatus(text, online) {
  $('statusText').textContent = text;
  $('dot').className = 'dot ' + (online ? 'online' : 'offline');
}
socket.on('connect', () => {
  setStatus(nameLocked || isPreview ? 'Đã kết nối' : 'Nhập tên để bắt đầu', true);
  if (nameLocked || isPreview) joinGame();
});
socket.on('disconnect', () => setStatus('Mất kết nối – đang thử lại…', false));
socket.on('connect_error', () => setStatus('Không kết nối được máy chủ', false));
socket.on('player:rejected', ({ message }) => {
  setStatus(message, false);
  $('rowsGrid').innerHTML = `<div class="empty" style="color:#8a5a2b">${message}</div>`;
});

/* ---------------- Nhận vé ---------------- */
function applyTicketData(data) {
  if (data.config && data.config.betPerTicket !== undefined) {
    $('cfgBetRate').value = data.config.betPerTicket;
    updateBetPreview();
  }
  if (Array.isArray(data.tickets) && data.tickets.length) {
    myTickets = data.tickets;
  } else {
    // tương thích dữ liệu 1 vé
    myTickets = [{
      code: data.code || '', name: data.name || '', locked: !!data.locked,
      won: false, rows: data.rows || [],
    }];
  }
  if (data.activeCode && myTickets.some((t) => t.code === data.activeCode)) {
    activeCode = data.activeCode;
  } else if (!myTickets.some((t) => t.code === activeCode)) {
    activeCode = myTickets[0] ? myTickets[0].code : '';
  }
  if (data.name && !isPreview) { playerName = data.name; $('nameInput').value = playerName; }
  renderTicketTabs();
  applyLockState();
  renderRows();
  syncWaitingFromRows();
  if (data.drawn && data.drawn.length) $('lastNumber').textContent = pad(data.drawn[data.drawn.length - 1]);
}

socket.on('ticket:assigned', (data) => {
  myWinInfo = null;
  acked = false;
  applyTicketData(data);
  // Tiền cược = số phiếu đang giữ × mức cược (đổi số phiếu thì cập nhật lại)
  if (!isPreview) {
    wallet.bet = myTickets.length * betRate();
    saveWallet();
  }
  renderWallet();
  const locked = myTickets.some((t) => t.locked);
  $('ticketCount').disabled = locked;
  const n = myTickets.length;
  setStatus(`Đã có ${n} vé (${currentRows().length} hàng/vé). Chờ xổ số!`, true);
});

socket.on('ticket:update', (data) => {
  const prevRows = currentRows();
  if (Array.isArray(data.tickets)) {
    const keep = activeCode;
    myTickets = data.tickets;
    activeCode = myTickets.some((t) => t.code === keep) ? keep : (myTickets[0] ? myTickets[0].code : '');
    renderTicketTabs();
    applyLockState();
  }
  if (data.drawn && data.drawn.length) $('lastNumber').textContent = pad(data.drawn[data.drawn.length - 1]);
  renderRows();
  syncWaitingFromRows();
  if (matchedCount(currentRows()) > matchedCount(prevRows) && !myWinInfo) {
    navigator.vibrate && navigator.vibrate(50);
  }
});

socket.on('game:reset', () => {
  myTickets = []; activeCode = ''; myWinInfo = null; acked = false;
  $('winOverlay').classList.remove('show');
  hideWaitingBanner();
  $('lastNumber').textContent = '--';
  $('rowsGrid').innerHTML = '<div class="empty" style="color:#8a5a2b">Ván mới. Đang nhận vé…</div>';
  $('ticketTabs').classList.add('hidden');
  $('ticketTabs').innerHTML = '';
  $('progressText').textContent = '0 / 0 số đã trúng';
  $('progressBar').style.width = '0%';
  $('ticketCount').disabled = false;
  applyLockState();
  setStatus('Ván mới – đang nhận vé…', true);
  joinGame();
});

/* ---------------- Tab các vé ---------------- */
function renderTicketTabs() {
  const box = $('ticketTabs');
  if (myTickets.length <= 1) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  box.classList.remove('hidden');
  box.innerHTML = myTickets.map((t, i) => {
    const kinh = t.won ? ' 🏆' : '';
    return `<button class="ticket-tab ${t.code === activeCode ? 'active' : ''}" data-code="${t.code}">
      Vé ${i + 1} · ${t.code}${kinh}
    </button>`;
  }).join('');
  box.querySelectorAll('.ticket-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCode = btn.dataset.code;
      renderTicketTabs();
      renderRows();
      syncWaitingFromRows();
    });
  });
}

/* ---------------- Đổi / Chốt vé ---------------- */
function applyLockState() {
  const t = activeTicket();
  const locked = !!(t && t.locked);
  $('btnChange').disabled = locked;
  $('btnLock').disabled = locked;
  $('ticketCount').disabled = locked;
  $('btnChange').textContent = locked ? '🔒 Đã chốt' : '🔄 ĐỔI VÉ';
  $('btnLock').textContent = locked ? '✅ ĐÃ CHỐT' : '🔒 CHỐT VÉ';
  $('lockStatus').classList.toggle('hidden', !locked);
  if (locked && t) {
    $('lockedCode').textContent = myTickets.length > 1
      ? `${myTickets.length} vé đã chốt` : t.code;
  }
}
socket.on('ticket:changed', ({ code }) => {
  setStatus('Đã đổi vé mới. Hãy chốt vé nếu ưng ý!', true);
});
socket.on('ticket:locked', ({ codes }) => {
  myTickets.forEach((t) => { t.locked = true; });
  applyLockState();
  renderTicketTabs();
  setStatus('Đã chốt vé! Tên bạn hiện trên màn hình chính.', true);
});
socket.on('ticket:error', ({ message }) => setStatus(message, false));

$('btnChange').addEventListener('click', () => {
  const t = activeTicket();
  if (!t) return;
  socket.emit('ticket:change', { playerId, code: t.code });
});
$('btnLock').addEventListener('click', () => {
  socket.emit('ticket:lock', { playerId });
});

/* ---------------- Báo "đợi 1 số" ---------------- */
socket.on('row:waiting', ({ row, missing }) => {
  showWaitingBanner(row, missing);
  navigator.vibrate && navigator.vibrate(80);
});
function syncWaitingFromRows() {
  const waits = currentRows().filter((r) => r.waiting);
  if (waits.length) showWaitingBanner(waits[waits.length - 1].index, waits[waits.length - 1].missing);
  else hideWaitingBanner();
}
function showWaitingBanner(row, missing) {
  $('waitRow').textContent = row;
  $('waitNum').textContent = pad(missing);
  $('waitingBanner').classList.remove('hidden');
}
function hideWaitingBanner() { $('waitingBanner').classList.add('hidden'); }

/* ---------------- Báo KINH ---------------- */
socket.on('kinh:notify', (info) => {
  myWinInfo = info; acked = false;
  if (!isPreview) {
    const amount = Number(info.prizePerWinner) || 0;
    wallet.won += amount;
    wallet.wins.push({
      time: Date.now(),
      amount,
      code: info.winner && info.winner.code,
      row: info.winner && info.winner.row,
      position: info.winner && info.winner.position,
    });
    if (wallet.wins.length > 200) wallet.wins = wallet.wins.slice(-200);
    saveWallet(); renderWallet();
  }
  if (info.winner && info.winner.code && myTickets.some((t) => t.code === info.winner.code)) {
    activeCode = info.winner.code;
    renderTicketTabs();
    renderRows();
  }
  const t = myTickets.find((x) => x.code === info.winner.code);
  if (t) t.won = true;
  showWin(info, true);
});

function showWin(info, celebrate) {
  const w = info.winner || {};
  const medal = ['🥇','🥈','🥉'][(w.position || 1) - 1] || '🎖️';
  $('winPos').textContent = `${medal} KINH HÀNG ${w.row} · kinh thứ ${w.position}`;
  if (info.totalWinners > 1) {
    $('winMoney').innerHTML = `Tiền thưởng (chia đều): <b>${fmt(info.prizePerWinner)}</b>`;
    $('winNote').textContent = `Tổng giải ${fmt(info.prize)} chia cho ${info.totalWinners} hàng kinh.`;
  } else {
    $('winMoney').innerHTML = `Tiền thưởng: <b>${fmt(info.prizePerWinner || info.prize)}</b>`;
    $('winNote').textContent = 'Bạn là người kinh đầu tiên! Chúc mừng! 🎉';
  }
  $('btnAck').disabled = false;
  $('btnAck').textContent = '📱 GỬI PHẢN HỒI VỀ MÀN HÌNH CHÍNH';
  $('winOverlay').classList.add('show');
  document.body.classList.add('shake');
  setTimeout(() => document.body.classList.remove('shake'), 1600);
  if (celebrate) navigator.vibrate && navigator.vibrate([200, 100, 200, 100, 400]);
}

$('btnAck').addEventListener('click', () => {
  if (acked) return;
  acked = true;
  socket.emit('player:ack', { playerId });
  $('btnAck').disabled = true;
  $('btnAck').textContent = '✅ Đã gửi phản hồi!';
  setTimeout(() => $('winOverlay').classList.remove('show'), 1200);
});

/* ---------------- Render vé ---------------- */
function matchedCount(rows) {
  let n = 0;
  rows.forEach((r) => (r.cells || []).forEach((c) => { if (c && c.matched) n++; }));
  return n;
}
function totalCount(rows) {
  let n = 0;
  rows.forEach((r) => (r.cells || []).forEach((c) => { if (c) n++; }));
  return n;
}
function renderRows() {
  const box = $('rowsGrid');
  const rows = currentRows();
  const t = activeTicket();
  if (!rows.length) {
    box.innerHTML = '<div class="empty" style="color:#8a5a2b">Chưa có vé.</div>';
    return;
  }
  $('ticketName').textContent = '👤 ' + (playerName || 'Người chơi');
  $('lotoSerial').textContent = t ? t.code : '';
  $('lotoRound').textContent = rows.length;
  box.innerHTML = rows.map((r) => {
    let badge = '';
    if (r.complete) badge = `<span class="row-badge kinh">KINH ${r.kinhPosition ? '# ' + r.kinhPosition : ''} 🥇</span>`;
    else if (r.waiting) badge = `<span class="row-badge doi">ĐỢI SỐ ${pad(r.missing)} ⏳</span>`;
    const cells = (r.cells || []).map((c) => c
      ? `<div class="loto-cell ${c.matched ? 'matched' : ''}">${pad(c.value)}</div>`
      : '<div class="loto-cell blank"></div>').join('');
    return `<div class="loto-row ${r.complete ? 'row-kinh' : ''}">
      <div class="row-label">Hàng ${r.index}</div>
      <div class="row-cells">${cells}</div>
      ${badge}
    </div>`;
  }).join('');
  const matched = matchedCount(rows);
  const total = totalCount(rows) || 1;
  $('progressText').textContent = `${matched} / ${total} số đã trúng`;
  $('progressBar').style.width = (matched / total * 100) + '%';
}

/* ---------------- Âm chúc mừng khi KINH ---------------- */
socket.on('kinh:notify', () => {
  if (window.LotoAudio) LotoAudio.kinh();
});

/* ---------------- Tạm rời / Tiếp tục / Thoát ---------------- */
let paused = false;
function setPaused(v) {
  paused = v;
  $('btnPause').textContent = v ? '▶️ TIẾP TỤC' : '⏸️ TẠM RỜI';
  $('btnPause').classList.toggle('btn-primary', v);
  $('pauseBanner').classList.toggle('hidden', !v);
  socket.emit(v ? 'player:pause' : 'player:resume', { playerId });
}
$('btnPause').addEventListener('click', () => setPaused(!paused));
$('btnQuit').addEventListener('click', () => {
  if (confirm('Thoát trò chơi? Vé của bạn sẽ được trả lại kho (chỉ khi chưa chốt vé).')) {
    socket.emit('player:quit', { playerId });
  }
});
socket.on('player:quit-ok', () => {
  myTickets = []; activeCode = '';
  $('rowsGrid').innerHTML = '<div class="empty" style="color:#8a5a2b">Bạn đã thoát trò chơi.</div>';
  setStatus('Đã thoát trò chơi. Vé đã trả lại kho.', false);
  $('ticketCount').disabled = false;
});
socket.on('player:error', ({ message }) => setStatus(message, false));

/* ---------------- Xác nhận tên (chỉ 1 lần) ---------------- */
function saveName() {
  if (nameLocked) return;
  const name = $('nameInput').value.trim() || 'Người chơi';
  playerName = name;
  localStorage.setItem('loto_player_name', name);
  // Khóa tên: không cho đổi nữa
  $('nameInput').disabled = true;
  $('btnSaveName').classList.add('hidden');
  $('nameLocked').classList.remove('hidden');
  $('lockedName').textContent = name;
  $('ticketName').textContent = '👤 ' + name;
  joinGame();   // gửi tên vừa nhập lên server
}
$('btnSaveName').addEventListener('click', saveName);
$('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveName(); });

// Trong khung xem trước: đổi số vé muốn mua -> tạo lại bộ vé xem trước
$('ticketCount').addEventListener('change', () => {
  if (!isPreview) return;
  myWinInfo = null;
  acked = false;
  $('winOverlay').classList.remove('show');
  joinGame();
  setStatus(`Đã đổi thành ${$('ticketCount').value} vé xem trước.`, true);
});
