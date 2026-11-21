/* ============================================================
   LÔ TÔ TẾT - Logic màn hình chính (Host)
   ============================================================ */
const socket = io();

const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ';

let state = { drawn: [], winners: [], playerCount: 0, config: {}, history: [] };
let rollTimer = null;
let rolling = false;

/* ---------------------- Toast ---------------------- */
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ---------------------- Âm thanh (Web Audio, không cần file) ---------------------- */
let audioCtx;
function beep(type) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    if (type === 'tick') {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.type = 'triangle';
      o.frequency.value = 1100;
      g.gain.setValueAtTime(0.025, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      o.start(now); o.stop(now + 0.04);
    } else if (type === 'kinh') {
      [0, 0.14, 0.28].forEach((d, i) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.connect(g); g.connect(audioCtx.destination);
        o.type = 'square';
        o.frequency.value = [523, 659, 784][i];
        g.gain.setValueAtTime(0.12, now + d);
        g.gain.exponentialRampToValueAtTime(0.001, now + d + 0.12);
        o.start(now + d); o.stop(now + d + 0.13);
      });
    } else {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(880, now);
      o.frequency.exponentialRampToValueAtTime(440, now + 0.15);
      g.gain.setValueAtTime(0.09, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      o.start(now); o.stop(now + 0.23);
    }
  } catch (e) { /* trình duyệt có thể chặn audio */ }
}

