/* ============================================================
 * Âm thanh: CHỈ phát nhạc chúc mừng khi có người KINH
 * - kinh.mp3 : file bạn tự cung cấp (nếu có)
 * - nếu không có file -> giai điệu beep dự phòng
 * Không phát tiếng số / nhạc nền lúc quay.
 * ============================================================ */
(function () {
  const enabled = localStorage.getItem('loto_audio_off') !== '1';
  let ctx = null;

  function beep(freq, dur, type, when) {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = type || 'sine';
      o.frequency.value = freq;
      const t = when || ctx.currentTime;
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (dur || 0.2));
      o.start(t); o.stop(t + (dur || 0.2) + 0.02);
    } catch (e) { /* trình duyệt có thể chặn audio */ }
  }

  window.LotoAudio = {
    kinh() {
      if (!enabled) return;
      const a = new Audio('/audio/kinh.mp3');
      a.play().catch(() => {
        // Giai điệu chúc mừng dự phòng
        [523, 659, 784, 1046].forEach((f, i) => {
          setTimeout(() => beep(f, 0.22, 'square'), i * 150);
        });
      });
    },
    setEnabled(v) {
      localStorage.setItem('loto_audio_off', v ? '0' : '1');
    },
    isEnabled() { return enabled; },
  };
})();
