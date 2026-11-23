/* ============================================================
   MÀN HÌNH TV - nhận số xổ + người kinh realtime từ server
   ============================================================ */
const socket = io();
const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ';
const pad = (n) => String(n).padStart(2, '0');

let rollTimer = null;
let rolling = false;
let lastWinners = [];
let stateLoaded = false;

function setStatus(t) { $('tvStatus').textContent = t; }

/* ---------------- Lồng cầu 90 bi ---------------- */
const drum = $('drum');
const drumBalls = $('drumBalls');
const ballOut = $('drumBallOut');
const BALLS = [];

function buildDrum() {
  if (BALLS.length) return;
  const frag = document.createDocumentFragment();
  for (let n = 1; n <= 90; n++) {
    // Phân bố ngẫu nhiên trong hình tròn (bán kính ~42%)
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 41;
    const x = 50 + Math.cos(a) * r;
    const y = 50 + Math.sin(a) * r;
    const b = document.createElement('div');
    b.className = 'drum-ball';
    b.dataset.n = n;
    b.textContent = n;
    b.style.left = x + '%';
    b.style.top = y + '%';
    // Biến cho chuyển động lắc ngẫu nhiên riêng từng bi
    b.style.setProperty('--dx', (4 + Math.random() * 9).toFixed(1) + 'px');
    b.style.setProperty('--dy', (4 + Math.random() * 9).toFixed(1) + 'px');
    b.style.setProperty('--dur', (0.28 + Math.random() * 0.45).toFixed(2) + 's');
    b.style.setProperty('--delay', (Math.random() * 0.5).toFixed(2) + 's');
    frag.appendChild(b);
    BALLS.push(b);
  }
  drumBalls.appendChild(frag);
}
buildDrum();

function startRoll(duration) {
  stopRoll();
  rolling = true;
  setStatus('🎲 Lồng cầu đang quay…');
  clearWinner();
  ballOut.classList.remove('show', 'pop');
  BALLS.forEach((b) => b.classList.remove('picked'));
  drum.classList.remove('stopped', 'slowdown');
  drum.classList.add('spinning');
}

function stopRoll() {
  rolling = false;
  if (rollTimer) clearTimeout(rollTimer);
  rollTimer = null;
}

function showNumber(num) {
  stopRoll();
  drum.classList.remove('spinning');
  drum.classList.add('slowdown');
  // Dừng hẳn lồng sau 0.5s rồi đẩy bi ra
  rollTimer = setTimeout(() => {
    drum.classList.remove('slowdown');
    drum.classList.add('stopped');
    BALLS.forEach((b) => b.classList.toggle('picked', Number(b.dataset.n) === Number(num)));
    $('outNumber').textContent = pad(num);
    ballOut.classList.remove('show', 'pop');
    void ballOut.offsetWidth;
    ballOut.classList.add('show', 'pop');
    setStatus(`Số vừa xổ: ${pad(num)} 🎉`);
  }, 500);
}

function showNumberInstant(num) {
  stopRoll();
  drum.classList.remove('spinning', 'slowdown');
  drum.classList.add('stopped');
  BALLS.forEach((b) => b.classList.toggle('picked', Number(b.dataset.n) === Number(num)));
  $('outNumber').textContent = pad(num);
  ballOut.classList.add('show');
}

/* ---------------- Người chiến thắng ---------------- */
function clearWinner() {
  const box = $('tvWinner');
  box.classList.remove('has-winner');
  $('tvWinnerTitle').textContent = '🎉 KINH! 🎉';
  $('tvWinnerName').textContent = 'Chưa có người kinh';
  $('tvWinnerInfo').textContent = 'Đang chờ người may mắn…';
  $('tvWinnerMoney').textContent = '';
}

function showWinners(list, per) {
  if (!list || !list.length) { clearWinner(); return; }
  lastWinners = list;
  const box = $('tvWinner');
  box.classList.add('has-winner');
  $('tvWinnerTitle').textContent = list.length > 1 ? `🎉 ${list.length} NGƯỜI KINH! 🎉` : '🎉 KINH! 🎉';
  $('tvWinnerName').textContent = list.map((w) => w.name).join('  ·  ');
  $('tvWinnerInfo').textContent = list
    .map((w) => `Hàng ${w.row} · kinh thứ ${w.position} (vé ${w.code || ''})`.trim())
    .join('  |  ');
  $('tvWinnerMoney').textContent = `Tiền thưởng mỗi người: ${fmt(per)}`;
  box.style.animation = 'none';
  void box.offsetWidth;
  box.style.animation = '';
}

