/* ══════════════════════════════════════════════════════════════
   scenes.js — 배경. 하이브리드 방식
     우선순위: assets/videos/{video} 가 재생되면 그것 → 실패하면 절차적 씬
   규칙
     · 실루엣과 색면만. 고양이 얼굴을 그리지 않는다
     · 30fps로 충분하다 (배터리)
     · prefers-reduced-motion이면 정지 프레임 한 장
     · 쪽 전환은 크로스페이드 0.8s (CSS .layer 트랜지션)
   ══════════════════════════════════════════════════════════════ */

window.MOC = window.MOC || {};

/* ── 미디어에도 판 번호를 붙인다 ──
   HTML 의 ?v= 만 올리고 mp4·jpg 주소는 그대로 두면, 영상을 갈아 끼워도
   브라우저는 캐시에 둔 옛 파일을 계속 쓴다. 화면에는 이전 장면이 나오는데
   디스크의 파일은 새 것이라 원인을 찾기 어렵다. 스크립트에 붙은 번호를
   그대로 물려 쓰면 HTML 을 갱신할 때 미디어도 함께 새로 받는다. */
window.MOC.av = (function () {
  var stamp = '';
  try {
    var el = document.querySelector('script[src*="?v="]');
    var m = el && el.src.match(/[?&]v=(\d+)/);
    if (m) stamp = '?v=' + m[1];
  } catch (e) {}
  return function (url) { return url + stamp; };
})();

