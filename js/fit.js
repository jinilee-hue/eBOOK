/* ══════════════════════════════════════════════════════════════
   fit.js — 본문 폰트 자동 맞춤 + 쪽 자동 분할
   스크롤은 전면 금지다. 넘치면 폰트를 줄이고, 18px에서도 넘치면 쪽을 나눈다.
   ══════════════════════════════════════════════════════════════ */

window.MOC = window.MOC || {};

window.MOC.Fit = (function () {
  /* ── 본문 크기 ──
     px을 고정하면 해상도가 바뀌어도 그대로라 큰 화면에서는 작아 보인다.
     기준은 px이 아니라 "한 줄에 담기는 글자 수"다. 본문 상자 폭에서 크기를 역산하면
       · 해상도가 커지면 상자도 커지고 글자도 함께 커진다
       · 같은 해상도에서는 상자 폭이 하나이므로 모든 쪽이 같은 크기가 된다
     크기는 쪽이 아니라 화면이 정한다 — measure()는 조판 전에 한 번만 부른다. */
  var DIV = 40;          /* 본문 크기 = 화면 높이 ÷ DIV. 낮출수록 글자가 커진다 */
  var MIN = 18;          /* 태블릿을 1m 거리에서 볼 때의 하한. 절대 양보 금지 */
  var MAX = 26;          /* 이보다 크면 좁은 열에서 한 줄이 너무 짧아져 읽기가 끊긴다 */
  var SIZE = 24;         /* measure()가 채운다. 이 값이 모든 쪽에 쓰인다 */
  var FLOOR = MIN;
  var MAX_STEPS = 80;

  /* 크기는 "화면 높이"에서 정한다. 패널 폭에서 뽑으면 열을 좁힐 때마다
     글자까지 같이 작아져서, 폭과 크기를 따로 조절할 수 없다. 둘은 분리해야 한다.
       · 해상도가 커지면 함께 커진다
       · 같은 해상도에서는 값이 하나이므로 모든 쪽이 같다
       · 열 폭을 바꿔도 글자 크기는 그대로다 */
  function measure() {
    var h = 0;
    try { h = document.documentElement.clientHeight || 0; } catch (e) {}
    if (h < 200) return SIZE;             /* 잴 수 없으면 쓰던 값을 지킨다 */
    var s = Math.round(h / DIV);
    SIZE = Math.max(MIN, Math.min(MAX, s));
    return SIZE;
  }

  var fitted = 0;

  /* ── 쓸 수 있는 높이 ──
     .body 자신의 clientHeight를 믿으면 안 된다.
     #sheet는 "내용 높이만큼" 부풀 수 있는 상자라, 내용이 많으면 .body의
     clientHeight가 내용 전체 높이를 그대로 보고한다. 그러면
     scrollHeight === clientHeight 가 되어 "안 넘쳤다"고 답하고,
     실제로는 #read의 overflow:hidden 이 아래를 잘라 버린다.
     그래서 자리를 확정해 주는 #read에서 직접 계산한다.
     비어 있는 .body로 처음 재는 순간에도 이 값은 옳다. */
  function availHeight(box) {
    var sheet = box.parentElement;
    var read = sheet && sheet.parentElement;
    if (!read) return box.clientHeight;
    var cs = getComputedStyle(sheet);
    var chrome = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) +
                 (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    return Math.max(0, read.clientHeight - chrome);
  }

  /* 넘쳤는가 — "쓸 수 있는 높이"와 "내용 높이"를 직접 견준다.
     .body 자신의 clientHeight 로 재면 안 된다. flex가 정한 상자 높이라
     마지막 문장의 아래 여백 같은 것이 scrollHeight 에만 들어가서,
     내용이 아무리 적어도 늘 몇 px 넘친 것으로 나온다.
     그러면 구간이 문장 하나까지 쪼개지고 글자도 바닥까지 줄어든다. */
  function overflows(box) {
    return box.scrollHeight > availHeight(box) + 2;
  }

  /* 상자가 접혀 있거나 너무 좁으면 조판을 시도하지 않는다.
     세로에서 접으면 높이가 0이 되고, 가로에서 접으면 폭이 0이 된다.
     폭 0에서 계산하면 글자가 바닥까지 줄고 구간이 문장 수만큼 쪼개진다. */
  function tooSmall(box) {
    return availHeight(box) < 40 || box.clientWidth < 80;
  }

  /* 고정 크기로 조판한다. 반환값은 "이 크기로 다 들어갔는가".
     false면 호출자(buildBeats)가 문장을 덜어 내고 다시 부른다. */
  function fitDown(box) {
    if (tooSmall(box)) return true;

    /* 한계를 명시해야 clientHeight가 "쓸 수 있는 높이"를 말해 준다.
       내용이 짧으면 여전히 내용 높이가 나오므로 상자는 그대로 오므라든다. */
    box.style.maxHeight = availHeight(box) + 'px';
    box.style.lineHeight = 'var(--lh)';
    box.style.fontSize = SIZE + 'px';
    fitted = SIZE;
    return !overflows(box);
  }

  /* 마지막 안전장치 — 한 문장이 혼자서도 SIZE로 안 들어갈 때만 부른다.
     더 쪼갤 것이 없으므로 이때는 글자를 줄이는 수밖에 없다.
     스크롤은 어떤 경우에도 만들지 않는다. */
  function shrinkToFit(box) {
    var s = SIZE, guard = 0;
    while (s > FLOOR && overflows(box) && guard++ < MAX_STEPS) {
      s -= 1;
      box.style.fontSize = s + 'px';
    }
    fitted = s;
    return !overflows(box);
  }

  /* 한 구간을 화면에 앉히는 유일한 입구.
     기본은 SIZE 고정이고, 더 쪼갤 수 없어 안 들어갈 때만 축소로 내려간다.
     조판하는 곳은 전부 이 함수를 써야 한다 — fitDown만 부르면
     축소해 둔 구간이 다시 SIZE로 되돌아가 글자가 잘린다. */
  function fitBeat(box) {
    return fitDown(box) || shrinkToFit(box);
  }

  /* 한 구간이 SIZE로 안 들어가면 마지막 문장을 다음 구간으로 밀어낸다.
     문장 중간에서는 절대 자르지 않는다. paint(lines)는 호출자가 준다. */
  function buildBeats(box, lines, paint) {

    var src = lines.map(function (l, i) {
      return { t: l.t, ko: l.ko, _i: i };
    });

    /* 접힘 상태: 분할을 보류하고 통째로 한 구간으로 둔다 */
    if (tooSmall(box)) { paint(src); return [src]; }

    var out = [], start = 0;
    while (start < src.length) {
      var end = src.length;
      while (end > start + 1) {
        paint(src.slice(start, end));
        if (fitDown(box)) break;
        end--;
      }
      if (end === start + 1) {           /* 한 문장만 남았으면 더 쪼갤 수 없다 */
        paint(src.slice(start, end));
        fitBeat(box);
      }
      out.push(src.slice(start, end));
      start = end;
    }
    return out;
  }

  return {
    FLOOR: FLOOR, MIN: MIN, MAX: MAX, DIV: DIV,
    measure: measure,
    get SIZE() { return SIZE; },
    availHeight: availHeight,
    fitDown: fitDown,
    fitBeat: fitBeat,
    buildBeats: buildBeats,
    get fitted() { return fitted; }
  };
})();
