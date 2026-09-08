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
  var WDIR = 'assets/audio-word/';   /* 낱말마다 따로 만들어 둔 발음 */

  /* ── 낱말 발음 ──
     쪽 낭독에서 잘라 쓰면 이어 말하는 자리에서 앞뒤가 딸려 나온다.
     낱말 사이에 무음이 없으니 어디서 잘라도 그렇다 — 경계를 소리로 다시 잡고
     이웃으로 잘라 내도 조용한 자리에서 끊긴 것은 41%뿐이었다.
     자를 일을 없애는 편이 낫다. 낱말 하나만 읽은 파일을 따로 둔다.
     파일 이름은 낱말 그림과 같은 규칙 — 아포스트로피를 뗀다. */
  var wordEl = null;
  function wordFile(key) {
    return WDIR + String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '') + '.mp3';
  }
  function stopWordFile() {
    if (!wordEl) return;
    wordEl.dead = true;
    wordEl.pause();
    wordEl.removeAttribute('src');
    wordEl = null;
  }
  /* 파일이 있으면 그것으로 들려주고 true, 없으면 false 를 돌려준다.
     부르는 쪽은 false 일 때만 잘라 쓰기로 내려가면 된다. */
  function sayWord(key, done) {
    if (!key) return false;
    stop();
    stopWordFile();
    var a = new Audio(wordFile(key));
    a.preload = 'auto';
    a.volume = vol;
    try { a.playbackRate = rate; } catch (e) {}
    wordEl = a;
    var fin = function (ok) {
      if (wordEl !== a) return;
      wordEl = null;
      if (done) done(ok);
    };
    a.addEventListener('ended', function () { fin(true); });
    a.addEventListener('error', function () { if (!a.dead) fin(false); });
    var pr = a.play();
    if (pr && pr.catch) pr.catch(function () { if (!a.dead) fin(false); });
    return true;
  }
  /* 파일이 실제로 있는지는 미리 알 수 없다(HEAD 를 쏘면 느리다).
     그래서 재생을 걸어 보고 error 가 나면 부르는 쪽이 폴백한다. */
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
    stopWordFile();
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
    a.volume = vol;                     /* 음량은 파일에서 이미 맞췄다. 여기서 키우지 않는다 */
    try { a.playbackRate = rate; a.volume = vol; } catch (e) {}
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

    var FADE = 0.045;                   /* 자르는 자리를 부드럽게 */
    var step = function () {
      if (my !== token) return;
      var t = a.currentTime;
      /* 이어 말하는 자리에는 낱말 사이에 무음이 없다. 그대로 끊으면 앞뒤가
         '툭' 하고 잘려 이웃 낱말의 조각처럼 들린다. 양끝만 짧게 여닫는다. */
      if (opts.fade) {
        var g = 1;
        if (t - from < FADE) g = Math.max(0, (t - from) / FADE);
        if (to != null && to - t < FADE) g = Math.min(g, Math.max(0, (to - t) / FADE));
        try { a.volume = vol * g; } catch (e) {}
      }
      /* 자리 옮기기가 먹지 않았다면 앞부분이 통째로 나간다. 한 번 더 시도한다. */
      if (from > 0.05 && t < from - 0.5) {
        try { a.currentTime = from; } catch (e) {}
        raf = requestAnimationFrame(step);
        return;
      }
      if (to != null && t >= to) { finish(true); return; }
      var i = wordAt(d.words, t);
      if (i !== last) {
        last = i;
        if (i >= 0 && opts.onWord) opts.onWord(i, d.words[i].c);
      }
      raf = requestAnimationFrame(step);
    };

    a.addEventListener('ended', function () { finish(true); });
    a.addEventListener('error', function () {
      if (a.dead) return;              /* 멈추느라 뗀 것이지 실패가 아니다 */
      finish(false);
    });

    /* 반드시 자리를 옮긴 뒤에 재생을 시작한다.
       먼저 play() 를 부르면 0초부터 소리가 나가고, 그 뒤에 옮겨 봐야 이미 늦다 —
       낱말 하나를 누른 것이 앞 문장 전체를 읽는 일이 된다. */
    var begin = function () {
      if (my !== token || a.dead) return;
      try { a.currentTime = from; } catch (e) {}
      raf = requestAnimationFrame(step);
      var pr = a.play();
      if (pr && pr.catch) pr.catch(function () { if (!a.dead) finish(false); });
    };
    if (a.readyState >= 1) begin();                       /* 이미 받아 둔 파일 */
    else a.addEventListener('loadedmetadata', begin, { once: true });
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
    var to = Math.max(L.t1, L.t + 0.6) + 0.12;    /* 끝소리가 잘리지 않게 살짝 여유 */
    var nx = d.lines[i + 1];                      /* 다음 문장을 물지 않는다 */
    if (nx) to = Math.min(to, Math.max(L.t1, nx.t - 0.04));
    opts.to = to;
    opts.fade = true;
    return play(n, opts);
  }

  /* 낱말 하나. c 는 그 쪽 본문에서의 글자 위치.

     그 낱말만 들려야 한다. 앞뒤로 여유를 주면 이웃 낱말이 함께 나가는데,
     정렬값 자체가 다음 낱말을 침범하는 경우도 있어(960개 중 38개) 여유만
     줄여서는 모자란다. 이웃의 시각으로 잘라 낸다. */
  var WORD_MIN = 0.22;    /* 정렬이 짧게 잡힌 낱말이라도 이만큼은 들려야 한다 */
  var WORD_MAX = 0.90;    /* 정렬이 이보다 길게 잡혔다면 그것은 틀린 값이다.
                             낱말 길이 중앙값이 0.34초다 — 0.9초면 넉넉하다 */
  var EDGE     = 0.02;    /* 이웃과의 사이에 남기는 틈 */

  function playWord(n, c, opts) {
    var d = data(n);
    if (!d) return false;
    var i = -1;
    for (var k = 0; k < d.words.length; k++) {
      if (d.words[k].c === c) { i = k; break; }
    }
    if (i < 0) return false;
    var w = d.words[i], prev = d.words[i - 1], next = d.words[i + 1];
    opts = opts || {};

    /* 앞 — 이전 낱말의 끝을 넘어가지 않는다 */
    var from = w.t - 0.03;
    if (prev) from = Math.max(from, prev.t1 + EDGE * 0.5);
    from = Math.max(0, Math.min(from, w.t));

    /* 뒤 — 다음 낱말이 시작하기 전에 끊는다 */
    var to = Math.max(w.t1, w.t + WORD_MIN) + 0.05;
    to = Math.min(to, w.t + WORD_MAX);
    if (next) to = Math.min(to, next.t - EDGE);

    /* 다음 낱말이 바로 붙어 있어 자를 자리가 없으면 정렬값 그대로 쓴다 */
    if (to <= from + 0.10) to = Math.max(w.t1, from + 0.14);

    opts.from = from;
    opts.to = to;
    opts.fade = true;
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

  /* 재생 속도. 하이라이트는 currentTime 을 보고 짚으므로 속도를 바꿔도 따라온다 */
  var rate = 1;
  function setRate(r) {
    rate = r;
    if (el) { try { el.playbackRate = r; } catch (e) {} }
  }
  /* 소리 크기. 파일 자체는 이미 -14 LUFS 로 맞춰 두었으므로 여기서는 줄이기만 한다 —
     1을 넘겨 키우면 튀는 구간이 잘려 나간다. */
  var vol = 1;
  function setVolume(v) {
    vol = Math.max(0, Math.min(1, v));
    if (el) { try { el.volume = vol; } catch (e) {} }
  }

  return {
    has: has, play: play, playLine: playLine, playWord: playWord, sayWord: sayWord,
    playLines: playLines, stop: stop, setRate: setRate, setVolume: setVolume,
    get rate() { return rate; },
    get volume() { return vol; },
    /* 지금 재생 위치. 화면을 다시 그린 뒤 하이라이트를 그 자리에 맞출 때 쓴다 */
    get time() { return el ? el.currentTime : 0; },
    get playing() { return !!el; },
    /* 검증용 */
    info: function (n) { var d = data(n); return d ? { file: d.file, words: d.words.length,
                                                        lines: d.lines.length, dur: d.duration } : null; }
  };
})();