/* ---------------------- Render ---------------------- */
function renderBigNumber(num, animate) {
  const el = $('bigNumber');
  el.innerHTML = num !== null && num !== undefined
    ? String(num).padStart(2, '0')
    : '<span class="placeholder">--</span>';
  if (animate) {
    el.classList.remove('rolling', 'pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }
}

/* ---------------- Hiệu ứng quay số ---------------- */
function startRoll(duration, min, max) {
  stopRoll();
  rolling = true;
  $('btnDraw').disabled = true;
  $('btnDraw').textContent = '⏳ ĐANG QUAY…';
  $('stageStatus').textContent = '🎲 Đang quay số… chờ chút!';
  const el = $('bigNumber');
  el.classList.add('spinning');

  const lo = Number(min) || 1;
  const hi = Number(max) || 90;
  const start = performance.now();
  let ticks = 0;

  const tick = () => {
    if (!rolling) return;
    const p = Math.min(1, (performance.now() - start) / duration);
    // Nhịp quay: nhanh lúc đầu (40ms), càng về cuối càng chậm (đến ~520ms)
    const delay = 40 + Math.pow(p, 3) * 480;
    el.textContent = pad(lo + Math.floor(Math.random() * (hi - lo + 1)));
    if (++ticks % 3 === 0) beep('tick');
    rollTimer = setTimeout(tick, delay);
  };
  tick();
}

function stopRoll() {
  rolling = false;
  if (rollTimer) clearTimeout(rollTimer);
  rollTimer = null;
  $('bigNumber').classList.remove('spinning');
  $('btnDraw').disabled = false;
  $('btnDraw').textContent = '🎲 XỔ SỐ NGAY';
}

function renderStats() {
  $('statPlayers').textContent = state.playerCount || 0;
  $('statMaxPlayers').textContent = state.maxPlayers || 200;
  $('statDrawn').textContent = (state.drawn || []).length;
  $('statWaiting').textContent = state.waitingCount || 0;
  $('statWinners').textContent = (state.winners || []).length;
  $('statPrize').textContent = fmt(state.prize);
  $('statCollected').textContent = `${fmt(state.collected)} (${state.collectedTickets || 0} vé)`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function renderDrawn() {
  const grid = $('drawnGrid');
  if (!state.drawn || state.drawn.length === 0) {
    grid.innerHTML = '<div class="empty">Chưa có số nào được xổ.</div>';
    return;
  }
  const latest = state.drawn[state.drawn.length - 1];
  grid.innerHTML = state.drawn
    .map((n, i) => `<div class="num-chip ${i === state.drawn.length - 1 ? 'latest' : ''}">${pad(n)}</div>`)
    .join('');
  grid.scrollTop = grid.scrollHeight;
}

function renderWinners() {
  const box = $('winnerList');
  const note = $('moneyNote');
  const per = getPerWinner();
  note.textContent = state.winners && state.winners.length
    ? `(mỗi người ${fmt(per)})`
    : '';
  if (!state.winners || state.winners.length === 0) {
    box.innerHTML = '<div class="empty">Chưa có ai kinh. Xổ số để tìm người may mắn!</div>';
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  const shown = state.winners.slice(-40).reverse();
  box.innerHTML = `
    <div class="history-item" style="color:#ffd9a0"><b>Tổng: ${state.winners.length} hàng kinh</b></div>` +
    shown.map((w) => {
      const medal = medals[w.position - 1] || '🎖️';
      const ack = w.acked ? '<span class="ack-dot">Đã phản hồi ✓</span>' : '<span style="color:#e8b98a;font-size:12px">Chờ phản hồi…</span>';
      return `<div class="winner-row">
        <div class="medal">${medal}</div>
        <div class="winner-info">
          <b>${escapeHtml(w.name)}</b> — Kinh hàng ${w.row} (thứ ${w.position})
          <small>${ack} · ${new Date(w.time).toLocaleTimeString('vi-VN')}</small>
        </div>
        <div class="winner-money">${fmt(per)}</div>
      </div>`;
    }).join('');
}

function getPerWinner() {
  const prize = Number(state.prize || 0);
  const n = (state.winners || []).length;
  return n ? Math.floor(prize / n) : prize;
}

function renderHistory() {
  const box = $('tabHistory');
  const h = state.history || [];
  if (!h.length) {
    box.innerHTML = '<div class="empty">Chưa có ván nào được lưu.</div>';
    return;
  }
  box.innerHTML = h.map((g) => `
    <div class="history-item">
      <div><b>Ván ${escapeHtml(g.id)}</b> · ${g.players || 0} người<br/>
        <small>${g.drawn ? g.drawn.length : 0} số · ${g.winners ? g.winners.length : 0} người kinh</small></div>
      <small>${new Date(g.endedAt || g.startedAt).toLocaleString('vi-VN')}</small>
    </div>`).join('');
}

let acks = [];
function renderAcks() {
  const box = $('tabAcks');
  if (!acks.length) {
    box.innerHTML = '<div class="empty">Chưa có phản hồi từ điện thoại.</div>';
    return;
  }
  box.innerHTML = acks.map((a) => `
    <div class="history-item">
      <span>✅ <b>${escapeHtml(a.name)}</b> đã phản hồi từ điện thoại</span>
      <small>${new Date(a.time).toLocaleTimeString('vi-VN')}</small>
    </div>`).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function renderPlayers() {
  const box = $('playerList');
  const list = state.players || [];
  $('playerNote').textContent = `(${list.length} người)`;
  if (!list.length) {
    box.innerHTML = '<div class="empty">Chưa có ai chốt vé.</div>';
    return;
  }
  box.innerHTML = list.map((p) => `
    <div class="history-item">
      <span>🧧 <b>${escapeHtml(p.name)}</b> · vé <b>${escapeHtml(p.code)}</b></span>
      <small>${p.kinh ? '🏆 ' + p.kinh + ' kinh' : 'Đã chốt'}</small>
    </div>`).join('');
}

function renderAll() {
  renderStats(); renderDrawn(); renderWinners(); renderHistory(); renderPlayers();
}

/* ---------------------- Socket events ---------------------- */
socket.on('connect', () => {
  socket.emit('host:register');
});

socket.on('qr:ready', ({ dataUrl, joinUrl }) => {
  $('qrImg').src = dataUrl;
  $('qrUrl').textContent = joinUrl;
});

socket.on('host:state', (s) => {
  state = s;
  if (state.config) {
    $('cfgMaxPlayers').value = state.config.maxPlayers;
    $('cfgRoll').value = state.config.rollSeconds || 6;
    $('cfgAutoRoll').value = state.config.autoRollSeconds || 1.2;
    $('cfgAutoHold').value = state.config.autoHoldMs || 4000;
    $('cfgBet').value = state.config.betPerTicket;
  }
  $('cfgPrize').textContent = fmt(state.prize);
  renderAll();
  // Khi tải lại trang, hiển thị số mới nhất đã xổ (nếu có)
  if (state.drawn && state.drawn.length && $('bigNumber').querySelector('.placeholder')) {
    renderBigNumber(state.drawn[state.drawn.length - 1], false);
    $('stageStatus').textContent = `Số mới nhất: ${pad(state.drawn[state.drawn.length - 1])}`;
  }
});

socket.on('draw:rolling', ({ duration, min, max }) => {
  startRoll(duration, min, max);
});

socket.on('draw:cancel', () => {
  stopRoll();
  $('stageStatus').textContent = 'Đã hủy lượt quay.';
});

socket.on('draw:result', ({ number }) => {
  stopRoll();
  renderBigNumber(number, true);
  $('stageStatus').textContent = `Số vừa xổ: ${pad(number)} 🎉`;
  beep('draw');
});

socket.on('draw:error', ({ message }) => {
  toast(message);
  $('stageStatus').textContent = message;
});

socket.on('host:kinh', ({ winners, latest }) => {
  state.winners = winners;
  renderWinners(); renderStats();
  latest.forEach((w) => {
    toast(`🎉 ${w.name} KINH hàng ${w.row} (thứ ${w.position})!`);
  });
  if (window.LotoAudio) LotoAudio.kinh(); else beep('kinh');
  $('stageStatus').textContent = '🎉 CÓ NGƯỜI KINH! Chúc mừng! 🎉';
});

socket.on('host:players', ({ players }) => {
  state.players = players;
  renderPlayers();
  renderStats();
});

socket.on('host:ack', ({ name }) => {
  acks.unshift({ name, time: Date.now() });
  renderAcks();
  toast(`📱 ${name} đã phản hồi từ điện thoại!`);
});

socket.on('game:reset', () => {
  hideCongrats();
  closeResult();
  renderBigNumber(null, false);
  $('stageStatus').textContent = 'Ván mới đã bắt đầu. Quét QR để tham gia!';
  acks = [];
  renderAcks();
  toast('🔄 Đã bắt đầu ván mới!');
});

socket.on('game:finished', () => {
  toast('🏁 Đã kết thúc và lưu ván vào lịch sử!');
  $('stageStatus').textContent = 'Ván đã kết thúc. Bấm "Ván mới" để chơi tiếp.';
});

/* ---------------------- Điều khiển ---------------------- */
$('btnDraw').addEventListener('click', () => {
  socket.emit('draw:request', {});
});

$('cfgRoll').addEventListener('change', () => {
  socket.emit('settings:update', { rollSeconds: $('cfgRoll').value });
});
$('cfgAutoRoll').addEventListener('change', () => {
  socket.emit('settings:update', { autoRollSeconds: $('cfgAutoRoll').value });
});
$('cfgAutoHold').addEventListener('change', () => {
  socket.emit('settings:update', { autoHoldMs: $('cfgAutoHold').value });
});

$('btnApplyConfig').addEventListener('click', () => {
  socket.emit('config:update', {
    maxPlayers: $('cfgMaxPlayers').value,
    rollSeconds: $('cfgRoll').value,
    autoRollSeconds: $('cfgAutoRoll').value,
    autoHoldMs: $('cfgAutoHold').value,
    betPerTicket: $('cfgBet').value,
  });
});

$('btnNew').addEventListener('click', () => socket.emit('game:new'));
/* ---------------------- Chọn cách xuất ra TV ---------------------- */
function closeTvModal() { $('tvModal').classList.remove('show'); }
function isMac() { return /Mac|iPod|iPhone|iPad/.test(navigator.platform || '') || /Mac/.test(navigator.userAgent || ''); }

$('btnTV').addEventListener('click', () => {
  $('tvModal').classList.add('show');
  $('tvScanPanel').classList.add('hidden');
  $('tvMirrorPanel').classList.add('hidden');
  document.querySelectorAll('.os-tab').forEach((t) => t.classList.toggle('active', (t.dataset.os === 'mac') === isMac()));
  $('osWin').classList.toggle('hidden', isMac());
  $('osMac').classList.toggle('hidden', !isMac());
});
$('btnCloseTvModal').addEventListener('click', closeTvModal);
$('tvModal').addEventListener('click', (e) => { if (e.target === $('tvModal')) closeTvModal(); });

// 1) Cáp HDMI: mở màn hình TV ngay máy này, full màn hình
$('tvOptCable').addEventListener('click', () => {
  closeTvModal();
  const w = window.open('/tv.html', '_blank');
  toast('🔌 Đã mở màn hình TV. Cắm cáp HDMI và nhấn F11 để full màn hình.');
  if (w) w.focus();
});

// 3) Chiếu màn hình: mở hướng dẫn theo OS + mở màn hình TV
$('tvOptMirror').addEventListener('click', () => {
  $('tvScanPanel').classList.add('hidden');
  $('tvMirrorPanel').classList.remove('hidden');
});
document.querySelectorAll('.os-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.os-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    $('osWin').classList.toggle('hidden', tab.dataset.os !== 'win');
    $('osMac').classList.toggle('hidden', tab.dataset.os !== 'mac');
  });
});
$('btnOpenTvFull').addEventListener('click', () => {
  closeTvModal();
  const w = window.open('/tv.html', '_blank');
  toast('📺 Đã mở màn hình TV. Nhấn F11 (Mac: ⌃⌘F) để full màn hình.');
  if (w) w.focus();
});

// 2) WiFi/LAN: tự dò TV trong mạng
async function scanTvDevices() {
  $('tvMirrorPanel').classList.add('hidden');
  $('tvScanPanel').classList.remove('hidden');
  $('tvScanInfo').textContent = 'Đang quét mạng… (có thể mất vài giây)';
  $('tvDeviceList').innerHTML = '<div class="empty">🔍 Đang dò…</div>';
  try {
    const r = await fetch('/api/tv-discover');
    const data = await r.json();
    const list = data.devices || [];
    $('tvScanInfo').textContent = `Mạng ${data.subnet || '?'} · máy chủ ${data.localIp || '?'} · tìm thấy ${list.length} thiết bị`;
    if (!list.length) {
      $('tvDeviceList').innerHTML = '<div class="empty">Không tìm thấy TV. Hãy mở trang /tv.html trên TV (cùng Wi-Fi) rồi bấm Dò lại.</div>';
      return;
    }
    $('tvDeviceList').innerHTML = list.map((d) => {
      const isSocket = !!d.socketId;
      const src = isSocket ? 'Đang hiển thị · cùng mạng' :
        (d.source === 'scan' ? 'Phát hiện qua mạng' : 'Trong mạng');
      const name = d.name || d.probeName || ('TV-' + d.ip.split('.').pop());
      return `<div class="tv-device-item">
        <div class="d-icon">📺</div>
        <div class="d-info"><b>${escapeHtml(name)}</b><small>${d.ip} · ${src}</small></div>
        ${isSocket
          ? `<button class="btn btn-primary" data-socket="${d.socketId}" data-name="${escapeHtml(name)}">XUẤT SANG TV NÀY</button>`
          : `<button class="btn btn-ghost" data-open="${d.ip}">MỞ TRANG TV</button>`}
      </div>`;
    }).join('');

    $('tvDeviceList').querySelectorAll('[data-socket]').forEach((btn) => {
      btn.addEventListener('click', () => {
        socket.emit('tv:focus', { socketId: btn.dataset.socket });
      });
    });
    $('tvDeviceList').querySelectorAll('[data-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.open(`http://${btn.dataset.open}:${location.port}/tv.html`, '_blank');
      });
    });
  } catch (e) {
    $('tvScanInfo').textContent = 'Lỗi khi dò TV: ' + e.message;
    $('tvDeviceList').innerHTML = '';
  }
}
$('tvOptWifi').addEventListener('click', scanTvDevices);
$('btnTvRescan').addEventListener('click', scanTvDevices);
socket.on('tv:focus-ok', ({ name }) => {
  toast(`📺 Đã xuất sang ${name}!`);
  closeTvModal();
});
socket.on('tv:focus-error', ({ message }) => toast(message));
$('btnFinish').addEventListener('click', () => socket.emit('game:finish'));

