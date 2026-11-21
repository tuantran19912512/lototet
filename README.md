# 🧧 XỔ LÔ TÔ NGÀY TẾT (vé 9×9)

Repo: **https://github.com/tuantran19912512/lototet**

Trang chơi lô tô chạy trên **LAN**: màn hình chính (host), trang người chơi (điện thoại quét QR) và màn hình TV chiếu riêng. Không cần internet, không cần domain.

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

## Cài đặt & chạy (LAN)
Yêu cầu **Node.js LTS** (https://nodejs.org).

| Hệ điều hành | Lệnh |
|---|---|
| Windows | double-click `Chay-May-Chu.cmd` |
| Mac / Linux | `chmod +x Chay-May-Chu.sh && ./Chay-May-Chu.sh` |
| Mọi nơi | `npm install` rồi `npm start` |

- Máy chủ: `http://localhost:3000` (có thể chiếu ra TV/máy chiếu).
- Điện thoại **cùng Wi-Fi/LAN**: quét QR trên màn hình chính, hoặc mở `http://<IP-máy-chủ>:3000/play.html`.
- Firewall: cho phép cổng **3000** (đổi cổng bằng biến `PORT` nếu cần).
- QR tự động lấy IP LAN đầu tiên (`getLocalIP()` trong `server.js`). Nếu máy có nhiều card mạng (Wi-Fi + Ethernet + card ảo) mà QR sai IP, tắt card ảo hoặc sửa hàm `getLocalIP()`.
- Muốn giữ lịch sử khi chuyển máy: copy thư mục `data/`.

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
├─ server.js              # Express + Socket.IO, vé 9x9, tự xổ, QR LAN, dò TV
├─ package.json
├─ Chay-May-Chu.cmd       # Windows
├─ Chay-May-Chu.sh        # Mac/Linux
├─ data/                  # history.json, game-state.json (tự tạo)
└─ public/
   ├─ index.html          # Màn hình chính
   ├─ play.html           # Trang người chơi
   ├─ tv.html             # Màn hình TV
   ├─ css/  (style.css, tv.css)
   ├─ js/   (host.js, player.js, tv.js)
   └─ fonts/ (6 file TTF)
```
