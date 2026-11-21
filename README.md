# 🧧 XỔ LÔ TÔ NGÀY TẾT (vé 9×9)

Trang chơi lô tô trên **LAN**: màn hình chính (host) + trang người chơi trên điện thoại (quét QR).

## Luật chơi / cấu trúc vé
- **Vé 9 ô ngang × 9 ô dọc** (81 ô).
- **Mỗi hàng 9 ô: đục 4 ô → còn đúng 5 ô có số** → mỗi vé 45 số, không dày.
- **Mỗi cột là một chục**: cột 1 = 1–9, cột 2 = 10–19, …, cột 9 = 80–90.
- Số trong **mỗi cột xếp tăng dần từ trên xuống** (số nhỏ nhất ở hàng đầu). Vị trí các lỗ xáo trộn nên vé nào cũng khác nhau.
- Khi tạo kho **200 vé**, server so sánh chữ ký toàn bộ lưới (số + ô đục) và **sinh lại ngay nếu trùng** → đảm bảo 200 vé khác biệt. Lúc khởi động có log báo số vé trùng (luôn là 0).
- **KINH khi một hàng ngang đủ toàn bộ số** (không cần đủ cả vé).
- Khi một hàng **còn đúng 1 số**: điện thoại hiện **"Hàng N còn 1 số — đang đợi số XX"** + badge ngay trên hàng.
- Tiền giải **chia đều** cho tất cả các hàng kinh (`Tổng giải / số hàng kinh`).

## Luồng tham gia
1. Quét QR → nhập tên → chọn **Số vé muốn mua (1–4)** → nhận các **vé random** trong kho **200 vé** (mã `V001`…`V200`). Ô **SỐ VỪA XỔ** nằm ngay đầu trang để dễ nhìn. Mua nhiều vé thì dùng các tab **Vé 1 / Vé 2…** để chuyển đổi; nút Đổi vé đổi vé đang chọn, nút Chốt vé chốt tất cả.
2. Nhấn **🔄 ĐỔI VÉ** để đổi sang bộ vé khác (có thể đổi nhiều lần, trước khi chốt).
3. Ứng ý thì nhấn **🔒 CHỐT VÉ** → tên và mã vé hiện ngay trong **danh sách người chơi đã chốt** trên màn hình chính. Sau khi chốt **không đổi vé được nữa**.
4. Chọn một trong hai cách xổ:
   - **🎲 XỔ SỐ NGAY**: số quay nhanh rồi **chậm dần ~6 giây** mới dừng (chỉnh **Thời gian quay** 2–15s). Bấm liên tục sẽ bị từ chối.
   - **🤖 TỰ XỔ ĐẾN KHI CÓ KINH**: server tự xổ từng số (dùng **Quay tự động**, mặc định 2s/lượt, chỉnh 0.3–15s) và **tự dừng ngay khi có người kinh**. Nút biến thành **⏹ DỪNG TỰ XỔ** nếu muốn dừng sớm.
5. Khi tự xổ dừng, màn hình chính hiện **bảng tổng kết**: tổng giải, tiền mỗi kinh, danh sách từng người (số vé, tiền cược, số hàng kinh, tiền thưởng) và **số tiền ròng** — thắng `+Xđ` (xanh), thua `-Xđ` (đỏ). Có nút **🔄 QUAY TIẾP LƯỢT MỚI** (tạo ván mới) hoặc **ĐÓNG**.
5. Khi trúng hàng → điện thoại báo **KINH** (rung + pháo hoa), bấm gửi phản hồi → hiện trên màn hình chính.
6. **Kết thúc & Lưu** ghi ván vào lịch sử; **Ván mới** phát lại 200 vé.

