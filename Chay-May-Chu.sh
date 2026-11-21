#!/bin/bash
# ============================================================
#  XỔ LÔ TÔ TẾT - Máy chủ (macOS / Linux)
#  Cấp quyền: chmod +x Chay-May-Chu.sh  rồi  ./Chay-May-Chu.sh
# ============================================================
cd "$(dirname "$0")" || exit 1

echo ""
echo "  ============================================"
echo "    XO LO TO TET - DANG KHOI DONG MAY CHU"
echo "  ============================================"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "  Chua co Node.js. Cai tai https://nodejs.org (ban LTS)."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "  Dang cai dat dependencies lan dau..."
  npm install
fi

echo ""
echo "  Mo trinh duyet: http://localhost:3000"
echo "  Dien thoai quet QR tren man hinh chinh."
echo "  De tat server: nhan Ctrl + C"
echo ""
npm start
