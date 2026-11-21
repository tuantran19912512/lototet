#!/bin/bash
# ============================================================
#  XỔ LÔ TÔ TẾT - Chạy qua internet bằng Cloudflare Quick Tunnel
#  Cài cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
#    macOS: brew install cloudflare/cloudflare/cloudflared
# ============================================================
cd "$(dirname "$0")" || exit 1

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "Chua co cloudflared. Cai: brew install cloudflare/cloudflare/cloudflared"
  exit 1
fi
if [ ! -d "node_modules" ]; then npm install; fi

echo "Dang khoi dong cloudflared quick tunnel..."
PUBLIC_URL=$(cloudflared tunnel --url http://localhost:3000 2>&1 | grep -o 'https://[^[:space:]]*trycloudflare.com' | head -n 1)

if [ -z "$PUBLIC_URL" ]; then
  echo "Khong doc duoc URL. Kiem tra lai mang."
  exit 1
fi

echo ""
echo ">>> PUBLIC URL: $PUBLIC_URL"
echo ">>> Trang quan ly: http://localhost:3000"
echo ">>> QR se doi thanh public URL. Gui URL nay cho nguoi choi."
echo ">>> LUU Y: URL thay doi moi lan chay!"
echo ""
PUBLIC_URL="$PUBLIC_URL" npm start