window.MOC.Scenes = (function () {

  var REDUCED = false;
  try { REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var STILL_T = 9.0;        /* 정지 프레임을 뽑을 시각 */
  var FRAME_MS = 1000 / 30;
  var FADE_MS = 800;

  var host = null, layers = [], current = null, raf = 0, lastDraw = 0, t0 = 0;
  var status = { key: null, source: '—', note: '' };   /* 검증 패널이 읽는다 */
  var playingVideo = null;   /* 지금 재생 중인 mp4 파일명 */
  var playingEl = null;      /* 그 <video> 요소. 끝났는지 확인해야 한다 */
  /* ── 붙들기 ──
     시작 화면이 떠 있는 동안에도 부팅 때 첫 쪽 영상을 붙인다 — 받아 두어야
     누르는 즉시 나오기 때문이다. 그런데 그대로 두면 가림막 뒤에서 재생이
     흘러가, 시작을 누른 시점에는 이미 중간이다. 그래서 첫 프레임에 세워 두고
     hold(false) 때 0초부터 내보낸다. */
  var held = false;

  /* ── 소리 ──
     브라우저는 소리 있는 자동재생을 막는다. 그래서 처음에는 음소거로 깔아 두고,
     게이트를 탭하는 순간(= 사용자 제스처) setAudio(true)로 연다.
     단어 발음이 나갈 때는 duck(true)로 잠깐 눌러 둔다. 겹치면 둘 다 안 들린다. */
  var audioOn = false, ducked = false;
  var DUCK = 0.08;      /* 기본: 단어 발음이 나갈 때 */
  var duckLevel = DUCK;

  function eachVideo(fn) {
    for (var i = 0; i < layers.length; i++) if (layers[i].tagName === 'VIDEO') fn(layers[i]);
  }
  /* 끝나기 직전 소리를 줄인다.
     원본 파일이 여운 없이 뚝 끝나면 "잘렸다"는 인상이 남는다.
     마지막 TAIL초 동안 서서히 0으로 내리면 의도된 마무리로 들린다. */
  var TAIL = 0.9;

  /* 낮추고 올릴 때 계단처럼 뚝 끊기면 "소리가 켜졌다 꺼졌다" 하는 게 그대로 들린다.
     목표값으로 지수적으로 다가가서 귀에 전환이 안 걸리게 한다. */
  var duckNow = 1, duckRaf = 0;
  var DUCK_EASE = 0.14;          /* 프레임당 남은 거리의 몇 %를 좁히나 */
  function duckTarget() { return ducked ? duckLevel : 1; }
  function baseVolume() { return duckNow; }
  function rampDuck() {
    if (duckRaf) return;
    duckRaf = requestAnimationFrame(function step() {
      var d = duckTarget() - duckNow;
      if (Math.abs(d) < 0.004) {
        duckNow = duckTarget();
        applyAudio();
        duckRaf = 0;
        return;
      }
      duckNow += d * DUCK_EASE;
      applyAudio();
      duckRaf = requestAnimationFrame(step);
    });
  }
  function tailVolume(v) {
    var d = v.duration;
    if (!isFinite(d) || d <= 0) return baseVolume();
    var left = d - v.currentTime;
    if (left >= TAIL) return baseVolume();
    return baseVolume() * Math.max(0, left / TAIL);
  }
  function applyAudio() {
    eachVideo(function (v) {
      v.muted = !audioOn;
      v.volume = tailVolume(v);
    });
  }
  function setAudio(on) {
    audioOn = !!on;
    applyAudio();
    /* 음소거를 푼 직후에는 재생을 한 번 더 밀어 줘야 정책에 걸리지 않는다.
       다만 이미 끝난 영상은 건드리지 않는다 — play()가 처음으로 되감아 버린다. */
    eachVideo(function (v) {
      if (v.ended) return;
      var pr = v.play();
      if (pr && pr.catch) pr.catch(function () {});
    });
    announce();
  }
  /* level을 주면 그 크기로 낮춘다. 끄지 않고 낮추기만 한다 —
     성우가 읽는 동안에도 영상의 분위기 소리는 계속 들려야 한다. */
  function duck(on, level) {
    ducked = !!on;
    duckLevel = (level == null) ? DUCK : level;
    rampDuck();
  }
  function hasVideo() { return !!(current && !current.canvas); }
  function announce() {
    try { window.dispatchEvent(new CustomEvent('scenechange', { detail: status })); } catch (e) {}
  }

  /* ── 잡동사니 ── */
  function lerp(a, b, k) { return a + (b - a) * k; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(k) { return k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
  function saw(t, period) { return (t % period) / period; }

  /* 결정적 난수 — 프레임마다 같은 배치가 나와야 한다 */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var x = Math.imul(a ^ a >>> 15, 1 | a);
      x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x;
      return ((x ^ x >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ── 팔레트 ── 배경은 dim 0.5 아래 깔리므로 다소 밝게 잡는다 */
  var P = {
    ink:      '#191b21',
    inkSoft:  '#2c3038',
    duskSky:  ['#3a3a63', '#6b5570', '#d59a67'],
    daySky:   ['#a9c8dd', '#dfe4d6'],
    paleSky:  ['#cfc9b6', '#efe8d5'],
    dullSky:  ['#9aa3a6', '#cfcbbd'],
    nightSky: ['#141726', '#232a3c'],
    warmRoom: ['#2a1a12', '#6b3f22'],
    lamp:     '#ffcf7a',
    water:    '#7fa3ad',
    bed:      '#6b6350',
    earth:    '#5b5342',
    grass:    '#59684a',
    hillFar:  '#7d8577',
    hillMid:  '#4f5a4c',
    hillNear: '#333b34',
    paper:    '#f2ecdc'
  };

  /* ── 하늘 ── */
  function sky(c, w, h, stops) {
    var g = c.createLinearGradient(0, 0, 0, h);
    for (var i = 0; i < stops.length; i++) g.addColorStop(i / (stops.length - 1), stops[i]);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }

  /* ── 언덕 ── 반환값은 x에서의 능선 높이를 주는 함수 */
  function hill(c, w, h, o) {
    var y = o.y, amp = o.amp, freq = o.freq, ph = o.phase || 0;
    var at = function (x) { return y + Math.sin((x / w) * freq * Math.PI * 2 + ph) * amp; };
    c.fillStyle = o.color;
    c.beginPath(); c.moveTo(-2, h + 2); c.lineTo(-2, at(-2));
    for (var x = 0; x <= w + 4; x += 5) c.lineTo(x, at(x));
    c.lineTo(w + 2, h + 2); c.closePath(); c.fill();
    return at;
  }

  /* ── 고양이 실루엣 ── 100×100 상자 안에 앉은 모습. 얼굴은 없다 ── */
  function catPath(c) {
    c.strokeStyle = c.fillStyle;
    c.lineWidth = 9; c.lineCap = 'round';
    c.beginPath(); c.moveTo(30, 82); c.quadraticCurveTo(6, 76, 15, 42); c.stroke();
    c.beginPath(); c.ellipse(50, 74, 26, 21, 0, 0, 6.2832); c.fill();
    c.beginPath(); c.ellipse(65, 58, 14, 18, 0, 0, 6.2832); c.fill();
    c.beginPath(); c.ellipse(69, 38, 15, 13, 0, 0, 6.2832); c.fill();
    c.beginPath(); c.moveTo(57, 33); c.lineTo(59, 14); c.lineTo(71, 28); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(71, 27); c.lineTo(83, 15); c.lineTo(83, 35); c.closePath(); c.fill();
  }

  /* 잉크 색 — 알파를 8단으로 끊는다. 안 그러면 고양이마다 색 문자열이 달라
     스프라이트 캐시가 매 프레임 통째로 무효화된다 */
  function ink(a) { return 'rgba(24,27,32,' + (Math.round(clamp(a, 0, 1) * 8) / 8) + ')'; }
  function lit8(a) { return 'rgba(150,140,120,' + (Math.round(clamp(a, 0, 1) * 8) / 8) + ')'; }

  var sprites = {};
  var Q = Math.log(1.08);
  function sprite(kind, px, color, extra) {
    /* 크기도 8% 계단으로 끊는다. 실제로는 요청한 크기로 늘려 그리므로 티가 안 난다 */
    px = Math.max(6, Math.round(Math.pow(1.08, Math.round(Math.log(Math.max(6, px)) / Q))));
    var key = kind + '|' + px + '|' + color + '|' + (extra || '');
    if (sprites[key]) return sprites[key];
    var cv = document.createElement('canvas');
    cv.width = px; cv.height = px;
    var c = cv.getContext('2d');
    c.scale(px / 100, px / 100);
    c.fillStyle = color;
    if (kind === 'cat') catPath(c);
    else if (kind === 'figure') figurePath(c, extra === 'skirt');
    else if (kind === 'curl') curlPath(c);
    sprites[key] = cv;
    if (Object.keys(sprites).length > 1200) sprites = {};  /* 최후의 안전판 */
    return cv;
  }

  /* 바닥이 y에 닿도록 x 중심에 그린다 */
  function drawSprite(c, cv, x, y, px, flip) {
    c.save();
    c.translate(x, y - px);
    if (flip) { c.translate(px, 0); c.scale(-1, 1); }
    c.drawImage(cv, 0, 0, px, px);
    c.restore();
  }
  function cat(c, x, y, px, color, flip) { drawSprite(c, sprite('cat', px, color), x - px / 2, y, px, flip); }

  /* ── 사람 실루엣 ── 모자 쓴 노인. 얼굴 없음 */
  function figurePath(c, skirt) {
    c.beginPath(); c.ellipse(50, 22, 11, 12, 0, 0, 6.2832); c.fill();
    c.beginPath(); c.ellipse(50, 13, 21, 5, 0, 0, 6.2832); c.fill();
    c.beginPath();
    c.moveTo(37, 34); c.lineTo(63, 34);
    c.lineTo(skirt ? 78 : 69, 96); c.lineTo(skirt ? 22 : 31, 96);
    c.closePath(); c.fill();
  }
  function figure(c, x, y, px, color, skirt, flip) {
    drawSprite(c, sprite('figure', px, color, skirt ? 'skirt' : ''), x - px / 2, y, px, flip);
  }

  /* ── 몸을 만 고양이 (16쪽) ── */
  function curlPath(c) {
    c.beginPath(); c.ellipse(50, 66, 38, 26, 0, 0, 6.2832); c.fill();
    c.beginPath(); c.ellipse(24, 58, 17, 15, 0, 0, 6.2832); c.fill();
    c.beginPath(); c.moveTo(16, 46); c.lineTo(14, 32); c.lineTo(27, 42); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(30, 41); c.lineTo(40, 30); c.lineTo(40, 46); c.closePath(); c.fill();
    c.strokeStyle = c.fillStyle; c.lineWidth = 11; c.lineCap = 'round';
    c.beginPath(); c.moveTo(84, 70); c.quadraticCurveTo(74, 92, 44, 88); c.stroke();
  }

  /* ── 오두막 ── */
  function cottage(c, x, y, px, color, lampK) {
    var u = px / 100, X = x - px / 2;
    c.fillStyle = color;
    c.fillRect(X + 20 * u, y - 54 * u, 60 * u, 54 * u);
    c.beginPath();
    c.moveTo(X + 8 * u, y - 50 * u); c.lineTo(X + 50 * u, y - 88 * u); c.lineTo(X + 92 * u, y - 50 * u);
    c.closePath(); c.fill();
    c.fillRect(X + 44 * u, y - 30 * u, 15 * u, 30 * u);      /* 문 */
    if (lampK > 0) {
      var g = c.createRadialGradient(X + 66 * u, y - 40 * u, 1, X + 66 * u, y - 40 * u, 34 * u);
      g.addColorStop(0, 'rgba(255,207,122,' + (0.85 * lampK) + ')');
      g.addColorStop(1, 'rgba(255,207,122,0)');
      c.fillStyle = g; c.beginPath(); c.arc(X + 66 * u, y - 40 * u, 34 * u, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(255,214,138,' + (0.95 * lampK) + ')';
      c.fillRect(X + 60 * u, y - 46 * u, 14 * u, 13 * u);
    }
  }

  /* ── 풀 ── k는 남은 길이 비율 0..1 */
  function grassRow(c, w, yAt, from, to, step, len, k, color, t, seedN) {
    c.strokeStyle = color; c.lineCap = 'round';
    var r = rng(seedN || 7);
    for (var x = from; x < to; x += step) {
      var jitter = r(), L = len * (0.6 + jitter * 0.7) * k;
      if (L < 0.6) continue;
      var y = yAt(x), sway = Math.sin(t * 1.1 + x * 0.05) * L * 0.16;
      c.lineWidth = Math.max(1, len * 0.09);
      c.beginPath(); c.moveTo(x, y);
      c.quadraticCurveTo(x + sway * 0.5, y - L * 0.6, x + sway, y - L);
      c.stroke();
    }
  }

  /* 흐르는 구름 */
  function clouds(c, w, h, t, color, n, band) {
    var r = rng(31); c.fillStyle = color;
    for (var i = 0; i < n; i++) {
      var base = r() * w, y = band[0] + r() * (band[1] - band[0]);
      var rx = w * (0.10 + r() * 0.14), ry = rx * (0.13 + r() * 0.07);
      var x = ((base + t * (5 + i * 2)) % (w + rx * 4)) - rx * 2;
      c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 6.2832); c.fill();
      c.beginPath(); c.ellipse(x + rx * 0.5, y + ry * 0.4, rx * 0.6, ry * 0.8, 0, 0, 6.2832); c.fill();
    }
  }

  /* 종이 질감 — 잉크 드로잉 느낌의 아주 옅은 얼룩 */
  function grain(c, w, h) {
    var r = rng(99);
    c.fillStyle = 'rgba(0,0,0,.035)';
    for (var i = 0; i < 260; i++) {
      var x = r() * w, y = r() * h, s = 1 + r() * 2.2;
      c.fillRect(x, y, s, s);
    }
  }

  /* 고양이 슬롯 — 언덕을 채우는 배치를 한 번만 만들어 둔다 */
  var slotCache = {};
  function slots(seed, n) {
    var key = seed + '|' + n;
    if (slotCache[key]) return slotCache[key];
    var r = rng(seed), a = [];
    for (var i = 0; i < n; i++) a.push({ u: r(), v: r(), s: r(), p: r() * 6.2832 });
    a.sort(function (x, y) { return x.v - y.v; });   /* 먼 것부터 그린다 */
    slotCache[key] = a;
    return a;
  }

  /* ══════════════════ 씬 16개 ══════════════════ */
  var S = {};

  /* 1 · 꽃에 둘러싸인 오두막 · 해질녘 */
  S.cottage_dusk = function (c, w, h, t) {
    sky(c, w, h, P.duskSky);
    clouds(c, w, h, t, 'rgba(255,220,190,.20)', 4, [h * 0.18, h * 0.42]);
    hill(c, w, h, { y: h * 0.70, amp: h * 0.05, freq: 1.1, phase: 0.4, color: P.hillFar });
    var g = hill(c, w, h, { y: h * 0.80, amp: h * 0.035, freq: 0.8, phase: 2.1, color: P.hillNear });
    var cx = w * 0.52, cy = g(cx) + h * 0.02;
    var pulse = 0.85 + Math.sin(t * 0.7) * 0.15;
    cottage(c, cx, cy, h * 0.30, P.ink, pulse);
    /* 문 앞만 비운 꽃 띠 */
    var r = rng(5);
    for (var i = 0; i < 110; i++) {
      var a = r() * 6.2832;
      if (a > 1.25 && a < 1.9) continue;             /* 문이 있는 자리 */
      var rad = h * (0.16 + r() * 0.09);
      var x = cx + Math.cos(a) * rad * 1.7, y = cy + Math.sin(a) * rad * 0.34 + h * 0.01;
      c.fillStyle = ['#d9738a', '#e8c65f', '#cf8f5a', '#b8577a'][(i % 4)];
      c.beginPath(); c.arc(x, y + Math.sin(t * 0.8 + i) * 0.8, h * 0.008, 0, 6.2832); c.fill();
    }
    grain(c, w, h);
  };

  /* 2 · 난롯가. 빈 의자 둘 */
  S.cottage_interior = function (c, w, h, t) {
    sky(c, w, h, P.warmRoom);
    var fx = w * 0.5, fy = h * 0.86;
    var fl = 0.82 + Math.sin(t * 3.1) * 0.09 + Math.sin(t * 7.7) * 0.05;
    var g = c.createRadialGradient(fx, fy, 4, fx, fy, h * 0.75 * fl);
    g.addColorStop(0, 'rgba(255,190,110,.85)');
    g.addColorStop(0.45, 'rgba(210,110,50,.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    /* 벽에 흔들리는 그림자 */
    c.fillStyle = 'rgba(20,10,6,.34)';
    for (var i = 0; i < 3; i++) {
      var sx = w * (0.2 + i * 0.3) + Math.sin(t * 0.9 + i) * w * 0.02;
      c.beginPath(); c.ellipse(sx, h * 0.3, w * 0.10, h * 0.22, 0, 0, 6.2832); c.fill();
    }
    c.fillStyle = 'rgba(14,8,5,.92)'; c.fillRect(0, h * 0.88, w, h * 0.12);
    chair(c, w * 0.30, h * 0.9, h * 0.34, false);
    chair(c, w * 0.70, h * 0.9, h * 0.34, true);
    grain(c, w, h);
  };
  function chair(c, x, y, px, flip) {
    var u = px / 100, X = x - px / 2;
    c.save(); if (flip) { c.translate(x * 2, 0); c.scale(-1, 1); }
    c.fillStyle = 'rgba(10,6,4,.95)';
    c.fillRect(X + 22 * u, y - 96 * u, 11 * u, 96 * u);
    c.fillRect(X + 22 * u, y - 46 * u, 56 * u, 10 * u);
    c.fillRect(X + 70 * u, y - 40 * u, 9 * u, 40 * u);
    c.restore();
  }

  /* 3 · 햇살 언덕과 서늘한 골짜기 · 가로 팬 */
  S.hills_journey = function (c, w, h, t) {
    sky(c, w, h, P.daySky);
    clouds(c, w, h, t, 'rgba(255,255,255,.55)', 5, [h * 0.10, h * 0.34]);
    var pan = (t * 6) % w;
    hill(c, w, h, { y: h * 0.62, amp: h * 0.06, freq: 1.4, phase: -pan / w * 6.2832, color: P.hillFar });
    var mid = hill(c, w, h, { y: h * 0.74, amp: h * 0.05, freq: 1.0, phase: -pan / w * 4.4 + 1.2, color: P.hillMid });
    var near = hill(c, w, h, { y: h * 0.88, amp: h * 0.04, freq: 0.7, phase: -pan / w * 3.0 + 2.6, color: P.hillNear });
    grassRow(c, w, near, -10, w + 10, 9, h * 0.05, 1, 'rgba(20,24,20,.55)', t, 3);
    var fx = (w * 0.12 + t * 9) % (w * 1.2);
    figure(c, fx, mid(fx) + h * 0.005, h * 0.075, P.ink, false, false);
    grain(c, w, h);
  };

  /* 4 · 수백만이 뒤덮은 언덕 ★ 이 책의 주인공 씬
     카메라가 물러나며 고양이 수가 눈에 보이게 늘어난다 */
  S.cat_hill = function (c, w, h, t) {
    var k = saw(t, 26), e = ease(k);
    sky(c, w, h, P.paleSky);
    var horizon = lerp(0.88, 0.44, e);
    hill(c, w, h, { y: h * (horizon + 0.10), amp: h * 0.035, freq: 1.3, phase: 1.0, color: P.hillFar });
    var g = hill(c, w, h, { y: h * horizon, amp: h * 0.055, freq: 0.9, phase: 0.3, color: P.hillMid });
    var all = slots(11, 460);
    var n = Math.floor(lerp(9, all.length, e * e));
    var base = h * lerp(0.20, 0.055, e);
    for (var i = 0; i < n; i++) {
      var s = all[i];
      var x = s.u * w * 1.04 - w * 0.02;
      var y = g(x) + (h - g(x)) * s.v * 0.92;
      var px = base * (0.45 + s.v * 0.85);
      var bob = Math.sin(t * 1.5 + s.p) * px * 0.03;
      cat(c, x, y + bob, px, ink(0.45 + s.v * 0.5), s.s > 0.5);
    }
    grain(c, w, h);
  };

  /* 5 · 흰 고양이 하나, 그리고 검고 흰 고양이 하나 */
  S.choosing_white = function (c, w, h, t) {
    sky(c, w, h, P.paleSky);
    var g = hill(c, w, h, { y: h * 0.46, amp: h * 0.04, freq: 0.8, phase: 0.9, color: P.hillMid });
    var all = slots(23, 90);
    var second = (t % 14) > 6;
    for (var i = 0; i < all.length; i++) {
      var s = all[i];
      var x = s.u * w * 1.05 - w * 0.02;
      var y = g(x) + (h - g(x)) * s.v;
      var px = h * 0.16 * (0.6 + s.v * 0.8);
      var bob = Math.sin(t * 1.3 + s.p) * px * 0.035;
      var col = ink(0.55 + s.v * 0.4);
      if (i === 62) col = P.paper;                                  /* 흰 고양이 */
      if (i === 71 && second) col = 'rgba(238,232,216,.92)';        /* 검고 흰 고양이 */
      cat(c, x, y + bob, px, col, s.s > 0.5);
      if (i === 71 && second) {                                      /* 검은 반쪽 */
        c.save(); c.beginPath();
        c.rect(x - px / 2, y - px, px * 0.5, px); c.clip();
        cat(c, x, y + bob, px, 'rgba(24,27,32,.9)', s.s > 0.5);
        c.restore();
      }
    }
    grain(c, w, h);
  };

  /* 6 · 시선이 이곳저곳으로 옮겨 간다 */
  S.choosing_more = function (c, w, h, t) {
    sky(c, w, h, P.paleSky);
    var g = hill(c, w, h, { y: h * 0.42, amp: h * 0.05, freq: 1.1, phase: 2.2, color: P.hillMid });
    var all = slots(37, 150);
    var spotsXY = [[0.78, 0.34], [0.22, 0.78], [0.55, 0.52], [0.86, 0.7]];
    var seg = 4.2, idx = Math.floor(t / seg) % spotsXY.length, nx = (idx + 1) % spotsXY.length;
    var k = ease(clamp((t % seg) / seg * 1.6, 0, 1));
    var sx = lerp(spotsXY[idx][0], spotsXY[nx][0], k) * w;
    var sy = lerp(spotsXY[idx][1], spotsXY[nx][1], k) * h;
    for (var i = 0; i < all.length; i++) {
      var s = all[i];
      var x = s.u * w * 1.05 - w * 0.02;
      var y = g(x) + (h - g(x)) * s.v;
      var px = h * 0.13 * (0.55 + s.v * 0.85);
      var d = Math.hypot(x - sx, y - sy) / (h * 0.22);
      var lit = clamp(1 - d, 0, 1);
      var a = (0.45 + s.v * 0.4) * (1 - lit * 0.45);
      var col = lit > 0.55 ? lit8(0.65 + lit * 0.3) : ink(a);
      cat(c, x, y + Math.sin(t * 1.2 + s.p) * px * 0.03, px, col, s.s > 0.5);
    }
    var gr = c.createRadialGradient(sx, sy, 2, sx, sy, h * 0.24);
    gr.addColorStop(0, 'rgba(255,248,225,.20)');
    gr.addColorStop(1, 'rgba(255,248,225,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    grain(c, w, h);
  };

  /* 7 · 언덕이 비고, 줄이 길어진다 */
  S.chose_all = function (c, w, h, t) {
    var k = ease(saw(t, 22));
    sky(c, w, h, P.paleSky);
    var g = hill(c, w, h, { y: h * 0.52, amp: h * 0.05, freq: 1.0, phase: 0.6, color: P.hillMid });
    var all = slots(53, 220);
    var lead = { x: w * 0.08, y: h * 0.92 };
    for (var i = 0; i < all.length; i++) {
      var s = all[i];
      var hx = s.u * w * 1.05 - w * 0.02;
      var hy = g(hx) + (h - g(hx)) * s.v * 0.8;
      var own = clamp((k - i / all.length * 0.55) / 0.45, 0, 1);
      var e = ease(own);
      var qx = lead.x + (i * 0.055 + 0.4) * w * 0.06;
      var qy = lead.y - Math.sin(i * 0.4) * h * 0.01;
      var x = lerp(hx, qx, e), y = lerp(hy, qy, e);
      var px = h * lerp(0.11 * (0.6 + s.v * 0.8), 0.075, e);
      if (x > w * 1.06) continue;
      cat(c, x, y, px, ink(0.5 + s.v * 0.42), true);
    }
    figure(c, lead.x - w * 0.02, lead.y, h * 0.13, P.ink, false, true);
    grain(c, w, h);
  };

  /* 8 · 끝이 보이지 않는 행렬 */
  S.procession = function (c, w, h, t) {
    sky(c, w, h, P.daySky);
    clouds(c, w, h, t, 'rgba(255,255,255,.45)', 4, [h * 0.10, h * 0.30]);
    hill(c, w, h, { y: h * 0.55, amp: h * 0.06, freq: 1.3, phase: 1.4, color: P.hillFar });
    hill(c, w, h, { y: h * 0.70, amp: h * 0.05, freq: 0.9, phase: 0.2, color: P.hillMid });
    var near = hill(c, w, h, { y: h * 0.90, amp: h * 0.035, freq: 0.6, phase: 2.4, color: P.hillNear });
    var pan = t * 26, gap = w * 0.045;
    var pathY = function (x) { return near(x) - h * 0.012 - Math.sin(x / w * 5.0) * h * 0.03; };
    for (var i = -2; i < Math.ceil(w / gap) + 3; i++) {
      var x = ((i * gap - pan) % (w + gap * 4) + w + gap * 4) % (w + gap * 4) - gap * 2;
      var bob = Math.abs(Math.sin(t * 3 + i)) * h * 0.006;
      cat(c, x, pathY(x) - bob, h * 0.085, 'rgba(24,27,32,.88)', true);
    }
    var fx = w * 0.12;
    figure(c, fx, pathY(fx), h * 0.15, P.ink, false, true);
    grain(c, w, h);
  };

  /* 9 · 연못이 사라진다 */
  S.pond = function (c, w, h, t) {
    var k = saw(t, 18), drain = ease(clamp(k * 1.35, 0, 1));
    sky(c, w, h, P.dullSky);
    hill(c, w, h, { y: h * 0.50, amp: h * 0.05, freq: 1.0, phase: 1.0, color: P.hillFar });
    var g = hill(c, w, h, { y: h * 0.66, amp: h * 0.03, freq: 0.7, phase: 2.0, color: P.hillMid });
    var cx = w * 0.5, cy = h * 0.86, rx = w * 0.30, ry = h * 0.13;
    c.fillStyle = P.bed;
    c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, 6.2832); c.fill();
    var wr = rx * (1 - drain), wry = ry * (1 - drain);
    if (wr > 1) {
      c.fillStyle = P.water;
      c.beginPath(); c.ellipse(cx, cy, wr, wry, 0, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(255,255,255,.22)';
      for (var s2 = 0; s2 < 3; s2++) {
        var yy = cy - wry * 0.4 + s2 * wry * 0.4;
        c.fillRect(cx - wr * 0.5 + Math.sin(t * 1.3 + s2) * wr * 0.1, yy, wr * (0.5 - s2 * 0.12), 1.5);
      }
    }
    var n = 46;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * 6.2832 + 0.2;
      var px = h * (0.075 + (Math.sin(a) + 1) * 0.02);
      var x = cx + Math.cos(a) * rx * 1.30;
      var y = cy + Math.sin(a) * ry * 1.30 + px * 0.06;
      if (Math.sin(a) < -0.55) continue;               /* 뒤쪽은 언덕에 가린다 */
      c.save();
      c.translate(x, y);
      c.rotate(Math.cos(a) * 0.16 * (1 - drain * 0.4));
      cat(c, 0, 0, px, 'rgba(24,27,32,.9)', Math.cos(a) > 0);
      c.restore();
    }
    var far = slots(61, 120);
    for (var j = 0; j < far.length; j++) {
      var s3 = far[j], fx2 = s3.u * w, fy = g(fx2) + (h * 0.72 - g(fx2)) * s3.v;
      cat(c, fx2, fy, h * 0.04 * (0.6 + s3.v), ink(0.3 + s3.v * 0.3), s3.s > .5);
    }
    grain(c, w, h);
  };

  /* 10 · 풀 한 포기 남지 않는다 */
  S.grass = function (c, w, h, t) {
    var k = saw(t, 20);
    sky(c, w, h, P.dullSky);
    hill(c, w, h, { y: h * 0.44, amp: h * 0.05, freq: 1.1, phase: 0.5, color: P.hillFar });
    hill(c, w, h, { y: h * 0.60, amp: h * 0.05, freq: 0.8, phase: 2.2, color: P.grass });
    var gn = hill(c, w, h, { y: h * 0.62, amp: h * 0.045, freq: 0.8, phase: 2.2, color: P.earth });
    /* 왼쪽부터 물결처럼 짧아진다 */
    var eaten = function (x) { return clamp((k * 1.5 - x / w) * 3.2, 0, 1); };
    for (var x = -8; x < w + 8; x += 7) {
      var kk = 1 - eaten(x);
      if (kk <= 0.02) continue;
      grassRow(c, w, gn, x, x + 7, 7, h * 0.075, kk, 'rgba(38,52,34,.75)', t, Math.round(x));
    }
    var all = slots(71, 190);
    for (var i = 0; i < all.length; i++) {
      var s = all[i];
      var cx = s.u * w * 1.05 - w * 0.02;
      var cy = gn(cx) + (h - gn(cx)) * s.v * 0.95;
      var px = h * 0.10 * (0.55 + s.v * 0.9);
      cat(c, cx, cy + Math.sin(t * 2 + s.p) * px * 0.04, px, ink(0.5 + s.v * 0.42), s.s > .5);
    }
    grain(c, w, h);
  };

  /* 11 · 언덕에서 마당으로 밀려드는 물결 */
  S.yard_arrival = function (c, w, h, t) {
    var k = ease(saw(t, 20));
    sky(c, w, h, P.dullSky);
    hill(c, w, h, { y: h * 0.42, amp: h * 0.05, freq: 1.2, phase: 0.9, color: P.hillFar });
    var g = hill(c, w, h, { y: h * 0.58, amp: h * 0.04, freq: 0.8, phase: 2.0, color: P.hillMid });
    c.fillStyle = P.earth; c.fillRect(0, h * 0.60, w, h * 0.40);
    cottage(c, w * 0.80, h * 0.72, h * 0.34, P.ink, 0.7);
    var all = slots(83, 300);
    var n = Math.floor(all.length * k);
    for (var i = 0; i < n; i++) {
      var s = all[i];
      var flow = clamp((k - i / all.length) * 3, 0, 1);
      var sx = -w * 0.1 + s.u * w * 0.5, sy = g(sx);
      var tx = s.u * w * 1.05 - w * 0.02, ty = h * (0.62 + s.v * 0.36);
      var x = lerp(sx, tx, ease(flow)), y = lerp(sy, ty, ease(flow));
      var px = h * lerp(0.05, 0.115, s.v) * (0.7 + flow * 0.4);
      cat(c, x, y, px, ink(0.45 + s.v * 0.45), true);
    }
    grain(c, w, h);
  };

  /* 12 · 마당이 가득 찼다 — 물처럼 술렁인다 */
  S.yard_flood = function (c, w, h, t) {
    sky(c, w, h, P.dullSky);
    hill(c, w, h, { y: h * 0.34, amp: h * 0.03, freq: 1.0, phase: 1.4, color: P.hillFar });
    c.fillStyle = P.earth; c.fillRect(0, h * 0.34, w, h * 0.66);
    var all = slots(97, 420);
    for (var i = 0; i < all.length; i++) {
      var s = all[i];
      var x = s.u * w * 1.1 - w * 0.05;
      var y = h * (0.34 + s.v * 0.72);
      var px = h * (0.05 + s.v * 0.12);
      var stir = Math.sin(t * 1.6 + s.p + s.u * 6) * px * 0.07;
      var lift = Math.cos(t * 1.1 + s.p) * px * 0.04;
      cat(c, x + stir, y + lift, px, ink(0.42 + s.v * 0.5), s.s > .5);
    }
    grain(c, w, h);
  };

  /* 13 · 물결처럼 한꺼번에 돌아본다 */
  S.yard_question = function (c, w, h, t) {
    sky(c, w, h, P.dullSky);
    c.fillStyle = P.earth; c.fillRect(0, h * 0.30, w, h * 0.70);
    hill(c, w, h, { y: h * 0.30, amp: h * 0.025, freq: 1.0, phase: 1.4, color: P.hillFar });
    var all = slots(101, 420);
    var src = { x: w * 0.86, y: h * 0.42 };
    var maxD = Math.hypot(w, h);
    var wave = saw(t, 6) * 1.35;
    for (var i = 0; i < all.length; i++) {
      var s = all[i];
      var x = s.u * w * 1.1 - w * 0.05;
      var y = h * (0.32 + s.v * 0.72);
      var px = h * (0.05 + s.v * 0.12);
      var d = Math.hypot(x - src.x, y - src.y) / maxD;
      var hit = clamp((wave - d) * 6, 0, 1);
      var pop = 1 + Math.sin(hit * Math.PI) * 0.10;
      var faceRight = x < src.x;
      cat(c, x, y, px * pop, ink(0.42 + s.v * 0.5), hit > 0.5 ? faceRight : s.s > .5);
    }
    grain(c, w, h);
  };

  /* 14 · 소란, 그리고 텅 빈 마당 — 형체가 흩어질 뿐이다 */
  S.quarrel = function (c, w, h, t) {
    var k = saw(t, 24);
    var churn = clamp(k / 0.35, 0, 1);
    var gone = ease(clamp((k - 0.35) / 0.40, 0, 1));
    sky(c, w, h, P.dullSky);
    c.fillStyle = P.earth; c.fillRect(0, h * 0.30, w, h * 0.70);
    hill(c, w, h, { y: h * 0.30, amp: h * 0.025, freq: 1.0, phase: 1.4, color: P.hillFar });
    var all = slots(103, 420);
    var alive = Math.ceil(all.length * (1 - gone));
    for (var i = 0; i < alive; i++) {
      var s = all[i];
      var x = s.u * w * 1.1 - w * 0.05;
      var y = h * (0.32 + s.v * 0.72);
      var px = h * (0.05 + s.v * 0.12);
      var amp = px * 0.35 * churn;
      var jx = Math.sin(t * 9 + s.p * 3) * amp;
      var jy = Math.cos(t * 11 + s.p * 5) * amp * 0.5;
      var fade = clamp((alive - i) / 14, 0, 1);
      cat(c, x + jx, y + jy, px, ink((0.42 + s.v * 0.5) * fade), s.s > .5);
    }
    /* 창밖으로 내다보는 두 사람 */
    var peek = clamp((k - 0.62) / 0.18, 0, 1);
    if (peek > 0) {
      c.fillStyle = 'rgba(20,22,28,.95)';
      c.fillRect(w * 0.06, h * 0.12, w * 0.16, h * 0.24);
      c.fillStyle = 'rgba(255,207,122,.55)';
      c.fillRect(w * 0.075, h * 0.14, w * 0.13, h * 0.20);
      c.fillStyle = 'rgba(20,22,28,.95)';
      c.beginPath(); c.arc(w * 0.115, h * 0.30 - peek * h * 0.045, h * 0.03, 0, 6.2832); c.fill();
      c.beginPath(); c.arc(w * 0.175, h * 0.31 - peek * h * 0.038, h * 0.028, 0, 6.2832); c.fill();
    }
    grain(c, w, h);
  };

  /* 15 · 풀숲의 아기 고양이 */
  S.found_kitten = function (c, w, h, t) {
    sky(c, w, h, P.dullSky);
    c.fillStyle = P.earth; c.fillRect(0, h * 0.36, w, h * 0.64);
    hill(c, w, h, { y: h * 0.36, amp: h * 0.02, freq: 1.0, phase: 1.4, color: P.hillFar });
    var gx = w * 0.60, gy = h * 0.86;
    var glow = 0.55 + Math.sin(t * 0.6) * 0.12;
    var gr = c.createRadialGradient(gx, gy - h * 0.10, 2, gx, gy - h * 0.10, h * 0.36);
    gr.addColorStop(0, 'rgba(255,248,226,' + (0.30 * glow + 0.10).toFixed(3) + ')');
    gr.addColorStop(1, 'rgba(255,248,226,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    var flat = function () { return gy; };
    grassRow(c, w, flat, gx - w * 0.075, gx + w * 0.075, 5, h * 0.26, 1, 'rgba(46,60,40,.85)', t, 17);
    cat(c, gx, gy - h * 0.005, h * 0.11, 'rgba(22,24,30,.95)', false);
    grassRow(c, w, flat, gx - w * 0.075, gx + w * 0.075, 9, h * 0.22, 1, 'rgba(38,50,34,.9)', t + 1.3, 23);
    var r = rng(13);
    for (var i = 0; i < 12; i++) {
      var mx = gx + (r() - 0.5) * w * 0.30;
      var my = gy - h * (0.05 + r() * 0.30) - ((t * 6 + r() * 200) % (h * 0.3));
      c.fillStyle = 'rgba(255,250,230,.30)';
      c.beginPath(); c.arc(mx, my, h * 0.004, 0, 6.2832); c.fill();
    }
    grain(c, w, h);
  };

  /* 16 · 등불 아래, 세상에서 제일 아름다운 고양이 */
  S.ending = function (c, w, h, t) {
    sky(c, w, h, P.warmRoom);
    var lx = w * 0.30, ly = h * 0.22;
    var fl = 0.9 + Math.sin(t * 1.6) * 0.05;
    var gr = c.createRadialGradient(lx, ly, 4, lx, ly, h * 0.95 * fl);
    gr.addColorStop(0, 'rgba(255,214,142,.92)');
    gr.addColorStop(0.4, 'rgba(226,140,64,.38)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(24,14,8,.9)'; c.fillRect(0, h * 0.80, w, h * 0.20);
    /* 그릇 */
    var bx = w * 0.66, by = h * 0.80, bw = h * 0.15;
    c.fillStyle = 'rgba(18,10,6,.95)';
    c.beginPath();
    c.moveTo(bx - bw * 0.5, by - bw * 0.30);
    c.lineTo(bx + bw * 0.5, by - bw * 0.30);
    c.lineTo(bx + bw * 0.34, by); c.lineTo(bx - bw * 0.34, by);
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(246,240,225,.85)';
    c.beginPath(); c.ellipse(bx, by - bw * 0.30, bw * 0.48, bw * 0.10, 0, 0, 6.2832); c.fill();
    /* 몸을 만 고양이 — 숨을 쉰다 */
    var px = h * 0.34, breathe = 1 + Math.sin(t * 0.9) * 0.012;
    var cv = sprite('curl', px, 'rgba(20,12,8,.96)');
    c.save();
    c.translate(w * 0.44, h * 0.80);
    c.scale(breathe, 1 / breathe);
    c.drawImage(cv, -px / 2, -px * 0.86, px, px);
    c.restore();
    grain(c, w, h);
  };

  /* ══════════════════ 레이어 관리 ══════════════════ */

  function makeCanvas() {
    var cv = document.createElement('canvas');
    cv.className = 'layer';
    cv.setAttribute('aria-hidden', 'true');
    return cv;
  }

  function sizeCanvas(cv) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = host.clientWidth || 1, h = host.clientHeight || 1;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv._w = w; cv._h = h; cv._dpr = dpr;
  }

  function drawLayer(cv, key, t) {
    var fn = S[key];
    if (!fn) return;
    var c = cv.getContext('2d');
    c.setTransform(cv._dpr, 0, 0, cv._dpr, 0, 0);
    c.clearRect(0, 0, cv._w, cv._h);
    fn(c, cv._w, cv._h, t);
  }

  function loop(ts) {
    raf = requestAnimationFrame(loop);
    if (!current || !current.canvas) return;
    if (ts - lastDraw < FRAME_MS) return;
    lastDraw = ts;
    drawLayer(current.canvas, current.key, (ts - t0) / 1000);
  }

  function retire(layer) {
    if (!layer) return;
    if (layer === playingEl) { playingEl = null; playingVideo = null; }
    layer.classList.remove('on');
    setTimeout(function () {
      if (layer.parentNode) layer.parentNode.removeChild(layer);
      var i = layers.indexOf(layer);
      if (i >= 0) layers.splice(i, 1);
    }, FADE_MS + 60);
  }

  function mount(el) {
    host = el;
    t0 = performance.now();
    if (!REDUCED) raf = requestAnimationFrame(loop);
    window.addEventListener('resize', function () {
      layers.forEach(function (l) { if (l.tagName === 'CANVAS') sizeCanvas(l); });
      if (current && current.canvas) drawLayer(current.canvas, current.key, REDUCED ? STILL_T : (performance.now() - t0) / 1000);
    });
  }

  /* 절차적 씬을 먼저 띄우고, mp4가 준비되면 그 위로 크로스페이드한다.
     mp4가 없으면 콘솔 경고만. 사용자에게는 아무 표시도 하지 않는다. */
  function show(key, video, flip) {
    if (!host || !S[key]) { if (!S[key]) console.warn('[scenes] 알 수 없는 씬:', key); return; }

    /* 한 컷이 여러 쪽에 걸쳐 있으면 같은 파일이 연달아 온다.
       그때 레이어를 갈아끼우면 영상이 처음으로 되감기고 크로스페이드가 껌뻑인다.
       이미 그 영상이 돌고 있으면 배경은 손대지 않고 쪽 표시만 갱신한다. */
    if (video && playingVideo === video && playingEl && !playingEl.ended &&
        current && !current.canvas) {
      status.key = key;
      announce();
      return;
    }

    var old = layers.slice();
    var cv = makeCanvas();
    host.appendChild(cv);
    sizeCanvas(cv);
    drawLayer(cv, key, REDUCED ? STILL_T : (performance.now() - t0) / 1000);
    void cv.offsetWidth;
    cv.classList.add('on');
    layers.push(cv);
    current = { key: key, canvas: cv };
    playingVideo = null; playingEl = null;
    status = { key: key, source: '절차적', note: video ? 'mp4 확인 중…' : 'mp4 없음' };
    announce();
    old.forEach(retire);

    if (!video) return;
    var v = document.createElement('video');
    v.className = flip ? 'layer flip' : 'layer';
    v.muted = !audioOn; v.volume = baseVolume();
    /* 한 바퀴만 돌고 마지막 프레임에서 멈춘다.
       <video>는 끝나면 그 프레임을 그대로 붙들고 있으므로 따로 할 일이 없다. */
    v.loop = false;
    /* autoplay 는 켜지 않는다. 켜 두면 브라우저가 화면에 붙이기도 전에 재생을 시작해서,
       loadeddata 를 기다렸다 띄우는 우리 코드와 경쟁한다. 그 사이 흘러간 만큼
       "중간부터 재생"되는 것처럼 보인다. 재생 시점은 우리가 잡는다. */
    v.autoplay = false;
    v.playsInline = true; v.setAttribute('playsinline', '');
    v.setAttribute('aria-hidden', 'true');
    v.preload = 'auto';
    v.src = window.MOC.av('assets/videos/' + video);
    var settled = false;
    var fail = function (why) {
      if (settled) return; settled = true;
      status.note = 'mp4 실패(' + (why || 'error') + ')';
      announce();
      console.warn('[scenes] mp4를 못 읽어 절차적 씬으로 갑니다:', video, '·', why || 'error');
      if (v.parentNode) v.parentNode.removeChild(v);
    };
    v.addEventListener('error', function () { fail('error'); });
    /* 9MB 안팎이라 첫 로드는 느릴 수 있다. 너무 짧으면 멀쩡한 영상을 버린다 */
    setTimeout(function () { fail('timeout'); }, 6000);
    v.addEventListener('loadeddata', function () {
      if (settled) return; settled = true;
      if (!current || current.key !== key) { fail('쪽이 이미 바뀜'); return; }
      host.appendChild(v);
      void v.offsetWidth;
      v.classList.add('on');
      layers.push(v);
      current = { key: key, canvas: null };     /* 영상이 있으면 캔버스 루프를 멈춘다 */
      playingVideo = video;
      playingEl = v;
      status = { key: key, source: 'mp4', note: video };
      announce();
      retire(cv);
      /* 끝이 가까워지면 소리를 부드럽게 내린다.
         timeupdate 는 초당 4번쯤이라 계단이 들린다. 꼬리 구간만 rAF로 촘촘히 그린다 */
      var fading = 0;
      v.addEventListener('timeupdate', function () {
        if (fading || !isFinite(v.duration)) return;
        if (v.duration - v.currentTime > TAIL + 0.25) return;
        fading = requestAnimationFrame(function step() {
          if (v.ended || playingEl !== v) { fading = 0; return; }
          v.volume = tailVolume(v);
          fading = requestAnimationFrame(step);
        });
      });

      /* 한 바퀴 다 돌면 알린다 — 마지막 장면이 뜬 순간이 "넘어갈 때"다 */
      v.addEventListener('ended', function () {
        if (playingEl !== v) return;              /* 이미 다른 쪽으로 넘어갔다 */
        /* 멈춘 그림 위에서 drift(확대)가 계속 돌면 매 프레임 다시 샘플링되어
           풀·털 같은 잔디테일이 자글거린다. 그 자리에서 애니메이션을 멈춘다.
           animation:none 이 아니라 play-state:paused 라야 현재 배율이 유지되어
           화면이 튀지 않는다. */
        v.classList.add('still');
        status.note = video + ' (끝)';
        announce();
        /* 정말 끝까지 갔는지 눈으로 확인할 수 있게 남긴다 */
        console.info('[scenes] 재생 완료: ' + video + ' · ' +
                     v.currentTime.toFixed(1) + ' / ' + (v.duration || 0).toFixed(1) + '초');
        try { window.dispatchEvent(new CustomEvent('sceneended', { detail: { key: key } })); }
        catch (e) {}
      });
      /* 반드시 처음으로 되감고 나서 재생한다.
         브라우저가 캐시된 재생 위치를 물고 오는 경우가 있다. */
      rewindPlay(v);
    });
  }

  /* 0초로 되감고 재생한다. 붙들린 동안에는 첫 프레임에 세워 두기만 한다.
     currentTime 대입은 곧바로 끝나지 않으므로 되감기가 끝난 뒤에 play 한다 —
     먼저 play 하면 되감기 이전 위치가 잠깐 흘러 "중간부터"로 보인다. */
  function rewindPlay(v) {
    var go = function () {
      if (playingEl !== v) return;
      if (held) { try { v.pause(); } catch (e) {} return; }
      var pr = v.play();
      if (pr && pr.catch) pr.catch(function () {});
    };
    if (v.currentTime > 0.02) {
      v.addEventListener('seeked', go, { once: true });
      try { v.currentTime = 0; } catch (e) { go(); }
    } else {
      try { v.currentTime = 0; } catch (e) {}
      go();
    }
  }

  /* 시작 게이트가 쓴다. hold(true) 로 세워 두었다가 hold(false) 로 내보낸다 */
  function hold(on) {
    held = !!on;
    if (held) {
      if (playingEl) { try { playingEl.pause(); playingEl.currentTime = 0; } catch (e) {} }
      return;
    }
    if (playingEl) rewindPlay(playingEl);
  }

  function keys() { return Object.keys(S); }

  return { mount: mount, show: show, keys: keys, reduced: REDUCED, hold: hold,
           setAudio: setAudio, duck: duck, hasVideo: hasVideo,
           get audioOn() { return audioOn; },
           status: function () { return status; } };
})();
