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
- **Tiền thu hiện tại** = `số vé đã CHỐT × mức cược/vé`, hiển thị realtime trên màn hình chính và TV (vd `15.000đ (3 vé)`). Vé mới nhận nhưng chưa chốt **không tính** vào tiền thu.
- **Tổng giải tự tính** = tiền thu hiện tại (không có giải cố định). Mặc định 5.000đ/vé → 200 vé = 1.000.000đ.
- **Tiền mỗi kinh** = `Tổng giải ÷ số hàng kinh`.
- Ví trên điện thoại: **Số dư = Đã nạp − Đã trừ cược + Đã tích thưởng** (lưu `localStorage`; vé xem trước không trừ tiền).
- **Lịch sử thắng**: mỗi lần KINH được ghi nhận (thời gian, mã vé, hàng kinh, kinh thứ mấy, số tiền). Trong ví, dòng **"Đã tích thưởng"** hiện `tổng tiền · N lượt`; bấm **🏆 Lịch sử thắng** để xem danh sách từng lần — kể cả khi người chơi thắng qua nhiều lượt/ván. Lưu tối đa 200 lượt gần nhất trên trình duyệt.
- Mọi số tiền có dấu `.` hàng nghìn (vd `1.000.000đ`).

## Luồng chơi
1. Quét QR → nhập tên → chọn **Số vé muốn mua (1–4)** → nhận vé random. Ô **SỐ VỪA XỔ** nằm đầu trang.
2. Chọn **🔄 ĐỔI VÉ** nếu chưa ưng, rồi **🔒 CHỐT VÉ** → tên hiện trên màn hình chính/TV.
3. Host bấm:
   - **🎲 XỔ SỐ NGAY**: quay ~6s rồi dừng (chỉnh 2–15s).
   - **🤖 TỰ XỔ ĐẾN KHI CÓ KINH**: quay ~1.2s rồi **số đứng yên ~4 giây** (tổng ~5.2s/lượt) để kịp đọc, tự dừng khi có kinh. Chỉnh **Quay tự động** và **Giữ số sau khi dừng** (200–10000ms) trên màn hình chính. Nút thành **⏹ DỪNG TỰ XỔ**.
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
- TV hiện **lồng cầu quay với 90 trái bi số**: lúc xổ lồng quay, khi ra số thì lồng dừng, **trái bi đó sáng lên và đẩy ra giữa màn hình** (thay cho kiểu nhảy số cũ).
- TV còn có: banner KINH, QR (góc phải), **danh sách người tham gia + số vé họ mua (bên trái)**, mức cược/tổng giải dưới tiêu đề; khi kết thúc lượt, panel trái đổi sang tổng kết tiền ròng của từng người.
- **📱 Xem trước ĐT** trên trang quản lý: khung điện thoại giả lập để test vé (không tính vào 200 vé).

## Dùng trang quản lý trên điện thoại
Được — mở `http://<IP-máy>:3000` (không dùng `localhost`). Đã có CSS responsive ≤640px. Tuy nhiên dùng máy tính/TV để điều khiển và xem tổng kết tiện hơn.

## Âm thanh
- Hiện **chỉ phát âm thanh chúc mừng khi có người KINH** (trên màn hình chính, TV và điện thoại).
- Đặt file `kinh.mp3` vào `public/audio/` để dùng nhạc chúc mừng của bạn. Nếu không có file, app tự phát giai điệu beep dự phòng.
- **Không phát tiếng số, không phát nhạc nền lúc quay** (đã tắt theo yêu cầu). Các file `nhac-nen-1.mp3`, `nhac-nen-2.mp3` vẫn giữ trong thư mục để bạn dùng sau nếu muốn.
- Code xử lý ở `public/js/audio.js`. Cần Chrome/Edge + bật âm lượng; trình duyệt chỉ phát tiếng sau khi bạn tương tác lần đầu với trang (chính sách autoplay).

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
