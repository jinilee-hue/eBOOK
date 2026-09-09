#!/bin/bash
# tools/resume_test.py 가 만든 _resume_test.html 을 헤드리스로 태운다.
#   python3 tools/resume_test.py && bash tools/resume_run.sh
# RESUMED@N 이면 통과, RESTARTED 면 처음으로 되감긴 것이다.
cd "$(dirname "$0")/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT=8901
python3 -m http.server $PORT >/dev/null 2>&1 &
SRV=$!
sleep 1
DOM=$("$CHROME" --headless=new --disable-gpu --window-size=1194,834 --virtual-time-budget=15000 \
      --dump-dom "http://localhost:$PORT/_resume_test.html" 2>/dev/null)
kill $SRV 2>/dev/null
wait $SRV 2>/dev/null
printf '%s' "$DOM" | grep -o 'id="TESTOUT">[^<]*' | sed 's|id="TESTOUT">||' | head -1