/* ---------------- Render từ trạng thái ---------------- */
function renderHistory(drawn) {
  const box = $('tvHistory');
  if (!drawn || !drawn.length) { box.innerHTML = ''; return; }
  const recent = drawn.slice(-14);
  box.innerHTML = recent.map((n, i) =>
    `<span class="tv-chip ${i === recent.length - 1 ? 'latest' : ''}">${pad(n)}</span>`
  ).join('');
}

function renderTvLeft(list) {
  const box = $('tvLeftList');
  if (!box) return;
  if (!list.length) {
    box.innerHTML = '<div class="tv-left-empty">Chưa có người chơi</div>';
    return;
  }
  box.innerHTML = list.map((p) => {
    const kinh = p.kinh ? ` · 🏆${p.kinh}` : '';
    const ve = p.tickets === 1 ? '1 vé' : `${p.tickets} vé`;
    const mark = !p.online ? '💤' : p.paused ? '⏸️' : '';
    return `<div class="tv-left-row ${p.kinh ? 'win' : ''}">
      <span class="l-name">${mark} ${p.name}</span>
      <span class="l-tickets">${ve}</span>
      ${kinh ? `<span class="l-kinh">${kinh}</span>` : ''}
    </div>`;
  }).join('');
}

function renderTvPlayers(list) {
  const box = $('tvPlayersList');
  $('tvPlayersTitle').textContent = '👥 NGƯỜI CHƠI ĐÃ CHỐT';
  if (!list.length) {
    box.innerHTML = '<div class="tv-players-empty">Chưa có người chơi</div>';
    return;
  }
  box.innerHTML = list.map((p) => {
    const kinh = p.kinh ? ` · 🏆${p.kinh}` : '';
    return `<span class="tv-player-chip">${p.name} · ${p.code}${kinh}</span>`;
  }).join('');
}
function renderTvResult(data) {
  const left = $('tvLeftList');
  if (left && data.players && data.players.length) {
    left.innerHTML = data.players.map((p) => {
      const ver = p.tickets === 1 ? '1 vé' : `${p.tickets} vé`;
      const net = p.paid ? (p.net > 0 ? '+' : '') + fmt(p.net) : '💤 không nhận thưởng';
      return `<div class="tv-left-row ${p.paid && p.net > 0 ? 'win' : ''}">
        <span class="l-name">${p.name}</span>
        <span class="l-tickets">${ver}</span>
        <span class="l-kinh">${net}</span>
      </div>`;
    }).join('');
  }
  $('tvPlayersTitle').textContent = `🏁 TỔNG KẾT · ${data.winnerCount} hàng kinh · mỗi kinh ${fmt(data.per)}`;
  const box = $('tvPlayersList');
  if (!data.players || !data.players.length) {
    box.innerHTML = '<div class="tv-players-empty">Chưa có người chơi</div>';
    return;
  }
  box.innerHTML = data.players.map((p) => {
    const cls = p.net > 0 ? 'win' : p.net < 0 ? 'lose' : '';
    const sign = p.net > 0 ? '+' : '';
    return `<span class="tv-player-chip ${cls}">${p.name} · ${p.tickets} vé · ${sign}${fmt(p.net)}</span>`;
  }).join('');
}

function applyState(s) {
  $('tvPlayers').textContent = s.playerCount || 0;
  $('tvDrawn').textContent = (s.drawn || []).length;
  $('tvKinh').textContent = (s.winners || []).length;
  $('tvPrize').textContent = fmt(s.prizePerWinner);
  $('tvPool').textContent = fmt(s.prize);
  $('tvPoolTop').textContent = `${fmt(s.prize)} (${s.collectedTickets || 0} vé)`;
  $('tvCollected').textContent = `${fmt(s.collected)} (${s.collectedTickets || 0} vé)`;
  renderTvLeft(s.players || []);
  $('tvBet').textContent = `${fmt(s.config && s.config.betPerTicket)}/vé`;
  renderTvPlayers(s.players || []);
  renderHistory(s.drawn);
  if (!rolling && s.drawn && s.drawn.length) {
    showNumberInstant(s.drawn[s.drawn.length - 1]);
    setStatus(`Số mới nhất: ${pad(s.drawn[s.drawn.length - 1])}`);
  }
  // Chỉ dựng lại banner khi mới tải trang/ván mới; các lượt sau do host:kinh quyết định
  if (!stateLoaded) {
    stateLoaded = true;
    if (s.winners && s.winners.length) {
      showWinners(s.winners.slice(-3).reverse(), s.prizePerWinner);
    }
  }
}

