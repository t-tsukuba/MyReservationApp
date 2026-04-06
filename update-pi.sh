#!/bin/bash
set -e

PI_USER="hiejima"
PI_HOST="192.168.100.102"
PI_DIR="/home/hiejima/Desktop/MyReservationApp"

echo "=== ソースをPiに同期中 ==="
rsync -avz \
  --exclude='.gradle' \
  --exclude='build' \
  --exclude='logs' \
  --exclude='.git' \
  /Users/tsukubatatsuki/Desktop/MyReservationApp/ \
  "${PI_USER}@${PI_HOST}:${PI_DIR}/"

echo "=== Pi側でビルド中 ==="
ssh "${PI_USER}@${PI_HOST}" \
  "cd ${PI_DIR} && chmod +x gradlew && ./gradlew build -x test 2>&1 | tail -8"

echo "=== アプリを再起動中 ==="
ssh "${PI_USER}@${PI_HOST}" \
  "pkill -f myapp 2>/dev/null; sleep 1; cd ${PI_DIR} && mkdir -p logs && nohup bash start.sh > logs/app.log 2>&1 &"

echo ""
echo "=== 完了 ==="
echo "→ http://${PI_HOST}:8080/reservation"
