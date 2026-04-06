#!/bin/bash
PI_USER="hiejima"
PI_HOST="192.168.100.102"
PI_DIR="/home/hiejima/Desktop/MyReservationApp"
JAR="build/libs/myapp-0.0.1-SNAPSHOT.jar"

echo "=== JARを転送中 ==="
scp "$JAR" "${PI_USER}@${PI_HOST}:${PI_DIR}/build/libs/"

echo "=== アプリを再起動中 ==="
ssh "${PI_USER}@${PI_HOST}" "pkill -f myapp; sleep 2; cd ${PI_DIR} && nohup bash start.sh > logs/app.log 2>&1 &"

echo "=== 完了 ==="