/* ---------------------- Tự xổ đến khi có KINH ---------------------- */
let autoRunning = false;
let congratsTimer = null;
let pendingResult = null;

function hideCongrats() {
  if (congratsTimer) clearTimeout(congratsTimer);
  congratsTimer = null;
  $('congratsModal').classList.remove('show');
}

function showResultBoard(data) {
  hideCongrats();
  if (!data) return;
  const { pool, per, winnerCount, winners, players, cancelled, exhausted } = data;
  $('resultTitle').textContent = cancelled ? '⏹ ĐÃ DỪNG TỰ XỔ' : '🎉 KẾT QUẢ LƯỢT XỔ';
  $('resultMeta').innerHTML = `Tổng giải: <b>${fmt(pool)}</b> · ${winnerCount} hàng kinh · mỗi kinh <b>${fmt(per)}</b>` +
    (exhausted ? ' · Đã hết số!' : '');
  const medal = ['🥇','🥈','🥉'];
  if (!players.length) {
    $('resultList').innerHTML = '<div class="empty">Chưa có người chơi nào.</div>';
  } else {
    $('resultList').innerHTML = players.map((p) => {
      const won = p.net > 0;
      const myWinners = winners.filter((w) => w.playerId === p.playerId);
      const kinhRows = myWinners.map((w) => `hàng ${w.row}`).join(', ');
      const kinhInfo = p.kinh
        ? `${medal[(myWinners[0].position || 1) - 1] || '🎖️'} Kinh ${kinhRows} (${p.kinh} vé) · thưởng ${fmt(p.win)}`
        : 'Không kinh';
      const netText = (won ? '+' : '') + fmt(p.net);
      return `<div class="result-row ${won ? 'win' : ''}">
        <div class="r-name"><b>${escapeHtml(p.name)}</b> · mua ${p.tickets} vé · cược ${fmt(p.bet)}
          <small>${kinhInfo} · ròng ${netText}</small></div>
        <div class="r-net ${won ? 'plus' : 'minus'}">${netText}</div>
      </div>`;
    }).join('');
  }
  $('resultModal').classList.add('show');
  $('stageStatus').textContent = cancelled ? 'Đã dừng tự xổ.' : '🏁 Lượt xổ kết thúc · Xem tổng kết';
}

