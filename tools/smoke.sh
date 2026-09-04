#!/bin/bash
# 부팅 연기 검사 — 문법이 아니라 "실제로 그려지는가"를 본다.
# new Function(src) 구문 검사는 지워진 함수를 못 잡는다. 실행해 봐야 안다.
#   bash tools/smoke.sh
cd "$(dirname "$0")/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT=8899
python3 -m http.server $PORT >/dev/null 2>&1 &
SRV=$!
sleep 1
fail=0
for SZ in 1194,834 1024,768; do
  DOM=$("$CHROME" --headless=new --disable-gpu --window-size=$SZ --virtual-time-budget=9000 \
        --dump-dom "http://localhost:$PORT/index.html?dev=1&audit=1" 2>/dev/null)
  sents=$(printf '%s' "$DOM" | grep -o 'class="sent"' | wc -l | tr -d ' ')
  words=$(printf '%s' "$DOM" | grep -o 'class="wd' | wc -l | tr -d ' ')
  verdict=$(printf '%s' "$DOM" | grep -oE '([0-9]+쪽 미달|모두 통과)' | head -1)
  printf "  %-10s 문장 %-3s 단어 %-4s 조판 %s\n" "$SZ" "$sents" "$words" "${verdict:-감사 실패}"
  [ "$sents" -gt 0 ] && [ "$words" -gt 0 ] && [ "$verdict" = "모두 통과" ] || fail=1
done
python3 tools/check_defs.py || fail=1
for f in js/app.js js/tts.js js/scenes.js js/fit.js js/content.js js/dict.js; do
  "/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc" \
    -e "var s=readFile(\"$f\"); try{new Function(s);}catch(e){print('  구문 오류 $f: '+e);quit(1);}" || fail=1
done
kill $SRV 2>/dev/null
[ $fail = 0 ] && echo "  ✓ 통과" || echo "  ✗ 실패"
exit $fail
