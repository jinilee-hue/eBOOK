/* ══════════════════════════════════════════════════════════════
   tts.js — 성우 낭독 + 단어·문장 발음
   쪽 전체를 읽지 않는다. 영상에 대사가 있는 구간은 영상이 맡고,
   내레이션 문장만 content.js의 narrate 설정에 따라 성우가 읽는다.
   iOS Safari 대비 규칙
     · 첫 재생은 반드시 사용자 터치 이후 (모달을 여는 것 자체가 터치다)
     · voiceschanged를 기다리되 1.2초 타임아웃. 그래도 없으면 unsupported
     · Apple의 en-GB 기본값은 Daniel(남성)이라 이름으로 여성 음성을 고른다
   ══════════════════════════════════════════════════════════════ */

window.MOC = window.MOC || {};

window.MOC.TTS = (function () {
  var synth = window.speechSynthesis;
  var supported = !!synth;
  var voice = null;
  /* 고른 음성의 신원. 브라우저가 음성 객체를 새로 만들어도 이름으로 되찾는다.
     쪽마다 목소리가 달라지면 안 된다 — 한 사람이 읽어 주는 책이다.
     새로고침해도 같은 음성이 나오도록 이름을 저장해 둔다. */
  var VOICE_KEY = 'moc.voice';
  var MANUAL_KEY = 'moc.voice.manual';   /* 사람이 직접 고른 것인가 */
  /* 고르는 규칙이 바뀌면 예전에 고정해 둔 음성을 한 번 버린다.
     네트워크 음성이 고정돼 있으면 따라 읽기가 계속 어긋나기 때문이다.
     사람이 직접 고른 것은 건드리지 않는다. */
  var RULE_KEY = 'moc.voice.rule', RULE = '6';
  (function () {
    try {
      /* ?voice=reset — 직접 고른 것까지 모두 풀고 자동 선택으로 돌아간다.
         직접 고른 음성은 규칙이 바뀌어도 유지되므로 빠져나올 길이 필요하다. */
      if (/[?&]voice=reset\b/.test(location.search)) {
        localStorage.removeItem(VOICE_KEY);
        localStorage.removeItem(MANUAL_KEY);
        localStorage.removeItem(RULE_KEY);
        console.info('[tts] 음성 고정을 풀었습니다 — 자동으로 다시 고릅니다');
      }
      if (localStorage.getItem(RULE_KEY) === RULE) return;
      localStorage.setItem(RULE_KEY, RULE);
      if (localStorage.getItem(MANUAL_KEY)) return;
      localStorage.removeItem(VOICE_KEY);
    } catch (e) {}
  })();
  var chosen = (function () {
    try {
      var n = localStorage.getItem(VOICE_KEY);
      return n ? { name: n, voiceURI: null,
                   manual: localStorage.getItem(MANUAL_KEY) === n } : null;
    } catch (e) { return null; }
  })();
  function remember(v, manual) {
    chosen = { name: v.name, voiceURI: v.voiceURI, manual: !!manual };
    try {
      localStorage.setItem(VOICE_KEY, v.name);
      if (manual) localStorage.setItem(MANUAL_KEY, v.name);
      else localStorage.removeItem(MANUAL_KEY);
    } catch (e) {}
  }
  function forget() {
    chosen = null;
    try {
      localStorage.removeItem(VOICE_KEY);
      localStorage.removeItem(MANUAL_KEY);
    } catch (e) {}
  }
  var readyCbs = [];
  var resolved = false;
  var playing = false;
  var token = 0;          /* 이전 시퀀스를 무효화하는 표 */

  /* ── 낭독 톤 ──
     본문 지문 낭독은 배경 영상의 소리가 맡는다(js/scenes.js).
     여기 남은 것은 모달에서 단어·문장 하나를 짚어 줄 때뿐이다. */
  var RATE_WORD = 0.62;    /* 단어 하나 — 또박또박 */
  var RATE_SENT = 0.72;    /* 문장 하나 — 동화 읽어 주는 속도 */

  /* ── 음성 고르기 ──
     Apple의 en-GB 기본값은 Daniel(남성)이라 그냥 두면 남자 목소리가 나온다.
     Web Speech API에는 성별 필드가 없으므로 이름으로 고른다. */
  var FEMALE = ['serena','kate','stephanie','martha','ava','samantha','allison',
                'susan','moira','tessa','fiona','karen','catherine','nicky',
                'shelley','flo','kathy','grandma','sandy','tara','veena','rishika',
                'zoe','joelle','noelle','nora','isha','siri female','samantha',
                'google uk english female','google us english',
                'sonia','libby','aria','zira','hazel','jenny','emma','clara','amber'];
  var MALE   = ['daniel','alex','fred','oliver','arthur','gordon','rishi','aaron',
                'nathan','tom','reed','eddy','jamie','grandpa','ryan','guy',
                'albert','junior','ralph','rocko','bruce','lee','xander',
                'david','mark','google uk english male'];
  /* 오래된 세대의 음성. 또렷하지 않고 느린 속도에서 뭉개진다.
     Premium/Enhanced 판본이 깔려 있으면 이름이 달라 여기 걸리지 않는다. */
  var LEGACY = ['moira','samantha','karen','tessa','fiona','victoria','alex',
                'daniel','veena','rishi','susan',
                'vicki','bruce','agnes'];
  /* 맥에 딸린 장난 음성들. 영어이긴 하나 낭독에 쓰면 안 된다. */
  var NOVELTY = ['bad news','good news','bahh','bells','boing','bubbles','cellos',
                 'jester','organ','superstar','trinoids','whisper','wobble',
                 'zarvox','deranged','hysterical','pipe organ','bahh'];
  var LANG_SCORE = { 'en-gb': 30, 'en-ie': 22, 'en-au': 20, 'en-za': 16, 'en-us': 14 };

  function scoreVoice(v) {
    var name = (v.name || '').toLowerCase();
    var lang = (v.lang || '').replace('_', '-').toLowerCase();
    if (lang.indexOf('en') !== 0) return -1000;

    var sc = LANG_SCORE[lang] || 6;
    var i;
    for (i = 0; i < NOVELTY.length; i++) if (name.indexOf(NOVELTY[i]) >= 0) return -900;
    for (i = 0; i < MALE.length; i++)   if (name.indexOf(MALE[i]) >= 0)   sc -= 200;
    for (i = 0; i < FEMALE.length; i++) if (name.indexOf(FEMALE[i]) >= 0) { sc += 200; break; }
    /* ── 소리 품질 ──
       이름으로 세대를 가른다. 90년대 계열(Moira·Samantha 류)은 느린 속도에서
       특히 뭉개진다. 이름 목록에만 기대면 이들이 상위 점수와 동점이 되어
       목록 순서로 이겨 버린다. 세대를 점수로 명시한다. */
    var hq = /premium|enhanced|neural|natural/.test(name);
    /* Premium 이 Enhanced 보다 한 급 위다. 같은 점수를 주면 목록 순서로 갈린다. */
    if (/premium/.test(name)) sc += 130;
    else if (hq) sc += 110;
    else if (name.indexOf('google') >= 0) sc += 60;               /* 크롬의 최신 음성 */
    /* 고품질 판본은 이름이 같아도(Ava (Premium)) 구형이 아니다. 건너뛴다. */
    if (!hq) for (i = 0; i < LEGACY.length; i++)
      if (name.indexOf(LEGACY[i]) >= 0) { sc -= 90; break; }
    if (/compact|eloquence/.test(name)) sc -= 60;
    /* 네트워크 음성은 onboundary(단어 위치)를 주지 않아 따라 읽기가 추정으로 돈다.
       그렇다고 크게 깎으면 구형 로컬 음성이 뽑혀 소리가 뭉개진다.
       소리가 먼저다 — 동점일 때만 로컬을 고르는 정도로 둔다. */
    if (v.localService === false) sc -= 8;
    return sc;
  }

  function pickVoice() {
    var vs = [];
    try { vs = synth.getVoices() || []; } catch (e) { vs = []; }
    /* 목록이 잠깐 비는 브라우저가 있다. 그때 null을 돌려주면 u.voice가 비어
       기본 음성(애플 en-GB = Daniel, 남성)으로 새어 나가고 쪽마다 목소리가 달라진다.
       쓰던 음성을 그대로 유지한다. */
    if (!vs.length) return voice;

    /* 이미 정한 음성이 있으면 그것을 되찾는다.
       단 남성·장난 음성이 고정돼 있으면 버린다 — 한 번 잘못 잡히면
       새로고침해도 계속 그 목소리가 나오기 때문이다. */
    if (chosen) {
      for (var j = 0; j < vs.length; j++) {
        if ((chosen.voiceURI && vs[j].voiceURI === chosen.voiceURI) || vs[j].name === chosen.name) {
          if (!chosen.manual && scoreVoice(vs[j]) < 0) { forget(); break; }
          if (!chosen.voiceURI) remember(vs[j], chosen.manual);
          return vs[j];
        }
      }
    }

    var best = null, bestScore = -Infinity;
    for (var i = 0; i < vs.length; i++) {
      var sc = scoreVoice(vs[i]);
      if (sc > bestScore) { bestScore = sc; best = vs[i]; }
    }
    /* 영어 음성이 아예 없으면 아무거나 */
    if (bestScore <= -1000) best = vs[0];
    if (best) remember(best);
    return best;
  }

  function settle(ok) {
    if (resolved) return;
    resolved = true;
    supported = ok;
    if (ok) {
      voice = pickVoice();
      if (voice) {
        console.info('[tts] 음성: ' + voice.name + ' (' + voice.lang + ') · ' +
          (voice.localService === false ? '네트워크 — onboundary 없음'
                                        : '기기 설치 — onboundary 기대됨') +
          (chosen && chosen.manual ? ' · 직접 고른 음성으로 고정됨' : '') +
          '  [바꾸려면 주소 끝에 ?voice=reset]');
      }
    }
    readyCbs.splice(0).forEach(function (cb) { cb(supported); });
  }

  function init() {
    if (!synth) { settle(false); return; }
    var check = function () {
      var vs = [];
      try { vs = synth.getVoices() || []; } catch (e) {}
      if (vs.length) settle(true);
    };
    check();
    if (!resolved) {
      try { synth.addEventListener('voiceschanged', check); }
      catch (e) { synth.onvoiceschanged = check; }
      setTimeout(function () {
        var vs = [];
        try { vs = synth.getVoices() || []; } catch (e) {}
        settle(vs.length > 0);
      }, 1200);
    }
  }

  function onReady(cb) {
    if (resolved) cb(supported); else readyCbs.push(cb);
  }

  function stop() {
    playing = false;
    token++;
    try { synth && synth.cancel(); } catch (e) {}
  }

  function utter(text, rate, pitch) {
    voice = pickVoice();                      /* 매번 같은 음성으로 되찾는다 */
    var u = new SpeechSynthesisUtterance(text);
    u.lang = (voice && voice.lang) || 'en-GB';
    if (voice) u.voice = voice;
    u.rate = rate == null ? RATE_SENT : rate;
    /* 피치를 살짝 내리면 밝기보다 온기 쪽으로 간다 */
    u.pitch = pitch == null ? 0.96 : pitch;
    u.volume = 1;
    return u;
  }

  /* ── 지문 낭독 ──
     쪽 전체를 읽지 않는다. content.js의 narrate.lines 가 고른 문장만 읽는다.
     영상에 대사가 있는 부분은 영상에 맡기고, 내레이션만 성우가 읽는 구조다.
     opts = { rate, gap, onSentence(i), onEnd(완료여부) } */
  function speakLines(lines, opts) {
    opts = opts || {};
    if (!lines || !lines.length) {
      if (opts.onEnd) opts.onEnd(false);
      return;
    }
    stop();
    playing = true;
    var my = ++token;
    /* 음성 목록이 채워질 때까지 기다린다 */
    onReady(function (ok) {
      if (my !== token) return;
      if (!ok) { playing = false; if (opts.onEnd) opts.onEnd(false); return; }
      run(lines, opts, my);
    });
  }

  function run(lines, opts, my) {
    var gap = opts.gap == null ? 300 : opts.gap;
    var i = 0;

    (function step() {
      if (!playing || my !== token) return;
      if (i >= lines.length) {
        playing = false;
        if (opts.onEnd) opts.onEnd(true);
        return;
      }
      var idx = i;
      if (opts.onSentence) opts.onSentence(idx);

      var u = utter(lines[idx].t, opts.rate, opts.pitch);
      /* 단어 단위 따라 읽기.
         iOS Safari 는 이 이벤트를 아예 안 주는 경우가 많다 —
         부르는 쪽이 문장 단위로 물러설 수 있게 시간 안에 안 오면 그쪽이 알아서 한다. */
      if (opts.onWord) {
        u.onboundary = function (e) {
          if (!playing || my !== token) return;
          if (e.name && e.name !== 'word') return;
          opts.onWord(idx, e.charIndex || 0, e.charLength || 0);
        };
      }
      if (idx === 0 && opts.tag) {
        console.info('[tts] ' + opts.tag + ' · ' + (u.voice ? u.voice.name + ' (' + u.voice.lang + ')' : '기본 음성'));
      }
      /* 소리가 실제로 나기 시작한 순간. speak() 를 부른 시점과는 다르다 —
         음성을 준비하는 데 수백 ms 가 걸리기도 한다.
         따라 읽기를 speak() 시점에 맞추면 그만큼 앞서 간다. */
      u.onstart = function () {
        if (my !== token) return;
        if (opts.onSpeakStart) opts.onSpeakStart(idx);
      };
      var advance = function () {
        if (my !== token) return;
        if (opts.onSentenceEnd) opts.onSentenceEnd(idx);
        i++;
        if (i >= lines.length) { step(); return; }
        setTimeout(function () { if (my === token && playing) step(); }, gap);
      };
      u.onend = advance;
      u.onerror = advance;
      try { synth.speak(u); } catch (e) { advance(); }
    })();
  }

  /* 단어·문장 하나만 읽는다 (모달용). 읽어주기 중이면 먼저 끊는다 */
  function say(text, rate) {
    stop();
    var my = token;
    onReady(function (ok) {
      if (!ok || my !== token) return;
      try { synth.speak(utter(text, rate == null ? RATE_WORD : rate)); } catch (e) {}
    });
  }

  /* 검증 패널에서 음성을 직접 골라 들어 보기 위한 것.
     이름을 넘기면 그 음성으로 고정된다. */
  /* 사람이 직접 고르면 그대로 따른다 — 남성이든 뭐든 되돌리지 않는다.
     이름 없이 부르면 고정을 풀고 자동 선택으로 되돌아간다. */
  function setVoice(name) {
    if (name) chosen = { name: name, voiceURI: null, manual: true };
    else forget();
    voice = pickVoice();
    return voice ? voice.name : null;
  }

  return {
    init: init,
    setVoice: setVoice,
    onReady: onReady,
    stop: stop,
    speakLines: speakLines,
    say: say,
    RATE_SENT: RATE_SENT,
    get supported() { return supported; },
    get playing() { return playing; },
    get voiceName() {
      if (!resolved) return '준비 중…';
      var v = voice || pickVoice();
      return v ? v.name + ' (' + v.lang + ')' : '—';
    },
    /* 검증용: 이 기기에서 쓸 수 있는 영어 음성을 점수순으로 본다 */
    listVoices: function () {
      var vs = [];
      try { vs = synth.getVoices() || []; } catch (e) {}
      return vs.map(function (v) { return { name: v.name, lang: v.lang, score: scoreVoice(v) }; })
               .filter(function (v) { return v.score > -1000; })
               .sort(function (a, b) { return b.score - a.score; });
    }
  };
})();