function showCongrats(data) {
  if (congratsTimer) clearInterval(congratsTimer);
  pendingResult = data;
  const { winners, per, winnerCount, pool } = data;
  const medal = ['🥇','🥈','🥉'];
  const list = winners.length ? winners : [];
  $('congratsSub').textContent = `Có ${winnerCount} hàng kinh trong lượt này · Tổng giải ${fmt(pool)}`;
  $('congratsList').innerHTML = list.map((w, i) => `
    <div class="congrats-item" style="animation-delay:${i * 0.12}s">
      <div class="c-medal">${medal[(w.position || 1) - 1] || '🎖️'}</div>
      <div class="c-name">${escapeHtml(w.name)}</div>
      <div class="c-detail">Kinh hàng ${w.row} · kinh thứ ${w.position} · vé ${escapeHtml(w.code || '')}</div>
      <div class="c-money">+ ${fmt(per)}</div>
    </div>`).join('');
  $('congratsModal').classList.add('show');
  if (window.LotoAudio) LotoAudio.kinh(); else beep('kinh');
  // Tự mở bảng kết quả sau 6 giây, hoặc bấm nút để mở ngay
  let left = 6;
  $('congratsCount').textContent = `Bảng kết quả sẽ hiện sau ${left}s…`;
  congratsTimer = setInterval(() => {
    left--;
    if (left <= 0) { showResultBoard(pendingResult); return; }
    $('congratsCount').textContent = `Bảng kết quả sẽ hiện sau ${left}s…`;
  }, 1000);
}

