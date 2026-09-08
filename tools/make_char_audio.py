#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""캐릭터별 목소리로 쪽 음성 만들기 — assets/audio-char/pNN.mp3

내레이션은 성우가, 대사는 그 인물의 목소리가 읽는다.
구간마다 다른 목소리로 뽑아 이어 붙인 뒤, 완성된 파일을 Whisper 로 정렬한다 —
정렬은 목소리가 몇 개든 상관하지 않는다.

  python3 tools/make_char_audio.py --plan       # 누가 무엇을 읽는지 표로만
  python3 tools/make_char_audio.py              # 실제로 만든다
  python3 tools/make_char_audio.py --pages 8

원문은 한 글자도 바꾸지 않는다. 바꾸면 정렬이 어긋나 하이라이트가 엉뚱한 곳을 짚는다.
"""

import argparse, json, os, re, subprocess, sys, urllib.request, urllib.error

ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT    = os.path.join(ROOT, 'assets', 'audio-char')
TMP    = os.path.join(OUT, '_seg')
JSC    = '/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc'
FFMPEG = '/opt/homebrew/bin/ffmpeg'
MODEL  = 'gpt-4o-mini-tts'

# ── 배역 ──
# OpenAI 는 성별을 공식 표기하지 않는다. 아래는 들리는 인상으로 고른 것이고,
# 톤은 instructions 로 잡는다 — 이 모델은 지시문을 실제로 따른다.
CAST = {
    '내레이터': ('sage', 0.92,
        "You are the narrator of an animated film. Warm and low, unhurried, "
        "with a hush of wonder. Never brisk, never sing-song."),
    '할아버지': ('onyx', 0.90,
        "An old man's voice - gentle, a little frail, kind. Speaks slowly, "
        "with warmth and a touch of wonder. Not gruff, not theatrical."),
    '할머니': ('shimmer', 0.92,
        "An old woman's voice - soft, warm, a little weary. Speaks gently, "
        "with feeling. Not shrill, not girlish."),
    '아기고양이': ('nova', 0.96,
        "A very small, timid kitten speaking - tiny, shy, a little breathless. "
        "Soft and high, almost apologetic."),
    '고양이들': ('coral', 1.02,
        "Many cats clamouring at once - eager, insistent, overlapping voices. "
        "Bright and quick, each one sure it is the prettiest."),
}
NARRATOR = '내레이터'

GAP_SAME  = 0.10   # 같은 화자가 이어질 때
GAP_TURN  = 0.22   # 화자가 바뀔 때 — 여기서 쉬어야 누가 말하는지 들린다


def pages():
    code = ('var out = MOC.PAGES.map(function(p){'
            ' return { n:p.n, lines:p.lines.map(function(l){return l.t;}) }; });'
            'print(JSON.stringify(out));')
    raw = subprocess.check_output(
        [JSC, '-e', 'var window=globalThis;',
         os.path.join(ROOT, 'js', 'content.js'), '-e', code], text=True)
    return json.loads(raw.strip().splitlines()[-1])


def speaker_of(line, prev):
    """이 줄의 대사는 누구 것인가.

    화자는 늘 따옴표 "밖"에 적힌다 ("said the very old man" 처럼).
    안쪽까지 보면 대사 내용에 든 낱말에 걸려 엉뚱한 사람이 잡힌다 —
    11쪽 "…I've seen hundreds of cats…" 가 고양이 대사로 잡히는 식이다.

    적혀 있지 않으면 앞 줄의 화자를 잇는다. 대사가 두 줄에 걸치는 경우가 있다.
    """
    s = re.sub(r'"[^"]*"', ' ', line).lower()      # 따옴표 안은 지운다
    if 'very old woman' in s:              return '할머니'
    if 'very old man' in s:                return '할아버지'
    if 'kitten' in s:                      return '아기고양이'
    if re.search(r'\bcats\b|\bvoices\b', s):  return '고양이들'
    if re.search(r'\bshe\b', s):           return '할머니'
    if re.search(r'\bhe\b', s):            return '할아버지'
    return prev or NARRATOR


def split_line(line, who):
    """한 줄을 [내레이션 | 대사] 조각으로 쪼갠다. 원문 순서와 글자를 그대로 지킨다."""
    out, pos = [], 0
    for m in re.finditer(r'"[^"]*"', line):
        if m.start() > pos:
            out.append((NARRATOR, line[pos:m.start()]))
        out.append((who, m.group(0)))
        pos = m.end()
    if pos < len(line):
        out.append((NARRATOR, line[pos:]))
    return [(w, t) for w, t in out if t.strip()]


def plan_page(p):
    segs, prev = [], None
    for line in p['lines']:
        who = speaker_of(line, prev)
        parts = split_line(line, who)
        if any(w != NARRATOR for w, _ in parts):
            prev = who
        segs.extend(parts)
    # 같은 화자가 연달아 나오면 한 덩어리로 합친다 (호출 수를 줄이고 억양이 이어진다)
    merged = []
    for who, t in segs:
        if merged and merged[-1][0] == who:
            merged[-1][1] = (merged[-1][1] + ' ' + t.strip()).strip()
        else:
            merged.append([who, t.strip()])
    return merged


def speak(text, voice, speed, style):
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        sys.exit('OPENAI_API_KEY 환경변수가 없습니다.')
    body = json.dumps({'model': MODEL, 'voice': voice, 'input': text,
                       'instructions': style, 'response_format': 'mp3',
                       'speed': speed}).encode('utf-8')
    req = urllib.request.Request(
        'https://api.openai.com/v1/audio/speech', data=body, method='POST',
        headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        sys.exit('API 오류 %s: %s' % (e.code, e.read().decode('utf-8', 'replace')[:400]))


def silence(sec, path):
    subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-f', 'lavfi',
                    '-i', 'anullsrc=r=24000:cl=mono', '-t', '%.3f' % sec,
                    '-c:a', 'libmp3lame', '-b:a', '96k', path], check=True)


def build(p, segs):
    os.makedirs(TMP, exist_ok=True)
    parts, prev_who = [], None
    for i, (who, text) in enumerate(segs):
        voice, speed, style = CAST.get(who, CAST[NARRATOR])
        seg = os.path.join(TMP, 'p%02d_%02d.mp3' % (p['n'], i))
        with open(seg, 'wb') as f:
            f.write(speak(text, voice, speed, style))
        if i:
            gap = GAP_TURN if who != prev_who else GAP_SAME
            sil = os.path.join(TMP, 'sil_%d.mp3' % int(gap * 1000))
            if not os.path.exists(sil):
                silence(gap, sil)
            parts.append(sil)
        parts.append(seg)
        prev_who = who
        print('      %-6s %s' % (who, text[:56]))

    lst = os.path.join(TMP, 'p%02d.txt' % p['n'])
    with open(lst, 'w') as f:
        for x in parts:
            f.write("file '%s'\n" % x.replace("'", r"'\''"))
    out = os.path.join(OUT, 'p%02d.mp3' % p['n'])
    subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0',
                    '-i', lst, '-c:a', 'libmp3lame', '-b:a', '96k', out], check=True)
    # 음량 맞추기 — 목소리마다 크기가 다르므로 이어 붙인 뒤에 한 번에 잡는다
    subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', out,
                    '-af', 'speechnorm=e=25:r=0.0001:l=1,loudnorm=I=-14:TP=-1.0:LRA=7',
                    '-c:a', 'libmp3lame', '-b:a', '96k', out + '.n.mp3'], check=True)
    os.replace(out + '.n.mp3', out)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pages', help='쉼표로 구분한 쪽 번호. 없으면 전부')
    ap.add_argument('--plan', action='store_true', help='누가 무엇을 읽는지만 보여 준다')
    a = ap.parse_args()

    ps = pages()
    if a.pages:
        want = {int(x) for x in a.pages.split(',')}
        ps = [p for p in ps if p['n'] in want]
    os.makedirs(OUT, exist_ok=True)

    if a.plan:
        tally = {}
        for p in ps:
            print('── %d쪽' % p['n'])
            for who, t in plan_page(p):
                tally[who] = tally.get(who, 0) + 1
                print('  %-6s %s' % (who, t[:66]))
            print('')
        print('  구간 수')
        for k in sorted(tally):
            v, _, _ = CAST.get(k, CAST[NARRATOR])
            print('    %-6s %3d개   목소리 %s' % (k, tally[k], v))
        return

    for p in ps:
        segs = plan_page(p)
        print('%2d쪽  %d구간' % (p['n'], len(segs)))
        out = build(p, segs)
        print('      → %s (%.0f KB)\n' % (out, os.path.getsize(out) / 1024))
    print('완료. 다음: python3 tools/align_audio.py --dir assets/audio-char')


if __name__ == '__main__':
    main()
