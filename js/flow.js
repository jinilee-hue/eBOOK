/* ══════════════════════════════════════════════════════════════
   app.js — 상태 기계 · 렌더 · 이벤트
   흐름: 게이트 → 읽기 구간(들) → 다 읽었어요 → 문제(ask→open) → 정답 → 다음 쪽
   ══════════════════════════════════════════════════════════════ */

(function () {
  var PAGES = window.MOC.PAGES;
  var DICT  = window.MOC.DICT;
  var END   = window.MOC.END || null;
  var Voice = window.MOC.Voice;

  /* ── 이어서 보기 판 ──
     문제가 없고, 낭독이 끝나면 쪽이 스스로 넘어간다.
     영상 소리가 이야기를 나르고, 영상이 끝나면 요약 낭독이 장면을 짚어 준다.
     책을 펼치면 본문 전체 낭독으로 바뀐다. */
  /* 원본 영상을 그대로 쓴다. 늘리지 않았으므로 소리가 살아 있고,
     그 소리가 이야기를 나른다. scenes.js 가 'assets/videos/' 를 앞에 붙인다. */
  function flowVideo(v) { return v; }

  /* 그 쪽 영상의 첫 프레임. 영상이 붙기 전까지 이 그림이 자리를 지킨다 */
  function flowPoster(v) {
    if (!v) { $('#bg').style.backgroundImage = ''; return; }
    $('#bg').style.backgroundImage =
      "url('" + window.MOC.av('assets/posters/' + v.replace(/\.mp4$/, '') + '.jpg') + "')";
  }
  /* 장면과 장면 사이의 숨. 짧을수록 이야기가 이어지는 느낌이 산다.
     0 으로 두면 소리가 끝나기 무섭게 넘어가 급해 보이므로 한 박자만 남긴다. */
  var FLOW_GAP = 350;
  /* 책을 접고 보는 동안의 간격. 영상이 끝나면 마지막 프레임이 그대로 멈춰 서므로
     (재생 완료 + still 클래스로 배경 확대까지 정지) 이 시간이 곧 '정지 화면'이다.
     특히 8→9쪽처럼 앞뒤 장면의 구도가 같으면 멈춤이 그대로 드러난다.
     숨은 0.38초 크로스페이드가 이미 만들어 주므로 여기서는 거의 쉬지 않는다. */
  var FLOW_GAP_FOLDED = 90;
  /* 글은 처음에 잠깐만 보여 주고 접는다. 이 판은 '보고 듣는' 것이 먼저다.
     아예 안 보여 주면 글이 있다는 것 자체를 모르고, 계속 띄워 두면 읽으려 든다. */
  /* 첫 문장을 다 읽으면 접는다. 고정 시간으로 두면 성우가 아직 읽는 중에 접히거나
     다 읽고 한참 뒤에 접힌다 — 정렬 데이터가 끝나는 시각을 알고 있으니 그걸 쓴다. */
  var FLOW_PEEK = 2600;      /* 글이 있다는 것만 보여 주고 접는 시간 */
  /* 처음 잠깐 글이 보이는 동안은 '펼친 것'이 아니다. 보여만 주는 것이지
     읽어 달라는 뜻이 아니므로, 이때는 영상 소리로 간다. */
  var flowPeeking = false;
  /* 책을 편 상태로 두려는가. DOM(data-read)은 접힘 애니메이션이 끝나야 바뀌므로
     그걸 보고 판단하면 전환 도중에 엉뚱한 모드가 잡힌다. 의도를 따로 들고 있는다. */
  var flowWantOpen = true;
  var flowFoldTouched = false;   /* 사람이 책 버튼을 건드렸나 */
  var flowReadKey = '';          /* 지금 읽고 있는 쪽·구간 */
  var flowT0 = 0;                /* 이 쪽이 열린 시각 */
  var flowTimer = 0;
  function flowState(v) { $('#stage').dataset.flow = v; }

  /* ── 다음 쪽을 미리 받아 둔다 ──
     scenes.js 는 절차적 씬을 먼저 띄우고 영상이 다 받아지면 바꿔 끼운다.
     그래서 받는 동안 그림이 보인다. 한 쪽에 30~43초 머무르니 그 사이에
     다음 쪽 영상과 음성을 받아 두면 넘어갈 때 곧바로 나온다.
     HTTP 캐시만 데워 두는 것이라 재생에는 끼어들지 않는다. */
  var flowWarmed = {};
  /* 미리 받아 둔 <video>. 참조를 들고 있지 않으면 수거되어 헛일이 된다.
     다만 무한정 쌓으면 안 된다 — 영상 하나가 수 MB이고, iOS 는 동시에 둘 수 있는
     <video> 개수 자체에 한계가 있다. 앞의 두 쪽만 들고 나머지는 놓아 준다. */
  var warmEls = {};
  var warmOrder = [];
  var WARM_KEEP = 2;
  function warmVideo(url) {
    if (warmEls[url]) return;
    var v = document.createElement('video');
    v.preload = 'auto';
    v.muted = true;
    v.playsInline = true; v.setAttribute('playsinline', '');
    v.src = url;
    try { v.load(); } catch (e) {}
    warmEls[url] = v;
    warmOrder.push(url);
    while (warmOrder.length > WARM_KEEP) {
      var old = warmOrder.shift(), el = warmEls[old];
      if (el) { try { el.removeAttribute('src'); el.load(); } catch (e) {} }
      delete warmEls[old];
    }
  }
  function flowWarm(n) {
    if (n < 1 || n > PAGES.length || flowWarmed[n]) return;
    flowWarmed[n] = true;
    var p = PAGES[n - 1];
    var urls = [];
    if (p.video) {
      urls.push(window.MOC.av('assets/posters/' + p.video.replace(/\.mp4$/, '') + '.jpg'));
      /* 영상은 fetch 로 받아 두어도 소용이 적다 — <video> 는 범위 요청으로 읽어서
         통째로 받아 둔 캐시를 그대로 쓰지 못하는 브라우저가 있다. 그래서 진짜
         <video> 를 하나 만들어 preload 시킨다. 화면에 붙이지는 않는다.
         이걸 해 두면 다음 쪽에서 loadeddata 가 곧바로 떨어져, 끝난 영상의
         마지막 프레임이 멈춰 서 있는 시간이 사라진다. */
      warmVideo(window.MOC.av('assets/videos/' + p.video));
    }
    urls.push(window.MOC.av('assets/audio-sum/p' + (p.n < 10 ? '0' : '') + p.n + '.mp3'));
    var A = window.MOC.ALIGN && window.MOC.ALIGN[p.n];
    if (A) urls.push('assets/audio/' + A.file);
    urls.forEach(function (u) {
      fetch(u, { cache: 'force-cache' }).catch(function () {});
    });
  }
  function flowProgress() {
    var el = $('#flowbar');
    if (el) el.style.width = ((pi + 1) / PAGES.length * 100) + '%';
  }
  /* ── 요약 낭독 ──
     영상 소리가 이야기를 나르고, 영상이 끝난 자리에서 이 음성이 장면을 짚어 준다.
     영상 중간에 끼워 넣으려면 쪽마다 대사 구간을 손으로 표시해야 한다 —
     끝난 뒤에 두면 겹칠 일이 없고 쪽마다 규칙이 같다. */
  var sumAudio = null;
  var sumPlaying = false;
  var sumGuard = 0;
  function sumStop() {
    sumPlaying = false;
    if (sumGuard) { clearInterval(sumGuard); sumGuard = 0; }
    if (!sumAudio) return;
    sumAudio.dead = true;
    sumAudio.pause();
    sumAudio.removeAttribute('src');
    sumAudio = null;
  }
  /* 지금 읽는 속도. setRate 가 여기에 적어 두면 요약 낭독도 같은 속도로 나간다.
     RATES·rateAt 은 아래 배선 함수 안에 갇혀 있어 여기서 못 본다. */
  var curRate = 1;

  function sumPlay(n, done) {
    sumStop();
    /* 본문 낭독이 돌고 있으면 요약은 나가지 않는다. 두 목소리가 겹치면 둘 다
       안 들린다. flowAudioMode 가 이미 막고 있지만, 접기/펴기 도중이나 낱말
       카드를 여닫는 사이에 시각을 재는 타이머가 먼저 터질 수 있어 여기서도 막는다. */
    if (flowOpen() || hlOn || Voice.playing) { done(); return; }
    var S = window.MOC.SUMMARY;
    if (!S || !S[n] || slotSkip(n)) { done(); return; }
    var a = new Audio(window.MOC.av('assets/audio-sum/p' + (n < 10 ? '0' : '') + n + '.mp3'));
    a.preload = 'auto';
    try { a.playbackRate = curRate; } catch (e) {}
    sumAudio = a;
    sumPlaying = true;
    var end = function () {
      if (a.dead) return;
      sumAudio = null; sumPlaying = false;
      done();
    };
    a.addEventListener('ended', end);
    a.addEventListener('error', end);      /* 파일이 없어도 흐름은 이어진다 */
    /* ── 파수꾼 ──
       책을 펴는 길이 여럿이라(버튼·되돌리기·쪽 넘김·카드 닫기) 어느 한 곳을
       빠뜨리면 요약이 본문 낭독 위에 얹힌다. 시작할 때 한 번 막는 것으로는
       모자라니, 나가는 동안에도 지켜보다가 낭독이 시작되면 바로 끈다. */
    sumGuard = setInterval(function () {
      if (!sumPlaying) { clearInterval(sumGuard); sumGuard = 0; return; }
      if (flowOpen() || hlOn || Voice.playing) sumStop();
    }, 60);
    var pr = a.play();
    if (pr && pr.catch) pr.catch(end);
  }

  /* ── 소리 모드 ──
     책이 접혀 있으면(기본) 영상 소리가 이야기를 나르고, 영상이 끝나면
     요약 낭독이 장면을 짚어 준 뒤 다음 쪽으로 간다.
     책을 펼치면 본문 전체를 성우가 읽고 낱말 하이라이트가 따라간다.
     이때 영상 소리는 낮춘다 — 두 목소리가 겹치면 둘 다 안 들린다. */
  function flowOpen() { return flowWantOpen && !flowPeeking; }

  function flowAudioMode() {
    if (!started || atEnd) return;
    clearTimeout(flowTimer);
    if (flowOpen()) {
      /* 본문 낭독으로 넘어간다 — 요약도 영상 소리도 여기서 멈춘다.
         0.08 로 낮추기만 하면 배경 대사가 낭독 밑에 깔려 둘 다 흐려진다.
         책을 편 동안은 성우 목소리 하나만 들려야 한다. */
      sumStop();
      clearInterval(slotTimer);
      hlOn = true;
      Scenes.duck(true, 0);
      hlRead();                       /* 본문 전체 낭독 + 하이라이트 */
      return;
    }
    hlOn = false;
    hlStopRead();
    /* ※ 요약이 나가는 중이면 건드리지 않는다.
       처음 2.6초 뒤 글이 자동으로 접힐 때도 여기를 지나는데,
       그때 멈추면 1쪽 요약이 시작하자마자 잘린다. */
    if (sumPlaying) return;
    Scenes.duck(false);               /* 영상 소리를 되살린다 */
    if (flowVideoDone) flowSummaryThenNext();
  }

  /* 영상 안에 요약을 넣을 자리가 있으면 거기서 튼다.
     말이 없는 쪽은 장면을 보면서 설명을 듣게 되고, 대사가 빽빽한 쪽은
     자리가 없으니 영상이 끝난 뒤로 미룬다 (SLOTS 가 null).
     자리를 찾는 건 tools/find_speech.py — 소리 크기가 아니라 말이 있는지로 판단한다. */
  var slotTimer = 0, slotDone = false;
  function slotAt(n) {
    /* 손으로 정한 자리가 있으면 그것이 먼저다 (content/summary.js 의 SUMMARY_AT).
       slots.js 는 자동 생성이라 손으로 고쳐 두면 다음 실행에 지워진다. */
    var M = window.MOC.SUMMARY_AT;
    if (M && typeof M[n] === 'number') return M[n];
    var S = window.MOC.SLOTS;
    var v = S && S[n];
    return (typeof v === 'number') ? v : null;
  }
  /* false 는 '이 쪽은 요약을 내보내지 않는다' 는 뜻이다.
     대사가 영상의 70% 를 넘으면 find_speech.py 가 그렇게 표시한다 —
     영상이 이미 다 말하고 있어 요약이 군더더기가 된다. */
  function slotSkip(n) {
    var S = window.MOC.SLOTS;
    if (S && S[n] === false) return true;
    /* 손으로 빼 둔 쪽 (content/summary.js 의 SUMMARY_SKIP) */
    var K = window.MOC.SUMMARY_SKIP;
    return !!(K && K.indexOf(n) >= 0);
  }
  var slotFor = -1;      /* 지금 감시 중인 쪽 */
  function slotWatch() {
    var page = PAGES[pi].n;
    /* 같은 쪽을 두 번 걸지 않는다. openGate 와 render 가 둘 다 부르는 바람에
       감시가 두 개 돌아 요약이 두 번 나갔다 — 두 목소리가 겹쳐 들렸다. */
    if (slotFor === page && (slotTimer || slotDone)) return;
    slotFor = page;
    clearInterval(slotTimer);
    slotTimer = 0;
    slotDone = false;
    if (slotSkip(PAGES[pi].n)) return;
    var at = slotAt(PAGES[pi].n);
    if (at === null || flowOpen()) return;
    var from = pi, t0 = Date.now();
    slotTimer = setInterval(function () {
      if (pi !== from || slotDone || flowOpen()) { clearInterval(slotTimer); slotTimer = 0; return; }
      /* 영상이 있으면 그 재생 위치를, 없으면(못 읽었을 때) 시계를 쓴다.
         영상 요소만 보고 있으면 영상이 안 뜨는 기기에서 요약이 영영 안 나온다. */
      var v = document.querySelector('#bg video');
      var t = v ? v.currentTime : (Date.now() - t0) / 1000;
      if (t < at) return;
      slotDone = true;
      clearInterval(slotTimer);
      /* 영상은 끄지 않고 낮춘다 — 배경음이 이어져야 장면이 안 끊긴다 */
      Scenes.duck(true, 0.22);
      sumPlay(PAGES[from].n, function () {
        if (pi !== from) return;
        Scenes.duck(false);
        /* 요약이 영상보다 늦게 끝났으면 여기서 넘긴다 —
           안 그러면 말하는 도중에 쪽이 바뀐다 */
        if (flowVideoDone && !flowOpen()) flowNext();
      });
    }, 120);
  }

  /* 영상이 끝났다. 요약을 읽어 주고 넘어간다 */
  var flowVideoDone = false;
  /* 영상이 끝난 뒤 요약이 나갈 때, 멈춘 화면을 그대로 두면 7초가 죽은 시간이 된다.
     마지막 구간을 소리 없이 다시 흘려 장면이 계속 움직이게 한다 —
     소리를 껐으니 대사와 겹칠 일은 없다. */
  var tailEl = null;
  function tailReplay(on) {
    if (!on) {
      /* 건드렸던 그 요소만 되돌린다. 다시 찾으면 전환 중에 옛 영상을 집어
         소리를 켜 버려 다음 쪽 대사와 겹친다. */
      if (tailEl) { tailEl.loop = false; tailEl = null; }
      return;
    }
    var v = document.querySelector('#bg video');
    if (!v) return;
    tailEl = v;
    v.classList.remove('still');
    v.muted = true;                 /* 소리는 끈 채로 그림만 다시 흐른다 */
    v.loop = true;
    try { v.currentTime = Math.max(0, (v.duration || 0) - 6); } catch (e) {}
    var pr = v.play();
    if (pr && pr.catch) pr.catch(function () {});
  }

  /* 쪽을 넘길 때 옛 영상을 세운다.
     scenes.js 는 옛 레이어를 860ms 동안 DOM 에 남겨 두는데 소리를 끄지 않아,
     그 사이 새 쪽 영상이 시작하면 대사 둘이 겹쳐 들린다.

     음소거만으로는 안 된다 — scenes.js 의 applyAudio() 가 화면에 있는 모든
     영상에 음소거 상태를 다시 적용해서, duck(false) 한 번이면 되살아난다.
     그래서 아예 정지시킨다. 사라지는 중(0.38초)이라 멈춘 그림이어도 티가 안 난다. */
  function flowHushOld() {
    var vs = document.querySelectorAll('#bg video');
    for (var i = 0; i < vs.length; i++) {
      vs[i].loop = false;
      vs[i].muted = true;
      vs[i].volume = 0;
      try { vs[i].pause(); } catch (e) {}
    }
    tailEl = null;
  }

  function flowSummaryThenNext() {
    if (flowOpen() || atEnd || !started) return;
    var from = pi;
    /* 영상 도중에 이미 들려줬으면 다시 읽지 않는다.
       아직 말하는 중이면 그쪽 콜백이 넘길 때까지 기다린다 */
    if (slotDone) { if (!sumPlaying) flowNext(); return; }

    /* 요약을 내보내지 않는 쪽이면 곧장 넘긴다.
       ※ 여기서 걸러야 한다. 아래 tailReplay 를 먼저 걸면 영상이 6초 뒤로
          되감겨 다시 흐르다가 넘어간다 — 장면이 중복돼 보이는 원인이었다. */
    var n = PAGES[pi].n;
    var S = window.MOC.SUMMARY;
    if (slotSkip(n) || !S || !S[n]) { flowNext(); return; }

    tailReplay(true);
    sumPlay(n, function () {
      tailReplay(false);
      if (pi !== from || flowOpen()) return;
      flowNext();
    });
  }

  /* 낭독이 끝나면 다음 쪽으로. 마지막 쪽이면 THE END 로 간다. */
  function flowNext() {
    clearTimeout(flowTimer);
    var from = pi;
    /* 본문 낭독이 진행을 맡을 때만 길이를 검사한다.
       영상 모드는 쪽이 영상 길이(7~20초)만큼만 머무르므로,
       낭독 길이(30~43초)를 기준으로 재면 매번 '너무 빨리 끝났다'로 막힌다.

       소리를 못 내는 기기에서는 '읽기'가 즉시 끝난 것으로 들어온다.
       그대로 두면 쪽이 우르르 넘어가므로 그때는 멈추고 사람에게 맡긴다. */
    var A = window.MOC.ALIGN && window.MOC.ALIGN[PAGES[pi].n];
    var want = (flowOpen() && A) ? A.duration * 1000 : 0;
    var spent = Date.now() - flowT0;
    if (want && spent < want * 0.5) {
      console.warn('[flow] 낭독이 ' + (spent / 1000).toFixed(1) + '초 만에 끝났습니다' +
                   ' (예상 ' + (want / 1000).toFixed(1) + '초). 자동 넘김을 멈춥니다 — 페이저 › 로 넘겨 주세요.');
      flowState('idle');
      return;
    }
    flowTimer = setTimeout(function () {
      if (pi !== from || atEnd || busy) return;
      if ($('#scrim').classList.contains('on')) return;   /* 카드를 열어 두었으면 기다린다 */
      flowState('turning');
      var go = function () {
        if (pi !== from || atEnd) return;
        if (pi < PAGES.length - 1) goTo(pi + 1); else showEnd();
      };
      /* 글이 사라지는 시간. 접혀 있으면 사라질 것이 없다 —
         그대로 기다리면 끝난 영상의 마지막 프레임이 그만큼 더 멈춰 서 있다. */
      if (flowOpen()) setTimeout(go, 200); else go();
    }, flowOpen() ? FLOW_GAP : FLOW_GAP_FOLDED);
  }
  var Fit   = window.MOC.Fit;
  var TTS   = window.MOC.TTS;
  var Scenes = window.MOC.Scenes;

  var $ = function (s) { return document.querySelector(s); };

  /* 라인 아이콘 — 정보를 담은 것만 둔다(무엇을 누르는 버튼인지 알려 준다).
     currentColor를 쓰므로 버튼 색을 따라간다. */
  var SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
            ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var ICON = {
    speaker: SVG + '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.4 9.2a4 4 0 0 1 0 5.6"/>' +
             '<path d="M18.2 6.4a8 8 0 0 1 0 11.2"/></svg>',
    mute:    SVG + '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M16.5 10l4.5 4.5"/>' +
             '<path d="M21 10l-4.5 4.5"/></svg>',
    /* 아이콘은 "지금 상태"가 아니라 "누르면 벌어지는 일"을 가리킨다.
       펼쳐진 책을 보고 있을 때 → 닫힌 책(접겠다), 접혀 있을 때 → 펼친 책(펴겠다) */
    book:     SVG + '<path d="M5 5a2 2 0 0 1 2-2h11v18H7a2 2 0 0 1-2-2V5Z"/>' +
              '<path d="M18 17H7a2 2 0 0 0-2 2"/></svg>',
    /* 따라 읽기 — 가운데 줄만 진하다. "지금 이 줄을 읽는다"는 뜻 */
    lines:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
              ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
              '<path d="M4 6.5h16" stroke-opacity=".38"/><path d="M4 12h11" stroke-width="2.6"/>' +
              '<path d="M4 17.5h16" stroke-opacity=".38"/></svg>',
    /* 읽는 중 — 누르면 멈춘다 */
    stop:     SVG + '<rect x="6.5" y="6.5" width="11" height="11" rx="2.4"/></svg>',
    /* 채점 표시 — 글자 O/X 는 서체가 모서리를 정해 버린다. 획으로 그려서 끝을 둥글게 */
    markO: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"' +
           ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
           '<circle cx="12" cy="12" r="7.6"/></svg>',
    markX: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"' +
           ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
           '<path d="M7.6 7.6 16.4 16.4"/><path d="M16.4 7.6 7.6 16.4"/></svg>',
    /* NEXT 옆 화살표 — 주 동작이라 획을 굵게, 끝은 둥글게 */
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"' +
             ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
             '<path d="M9 5.5 15.5 12 9 18.5"/></svg>',
    bookOpen: SVG + '<path d="M12 7.5v13"/>' +
              '<path d="M3 18a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5a4 4 0 0 1 4 3.5A4 4 0 0 1 16 4h5a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 2.5A3 3 0 0 0 9 18Z"/></svg>'
  };
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };

  var pi = 0, beats = [], bi = 0, answered = false, started = false, busy = false;
  var qi = 0;                    /* 이 쪽에서 지금 보여 주는 문제 번호 */
  /* 이미 맞힌 쪽. 뒤로 갔다가 돌아올 때 다시 풀게 하지 않는다 */
  var solved = Object.create(null);
  /* 쪽별 풀이 기록 — { wrong: 틀린 횟수, ok: 맞혔는가 }. 결과 화면이 읽는다 */
  var results = Object.create(null);

  /* ── 단어장 ──
     따로 담지 않는다. 단어 카드를 연 순간 그 단어이 쌓인다.
     새로고침해도 남도록 localStorage에 둔다(브라우저가 막으면 조용히 세션 한정). */
  var WB_KEY = 'moc.wordbook';
  var wordbook = (function () {
    try { return JSON.parse(localStorage.getItem(WB_KEY)) || {}; }
    catch (e) { return {}; }
  })();
  function wbSave() {
    try { localStorage.setItem(WB_KEY, JSON.stringify(wordbook)); } catch (e) {}
  }
  function wbCount() { return Object.keys(wordbook).length; }
  function wbSync() {
    $('#wbcount').textContent = wbCount();
    $('#wbcount').hidden = wbCount() === 0;
    /* 9 → 10 처럼 자릿수가 늘면 바 폭이 달라진다 */
    relayout();
  }
  function wbAdd(key, shown) {
    if (wordbook[key]) return;
    wordbook[key] = { w: shown, ko: DICT[key], n: PAGES[pi].n, t: Date.now() };
    wbSave();
    wbSync();
  }

  /* 본문을 단어 단위로 감싼다.
     사전에 있는 단어은 눌러서 뜻을 볼 수 있고(.w), 나머지는 따라 읽기에서
     밝기를 바꾸기 위한 껍데기(.wd)다.
     단어 사이의 쉼표·공백도 앞 단어와 같은 data-c 로 묶는다 —
     빼놓으면 글자만 어두워지고 구두점은 밝게 남아 얼룩덜룩해진다.
     data-c 는 원문에서의 시작 위치로, onboundary 의 charIndex 와 맞춰 본다. */
  function markup(raw, si) {
    var re = /[A-Za-z]+(?:'[A-Za-z]+)?/g, m, hits = [];
    while ((m = re.exec(raw)) !== null) hits.push({ w: m[0], i: m.index });
    if (!hits.length) return '<span class="wd" data-c="0">' + esc(raw) + '</span>';

    var out = '';
    if (hits[0].i > 0) out += '<span class="wd" data-c="0">' + esc(raw.slice(0, hits[0].i)) + '</span>';
    for (var n = 0; n < hits.length; n++) {
      var h = hits[n], k = h.w.toLowerCase(), hit = DICT[k];
      out += '<span class="wd' + (hit ? ' w' : '') + '" data-c="' + h.i + '"' +
             (hit ? ' data-w="' + k + '" data-s="' + si + '" role="button" tabindex="0"' : '') +
             '>' + esc(h.w) + '</span>';
      var tail = raw.slice(h.i + h.w.length, n + 1 < hits.length ? hits[n + 1].i : raw.length);
      if (tail) out += '<span class="wd" data-c="' + h.i + '">' + esc(tail) + '</span>';
    }
    return out;
  }

  function paint(lines) {
    $('#body').innerHTML = lines.map(function (l) {
      return '<span class="sent" data-i="' + l._i +
             '" role="button" tabindex="0">' + markup(l.t, l._i) + '</span>';
    }).join('');
  }

  function rebuild() {
    /* 크기는 화면이 정한다. 쪽마다 다시 재지 않으므로 같은 해상도에서는 전 쪽이 같다 */
    Fit.measure();
    beats = Fit.buildBeats($('#body'), PAGES[pi].lines, paint);
  }

  /* ── 읽기 구간 ── */
  function showBeat(i) {
    bi = Math.max(0, Math.min(i, beats.length - 1));
    paint(beats[bi]);
    Fit.fitBeat($('#body'));
    goLabel();
    meter();
    hlRead();          /* 모드가 꺼져 있으면 아무 일도 하지 않는다 */
  }

  /* ── 위·아래 상자 폭 맞추기 ──
     컨트롤 바는 내용(글자·아이콘)이 정하는 최소 폭이 있고, 본문 패널은 비율이다.
     둘을 그냥 두면 해상도마다 갈라진다. 바가 한 줄로 들어가는 데 필요한 폭을 재서
     --bar-w 에 넣고, 양쪽이 max(비율, --bar-w) 라는 같은 식을 쓰게 한다.
     ※ 반드시 조판(rebuild)보다 먼저 불러야 한다. 패널 폭이 바뀌기 때문이다. */
  function syncBarWidth() {
    var el = $('#ctl');
    var prev = el.style.width;
    el.style.width = 'max-content';
    var w = Math.ceil(el.getBoundingClientRect().width);
    el.style.width = prev;
    /* max-content 만으로는 모자란다. min-width 가 걸린 요소(쪽번호 칸 등) 때문에
       실제로 그려진 폭이 더 넓을 수 있고, 그러면 바가 열을 넘어 삐져나온다.
       둘 중 큰 값을 쓴다 — 이 값이 곧 열 너비가 되므로 다음 프레임에서 수렴한다. */
    w = Math.max(w, Math.ceil(el.getBoundingClientRect().width));
    document.documentElement.style.setProperty('--bar-w', w + 'px');
  }

  var relayout = function () {
    syncBarWidth();
    requestAnimationFrame(function () { rebuild(); showBeat(bi); });
  };

  /* ── 쪽 이동 ──
     앞으로 가는 길은 "정답을 맞혀야" 하나뿐이다. 상단 ›와 문제 띠의 [다음 쪽]이
     같은 관문을 쓴다. 뒤로 가는 것은 언제든 허용한다 — 다시 읽는 건 막을 이유가 없다. */
  /* 뒤로는 언제든, 앞으로는 문제를 푼 뒤에만.
     맞고 틀리고는 상관없다 — "풀었는가"가 관문이다.
     이미 푼 쪽으로 ‹ 로 돌아오면 기록이 살아나 ›가 다시 열린다. */
  function syncPager() {
    $('#pnum').textContent = PAGES[pi].n + ' / ' + PAGES.length;
    $('#prev').disabled = (pi === 0);
    $('#pnext').disabled = (pi === PAGES.length - 1) || !answered;
    $('#pnext').setAttribute('aria-label',
      answered ? '다음 쪽' : '다음 쪽 (문제를 풀어야 넘어갈 수 있어요)');
  }
  function goTo(idx) {
    if (busy) return;
    if (idx < 0 || idx > PAGES.length - 1 || idx === pi) return;
    busy = true;                                   /* 전환 중 재클릭 차단 */
    pi = idx;
    syncDevPage();
    render();
    /* 전환 애니메이션(450ms)만 막는다. 더 길면 눌러도 안 먹는 것처럼 느껴진다 */
    setTimeout(function () { busy = false; }, 400);
  }
  $('#prev').onclick = function () { goTo(pi - 1); };
  $('#pnext').onclick = function () { if (answered) goTo(pi + 1); };

  /* ── 쪽 렌더 ── */
  function render() {
    var p = PAGES[pi];
    stopNarration();
    answered = true;          /* 문제가 없으므로 쪽 이동이 잠기지 않는다 */
    /* 문제 띠를 "즉시" 접는다.
       트랜지션(0.42초)에 맡기면 새 쪽의 첫 조판이 아직 펼쳐진 띠 높이로 계산되어,
       실제로는 여유가 있는데도 쪽이 둘로 쪼개진다. */
    var qz = $('#quiz');
    qz.style.transition = 'none';
    $('#app').dataset.q = 'hidden';
    void qz.offsetHeight;                 /* 리플로우를 강제해 접힘을 확정한다 */
    qz.style.transition = '';
    $('#scene').textContent = 'SCENE ' + String(p.n).padStart(2, '0') + ' · ' + p.scene;
    qi = 0;
    paintOpts();
    syncPager();
    syncRequiz();
    unlockGo();

    flowHushOld();
    flowPoster(p.video);
    Scenes.show(p.bg, flowVideo(p.video), p.flip);

    syncBarWidth();
    stopNudge();
    clearTimeout(flowTimer);
    flowT0 = Date.now();
    flowProgress();
    flowState('reading');
    /* 새 영상이 붙은 뒤에 속도를 다시 건다 */
    setTimeout(function () { setRate(rateAt); }, 700);
    /* 지금 쪽이 자리를 잡고 나서 다음 쪽을 받는다 — 지금 것과 대역폭을 다투지 않게.
       너무 늦게 걸면 짧은 쪽(8쪽 8.0초)에서 다 받기 전에 넘어가, 다음 영상이
       뜰 때까지 정지 그림이 서 있는다. 자리를 잡자마자 시작한다. */
    setTimeout(function () { flowWarm(PAGES[pi].n + 1); }, 900);
    /* 한 쪽 더 미리. 8초짜리 쪽이 이어지면 한 쪽 앞만으로는 모자란다 */
    setTimeout(function () { flowWarm(PAGES[pi].n + 2); }, 3200);
    flowVideoDone = false;
    sumStop();
    tailReplay(false);
    /* 영상이 있는 쪽은 재생이 끝나는 시점을 기다린다. 없으면 시간으로 간다.
       ※ 영상이 있어도 안전망을 하나 둔다 — 파일이 크거나 재생이 막히면
          'ended' 가 영영 안 와서 신호가 아예 안 뜬다. */
    armNudge(p.video ? NUDGE_STUCK : NUDGE_IDLE);
    /* 반드시 이 순서다 — 조판을 다시 하고(rebuild) 읽기 구간을 잡은(showBeat)
       뒤에 소리를 건다. 뒤집으면 hlRead 가 '이전 쪽의 구간'으로 읽을 자리를
       계산해, 엉뚱한 구간을 짧게 읽고 끝나 버린다. 그러면 낭독이 안 끝났는데
       다음 쪽으로 넘어간다 — 2쪽부터 그랬다. */
    requestAnimationFrame(function () {
      rebuild(); showBeat(0); startNarration();
      flowAudioMode(); slotWatch();
    });
  }

  /* ── 검증 패널 계측 ── */
  function meter() {
    var el = $('#meter'); if (!el) return;
    var b = $('#body'), folded = $('#app').dataset.read === 'off';
    var bgStat = Scenes.status();
    if (folded) {
      el.innerHTML = '<span class="warn">책 접힘 — 배경 전체화면</span>' +
        '<div class="hint">읽어주기와 문제는 그대로 진행됩니다.<br>' +
        '배경 ' + bgStat.source + ' · ' + bgStat.note + '<br>' +
      '음성 ' + TTS.voiceName + '</div>';
      return;
    }
    el.innerHTML =
      '본문 <b>' + Fit.fitted + 'px</b> · ' + beats.length + '개 읽기 구간 (' + (bi + 1) + '번째)<br>' +
      (Fit.fitted === Fit.SIZE
        ? '<span class="ok">● 이 해상도 공통 ' + Fit.SIZE + 'px · 한 줄 ' +
          Math.round(b.clientWidth / (Fit.SIZE * 0.5)) + '자</span>'
        : Fit.fitted >= Fit.FLOOR
          ? '<span class="warn">▲ 한 문장이 길어 ' + Fit.fitted + 'px로 축소</span>'
          : '<span class="warn">▲ 바닥 미달</span>') +
      '<div class="hint">' + document.body.dataset.f + ' ' + document.body.dataset.w + ' · ' +
      document.body.dataset.panel + ' · 상자 ' + b.clientWidth + '×' + b.clientHeight +
      ' / 여유 ' + Math.round(Fit.availHeight(b)) +
      ' / 칸 ' + ($('#read') ? $('#read').clientHeight : 0) + '<br>' +
      (b.scrollHeight > b.clientHeight + 2 ? '<span class="warn">▲ 넘침 ' +
        (b.scrollHeight - b.clientHeight) + 'px</span><br>' : '') +
      '한 줄 약 ' + Math.round(b.clientWidth / (Fit.fitted * 0.5)) + '자<br>' +
      '배경 ' + bgStat.source + ' · ' + bgStat.note + '</div>';
  }

  /* ── 접기 / 펴기 ──
     컨트롤 바가 패널 밖에 있으므로 접어도 읽어주기·문제 흐름은 끊기지 않는다 */
  /* 패널 중심에서 책 버튼 중심까지의 거리. CSS 는 버튼 자리를 모르므로 여기서 잰다 */
  var SUCK_IN = 220, SUCK_OUT = 280;
  function flowSuckVars() {
    var sh = $('#sheet'), b = $('#fold');
    if (!sh || !b) return false;
    var a = sh.getBoundingClientRect(), r = b.getBoundingClientRect();
    if (!a.width || !r.width) return false;
    /* 깔때기가 모이는 지점 — 버튼 중심이 패널 폭의 몇 %에 있나 */
    var cx = (r.left + r.width / 2) - a.left;
    sh.style.setProperty('--oxp', Math.max(2, Math.min(98, cx / a.width * 100)).toFixed(1) + '%');
    /* 패널 아래끝에서 버튼까지의 거리 */
    sh.style.setProperty('--gy', Math.round((r.top + r.height / 2) - a.bottom) + 'px');
    return true;
  }

  /* 맥의 최소화처럼 책 버튼으로 빨려 들어간다.
     거리를 잴 수 없거나 움직임을 줄이는 설정이면 예전 방식으로 접는다. */
  function setFold(off) {
    var st = $('#stage');
    $('#fold').innerHTML = off ? ICON.bookOpen : ICON.book;
    $('#fold').setAttribute('aria-label', off ? '책 펴기' : '책 접기');
    $('#fold').setAttribute('aria-pressed', off ? 'true' : 'false');

    var calm = matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;

    if (off) {
      if (calm || !flowSuckVars()) {
        $('#app').dataset.read = 'off';
        setTimeout(meter, 470);
        return;
      }
      st.dataset.suck = 'in';
      setTimeout(function () {
        /* 'done' 으로 넘긴다. 여기서 속성을 떼면 패널이 원래 크기로 되돌아와
           잔상처럼 번쩍인다. 펼칠 때까지 숨김을 유지한다. */
        st.dataset.suck = 'done';
        $('#app').dataset.read = 'off';
        meter();
      }, SUCK_IN);
      return;
    }

    /* 펼 때는 자리를 잡은 뒤에 재야 한다 — 접혀 있는 동안 패널 폭이 0이다.
       'done' 은 그대로 둔 채 잰다. visibility:hidden 은 자리를 지우지 않으므로
       숨긴 상태에서도 크기를 알 수 있다.
       먼저 떼면 아무 스타일 없는 패널이 한 프레임 원래 크기로 드러나 잔상이 된다. */
    $('#app').dataset.read = 'on';
    void $('#read').offsetHeight;              /* 자리 확정 */
    var ok = flowSuckVars();
    if (calm || !ok) {
      st.removeAttribute('data-suck');
      setTimeout(function () { rebuild(); showBeat(bi); }, 470);
      return;
    }
    /* 'done' → 'out' 한 번에 바꾼다. 사이에 빈 상태를 두지 않는다 */
    st.dataset.suck = 'out';
    setTimeout(function () {
      st.removeAttribute('data-suck');
      rebuild();
      showBeat(bi);
    }, SUCK_OUT);
  }
  $('#fold').onclick = function () {
    flowFoldTouched = true;      /* 이제부터는 사람이 정한다 */
    flowPeeking = false;         /* 사람이 손을 댔으면 더는 '보여 주는 중'이 아니다 */
    flowWantOpen = !flowWantOpen;
    setFold(!flowWantOpen);
    /* 펼치면 본문 낭독으로, 접으면 영상 소리로 */
    flowAudioMode();
  };

  /* ── 따라 읽기 ──
     쪽의 문장을 차례로 읽으면서 지금 줄만 또렷하게 남긴다.
     영상 소리는 끄고 간다 — 대사가 겹치면 어느 쪽도 안 들린다.
     켜 두면 쪽을 넘길 때마다 그 쪽을 처음부터 읽는다. */
  var hlOn = false;      /* 모드가 켜져 있나 */
  var hlAudioWas = null; /* 켜기 직전의 영상 소리 상태. 끌 때 되돌린다 */

  /* 화면에 그려진 단어을 문장별로 모아 둔다. 읽는 동안 매번 다시 찾지 않는다 */
  var hlWords = [];      /* [문장][{el, c}] */
  var hlCur = -1;        /* 지금 읽는 문장 */
  var hlTick = 0;        /* 시간으로 밀어 주는 타이머 */
  var hlT0 = 0;          /* 이번 문장이 시작한 시각 */
  var hlReal = false;    /* onboundary 가 실제로 오는 브라우저인가 */
  var hlSaid = '';
  /* 말하는 속도(초당 글자). 기기·음성·rate 마다 다르므로 고정값은 반드시 어긋난다.
     문장 하나를 읽을 때마다 실제 걸린 시간으로 다시 재서 다음 문장에 쓴다.
     한 번 잰 값은 저장해 두어 다음에 열 때는 첫 문장부터 맞게 간다. */
  var CPS_KEY = 'moc.cps';
  var HL_CPS0 = 13.5;    /* 아직 재 보기 전의 짐작값 */
  /* 눈이 소리보다 아주 조금 앞서야 "따라 읽는다"로 느껴진다.
     뒤처지면 곧바로 어긋난 것으로 보인다. 일부러 조금 빠르게 민다. */
  var HL_LEAD = 1.06;
  var hlSeen = 0;        /* 몇 번이나 실제로 재 봤나 */
  var hlCps = (function () {
    try {
      var v = parseFloat(localStorage.getItem(CPS_KEY));
      if (v > 3 && v < 60) { hlSeen = 3; return v; }
    } catch (e) {}
    return HL_CPS0;
  })();
  function hlLearn(chars, ms) {
    if (ms < 300 || chars < 12) return;          /* 너무 짧으면 표본이 못 된다 */
    var cps = chars / (ms / 1000);
    if (cps < 3 || cps > 60) return;             /* 말이 안 되는 값은 버린다 */
    /* 처음 몇 번은 그대로 받는다. 천천히 섞으면 앞쪽 문장이 계속 어긋난다. */
    var w = hlSeen === 0 ? 1 : (hlSeen < 3 ? 0.6 : 0.35);
    hlCps = hlCps * (1 - w) + cps * w;
    hlSeen++;
    try { localStorage.setItem(CPS_KEY, hlCps.toFixed(2)); } catch (e) {}
  }

  function hlMode(m) {
    if (hlSaid === m) return;
    hlSaid = m;
    console.info('[따라 읽기] ' + (
      m === 'file' ? '음성 파일 + 정렬 데이터 — 실제 재생 위치를 따라갑니다'
      : m === 'word' ? '내장 음성 · onboundary 를 줍니다'
      : '내장 음성 · 시간 추정 (onboundary 없음)'));
  }

  /* ── 말의 리듬 ──
     낭독 속도는 일정하지 않다. 글자 수로 나누면 긴 단어에서 앞서고
     쉼표·마침표에서 뒤처진다. 시간을 음절 수에 비례해 나누고
     구두점에는 쉼을 얹어야 실제 억양을 따라간다. */
  function hlSyll(w) {
    w = w.toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return 0;
    if (w.length <= 3) return 1;
    w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
    var m = w.match(/[aeiouy]{1,2}/g);
    return m ? m.length : 1;
  }
  /* 한 토막(단어 + 뒤따르는 구두점)이 차지할 몫. 음절 하나를 1로 본다 */
  function hlWeight(seg) {
    var w = seg.match(/[A-Za-z']+/);
    var n = w ? hlSyll(w[0]) : 0.4;
    if (/[.!?]/.test(seg)) n += 1.6;            /* 문장 끝의 쉼이 가장 길다 */
    else if (/[,;:]/.test(seg)) n += 0.8;
    else if (/[—–-]/.test(seg)) n += 0.5;
    return Math.max(0.5, n);
  }

  /* onboundary 가 안 오는 브라우저를 위해 시간으로 단어를 훑는다.
     문장을 통째로 켜면 "한 단어 뒤 전부 켜짐"이 되어 따라 읽기가 아니게 된다. */
  function hlSweep(k, text, live) {
    clearTimeout(hlTick);
    var ws = hlWords[k] || [];
    var starts = [];
    for (var i = 0; i < ws.length; i++)
      if (!starts.length || ws[i].c > starts[starts.length - 1]) starts.push(ws[i].c);
    if (!starts.length) return;

    hlMode('est');
    /* 토막별 몫을 재고, 문장 전체 예상 시간을 그 비율대로 나눈다 */
    var segs = [], wts = [], sum = 0;
    for (i = 0; i < starts.length; i++) {
      var seg = text.slice(starts[i], i + 1 < starts.length ? starts[i + 1] : text.length);
      var wt = hlWeight(seg);
      segs.push(seg); wts.push(wt); sum += wt;
    }
    var totalMs = text.length / (hlCps * HL_LEAD) * 1000;
    var n = 0;
    (function step() {
      if (!live() || hlCur !== k) return;
      hlPaint(k, starts[n]);
      var ms = Math.max(70, totalMs * wts[n] / sum);
      n++;
      if (n >= starts.length) return;        /* 문장 끝. 다음 문장 신호를 기다린다 */
      hlTick = setTimeout(step, ms);
    })();
  }

  function hlScan() {
    hlWords = Array.prototype.map.call($('#body').querySelectorAll('.sent'), function (sn) {
      var ws = Array.prototype.map.call(sn.querySelectorAll('.wd'), function (w) {
        return { el: w, c: +w.dataset.c, nc: Infinity };
      });
      /* 단어와 그 뒤 구두점은 data-c 가 같다. 한 덩어리로 움직여야 하므로
         "다음 단어가 시작하는 위치"를 각자 들고 있게 한다. */
      for (var i = ws.length - 2; i >= 0; i--)
        ws[i].nc = ws[i + 1].c > ws[i].c ? ws[i + 1].c : ws[i + 1].nc;
      return ws;
    });
  }
  function hlSet(el, cls) { el.className = el.className.replace(/ (said|now)\b/g, '') + cls; }

  /* 읽은 단어는 중간 밝기로 남기고, 지금 단어만 또렷하게. 앞은 어둡다.
     지나온 자리가 남아 있어야 "어디까지 읽었나"가 보인다. */
  function hlPaint(si, ci) {
    for (var j = 0; j < hlWords.length; j++) {
      var ws = hlWords[j];
      for (var k = 0; k < ws.length; k++) {
        var cls = '';
        if (j < si) cls = ' said';
        else if (j === si) {
          if (ci == null) cls = ' now';                   /* 문장 단위 폴백 */
          else if (ws[k].c > ci) cls = '';                /* 아직 안 읽음 */
          else cls = ws[k].nc <= ci ? ' said' : ' now';
        }
        hlSet(ws[k].el, cls);
      }
    }
  }
  function hlClear() {
    clearTimeout(hlTick);
    for (var j = 0; j < hlWords.length; j++)
      for (var k = 0; k < hlWords[j].length; k++) hlSet(hlWords[j][k].el, '');
    hlCur = -1;
  }
  /* 낱말 카드를 열며 멈춘 자리. 닫으면 여기서부터 이어 읽는다.
     이걸 안 들고 있으면 카드를 닫을 때마다 처음으로 되감겼다 — 읽던 데까지
     칠해진 하이라이트가 지워지고, 이미 읽은 데를 다시 읽어 겹쳐 들렸다. */
  var hlPaused = null;
  var hlLastT = 0;       /* 마지막으로 읽던 자리(초) */

  function hlStopRead() {
    flowReadKey = '';
    hlPaused = null;          /* 멈춰 둔 자리도 버린다 — 이건 '끝내기'다 */
    Voice.stop();
    $('#app').dataset.hl = hlOn ? 'on' : 'off';
    hlClear();
  }
  /* 정렬 데이터의 글자 위치는 쪽 전체 기준이고, 화면의 낱말은 문장별 기준이다.
     쪽 기준 위치가 어느 문장에 속하는지 찾는다. */
  function alignLineOf(A, c) {
    for (var i = 0; i < A.lines.length; i++) {
      var L = A.lines[i];
      if (c >= L.c && c < L.c + L.len) return i;
    }
    return -1;
  }

  /* 쪽 전체 기준 글자 위치를 받아 화면의 해당 낱말을 칠한다.
     지금 그려져 있는 낱말(hlWords)을 기준으로 하므로, 다시 그린 뒤에는
     반드시 hlScan() 을 먼저 불러야 한다. */
  function hlPaintPageC(c) {
    var A = window.MOC.ALIGN && window.MOC.ALIGN[PAGES[pi].n];
    if (!A) return;
    var li = alignLineOf(A, c);
    if (li < 0) return;
    var lines = beats[bi] || [];
    for (var k = 0; k < lines.length; k++) {
      if (lines[k]._i === li) { hlCur = k; hlPaint(k, c - A.lines[li].c); return; }
    }
  }

  /* 책을 펼치면 본문을 다시 그린다 — 그 순간 하이라이트가 붙어 있던 낱말들이
     화면에서 사라진다. 새로 그려진 낱말을 다시 잡고, 지금 재생 위치에 맞춰 칠한다.
     이걸 빼먹으면 펼친 뒤로 하이라이트가 멈춘 것처럼 보인다. */
  function hlResync() {
    var A = window.MOC.ALIGN && window.MOC.ALIGN[PAGES[pi].n];
    hlScan();
    $('#app').dataset.hl = 'reading';
    if (!A) return;
    var t = Voice.time, c = null;
    for (var i = 0; i < A.words.length; i++) {
      if (A.words[i].t <= t) c = A.words[i].c; else break;
    }
    if (c != null) hlPaintPageC(c);
  }

  /* 미리 만들어 둔 음성으로 따라 읽는다. 실제 재생 위치를 그대로 쓰므로
     브라우저가 onboundary 를 주든 말든 똑같이 동작한다. */
  function hlReadVoice(live, fromT) {
    var n = PAGES[pi].n, A = window.MOC.ALIGN && window.MOC.ALIGN[n];
    if (!A || !Voice.has(n)) return false;
    var lines = beats[bi] || [];
    if (!lines.length) return false;

    /* 이 구간이 담고 있는 원문 문장 번호 → 화면에 그려진 자리 */
    var slot = {};
    for (var k = 0; k < lines.length; k++) slot[lines[k]._i] = k;
    var first = A.lines[lines[0]._i], last = A.lines[lines[lines.length - 1]._i];
    if (!first || !last) return false;

    hlMode('file');
    var startAt = (fromT != null && fromT > first.t && fromT < last.t1) ? fromT : first.t;
    if (fromT != null) {
      console.info('[따라 읽기] ' + startAt.toFixed(1) + '초부터 이어 읽습니다' +
                   (startAt === first.t ? ' (자리를 못 찾아 처음부터)' : ''));
    }
    return Voice.play(n, {
      /* 이어 읽기 — 카드를 닫고 돌아온 자리. 구간 밖이면 처음부터 */
      from: startAt,
      to: last.t1 + 0.15,
      onWord: function (i, c) {
        if (!live()) return;
        /* 지금 어디를 읽고 있는지 계속 적어 둔다. 낱말 카드를 열 때
           Voice.time 을 바로 못 읽는 경우가 있어(이미 멈춰 있거나 내장 음성으로
           읽는 중) 그때는 이 값을 쓴다. */
        hlLastT = Voice.time || hlLastT;
        hlPaintPageC(c);
      },
      onEnd: function (ok) {
        if (!live()) return;
        if (ok) { hlStopRead(); flowNext(); return; }
        /* 파일을 못 읽었다. 내장 음성으로 내려간다 */
        console.warn('[따라 읽기] 음성 파일 재생 실패 — 내장 음성으로 갑니다');
        hlReadTTS(live);
      }
    });
  }

  /* 낭독을 멈추되 어디까지 읽었는지는 남긴다. 하이라이트도 지우지 않는다 —
     어디까지 읽었는지 보여야 이어지는 느낌이 난다. */
  function hlPause() {
    /* 재생 중이 아니어도 기억한다 — 카드를 열기 직전에 무엇이 먼저 멈춰
       세웠을 수 있다. 그때 자리를 버리면 닫을 때 처음부터 다시 읽는다. */
    var t = (Voice.playing ? Voice.time : 0) || hlLastT;
    if (!hlOn || !flowReadKey || !(t > 0.05)) { hlPaused = null; Voice.stop(); return; }
    hlPaused = { key: flowReadKey, t: t };
    Voice.stop();
    $('#app').dataset.hl = 'on';      /* '읽는 중' 표시만 내린다 */
  }

  /* 멈춘 자리에서 이어 읽는다. 이어 읽을 것이 없으면 false */
  function hlResume() {
    var p = hlPaused;
    hlPaused = null;
    if (!p || !hlOn || !started || atEnd) return false;
    if (p.key !== pi + ':' + bi) return false;
    return hlReadAt(p.t);
  }

  /* fromT 를 주면 그 자리부터, 안 주면 이 구간 처음부터 */
  /* 카드가 열려 있나 — 낱말·문장·단어장·결과 */
  function cardOpen() {
    return $('#scrim').classList.contains('on') ||
           $('#wbscrim').classList.contains('on') ||
           $('#resscrim').classList.contains('on');
  }

  function hlReadAt(fromT) {
    if (!hlOn || !started) return false;
    /* 카드를 열어 둔 동안에는 낭독을 시작하지 않는다.
       조판을 다시 하거나 화면이 바뀌면 showBeat → hlRead 로 여기까지 오는데,
       그때 낭독이 되살아나 낱말 발음 위에 겹쳤다. */
    if (cardOpen()) return false;
    var lines = beats[bi] || [];
    if (!lines.length) return false;
    /* 낭독이 시작되는 자리는 여기 하나뿐이다. 요약은 여기서 확실히 끊는다 —
       두 목소리가 겹치면 둘 다 안 들린다. 요약 시각을 재던 타이머도 함께 끈다. */
    sumStop();
    clearInterval(slotTimer); slotTimer = 0;
    flowReadKey = pi + ':' + bi;
    var from = pi, fromBi = bi, mine = ++hlToken;
    var live = function () { return hlOn && pi === from && bi === fromBi && mine === hlToken; };

    hlLastT = fromT || 0;
    hlScan();
    if (fromT == null) hlClear();     /* 이어 읽을 때는 칠해 둔 것을 지우지 않는다 */
    $('#app').dataset.hl = 'reading';
    if (hlReadVoice(live, fromT)) return true;
    hlReadTTS(live);
    return true;
  }

  function hlRead() {
    if (!hlOn || !started) return;
    var lines = beats[bi] || [];
    if (!lines.length) return;
    /* 책을 펴면 조판을 다시 하느라 여기까지 온다. 읽던 중이면 건드리지 않는다 —
       안 그러면 펼치는 순간 낭독이 처음으로 되감긴다. */
    var key = pi + ':' + bi;
    if (Voice.playing && flowReadKey === key) { hlResync(); return; }
    if (hlPaused && hlPaused.key === key) { hlResume(); return; }
    hlReadAt(null);
  }

  /* 음성 파일이 없을 때의 그물. 브라우저 내장 음성으로 읽고,
     onboundary 가 오면 실제 위치를, 안 오면 음절·구두점으로 시간을 나눈다. */
  function hlReadTTS(live) {
    var lines = beats[bi] || [];
    if (!lines.length || !TTS.supported) return;
    TTS.speakLines(lines, {
      tag: PAGES[pi].n + '쪽 따라 읽기',
      rate: TTS.RATE_SENT,
      gap: 320,
      /* 큐에 넣은 시점. 아직 소리는 안 난다 — 자리만 잡아 둔다 */
      onSentence: function (k) {
        if (!live()) return;
        hlCur = k;
        hlPaint(k, -1);
      },
      /* 소리가 실제로 나기 시작한 순간. 여기서부터 따라간다 */
      onSpeakStart: function (k) {
        if (!live()) return;
        hlCur = k;
        hlT0 = Date.now();
        hlPaint(k, 0);
        /* 진짜 신호가 오는 브라우저면 그쪽에 맡기고, 아니면 시간으로 민다.
           첫 문장에서는 아직 모르므로 일단 밀어 두고, 신호가 오면 즉시 넘긴다. */
        if (!hlReal) hlSweep(k, lines[k].t, live);
      },
      onSentenceEnd: function (k) {
        if (!live()) return;
        var ms = Date.now() - hlT0, ch = lines[k].t.length;
        var was = hlCps;
        hlLearn(ch, ms);
        /* 추정으로 돌 때는 얼마나 어긋났는지 눈으로 볼 수 있어야 한다.
           실제 초당 글자수와 우리가 쓰던 값이 크게 다르면 그만큼 밀린다. */
        if (!hlReal) {
          console.info('[따라 읽기] ' + (k + 1) + '문장 · ' + ch + '자 ' +
            (ms / 1000).toFixed(1) + '초 → 실제 ' + (ch / (ms / 1000)).toFixed(1) +
            '자/초 (쓰던 값 ' + was.toFixed(1) + ' → ' + hlCps.toFixed(1) + ')');
        }
        clearTimeout(hlTick);
        /* 추정이 뒤처졌더라도 여기서 실제 위치로 맞춘다.
           그래서 어긋남이 한 문장을 넘어 쌓이지 않는다. */
        if (k + 1 < lines.length) hlPaint(k + 1, -1);
      },
      onWord: function (k, ci) {
        if (!live()) return;
        hlReal = true;
        hlMode('word');
        clearTimeout(hlTick);
        hlCur = k;
        hlPaint(k, ci);
      },
      onEnd: function () {
        if (!live()) return;
        hlStopRead();
        flowNext();
      }
    });
  }
  var hlToken = 0;

  function setHl(on) {
    hlOn = !!on;
    TTS.stop();
    var btn = $('#hl');
    btn.innerHTML = hlOn ? ICON.stop : ICON.lines;
    btn.setAttribute('aria-pressed', hlOn ? 'true' : 'false');
    btn.setAttribute('aria-label', hlOn ? '따라 읽기 멈추기' : '따라 읽기');
    if (hlOn) {
      /* 영상 소리를 끄고, 끌 때 되돌리기 위해 원래 상태를 기억해 둔다 */
      if (hlAudioWas === null) hlAudioWas = Scenes.audioOn;
      Scenes.setAudio(false);
      stopNarration();
      hlStopRead();
      hlRead();
    } else {
      hlStopRead();
      if (hlAudioWas !== null) { Scenes.setAudio(hlAudioWas); hlAudioWas = null; }
    }
    syncSound();
  }
  $('#hl').onclick = function () { setHl(!hlOn); };

  /* ── 성우 낭독 ──
     쪽 전체가 아니라 content.js의 narrate.lines 가 고른 문장만 읽는다.
     영상 소리는 끄지 않고 낮추기만 한다(duck) — 분위기 소리는 계속 들려야 한다. */
  var narrateTimer = 0, narrateAudio = null;

  /* 읽을 문장을 고른다. text 를 주면 원문 대신 그 문장을 읽는다 —
     원문 한 줄이 너무 길어 앞부분만 읽히고 싶을 때 쓴다. */
  function narrateLines(page) {
    var cfg = page.narrate;
    if (!cfg) return [];
    if (cfg.text) return cfg.text.map(function (t) { return { t: t }; });
    return (cfg.lines || []).map(function (i) { return page.lines[i]; }).filter(Boolean);
  }

  function stopNarration() {
    clearTimeout(narrateTimer);
    if (narrateAudio) {
      /* src 를 떼면 error 이벤트가 뜬다. 그 폴백이 돌면 이전 쪽 문장을
         내장 음성이 읽기 시작한다 — 표를 남겨 물러나게 한다. */
      narrateAudio.dead = true;
      narrateAudio.pause();
      narrateAudio.removeAttribute('src');
      narrateAudio = null;
    }
    TTS.stop();
    Scenes.duck(false);
  }

  /* 쪽 음성에서 낭독할 구간을 잘라 재생한다.
     narrate.text 가 있으면 원문 한 줄의 앞부분만 읽는 설정이므로,
     그 문구의 마지막 낱말이 끝나는 지점까지만 간다. */
  function narrateVoice(from, cfg, done) {
    var n = PAGES[from].n, A = window.MOC.ALIGN && window.MOC.ALIGN[n];
    if (!A || !Voice.has(n)) return false;
    var idx = cfg.lines || [0];
    var L0 = A.lines[idx[0]], Lz = A.lines[idx[idx.length - 1]];
    if (!L0 || !Lz) return false;

    var to = Lz.t1 + 0.15;
    if (cfg.text) {
      var frag = cfg.text.join(' ').replace(/[^A-Za-z]+$/, '');
      var endC = L0.c + frag.length;
      var last = null;
      for (var i = 0; i < A.words.length; i++) {
        if (A.words[i].c < endC) last = A.words[i].t1; else break;
      }
      if (last) to = last + 0.15;
    }
    return Voice.play(n, {
      from: L0.t, to: to,
      onEnd: function (ok) {
        if (ok) done('쪽 음성 · ' + A.file);
        else done('쪽 음성 재생 실패');
      }
    });
  }

  function startNarration() {
    /* 이 판에는 '쪽 앞머리만 읽어 주는 낭독'이 없다.
       소리는 둘 중 하나다 — 접혀 있으면 영상 소리, 펼치면 본문 전체 낭독.
       여기를 살려 두면 영상을 눌러 놓고 그 위에 낭독을 얹어 소리가 겹친다. */
    return;
    /* eslint-disable no-unreachable */

    /* 따라 읽기가 켜져 있으면 그쪽이 읽는다.
       ※ 반드시 stopNarration() 보다 먼저 빠져나가야 한다. 쪽을 넘길 때
          showBeat() 가 먼저 읽기를 시작하는데, 여기서 stop 을 부르면 그걸 죽인다. */
    if (hlOn) return;
    stopNarration();
    var cfg = PAGES[pi].narrate;
    if (!cfg || !started) return;
    var lines = narrateLines(PAGES[pi]);
    if (!lines.length) return;

    narrateTimer = setTimeout(function () {
      var t0 = Date.now(), from = pi;
      Scenes.duck(true, cfg.duck == null ? 0.08 : cfg.duck);

      var done = function (how) {
        Scenes.duck(false);
        if (pi !== from) return;
        console.info('[narrate] ' + (from + 1) + '쪽 · ' + how + ' · ' +
                     ((Date.now() - t0) / 1000).toFixed(1) + '초');
      };

      /* 폴백은 한 번만, 그리고 그 쪽에 머물러 있을 때만 돈다.
         error 와 play() 거부가 둘 다 오는 브라우저가 있다. */
      var fellBack = false;
      var viaTTS = function () {
        if (fellBack || pi !== from) return;
        fellBack = true;
        if (!TTS.supported) { done('음성 없음'); return; }
        TTS.speakLines(lines, {
          tag: (from + 1) + '쪽',
          rate: cfg.rate, gap: cfg.gap, pitch: cfg.pitch,
          onEnd: function () { done('시스템 음성 · ' + TTS.voiceName); }
        });
      };

      /* 쪽 음성이 있으면 그 안의 해당 구간만 재생한다.
         따라 읽기·문장·낱말과 같은 파일이라 목소리가 갈릴 수 없다. */
      if (narrateVoice(from, cfg, done)) return;

      /* 미리 만들어 둔 성우 음성이 있으면 그것을 쓴다.
         음량은 tools/normalize_audio.py 로 맞춰 두었으므로 여기서 키우지 않는다 —
         재생 중에 배율로 올리면 튀는 구간이 잘려 나간다. */
      if (!cfg.audio) { viaTTS(); return; }

      var a = new Audio('assets/audio/' + cfg.audio);
      a.preload = 'auto';
      a.volume = 1;
      narrateAudio = a;
      a.addEventListener('ended', function () {
        narrateAudio = null;
        fellBack = true;                       /* 다 들었으니 폴백은 없다 */
        done('음성 파일 · ' + cfg.audio);
      });
      a.addEventListener('error', function () {
        if (a.dead) return;                    /* 멈추느라 뗀 것이지 실패가 아니다 */
        console.warn('[narrate] 음성 파일을 못 읽어 시스템 음성으로 갑니다:', cfg.audio);
        narrateAudio = null;
        viaTTS();
      });
      var pr = a.play();
      if (pr && pr.catch) pr.catch(function () {
        if (a.dead) return;
        narrateAudio = null;
        viaTTS();
      });
    }, cfg.delay || 0);
  }

  /* ── 소리 ──
     본문 낭독 TTS는 걷어냈다. 지문 소리는 배경 mp4가 담당한다.
     TTS 모듈은 남아 있고, 단어·문장 모달의 발음 버튼에만 쓰인다. */

  /* ── NEXT 를 누르라는 신호 ──
     화면 곳곳에 흩어놓지 않는다. 신호는 이 버튼 하나뿐이고,
     "이제 넘어갈 때"라는 근거가 생겼을 때만 켠다.
       · 배경 영상이 한 바퀴 다 돌고 마지막 장면에서 멈췄을 때 (기본)
       · 영상이 없거나 못 읽은 쪽이면 일정 시간이 지났을 때 (보루)
     다섯 번 숨 쉬고 스스로 멎는다. 계속 뛰면 잔소리가 된다. */
  var NUDGE_IDLE = 9000, NUDGE_AFTER_VIDEO = 1400, nudgeTimer = 0;
  var NUDGE_STUCK = 32000;   /* 영상이 끝나지 않을 때의 안전망 */
  /* ?cue=1 — 신호를 바로 켜서 모양을 확인한다 */
  var CUE_FORCE = /[?&]cue=1\b/.test(location.search);
  function stopNudge() {
    if (CUE_FORCE) return;
    clearTimeout(nudgeTimer);
    $('#gowrap').classList.remove('nudge');
  }
  function armNudge(delay) {
    if (CUE_FORCE) { $('#gowrap').classList.add('nudge'); return; }
    clearTimeout(nudgeTimer);
    nudgeTimer = setTimeout(function () {
      /* 문제가 이미 열렸으면 할 일은 NEXT가 아니라 답 고르기다 */
      if ($('#app').dataset.q !== 'hidden') return;
      $('#gowrap').classList.add('nudge');
    }, delay);
  }

  function goLabel() {
    var g = $('#go');
    /* 앞으로 가는 버튼은 하나뿐이므로 문구도 하나로 둔다.
       마지막 구간이면 문제가 열리고, 아니면 다음 구간으로 넘어간다 —
       아이 입장에서는 둘 다 "다음"이다. */
    var last = bi >= beats.length - 1;
    g.innerHTML = g.classList.contains('wait') ? '잠시만…' : 'NEXT' + ICON.chevron;
    /* 화면 문구가 짧아진 만큼, 실제로 무슨 일이 일어나는지는 여기에 담는다 */
    var endNext = END && pi === PAGES.length - 1 && answered;
    g.setAttribute('aria-label',
      (endNext ? '이야기 끝내기' : last ? '다 읽었어요, 문제 풀기' : '계속 읽기') +
      (beats.length > 1 ? ' (읽기 구간 ' + beats.length + '개 중 ' + (bi + 1) + '번째)' : ''));
  }
  function unlockGo() { $('#go').classList.remove('wait'); goLabel(); }

  /* #play는 이제 영상 소리 스위치다. 배경이 절차적 씬이면 소리가 없으므로 숨는다. */
  /* ── 읽는 속도 ──
     느리게는 두지 않는다 — 낭독이 이미 동화 읽어 주는 속도다.
     숫자를 그대로 보여 준다. 아이콘으로는 "지금 몇 배"가 안 보인다. */
  var RATES = [1, 1.25, 1.5];
  var rateAt = 0;
  function syncRate() {
    var btn = $('#rate'); if (!btn) return;
    var r = RATES[rateAt];
    btn.innerHTML = '<b class="rate">' + r + '×</b>';
    btn.setAttribute('aria-label', '읽는 속도 ' + r + '배 — 눌러서 바꾸기');
    btn.setAttribute('aria-pressed', r === 1 ? 'false' : 'true');
  }
  function setRate(i) {
    rateAt = (i + RATES.length) % RATES.length;
    var r = RATES[rateAt];
    Voice.setRate(r);
    /* 영상도 같은 속도로 — 안 그러면 소리와 그림이 갈라진다.
       scenes.js 를 건드리지 않으려고 화면의 <video> 를 직접 짚는다. */
    var vs = document.querySelectorAll('#bg video');
    for (var k = 0; k < vs.length; k++) { try { vs[k].playbackRate = r; } catch (e) {} }
    /* 요약 낭독도 같은 속도로 — 빼 두면 영상만 빨라지고 요약만 늘어져 들린다 */
    curRate = r;
    if (sumAudio) { try { sumAudio.playbackRate = r; } catch (e) {} }
    syncRate();
  }
  $('#rate').onclick = function () { setRate(rateAt + 1); };

  /* ── 소리 크기 ──
     스피커를 누르면 슬라이더가 버튼 위로 올라온다.
     아이콘은 지금 크기를 말해 준다 — 꺼짐 / 작음 / 큼. */
  var VOL_KEY = 'moc.vol';
  var volOpen = false;
  /* 기본을 가운데(0.5)에 둔다. <audio>.volume 의 천장이 1이라,
     여기서 시작해야 위로 올릴 여지가 남는다. 1을 넘겨 키울 방법은 없고,
     넘기려고 증폭을 걸면 튀는 구간이 잘려 나간다. */
  var VOL_DEFAULT = 0.5;
  /* 기본값이 바뀌면 예전에 저장해 둔 크기를 한 번 버린다.
     안 그러면 새 기본값이 영영 안 먹고 손잡이가 끝에 붙어 있다. */
  var VOL_RULE = 'moc.vol.rule', VOL_RULE_V = '2';
  (function () {
    try {
      if (localStorage.getItem(VOL_RULE) === VOL_RULE_V) return;
      localStorage.setItem(VOL_RULE, VOL_RULE_V);
      localStorage.removeItem(VOL_KEY);
    } catch (e) {}
  })();
  function volRead() {
    try { var v = parseFloat(localStorage.getItem(VOL_KEY)); return (v >= 0 && v <= 1) ? v : VOL_DEFAULT; }
    catch (e) { return VOL_DEFAULT; }
  }
  function syncSound() {
    var btn = $('#play'), sl = $('#vol');
    if (!btn) return;
    btn.hidden = false;
    var v = Voice.volume;
    btn.innerHTML = v === 0 ? ICON.mute : ICON.speaker;
    btn.style.opacity = v === 0 ? '.55' : '';
    btn.setAttribute('aria-label', '소리 크기 ' + Math.round(v * 100) + '%');
    btn.setAttribute('aria-pressed', volOpen ? 'true' : 'false');
    if (sl) sl.value = Math.round(v * 100);
    $('#stage').dataset.vol = volOpen ? 'open' : '';
  }
  function setVolume(v) {
    Voice.setVolume(v);
    try { localStorage.setItem(VOL_KEY, String(v)); } catch (e) {}
    syncSound();
  }
  $('#play').onclick = function () { volOpen = !volOpen; syncSound(); };
  $('#vol').oninput = function () { setVolume(+this.value / 100); };
  /* 다른 곳을 누르면 슬라이더를 닫는다 */
  addEventListener('pointerdown', function (e) {
    if (!volOpen) return;
    if (e.target.closest('#vol') || e.target.closest('#play')) return;
    volOpen = false; syncSound();
  });

  /* ── 다 읽었어요 / 계속 읽기 ──
     낭독이 끝나는 시점이 없어졌으므로 버튼은 처음부터 눌린다.
     진행을 막는 관문은 "정답을 맞혀야 다음 쪽" 하나만 남는다. */
  /* ── 마지막 화면 ──
     11쪽 문제까지 끝난 뒤 NEXT 를 누르면 나온다.
     쪽이 하나 더 늘어나는 게 아니라 별도의 상태다 — 쪽수도 문제 수도 그대로 11이다. */
  var atEnd = false;
  function showEnd() {
    if (!END || atEnd) return;
    atEnd = true;
    stopNudge();
    stopNarration();
    if (hlOn) setHl(false);
    $('#stage').dataset.end = 'on';
    flowPoster(END.video);
    Scenes.show(END.bg, flowVideo(END.video), END.flip);
    $('#theend').focus();
  }
  function leaveEnd() {
    if (!atEnd) return;
    atEnd = false;
    $('#stage').dataset.end = 'off';
    var p = PAGES[pi];
    flowHushOld();
    flowPoster(p.video);
    Scenes.show(p.bg, flowVideo(p.video), p.flip);
    $('#pnext').focus();
  }
  /* 처음부터 다시. 마지막 화면에서 나가고, 시작할 때와 같은 상태로 되돌린다 */
  function flowRestart() {
    clearTimeout(flowTimer);
    sumStop();
    Voice.stop();
    TTS.stop();
    atEnd = false;
    $('#stage').dataset.end = 'off';
    flowVideoDone = false;
    flowFoldTouched = false;
    flowWantOpen = true;        /* 다시 잠깐 보여 주고 접는다 */
    flowPeeking = true;
    hlOn = false;
    $('#app').dataset.read = 'on';
    $('#stage').removeAttribute('data-suck');
    $('#fold').innerHTML = ICON.book;
    pi = 0;
    syncDevPage();
    render();
    Scenes.setAudio(true);
    syncSound();
    setTimeout(function () {
      if (flowFoldTouched || atEnd) return;
      flowPeeking = false;
      flowWantOpen = false;
      setFold(true);
      flowAudioMode();
    }, FLOW_PEEK);
  }
  $('#again').onclick = function (e) { e.stopPropagation(); flowRestart(); };

  $('#theend').onclick = leaveEnd;
  $('#theend').onkeydown = function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); leaveEnd(); }
    if (e.key === 'Escape') leaveEnd();
  };

  $('#go').onclick = function () {
    if ($('#go').classList.contains('wait')) return;
    stopNudge();
    /* 마지막 쪽에서 문제까지 끝냈으면 다음은 THE END 다 */
    if (END && pi === PAGES.length - 1 && answered) { showEnd(); return; }
    if (bi < beats.length - 1) {
      showBeat(bi + 1);
      return;
    }
    /* 이 판에는 문제가 없다. NEXT 는 곧장 다음 쪽으로 — 기다리지 않고 건너뛰고 싶을 때 쓴다 */
    clearTimeout(flowTimer);
    if (pi < PAGES.length - 1) goTo(pi + 1); else showEnd();
  };

  /* ── 문제 띠 ── */
  /* ↻ — 같은 쪽의 다른 문제로 바꾼다. 문제가 하나뿐인 쪽에서는 다시 풀기가 된다.
     기록과 관문도 함께 초기화한다. 새 문제를 풀어야 다음 쪽으로 넘어간다. */
  function nextQuiz() {
    var set = quizSet(PAGES[pi]);
    qi = (qi + 1) % set.length;
    delete solved[pi];
    delete results[pi];
    answered = false;
    paintOpts();
    syncPager();
    syncRequiz();
  }
  function syncRequiz() {
    var many = quizSet(PAGES[pi]).length > 1;
    var btn = $('#requiz');
    btn.hidden = !(many || answered);       /* 바꿀 문제가 있거나, 되돌릴 답이 있을 때 */
    btn.setAttribute('aria-label', many ? '다른 문제 보기' : '이 문제 다시 풀기');
    btn.setAttribute('title', many ? '다른 문제' : '다시 풀기');
  }
  $('#requiz').onclick = nextQuiz;

  /* 한 쪽에 문제가 여러 개다. q/o/a 가 첫 문제, alt[] 가 나머지. */
  function quizSet(p) { return [{ q: p.q, o: p.o, a: p.a }].concat(p.alt || []); }
  function curQuiz() {
    var set = quizSet(PAGES[pi]);
    return set[Math.min(qi, set.length - 1)];
  }

  /* 보기를 현재 기록대로 그린다. 쪽을 다시 열어도 O/X가 그대로 남는다. */
  function paintOpts() {
    var p = curQuiz(), r = results[pi];
    $('#qtext').textContent = p.q;
    $('#opts').innerHTML = p.o.map(function (o, i) {
      var mark = 'ABCD'[i], cls = '';
      if (r) {
        if (i === p.a) { cls = ' correct'; mark = 'O'; }
        else if (i === r.picked) { cls = ' wrong'; mark = 'X'; }
      }
      return '<button type="button" class="opt' + cls + '" data-i="' + i + '">' +
             '<span class="k">' + mark + '</span><span>' + esc(o) + '</span></button>';
    }).join('');
  }

  /* 정답을 맞힐 때까지 누르는 방식이 아니다. 한 번 고르면 그것으로 끝난다.
     틀리면 고른 보기에 X, 정답 자리에 O를 함께 보여 준 뒤 다음 쪽으로 넘어간다. */
  var ADVANCE_OK = 950, ADVANCE_NO = 2000;
  $('#opts').addEventListener('click', function (e) {
    var o = e.target.closest('.opt');
    if (!o || answered) return;

    var p = curQuiz(), picked = +o.dataset.i, ok = picked === p.a;
    answered = true;
    solved[pi] = 1;                       /* 풀었으므로 앞으로 갈 수 있다 (맞고 틀리고와 무관) */
    results[pi] = { ok: ok, picked: picked };
    paintOpts();
    if (!ok) {
      /* 틀렸다는 것을 몸으로 알린다. 표시는 지우지 않고 남는다 */
      var el = $('#opts').children[picked];
      if (el) { el.classList.add('shake'); setTimeout(function () { el.classList.remove('shake'); }, 400); }
    }
    syncPager();
    syncRequiz();

    if (pi < PAGES.length - 1) {
      var from = pi;
      setTimeout(function () {
        /* 기다리는 동안 직접 넘겼거나 다시 풀기를 눌렀으면 가만히 둔다 */
        if (pi === from && answered && !busy) goTo(from + 1);
      }, ok ? ADVANCE_OK : ADVANCE_NO);   /* 틀렸을 때는 정답을 읽을 시간을 더 준다 */
    }
  });

  /* ── 모달 ── */
  var mSay = '', lastFocus = null;
  var mPlay = null;          /* 이 카드를 소리내는 함수 */
  function sayCard() { if (mPlay) mPlay(); }
  function openModal() {
    /* 낱말을 누르면 낭독을 멈춘다 — 낱말 발음과 겹치면 둘 다 안 들린다.
       끝내는 것이 아니라 자리를 기억해 두었다가 카드를 닫으면 이어 간다. */
    hlPause();
    lastFocus = document.activeElement;
    /* 영상 소리는 끈다. duck(true) 만 부르면 기본값 0.08 로 '올라가' 버린다 —
       본문을 읽는 동안에는 이미 0 이었으므로, 낱말을 누르는 순간 영상 소리가
       되살아났다. 크기를 직접 못박는다. */
    Scenes.duck(true, 0);
    $('#scrim').classList.add('on');
    $('#m-say').onclick = sayCard;
    $('#m-close').focus();
  }
  function closeModal() {
    /* 책을 편 채였으면 낭독으로 돌아간다 — 영상 소리를 되살리면 안 된다.
       duck(false) 는 원래 크기까지 올려 버린다. */
    if (flowOpen() && hlOn) Scenes.duck(true, 0); else Scenes.duck(false);
    Voice.stop();
    TTS.stop();
    $('#scrim').classList.remove('on');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    /* 멈춰 두었던 자리에서 이어 읽는다. 이어 갈 것이 없으면 평소 흐름대로 */
    if (!hlResume()) flowAudioMode();
  }
  /* 단어 카드는 단어와 뜻만 보여 준다.
     예문은 카드 뒤 본문에 그대로 있으므로 다시 싣지 않는다. */
  /* pc 는 쪽 전체 기준 글자 위치. 있으면 그 낱말이 실제로 발음된 구간을 재생한다 —
     본문을 읽어 준 그 목소리 그대로다. 없으면 내장 음성으로 내려간다. */
  function openWord(key, shown, pc) {
    wbAdd(key, shown);
    mSay = shown;
    var n = PAGES[pi].n;
    mPlay = function () {
      /* 낱말 하나만 읽은 파일이 있으면 그것으로 들려준다 — 잘라 쓸 일이 없으니
         이웃 낱말이 딸려 나오지 않는다. 파일이 없으면 쪽 낭독에서 잘라 쓰고,
         그것도 안 되면 브라우저 음성으로 내려간다. */
      Voice.sayWord(key, function (ok) {
        if (ok) return;
        if (pc != null && Voice.playWord(n, pc)) return;
        TTS.say(shown);
      });
    };
    $('#m-kind').textContent = 'WORD';
    $('#m-top').innerHTML =
      '<div class="m-word"><span class="term">' + esc(shown) + '</span>' +
      '<button type="button" class="m-say" id="m-say" aria-label="발음 듣기">' + ICON.speaker + '</button></div>' +
      '<div class="m-mean">' + esc(DICT[key]) + '</div>';
    openModal();
    sayCard();                                     /* 열자마자 한 번 읽어준다 */
  }
  function openSentence(idx) {
    var line = PAGES[pi].lines[idx];
    mSay = line.t;
    var n = PAGES[pi].n;
    mPlay = function () {
      if (Voice.playLine(n, idx)) return;
      TTS.say(line.t, TTS.RATE_SENT);
    };
    $('#m-kind').textContent = 'SENTENCE';
    $('#m-top').innerHTML =
      '<div class="m-word" style="align-items:flex-start">' +
      '<span class="m-sent" style="flex:1">' + esc(line.t) + '</span>' +
      '<button type="button" class="m-say" id="m-say" aria-label="문장 듣기">' + ICON.speaker + '</button></div>' +
      '<div class="m-mean" style="font-size:20px;font-weight:500">' + esc(line.ko) + '</div>';
    openModal();
    sayCard();
  }
  $('#m-close').onclick = closeModal;
  $('#scrim').onclick = function (e) { if (e.target === $('#scrim')) closeModal(); };
  /* 키보드 ← → 로도 넘긴다. 입력 중이거나 카드가 열려 있으면 건드리지 않는다 */
  addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if ($('#scrim').classList.contains('on') ||
        $('#resscrim').classList.contains('on') ||
        $('#wbscrim').classList.contains('on')) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    e.preventDefault();
    if (e.key === 'ArrowLeft') { goTo(pi - 1); return; }
    if (answered) goTo(pi + 1);          /* 앞으로는 문제를 푼 뒤에만 */
  });

  addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeModal();
    closeResults();
    closeWordbook();
  });
  /* 본문 클릭: 단어이 우선, 없으면 문장 */
  function bodyHit(target) {
    var w = target.closest('.w'), s = target.closest('.sent');
    if (w) {
      /* .wd 의 data-c 는 문장 안에서의 위치다. 정렬 데이터는 쪽 전체 기준이라 옮겨 준다 */
      var A = window.MOC.ALIGN && window.MOC.ALIGN[PAGES[pi].n];
      var si = +w.dataset.s, lc = +w.dataset.c, pc = null;
      if (A && A.lines[si] && !isNaN(lc)) pc = A.lines[si].c + lc;
      openWord(w.dataset.w, w.textContent, pc);
    } else if (s) openSentence(+s.dataset.i);
  }
  $('#body').addEventListener('click', function (e) { bodyHit(e.target); });
  $('#body').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault(); bodyHit(e.target);
  });

  /* 단어 그림 — assets/words/<단어>.jpg|png|webp 를 순서대로 시도한다.
     셋 다 없으면 <img>가 스스로 사라지고 뒤의 첫 글자 타일이 드러난다.
     즉 그림을 한 장도 안 넣어도 카드는 멀쩡하다. */
  var WB_EXT = ['jpg', 'png', 'webp'];
  function wbAttachImages(root) {
    Array.prototype.forEach.call(root.querySelectorAll('img[data-key]'), function (img) {
      var left = WB_EXT.slice(), key = (img.getAttribute('data-key') || '').replace(/'/g, '');
      var next = function () {
        if (!left.length) { img.remove(); return; }
        img.setAttribute('src', 'assets/words/' + key + '.' + left.shift());
      };
      img.addEventListener('error', next);
      next();
    });
  }

  var wbLastFocus = null;
  function openWordbook() {
    var keys = Object.keys(wordbook).sort(function (a, b) { return wordbook[a].t - wordbook[b].t; });
    $('#wbgrid').innerHTML = keys.map(function (k) {
      var e = wordbook[k];
      return '<figure class="wb-card">' +
        '<button type="button" class="wb-del" data-del="' + k + '"' +
        ' aria-label="' + esc(e.w) + ' 지우기" title="지우기">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"' +
        ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M7.5 7.5 16.5 16.5"/><path d="M16.5 7.5 7.5 16.5"/></svg></button>' +
        '<div class="wb-img"><span class="wb-initial">' + esc(e.w.charAt(0).toUpperCase()) + '</span>' +
        '<img data-key="' + k + '" alt="" loading="lazy">' + '</div>' +
        '<figcaption>' +
        '<b class="wb-w">' + esc(e.w) + '</b>' +
        '<span class="wb-ko">' + esc(e.ko || '') + '</span>' +
        '<span class="wb-n">' + e.n + ' Page</span>' +
        '</figcaption></figure>';
    }).join('');
    wbAttachImages($('#wbgrid'));
    $('#wbsum').textContent = keys.length ? '내가 찾은 단어 ' + keys.length + '개' : '';
    $('#wbempty').hidden = keys.length > 0;
    wbLastFocus = document.activeElement;
    $('#wbscrim').classList.add('on');
    $('#wbclose').focus();
  }
  function closeWordbook() {
    $('#wbscrim').classList.remove('on');
    if (wbLastFocus && wbLastFocus.focus) wbLastFocus.focus();
  }
  /* 단어 하나씩 지우기. 되돌리기는 두지 않았다 —
     본문에서 그 단어을 다시 누르면 그대로 되살아난다. */
  $('#wbgrid').addEventListener('click', function (e) {
    var b = e.target.closest('.wb-del'); if (!b) return;
    delete wordbook[b.getAttribute('data-del')];
    wbSave();
    wbSync();
    openWordbook();          /* 다시 그린다 */
  });
  $('#wbbtn').onclick = openWordbook;
  $('#wbclose').onclick = closeWordbook;
  $('#wbscrim').onclick = function (e) { if (e.target === $('#wbscrim')) closeWordbook(); };
  $('#wbprint').onclick = function () { window.print(); };
  $('#wbclear').onclick = function () {
    if (!wbCount()) return;
    if (!confirm('단어장을 비울까요? 되돌릴 수 없습니다.')) return;
    wordbook = Object.create(null);
    wbSave();
    wbSync();
    openWordbook();
  };

  /* ── 문제 결과 ──
     15쪽을 한눈에 보고, 눌러서 그 쪽으로 간다. */
  var resLastFocus = null;
  function openResults() {
    var nOk = 0, nNo = 0, nNone = 0;
    $('#resgrid').innerHTML = PAGES.map(function (p, i) {
      var r = results[i], cls, mark, label;
      if (!r) { cls = 'none'; mark = ''; label = '아직 안 풀었음'; nNone++; }
      else if (r.ok) { cls = 'ok'; mark = ICON.markO; label = '맞음'; nOk++; }
      else { cls = 'no'; mark = ICON.markX; label = '틀림'; nNo++; }
      return '<button type="button" class="res-cell ' + cls + '" data-p="' + i + '"' +
             ' aria-label="' + p.n + '쪽 · ' + label + '">' +
             '<b>' + p.n + '</b>' +
             (mark ? '<span class="res-mark">' + mark + '</span>' : '') +
             '</button>';
    }).join('');
    /* 통계 — 회색 카드 하나에 결과 한 줄과 그래프 둘.
       왼쪽 진행률은 전체 11 중 몇 개를 풀었나.
       오른쪽은 푼 문제를 초록·빨강으로 나눈 한 막대다. 둘을 따로 그리면
       합이 곧 푼 문제라는 관계가 안 보인다. */
    var total = PAGES.length, done = nOk + nNo;

    var pPct = Math.round(done / total * 100);
    var okPct = done ? Math.round(nOk / done * 100) : 0;
    var noPct = done ? 100 - okPct : 0;   /* 각각 반올림하면 합이 101%가 되기도 한다 */

    $('#rs-pn').textContent = pPct;
    $('#rs-wn').textContent = okPct;
    $('#rs-pc').textContent = done ? total + '문제 중 ' + done + '개 풀었어요'
                                   : '아직 시작하지 않았어요';
    $('#rs-wc').innerHTML = done
      ? '<i class="g">맞음 <b>' + nOk + '</b></i><i class="r">틀림 <b>' + nNo + '</b></i>'
      : '<span>풀면 여기에 나와요</span>';
    $('#rs-pbar').setAttribute('aria-label', '진행률 ' + pPct + '퍼센트');
    $('#rs-wbar').setAttribute('aria-label',
      done ? '푼 ' + done + '문제 중 ' + nOk + '개 맞고 ' + nNo + '개 틀림' : '아직 푼 문제 없음');

    /* 0에서 시작해 늘어나야 그래프로 읽힌다. 처음부터 그려 두면 그냥 색 막대다 */
    var pf = $('#rs-pbar').querySelector('.fill');
    var wOk = $('#rs-wbar').querySelector('.fill.ok');
    var wNo = $('#rs-wbar').querySelector('.fill.no');
    pf.style.width = '0%'; wOk.style.width = '0%'; wNo.style.width = '0%';
    requestAnimationFrame(function () {
      pf.style.width = pPct + '%';
      wOk.style.width = okPct + '%';
      wNo.style.width = noPct + '%';
    });

    resLastFocus = document.activeElement;
    $('#resscrim').classList.add('on');
    $('#resclose').focus();
  }
  function closeResults() {
    $('#resscrim').classList.remove('on');
    if (resLastFocus && resLastFocus.focus) resLastFocus.focus();
  }
  /* 처음부터 다시 읽기 — 문제 기록을 지우고 1쪽으로 돌아간다.
     기록을 남겨 두면 O/X가 그대로 있고 ›도 열려 있어서 "다시"가 되지 않는다.
     단어장은 건드리지 않는다 — 읽기와 별개로 쌓아 온 것이다. */
  function restartBook() {
    if (!confirm('처음부터 다시 읽을까요? 문제 결과가 지워집니다.\n(단어장은 그대로 남습니다)')) return;
    results = Object.create(null);
    solved = Object.create(null);
    answered = false;
    closeResults();
    if (pi === 0) render(); else goTo(0);
  }
  $('#restart').onclick = restartBook;
  $('#resbtn').onclick = openResults;
  $('#resclose').onclick = closeResults;
  $('#resscrim').onclick = function (e) { if (e.target === $('#resscrim')) closeResults(); };
  $('#resgrid').addEventListener('click', function (e) {
    var c = e.target.closest('.res-cell'); if (!c) return;
    closeResults();
    goTo(+c.dataset.p);
  });

  /* ── 시작 게이트 ── iOS는 첫 재생이 사용자 터치 뒤여야 한다 ── */
  function openGate() {
    var g = $('#gate'); if (!g || g.classList.contains('off')) return;
    g.classList.add('off');
    started = true;
    setTimeout(function () { if (g.parentNode) g.remove(); }, 600);
    /* 영상 소리가 이야기를 나른다 */
    Scenes.setAudio(true);
    Scenes.hold(false);        /* 여기서 비로소 0초부터 재생한다 */
    syncSound();

    /* 글을 잠깐 보여 준 뒤 접는다. 기본은 '보고 듣기'다.
       ※ flowPeeking 을 먼저 켜야 한다. 뒤에 켜면 flowAudioMode 가 부를 때
          아직 '펼쳐진 것'으로 보여 본문 낭독이 시작돼 버린다. */
    flowPeeking = true;
    flowAudioMode();
    /* 요약 자리 감시는 여기서 건다. 부팅 때 걸면 아직 '펼쳐진 것'으로 보여
       바로 빠져나가고, 1쪽은 시작 자리(0초)를 놓친다. */
    slotWatch();
    setTimeout(function () { flowWarm(2); }, 1500);
    setTimeout(function () {
      if (flowFoldTouched || !started) return;
      flowPeeking = false;
      flowWantOpen = false;
      setFold(true);
      flowAudioMode();
    }, FLOW_PEEK);
  }
  $('#gate').onclick = openGate;
  $('#gate').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGate(); }
  });

  /* ── 무대 축소(데스크톱에서 태블릿 비율 확인용) ── */
  var SIZES = [null, [1194, 834], [1024, 768]], si = 0;
  function stage() {
    var st = $('#stage'), s = SIZES[si];
    if (!s) { document.body.classList.remove('sim'); st.style.cssText = ''; return; }
    document.body.classList.add('sim');
    var k = Math.min((innerWidth - 40) / s[0], (innerHeight - 40) / s[1], 1);
    st.style.width = s[0] + 'px';
    st.style.height = s[1] + 'px';
    st.style.transform = 'translate(-50%,-50%) scale(' + k + ')';
  }

  /* ── 검증 패널 — ?dev=1 일 때만 붙는다 ── */
  var DEV = /[?&]dev=1\b/.test(location.search);
  var DEV_JUMPS = [[0, 'P01'], [1, 'P02 후렴'], [7, 'P08 최장']];
  function buildDev() {
    var el = document.createElement('div');
    el.id = 'dev';
    el.innerHTML =
      '<h4>L2 하단띠 · 접기/펴기</h4>' +
      '<div class="row" id="fsw"><button data-f="andika" class="sel">Andika</button>' +
      '<button data-f="atkinson">Atkinson</button><button data-f="lexend">Lexend</button></div>' +
      '<div class="row" id="wsw"><button data-w="400" class="sel">보통 400</button>' +
      '<button data-w="700">굵게 700</button></div>' +
      '<div class="row" id="nsw"><button data-n="dark" class="sel">어두운 패널</button>' +
      '<button data-n="light">밝은 패널</button></div>' +
      '<div class="row" id="psw">' + DEV_JUMPS.map(function (j, i) {
        return '<button data-p="' + j[0] + '"' + (i === 0 ? ' class="sel"' : '') + '>' + j[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="row" id="ssw"><button data-s="0" class="sel">실제 창</button>' +
      '<button data-s="1">iPad 1194</button><button data-s="2">iPad 1024</button></div>' +
      '<div class="row"><select id="vsel" aria-label="성우 음성"></select></div>' +
      '<div class="row"><button id="vtest">이 음성으로 1쪽 읽어보기</button></div>' +
      '<div id="meter"></div>';
    document.body.appendChild(el);
    var tg = document.createElement('button');
    tg.id = 'devtoggle'; tg.textContent = '검증 패널';
    document.body.appendChild(tg);

    function pick(sel, attr, fn) {
      $(sel).onclick = function (e) {
        var b = e.target.closest('button'); if (!b) return;
        Array.prototype.forEach.call($(sel).children, function (x) { x.classList.toggle('sel', x === b); });
        fn(b.dataset[attr]);
      };
    }
    pick('#fsw', 'f', function (v) { document.body.dataset.f = v; relayout(); });
    pick('#wsw', 'w', function (v) { document.body.dataset.w = v; relayout(); });
    pick('#nsw', 'n', function (v) { document.body.dataset.panel = v; relayout(); });
    pick('#psw', 'p', function (v) { pi = +v; render(); });
    pick('#ssw', 's', function (v) { si = +v; stage(); relayout(); });
    /* 음성 목록은 비동기로 채워진다 */
    TTS.onReady(function () {
      var sel = $('#vsel'); if (!sel) return;
      var vs = TTS.listVoices();
      sel.innerHTML = vs.map(function (v) {
        return '<option value="' + v.name.replace(/"/g, '') + '">' +
               esc(v.name) + ' · ' + v.lang + ' (' + v.score + ')</option>';
      }).join('') || '<option>영어 음성 없음</option>';
      var cur = TTS.voiceName.split(' (')[0];
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === cur) { sel.selectedIndex = i; break; }
      }
      sel.onchange = function () { TTS.setVoice(sel.value); meter(); };
    });
    /* 따라 읽기와 같은 속도로 들려준다. 다른 속도로 들어 보면 판단이 어긋난다 */
    $('#vtest').onclick = function () {
      var p0 = PAGES[0];
      TTS.speakLines([p0.lines[0]], { rate: TTS.RATE_SENT, gap: 300 });
    };
    tg.onclick = function () { document.body.classList.remove('hidedev'); };
    el.ondblclick = function () { document.body.classList.add('hidedev'); };
  }
  function syncDevPage() {
    var sw = $('#psw'); if (!sw) return;
    Array.prototype.forEach.call(sw.children, function (x) { x.classList.toggle('sel', +x.dataset.p === pi); });
  }

  /* ── 자동 감사 ──
     16쪽을 전부 조판해 보고 "18px 바닥을 지켰는가 / 넘치지 않는가"를 표로 낸다.
     ?dev=1&audit=1 로 켠다. 콘솔에서 MOC.audit() 로도 부를 수 있다.
     ※ 접힌 상태에서는 상자 높이가 0이라 계산이 무의미하므로 먼저 편다. */
  function audit() {
    if ($('#app').dataset.read === 'off') { console.warn('[audit] 책을 편 뒤에 다시 실행하세요'); return null; }
    var keepPi = pi, keepBi = bi, rows = [];
    for (var i = 0; i < PAGES.length; i++) {
      pi = i;
      rebuild();
      var minFs = Infinity, fits = true;
      for (var b = 0; b < beats.length; b++) {
        paint(beats[b]);
        /* 구간이 옳게 나뉘었다면 SIZE 그대로 들어가야 한다. 축소가 일어나면 그 쪽은 ✗ */
        Fit.fitBeat($('#body'));
        if (Fit.fitted !== Fit.SIZE) fits = false;
        minFs = Math.min(minFs, Fit.fitted);
      }
      rows.push({
        쪽: PAGES[i].n, 구간: beats.length, 최소폰트: minFs + 'px',
        공통크기유지: minFs === Fit.SIZE, 넘침없음: fits
      });
    }
    pi = keepPi; rebuild(); showBeat(Math.min(keepBi, beats.length - 1));

    var bad = rows.filter(function (r) { return !r.공통크기유지 || !r.넘침없음; });
    if (console.table) console.table(rows);
    var box = $('#audit') || document.createElement('div');
    box.id = 'audit';
    box.innerHTML = '<h4>조판 감사 · 상자 ' + $('#body').clientWidth + '×' + $('#body').clientHeight + '</h4>' +
      rows.map(function (r) {
        var ok = r.공통크기유지 && r.넘침없음;
        return '<div class="' + (ok ? 'ok' : 'warn') + '">P' + String(r.쪽).padStart(2, '0') +
               ' · ' + r.구간 + '구간 · ' + r.최소폰트 + ' ' + (ok ? '✓' : '✗') + '</div>';
      }).join('') +
      '<div class="sum ' + (bad.length ? 'warn' : 'ok') + '">' +
      (bad.length ? bad.length + '쪽 미달' : '16쪽 모두 통과') + '</div>';
    if (!box.parentNode) document.body.appendChild(box);
    return rows;
  }
  window.MOC.audit = audit;

  /* ── 부팅 ── */
  /* 영상 판정은 show() 뒤에 비동기로 끝난다. 소리 버튼과 계측을 그때 다시 그린다 */
  addEventListener('scenechange', function () {
    syncSound();
    meter();
    /* 영상을 못 읽어 절차적 씬으로 떨어졌으면 기다릴 "끝"이 없다. 시간으로 바꾼다 */
    var st = Scenes.status();
    if (PAGES[pi].video && st.source === '절차적' && /실패/.test(st.note || '')) {
      armNudge(NUDGE_IDLE);
      /* 영상을 못 읽으면 'ended' 가 영영 안 온다. 진행이 멈추지 않게 시계로 대신한다 */
      var from = pi;
      setTimeout(function () {
        if (pi !== from || flowVideoDone || atEnd) return;
        flowVideoDone = true;
        if (!flowOpen()) flowSummaryThenNext();
      }, 6000);
    }
  });

  /* 영상이 마지막 장면에서 멈춘 순간 — 여기가 "이제 넘어갈 때"다 */
  addEventListener('sceneended', function () {
    armNudge(NUDGE_AFTER_VIDEO);
    flowVideoDone = true;
    /* 책이 펼쳐져 있으면 본문 낭독이 진행을 맡는다 — 요약은 건너뛴다 */
    if (!flowOpen()) flowSummaryThenNext();
  });
  addEventListener('resize', function () { stage(); relayout(); });
  addEventListener('orientationchange', function () {
    setTimeout(function () { stage(); relayout(); }, 300);
  });

  TTS.init();
  TTS.onReady(function (ok) {
    /* TTS는 이제 모달의 발음 버튼에만 쓰인다. 없어도 진행에는 지장이 없다 */
    if (!ok) console.warn('[tts] 사용할 수 있는 음성이 없습니다 — 모달의 발음 버튼만 동작하지 않습니다');
  });

  Scenes.mount($('#bg'));
  /* 시작 화면 뒤에서 1쪽 영상이 저 혼자 흘러가지 않도록 세워 둔다.
     받아 두는 것은 그대로다 — 누르면 곧바로, 그리고 0초부터 나간다. */
  Scenes.hold(true);
  setHl(false);              /* 아이콘·라벨 초기화 */
  Voice.setVolume(volRead());
  syncRate();
  syncSound();
  syncBarWidth();
  wbSync();
  if (DEV) buildDev(); else document.body.classList.add('hidedev');
  stage();

  /* 서체가 뜨기 전에 맞추면 자간이 달라 계산이 틀어진다 */
  var AUDIT = /[?&]audit=1\b/.test(location.search);
  var boot = function () {
    render();
    if (AUDIT) setTimeout(audit, 400);
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot).catch(boot);
  else addEventListener('load', boot);
})();
