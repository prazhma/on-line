#!/usr/bin/env bash
# Двусторонняя синхронизация /volume1/web и gdrive:web
LOCK_FILE="/tmp/rclone_web_sync.lock"
if [ -f "$LOCK_FILE" ]; then
    exit 0
fi
touch "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

/usr/bin/rclone bisync /volume1/web gdrive:web \
    --exclude "@eaDir/**" \
    --exclude "#recycle/**" \
    --exclude "rclone_sync.log" \
    --conflict-resolve newer \
    --log-file "/volume1/web/rclone_sync.log" \
    --log-level INFO

chmod -R 777 /volume1/web 2>/dev/null
