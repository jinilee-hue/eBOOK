/* ══════════════════════════════════════════════════════════════
   voice.js — 미리 만들어 둔 낭독 음성 재생

   쪽마다 mp3 하나와 낱말·문장 시각(js/align.js)이 있다.
   낭독·따라읽기·문장발음·낱말발음이 전부 이 한 파일에서 나온다 —
   그래서 목소리가 갈릴 수 없고, 하이라이트가 추정이 아니라 실제 위치다.

   브라우저의 onboundary 에 기대지 않으므로 iOS 에서도 같게 동작한다.
   파일이 없으면 조용히 false 를 돌려준다. 부르는 쪽이 내장 음성으로 내려가면 된다.
   ══════════════════════════════════════════════════════════════ */

window.MOC = window.MOC || {};

window.MOC.Voice = (function () {
  var DIR = 'assets/audio/';
  var el = null;          /* 재생 중인 <audio> */
  var raf = 0;
  var token = 0;          /* 이전 재생을 무효화하는 표 */

  function data(n) {
    var a = window.MOC.ALIGN;
    return (a && a[n]) || null;
  }
  function has(n) { return !!data(n); }

  function stop() {
    token++;
    cancelAnimationFrame(raf); raf = 0;
    if (!el) return;
    el.dead = true;
    el.pause();
    el.removeAttribute('src');
    el = null;
  }

  /* 지금 시각에 해당하는 낱말 번호. 이분 탐색 — 낱말이 백 개라 선형도 되지만
     매 프레임 도는 자리라 습관을 들여 둔다. */
  function wordAt(words, t) {
    var lo = 0, hi = words.length - 1, hit = -1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (words[mid].t <= t) { hit = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    return hit;
  }

  /* 구간 재생.
     opts = { from, to, onWord(낱말번호, 글자위치), onEnd(끝까지갔나) } */
  function play(n, opts) {
    opts = opts || {};
    var d = data(n);
    if (!d) return false;
    stop();

    var my = ++token;
    var a = new Audio(DIR + d.file);
    a.preload = 'auto';
    a.volume = 1;                       /* 음량은 파일에서 이미 맞췄다. 여기서 키우지 않는다 */
    el = a;

    var from = opts.from == null ? 0 : opts.from;
    var to   = opts.to;
    var last = -1;

    var finish = function (ok) {
      if (my !== token) return;
      cancelAnimationFrame(raf); raf = 0;
      if (el === a) { a.pause(); el = null; }
      if (opts.onEnd) opts.onEnd(ok);
    };

    var step = function () {
      if (my !== token) return;
      var t = a.currentTime;
      if (to != null && t >= to) { finish(true); return; }
      var i = wordAt(d.words, t);
      if (i !== last) {
        last = i;
        if (i >= 0 && opts.onWord) opts.onWord(i, d.words[i].c);
      }
      raf = requestAnimationFrame(step);
    };

    a.addEventListener('loadedmetadata', function () {
      if (my !== token) return;
      try { a.currentTime = from; } catch (e) {}
    });
    a.addEventListener('ended', function () { finish(true); });
    a.addEventListener('error', function () {
      if (a.dead) return;              /* 멈추느라 뗀 것이지 실패가 아니다 */
      finish(false);
    });

    var start = function () {
      if (my !== token) return;
      try { if (Math.abs(a.currentTime - from) > 0.05) a.currentTime = from; } catch (e) {}
      raf = requestAnimationFrame(step);
    };
    if (a.readyState >= 1) start();
    else a.addEventListener('loadeddata', start, { once: true });

    var pr = a.play();
    if (pr && pr.catch) pr.catch(function () { if (!a.dead) finish(false); });
    return true;
  }

  /* 문장 하나. i 는 그 쪽 lines 배열의 번호 */
  function playLine(n, i, opts) {
    var d = data(n);
    if (!d) return false;
    var L = d.lines[i];
    if (!L) return false;
    opts = opts || {};
    opts.from = L.t;
    opts.to = L.t1 + 0.12;             /* 끝소리가 잘리지 않게 살짝 여유 */
    return play(n, opts);
  }

  /* 낱말 하나. c 는 그 쪽 본문에서의 글자 위치 */
  function playWord(n, c, opts) {
    var d = data(n);
    if (!d) return false;
    var w = null;
    for (var i = 0; i < d.words.length; i++) {
      if (d.words[i].c === c) { w = d.words[i]; break; }
    }
    if (!w) return false;
    opts = opts || {};
    opts.from = Math.max(0, w.t - 0.04);
    opts.to = w.t1 + 0.10;
    return play(n, opts);
  }

  /* 여러 문장을 이어서. lines 는 번호 배열 */
  function playLines(n, idx, opts) {
    var d = data(n);
    if (!d || !idx.length) return false;
    var a = d.lines[idx[0]], z = d.lines[idx[idx.length - 1]];
    if (!a || !z) return false;
    opts = opts || {};
    opts.from = a.t;
    opts.to = z.t1 + 0.12;
    return play(n, opts);
  }

  return {
    has: has, play: play, playLine: playLine, playWord: playWord,
    playLines: playLines, stop: stop,
    get playing() { return !!el; },
    /* 검증용 */
    info: function (n) { var d = data(n); return d ? { file: d.file, words: d.words.length,
                                                        lines: d.lines.length, dur: d.duration } : null; }
  };
})();
