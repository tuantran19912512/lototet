# 🧧 XỔ LÔ TÔ NGÀY TẾT (vé 9×9)

Repo: **https://github.com/tuantran19912512/lototet**

Trang chơi lô tô chạy trên **LAN** hoặc **qua internet (Cloudflare Tunnel)**: màn hình chính (host), trang người chơi (điện thoại quét QR) và màn hình TV chiếu riêng.

## Luật chơi / cấu trúc vé
- Vé **9 ô ngang × 9 ô dọc** (81 ô). Mỗi hàng **đục 4 ô → còn 5 ô có số** (45 số/vé).
- Mỗi cột là một chục: `1–9 | 10–19 | … | 80–90`. Số trong cột xếp **tăng dần từ trên xuống**; vị trí ô đục xáo trộn riêng từng vé.
- Khi tạo kho **200 vé**, server so sánh chữ ký toàn bộ lưới và **sinh lại nếu trùng** → 200 vé khác biệt (log báo `0 vé trùng` lúc khởi động).
- **KINH khi một hàng ngang đủ số** (không cần đủ cả vé). Hàng còn đúng 1 số → báo **"đợi số XX"**.
- Mua **1–4 vé/người**, đổi/chốt vé. Chốt xong không đổi được; người vào giữa lượt bị từ chối ("chờ lượt tiếp theo").

## Tiền
- **Tổng giải tự tính** = `số vé đã bán × mức cược/vé` (không có giải cố định). Mặc định 5.000đ/vé → 200 vé = 1.000.000đ.
- **Tiền mỗi kinh** = `Tổng giải ÷ số hàng kinh`.
- Ví trên điện thoại: **Số dư = Đã nạp − Đã trừ cược + Đã tích thưởng** (lưu `localStorage`; vé xem trước không trừ tiền).
- Mọi số tiền có dấu `.` hàng nghìn (vd `1.000.000đ`).

## Luồng chơi
1. Quét QR → nhập tên → chọn **Số vé muốn mua (1–4)** → nhận vé random. Ô **SỐ VỪA XỔ** nằm đầu trang.
2. Chọn **🔄 ĐỔI VÉ** nếu chưa ưng, rồi **🔒 CHỐT VÉ** → tên hiện trên màn hình chính/TV.
3. Host bấm:
   - **🎲 XỔ SỐ NGAY**: quay ~6s rồi dừng (chỉnh 2–15s).
   - **🤖 TỰ XỔ ĐẾN KHI CÓ KINH**: quay ~1.2s + giữ số ~0.9s (~2.1s/lượt, chỉnh được) rồi tự dừng khi có kinh. Nút thành **⏹ DỪNG TỰ XỔ**.
4. Có kinh → **màn chúc mừng** (pháo hoa + nhạc, huy chương, tên, hàng, mã vé, tiền nhận) → sau 6s (hoặc bấm nút) mở **bảng kết quả**: mua bao nhiêu vé, kinh hàng nào/bao nhiêu vé, tiền thưởng, tiền ròng (thắng `+` xanh / thua `−` đỏ).
5. **🔄 QUAY TIẾP LƯỢT MỚI** hoặc **Kết thúc & Lưu** (ghi vào `data/history.json`).