## Tính năng
- 📱 Quét QR tự lấy IP LAN.
- 🎫 200 vé random, đổi/chốt vé.
- ✅ Danh sách **người đã chốt** trên màn hình chính (tên + mã vé + số kinh).
- 🔢 Số xổ to, rõ, hiệu ứng + tiếng beep.
- ⏳ Báo "đợi số XX" khi hàng còn 1 số.
- 🏆 Báo KINH trên điện thoại, phản hồi về màn hình chính.
- 💾 Lưu mọi lượt xổ + lịch sử ván (`data/history.json`, `data/game-state.json`).

## Cài đặt & chạy
```bash
cd E:\Tools_Vip\Tools\lototet
npm install
npm start
```
Hoặc double-click `Chay-May-Chu.cmd`. Server tại `http://localhost:3000`.

## Cấu hình trên màn hình chính
- **Số vé (tối đa)** — mặc định `200` (có thể chỉnh).
- **Tổng tiền giải được tính tự động**, KHÔNG cố định: `Tổng giải = số vé đã bán × mức cược/vé`. Ví dụ bán 200 vé × 5.000đ = **1.000.000đ**.
- **Mức cược mỗi vé (VNĐ)** — mặc định `5.000đ/vé`; hiện trên TV và dùng để tính ví người chơi.
- Tiền giải chia đều cho các hàng kinh: `prizePerWinner = Tổng giải ÷ số hàng kinh`.
- Mọi số tiền đều hiển thị có dấu `.` phân tách hàng nghìn (vd `1.000.000đ`).

## Ví tiền trên điện thoại
- Trang người chơi có ví: **Số dư = Đã nạp − Đã trừ cược + Đã tích thưởng**.
- Khi nhận vé, hệ thống trừ `số vé × mức cược`; mỗi lần KINH cộng thêm tiền thưởng tương ứng.
- Có ô **Nạp tiền** để tăng số dư. Ví lưu trong trình duyệt (`localStorage`); vé xem trước không bị trừ tiền.

## Cấu trúc
```
lototet/
├─ server.js              # Express + Socket.IO, lưới vé 9x9, đổi/chốt vé, luật KINH
├─ package.json
├─ Chay-May-Chu.cmd
├─ data/                  # history.json, game-state.json (tự tạo)
└─ public/
   ├─ index.html          # Màn hình chính (+ danh sách người đã chốt)
   ├─ play.html           # Trang người chơi (+ Đổi vé / Chốt vé)
   ├─ css/style.css
   └─ js/host.js, player.js
```

## Màn hình TV (chiếu riêng)
- Trang quản lý: `http://localhost:3000`
  - **📱 Xem trước ĐT**: mở khung điện thoại ngay trên trang quản lý để kiểm tra vé, đổi/chốt vé, banner đợi số và KINH. Vé xem trước là vé riêng, **không tính vào 200 vé** và **không hiện trong danh sách người chốt**.
  - **📺 Màn hình TV**: mở tab màn hình chiếu.
- Màn hình TV: `http://<IP-máy>:3000/tv.html` — đem đi toàn màn hình trên TV/máy chiếu (nhấn F11).
- TV hiện **số xổ cực to**, hiệu ứng quay đồng bộ với trang quản lý, lịch sử các số gần đây, và **banner người KINH ngay trong từng lượt** (tên, hàng, vị trí, tiền thưởng).
- Cả hai trang nhận cùng dữ liệu realtime từ server; không cần cấu hình thêm.

## Font chữ
- **Be Vietnam Pro** (thiết kế riêng cho tiếng Việt, đầy đủ dấu) cho toàn bộ nội dung.
- **Baloo 2** (nét bo tròn, vui tươi hợp ngày Tết) cho tiêu đề, số xổ to, nút bấm và số trên vé.
- Font được lưu locally tại `public/fonts/` → **chạy LAN không cần internet**.

## Lưu ý mạng
- Cổng **3000** (đổi bằng biến `PORT`). Điện thoại cùng mạng, firewall cho phép cổng 3000.
- QR dùng IP LAN đầu tiên (`getLocalIP()` trong `server.js`).
