# -*- coding: utf-8 -*-
"""
resume_test.py — 카드를 닫으면 멈춘 자리에서 이어 읽는가

헤드리스에는 소리가 없다. <audio> 를 만들어도 currentTime 이 0 에 머물러
"어디부터 이어 읽었는가"를 볼 수 없다 — 오류만 안 나면 통과가 되어 버린다.
실제로 이 검사가 없던 동안 이어 읽기가 처음으로 되감기는 버그가 배포까지 나갔다.

그래서 Voice 를 시계 도는 가짜로 갈아 끼운 flow.html 사본을 만든다.
낭독 → 낱말 카드 열기 → 닫기 를 태우고, 두 번째 play 의 from 이 0 이 아니면 통과.

  python3 tools/resume_test.py && bash tools/resume_run.sh
"""
import io, re
src = io.open('flow.html', encoding='utf-8').read()

STUB = u"""
<script>
/* ── 검사용 가짜 Voice ──
   헤드리스에는 소리가 없어 currentTime 이 0 에 머문다. 그러면 "이어 읽는 자리"를
   검증할 수 없다. 시계를 직접 돌려 진짜 Voice 와 같은 겉모습만 흉내 낸다. */
(function () {
  var LOG = window.__LOG = [];
  var clock = 0, timer = 0, cur = null, curN = 0;
  function cAt(n, t) {
    var A = window.MOC.ALIGN && window.MOC.ALIGN[n];
    if (!A) return 0;
    var c = 0;
    for (var i = 0; i < A.words.length; i++) { if (A.words[i].t <= t) c = A.words[i].c; else break; }
    return c;
  }
  function halt() { clearInterval(timer); timer = 0; cur = null; }
  window.MOC.Voice = {
    has: function () { return true; },
    play: function (n, opts) {
      opts = opts || {};
      halt();
      cur = opts; curN = n; clock = opts.from || 0;
      LOG.push('play from=' + clock.toFixed(2));
      timer = setInterval(function () {
        if (!cur) return;
        clock += 0.10;                       /* 실시간의 5배로 감는다 */
        if (cur.to != null && clock >= cur.to) { var o = cur; halt(); if (o.onEnd) o.onEnd(true); return; }
        if (cur.onWord) cur.onWord(0, cAt(curN, clock));
      }, 20);
      return true;
    },
    playLine: function () { LOG.push('playLine'); return true; },
    playWord: function () { LOG.push('playWord'); return true; },
    sayWord: function (k, done) { LOG.push('sayWord ' + k); setTimeout(function () { done && done(true); }, 30); return true; },
    stop: function () { LOG.push('stop@' + (cur ? clock.toFixed(2) : '-')); halt(); },
    setRate: function () {}, setVolume: function () {}, volume: 1,
    get time() { return cur ? clock : 0; },
    get playing() { return !!cur; }
  };
})();
</script>
"""

DRIVER = u"""
<script>
(function () {
  var L = window.__LOG;
  var notes = [];
  var ci = console.info.bind(console);
  console.info = function () { notes.push([].join.call(arguments, ' ')); ci.apply(null, arguments); };
  function q(s) { return document.querySelector(s); }
  function click(el) { if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
  function done(verdict) {
    var d = document.createElement('div');
    d.id = 'TESTOUT';
    d.textContent = 'VERDICT ' + verdict + ' || LOG ' + L.join(' | ') + ' || INFO ' + notes.join(' / ');
    document.body.appendChild(d);
  }
  var steps = [
    function () { click(q('#gate')); },
    /* 미리보기 중에는 read=on 이라도 flowPeeking 이라 낭독이 안 붙는다.
       #fold 를 눌러 '사람이 정한 상태'로 만든다. */
    function () { click(q('#fold')); },
    function () { if (q('#app').dataset.read !== 'on') click(q('#fold')); },
    /* 그래도 안 읽으면 따라 읽기 버튼으로 직접 켠다 */
    function () { if (!L.some(function (s) { return s.indexOf('play from=') === 0; })) click(q('#hl')); },
    function () { /* 읽는 중이 되도록 둔다 — 시계가 5배로 감긴다 */ },
    function () {
      var w = q('#body .w');
      if (!w) { done('NOWORD read=' + q('#app').dataset.read); throw 0; }
      click(w);
    },
    function () { click(q('#m-close')); },
    function () {
      var plays = L.filter(function (s) { return s.indexOf('play from=') === 0; });
      var last = plays[plays.length - 1] || '';
      var t = parseFloat(last.replace('play from=', ''));
      done(plays.length >= 2 && t > 0.05 ? ('RESUMED@' + t) : ('RESTARTED plays=' + plays.length + ' t=' + t));
    }
  ];
  var i = 0;
  function tick() {
    if (i >= steps.length) return;
    try { steps[i++](); } catch (e) { return; }
    setTimeout(tick, i === 5 ? 900 : 500);
  }
  setTimeout(tick, 1200);
})();
</script>
"""

out = src.replace('<script src="js/flow.js', STUB + '<script src="js/flow.js')
assert out != src
out = out.replace('</body>', DRIVER + '</body>')
io.open('_resume_test.html', 'w', encoding='utf-8').write(out)
print('wrote _resume_test.html')