## Cài đặt & chạy
Yêu cầu **Node.js LTS** (https://nodejs.org).

| Hệ điều hành | Lệnh |
|---|---|
| Windows | double-click `Chay-May-Chu.cmd` |
| Mac / Linux | `chmod +x Chay-May-Chu.sh && ./Chay-May-Chu.sh` |
| Mọi nơi | `npm install` rồi `npm start` |

Mở `http://localhost:3000`. Điện thoại cùng mạng mở `http://<IP-máy>:3000`.

## Chạy qua internet với Cloudflare Tunnel (không cần tài khoản/domain)
GitHub **không host được** app này (chỉ chạy file tĩnh, không chạy Node + Socket.IO). Dùng Cloudflare Quick Tunnel để lấy domain tạm `https://xxx.trycloudflare.com`:

1. Cài `cloudflared`:
   - Windows: `winget install --id Cloudflare.cloudflared`
   - Mac: `brew install cloudflare/cloudflare/cloudflared`
   - Hoặc tải từ https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
2. Chạy:
   - Windows: double-click **`Chay-Cloudflare.cmd`**
   - Mac/Linux: `chmod +x Chay-Cloudflare.sh && ./Chay-Cloudflare.sh`
   - Hoặc thủ công: `cloudflared tunnel --url http://localhost:3000`, copy URL in ra, rồi `set PUBLIC_URL=https://xxx.trycloudflare.com && npm start`
3. Server sẽ **tự đổi QR thành public URL** (log hiện `🌐 Chế độ PUBLIC (Cloudflare tunnel) đang bật`). Gửi URL này cho người chơi — họ ở đâu cũng vào được.

**Giới hạn của Quick Tunnel** (theo Cloudflare): URL **đổi mỗi lần chạy lại** (phải gửi URL/QR mới), không bảo hành uptime, tối đa 200 request đang xử lý, **không hỗ trợ SSE** (app dùng WebSocket nên không ảnh hưởng). Muốn domain cố định → dùng Cloudflare Tunnel có tài khoản + domain riêng.

## Màn hình TV & xuất sang TV
- Trang quản lý bấm **📺 Xuất ra TV**, có 3 cách:
  1. **🔌 Cáp HDMI** — mở `/tv.html`, cắm cáp, F11 (Mac `⌃⌘F`).
  2. **📶 WiFi / mạng nội bộ** — server quét subnet `/24`, liệt kê các màn hình đang mở `/tv.html` (tự đăng ký tên + IP, đổi tên bằng ✏️ trên TV). Chọn TV → **XUẤT SANG TV NÀY** → TV hiện banner nhận xuất và tự fullscreen.
  3. **🪞 Chiếu màn hình** — hướng dẫn theo OS (tự nhận diện): Windows `Win+K` (Miracast), Mac Control Center → Screen Mirroring (AirPlay).
- TV hiện: số xổ to, banner KINH, QR, danh sách người chốt, mức cược/tổng giải; khi kết thúc lượt hiện tổng kết tiền ròng.
- **📱 Xem trước ĐT** trên trang quản lý: khung điện thoại giả lập để test vé (không tính vào 200 vé).

## Dùng trang quản lý trên điện thoại
Được — mở `http://<IP-máy>:3000` (không dùng `localhost`). Đã có CSS responsive ≤640px. Tuy nhiên dùng máy tính/TV để điều khiển và xem tổng kết tiện hơn.

## Font chữ
**Be Vietnam Pro** (nội dung, đầy đủ dấu tiếng Việt) + **Baloo 2** (tiêu đề, số to, nút bấm, số trên vé). Font lưu locally tại `public/fonts/` → chạy LAN không cần internet.

## Cấu trúc
```
lototet/
├─ server.js              # Express + Socket.IO, vé 9x9, tự xổ, QR public, dò TV
├─ package.json
├─ Chay-May-Chu.cmd       # Windows
├─ Chay-May-Chu.sh        # Mac/Linux
├─ Chay-Cloudflare.cmd    # Windows + Cloudflare Tunnel
├─ Chay-Cloudflare.sh     # Mac/Linux + Cloudflare Tunnel
├─ data/                  # history.json, game-state.json (tự tạo)
└─ public/
   ├─ index.html          # Màn hình chính
   ├─ play.html           # Trang người chơi
   ├─ tv.html             # Màn hình TV
   ├─ css/  (style.css, tv.css)
   ├─ js/   (host.js, player.js, tv.js)
   └─ fonts/ (6 file TTF)
```

## Lưu ý mạng
- Cổng **3000** (đổi bằng biến `PORT`). Firewall cho phép cổng 3000 để QR, dò TV và truy cập từ điện thoại.
- Không set `PUBLIC_URL`: QR dùng IP LAN (`getLocalIP()` trong `server.js`). Có set: QR dùng domain tunnel.
- Muốn giữ lịch sử khi chuyển máy: copy thư mục `data/`.