// URL cho người chơi dùng máy tính (cùng mạng)
if ($('tvPcUrl')) $('tvPcUrl').textContent = '💻 PC: ' + location.host + '/play-pc.html';

/* ---------------- Đăng ký làm màn hình TV ---------------- */
let tvName = localStorage.getItem('loto_tv_name') || '';
if (!tvName) {
  tvName = 'TV-' + Math.floor(100 + Math.random() * 900);
  localStorage.setItem('loto_tv_name', tvName);
}
$('tvDeviceName').textContent = tvName;

$('btnTvRename').addEventListener('click', () => {
  const next = (prompt('Tên màn hình TV:', tvName) || '').trim().slice(0, 40);
  if (next) {
    tvName = next;
    localStorage.setItem('loto_tv_name', tvName);
    $('tvDeviceName').textContent = tvName;
    socket.emit('tv:register', { name: tvName });
  }
});

/* ---------------- Socket ---------------- */
socket.on('connect', () => {
  setStatus('Đã kết nối · Chờ lượt xổ');
  socket.emit('host:register');
  socket.emit('tv:register', { name: tvName });
});
socket.on('disconnect', () => setStatus('Mất kết nối – đang thử lại…'));
socket.on('connect_error', () => setStatus('Không kết nối được máy chủ'));

socket.on('host:state', applyState);
socket.on('qr:ready', ({ dataUrl }) => {
  if (dataUrl) $('tvQrImg').src = dataUrl;
});
socket.on('tv:registered', ({ name }) => {
  $('tvDeviceName').textContent = name;
});
socket.on('tv:focus-on', ({ from }) => {
  setStatus(`📺 Đang nhận xuất từ ${from}…`);
  const badge = $('tvCastBadge');
  if (badge) badge.classList.remove('hidden');
  if (document.body.requestFullscreen && !document.fullscreenElement) {
    document.body.requestFullscreen().catch(() => {});
  }
  setTimeout(() => { if (badge) badge.classList.add('hidden'); }, 5000);
});

socket.on('draw:rolling', ({ duration, min, max }) => startRoll(duration, min, max));
socket.on('draw:result', ({ number }) => {
  showNumber(number);
  // Nếu lượt này không có kinh, host:kinh sẽ không đến -> giữ banner cũ
  // nhưng vẫn làm mới lịch sử/stats qua host:state ngay sau đó.
});
socket.on('host:kinh', ({ latest, winners, prizePerWinner }) => {
  if (window.LotoAudio) LotoAudio.kinh();
  showWinners(latest && latest.length ? latest : winners.slice(-3), prizePerWinner);
});
let tvResultTimer = null;
socket.on('auto:stopped', (data) => {
  if (tvResultTimer) clearTimeout(tvResultTimer);
  if (!data.cancelled && data.winnerCount > 0) {
    // Ưu tiên chúc mừng trên TV trước
    showWinners(data.winners.slice(-3).reverse(), data.per);
    setStatus(`🎉 CHÚC MỤNG! ${data.winnerCount} người kinh`);
    tvResultTimer = setTimeout(() => {
      renderTvResult(data);
      setStatus(`🏁 Kết thúc lượt · ${data.winnerCount} người kinh`);
    }, 6000);
  } else {
    renderTvResult(data);
    setStatus(data.cancelled ? '⏹ Đã dừng tự xổ' : '🏁 Kết thúc lượt');
  }
});
socket.on('host:ack', () => { /* có thể thêm hiệu ứng nếu muốn */ });
socket.on('game:reset', () => {
  if (tvResultTimer) clearTimeout(tvResultTimer);
  stateLoaded = false;
  stopRoll();
  drum.classList.remove('stopped', 'slowdown');
  drum.classList.add('spinning');
  ballOut.classList.remove('show', 'pop');
  $('outNumber').textContent = '--';
  BALLS.forEach((b) => b.classList.remove('picked'));
  clearWinner();
  $('tvHistory').innerHTML = '';
  renderTvPlayers([]);
  $('tvPlayers').textContent = '0';
  $('tvDrawn').textContent = '0';
  $('tvKinh').textContent = '0';
  setStatus('Ván mới đã bắt đầu');
});
socket.on('game:finished', () => setStatus('🏁 Ván đã kết thúc · Xem lại trên trang quản lý'));
socket.on('draw:error', ({ message }) => setStatus(message));
