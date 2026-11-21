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

/* ---------------- Hiệu ứng quay ---------------- */
function startRoll(duration, min, max) {
  stopRoll();
  rolling = true;
  $('tvNumber').classList.add('spinning');
  setStatus('🎲 Đang quay số…');
  clearWinner();

  const lo = Number(min) || 1;
  const hi = Number(max) || 90;
  const start = performance.now();
  const tick = () => {
    if (!rolling) return;
    const p = Math.min(1, (performance.now() - start) / duration);
    const delay = 40 + Math.pow(p, 3) * 480;
    $('tvNumber').textContent = pad(lo + Math.floor(Math.random() * (hi - lo + 1)));
    rollTimer = setTimeout(tick, delay);
  };
  tick();
}

function stopRoll() {
  rolling = false;
  if (rollTimer) clearTimeout(rollTimer);
  rollTimer = null;
  $('tvNumber').classList.remove('spinning');
}

function showNumber(num) {
  stopRoll();
  const el = $('tvNumber');
  el.textContent = pad(num);
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
  setStatus(`Số vừa xổ: ${pad(num)} 🎉`);
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
  $('tvBet').textContent = `${fmt(s.config && s.config.betPerTicket)}/vé`;
  renderTvPlayers(s.players || []);
  renderHistory(s.drawn);
  if (!rolling && s.drawn && s.drawn.length) {
    $('tvNumber').textContent = pad(s.drawn[s.drawn.length - 1]);
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

/* ---------------- Socket ---------------- */
socket.on('connect', () => {
  setStatus('Đã kết nối · Chờ lượt xổ');
  socket.emit('host:register');
});
socket.on('disconnect', () => setStatus('Mất kết nối – đang thử lại…'));
socket.on('connect_error', () => setStatus('Không kết nối được máy chủ'));

socket.on('host:state', applyState);
socket.on('qr:ready', ({ dataUrl }) => {
  if (dataUrl) $('tvQrImg').src = dataUrl;
});

socket.on('draw:rolling', ({ duration, min, max }) => startRoll(duration, min, max));
socket.on('draw:result', ({ number }) => {
  showNumber(number);
  // Nếu lượt này không có kinh, host:kinh sẽ không đến -> giữ banner cũ
  // nhưng vẫn làm mới lịch sử/stats qua host:state ngay sau đó.
});
socket.on('host:kinh', ({ latest, winners, prizePerWinner }) => {
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
  $('tvNumber').innerHTML = '<span class="tv-placeholder">--</span>';
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