function setAutoUI(running) {
  autoRunning = !!running;
  $('btnAuto').textContent = running ? '⏹ DỪNG TỰ XỔ' : '🤖 TỰ XỔ ĐẾN KHI CÓ KINH';
  $('btnAuto').classList.toggle('btn-danger', !!running);
  $('btnDraw').disabled = !!running;
}
$('btnAuto').addEventListener('click', () => {
  socket.emit(autoRunning ? 'auto:stop' : 'auto:start');
});

$('btnShowResult').addEventListener('click', () => showResultBoard(pendingResult));

function closeResult() { $('resultModal').classList.remove('show'); }
$('btnCloseResult').addEventListener('click', closeResult);
$('resultModal').addEventListener('click', (e) => {
  if (e.target === $('resultModal')) closeResult();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { hideCongrats(); closeResult(); closePreview(); }
});
$('btnNextRound').addEventListener('click', () => {
  closeResult();
  socket.emit('game:new');
  toast('🔄 Ván mới đã tạo. Chờ người chơi nhận vé rồi bấm Tự xổ!');
});

socket.on('auto:state', ({ running }) => {
  setAutoUI(running);
  if (running) $('stageStatus').textContent = '🤖 Đang tự xổ… sẽ dừng khi có người KINH';
});

socket.on('auto:stopped', (data) => {
  setAutoUI(false);
  if (data.cancelled || data.winnerCount === 0) {
    showResultBoard(data);   // dừng tay / hết số: hiện thẳng bảng
    return;
  }
  showCongrats(data);        // có kinh: chúc mừng trước, rồi mới bảng kết quả
  toast(`🎉 ${data.winnerCount} hàng kinh! Tổng giải ${fmt(data.pool)}`);
  $('stageStatus').textContent = '🎉 CÓ NGƯỜI KINH! Đang chúc mừng…';
});

/* ---------------------- Xem trước điện thoại ---------------------- */
function closePreview() {
  $('previewModal').classList.remove('show');
  $('previewFrame').src = 'about:blank';   // ngắt socket của vé xem trước
}
$('btnPreview').addEventListener('click', () => {
  $('previewFrame').src = '/play.html?preview=1';
  $('previewModal').classList.add('show');
});
$('btnClosePreview').addEventListener('click', closePreview);
$('previewModal').addEventListener('click', (e) => {
  if (e.target === $('previewModal')) closePreview();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePreview();
});

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const t = tab.dataset.tab;
    $('tabHistory').classList.toggle('hidden', t !== 'history');
    $('tabAcks').classList.toggle('hidden', t !== 'acks');
  });
});
