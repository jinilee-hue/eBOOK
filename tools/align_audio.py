#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""단어별 시각 뽑기 — assets/audio/pNN.json

OpenAI TTS 는 타임스탬프를 주지 않는다. 그래서 만들어진 오디오를 다시
Whisper 에 보내 단어 시각을 받고, 우리 원문의 글자 위치에 맞춰 붙인다.
추정이 아니라 오디오에서 측정한 값이라 밀리지 않는다.

  export OPENAI_API_KEY=...
  python3 tools/align_audio.py
  python3 tools/align_audio.py --pages 1

Whisper 는 제 나름대로 낱말을 쪼갠다("don't" → "don" "t" 등). 순서대로 대조해
맞추고, 못 맞춘 낱말은 앞뒤 시각 사이를 나눠 채운다. 몇 개를 그렇게 채웠는지
함께 보고한다 — 그 수가 크면 정렬을 믿으면 안 된다.
"""

import argparse, io, json, os, re, subprocess, sys, urllib.request, urllib.error, uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT  = os.path.join(ROOT, 'assets', 'audio')
JSC  = '/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc'

WORD = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")     # js/app.js 의 markup 과 같은 규칙


def pages():
    code = ('var out = MOC.PAGES.map(function(p){'
            ' return { n:p.n, lines:p.lines.map(function(l){return l.t;}) }; });'
            'print(JSON.stringify(out));')
    raw = subprocess.check_output(
        [JSC, '-e', 'var window=globalThis;',
         os.path.join(ROOT, 'js', 'content.js'), '-e', code], text=True)
    return json.loads(raw.strip().splitlines()[-1])


def transcribe(path):
    """Whisper 에 올려 단어별 시각을 받는다."""
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        sys.exit('OPENAI_API_KEY 환경변수가 없습니다.')
    b = uuid.uuid4().hex
    buf = io.BytesIO()
    def part(name, value):
        buf.write(('--%s\r\nContent-Disposition: form-data; name="%s"\r\n\r\n%s\r\n'
                   % (b, name, value)).encode('utf-8'))
    part('model', 'whisper-1')
    part('response_format', 'verbose_json')
    part('timestamp_granularities[]', 'word')
    part('language', 'en')
    buf.write(('--%s\r\nContent-Disposition: form-data; name="file"; filename="%s"\r\n'
               'Content-Type: audio/mpeg\r\n\r\n' % (b, os.path.basename(path))).encode('utf-8'))
    with open(path, 'rb') as f:
        buf.write(f.read())
    buf.write(('\r\n--%s--\r\n' % b).encode('utf-8'))

    req = urllib.request.Request(
        'https://api.openai.com/v1/audio/transcriptions', data=buf.getvalue(), method='POST',
        headers={'Authorization': 'Bearer ' + key,
                 'Content-Type': 'multipart/form-data; boundary=' + b})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit('API 오류 %s: %s' % (e.code, e.read().decode('utf-8', 'replace')[:400]))


def norm(w):
    return re.sub(r"[^a-z']", '', w.lower())


def align(text, heard):
    """원문 낱말과 Whisper 낱말을 순서대로 맞춘다.

    돌려주는 것: [{c: 원문 글자위치, t: 시작초, t1: 끝초, guess: 채워넣었나}]
    """
    src = [{'c': m.start(), 'w': norm(m.group(0))} for m in WORD.finditer(text)]
    hw  = [{'w': norm(h.get('word', '')), 't': float(h.get('start', 0)),
            't1': float(h.get('end', 0))} for h in heard]
    hw  = [h for h in hw if h['w']]

    out, j = [], 0
    for i, s in enumerate(src):
        hit = None
        # 제자리에서 시작해 조금씩 넓혀 찾는다. 앞으로만 가서 순서가 꼬이지 않는다.
        for k in range(j, min(j + 6, len(hw))):
            if hw[k]['w'] == s['w'] or (len(s['w']) > 3 and hw[k]['w'].startswith(s['w'][:4])):
                hit = k
                break
        if hit is None:
            out.append({'c': s['c'], 't': None, 't1': None, 'guess': True})
        else:
            out.append({'c': s['c'], 't': hw[hit]['t'], 't1': hw[hit]['t1'], 'guess': False})
            j = hit + 1

    # Whisper 가 구절 끝 낱말의 끝 시각을 시작과 같게 주는 일이 있다.
    # 그대로 두면 그 낱말을 눌렀을 때 소리가 안 난다. 다음 낱말 앞까지로 메운다.
    for i, o in enumerate(out):
        if o['t'] is None or o['t1'] is None or o['t1'] > o['t']:
            continue
        nxt = next((out[k]['t'] for k in range(i + 1, len(out))
                    if out[k]['t'] is not None and out[k]['t'] > o['t']), None)
        o['t1'] = min(nxt, o['t'] + 0.9) if nxt else o['t'] + 0.35

    # 못 맞춘 자리는 앞뒤 사이를 균등하게 나눈다
    n = len(out)
    for i, o in enumerate(out):
        if o['t'] is not None:
            continue
        a = next((out[k] for k in range(i - 1, -1, -1) if out[k]['t'] is not None), None)
        z = next((out[k] for k in range(i + 1, n) if out[k]['t'] is not None), None)
        if a and z:
            span = z['t'] - a['t1']
            gap = sum(1 for k in range(i, n) if out[k]['t'] is None)
            o['t'] = a['t1'] + span * 0.5 / max(gap, 1)
            o['t1'] = z['t']
        elif a:
            o['t'], o['t1'] = a['t1'], a['t1']
        elif z:
            o['t'], o['t1'] = 0.0, z['t']
        else:
            o['t'], o['t1'] = 0.0, 0.0
    return out


def build_js():
    """pNN.json 을 모아 js/align.js 로 낸다.

    file:// 로 열면 fetch 가 막힌다. 그래서 앱이 읽는 쪽은 JSON 이 아니라
    window.MOC.ALIGN 에 대입하는 .js 여야 한다. 다른 모듈들과 같은 이유다.
    """
    import glob
    docs = {}
    for f in sorted(glob.glob(os.path.join(OUT, 'p*.json'))):
        d = json.load(open(f, encoding='utf-8'))
        ws = d['words']
        # 길이 0 인 낱말 메우기 (옛 json 에도 적용된다)
        fixed = 0
        for i, o in enumerate(ws):
            if o['t1'] > o['t']:
                continue
            nxt = next((ws[k]['t'] for k in range(i + 1, len(ws)) if ws[k]['t'] > o['t']), None)
            o['t1'] = round(min(nxt, o['t'] + 0.9) if nxt else o['t'] + 0.35, 3)
            fixed += 1
        if fixed:
            print('  %2d쪽  길이 0 인 낱말 %d개 보정' % (d['n'], fixed))
        docs[d['n']] = {'file': d['file'], 'duration': d['duration'],
                        'lines': d['lines'], 'words': ws}
    out = os.path.join(ROOT, 'js', 'align.js')
    with open(out, 'w', encoding='utf-8') as f:
        f.write('/* 자동 생성 — tools/align_audio.py\n'
                '   쪽별 낭독 음성의 낱말·문장 시각. 손으로 고치지 말 것.\n'
                '   본문을 바꾸면 make_pages_audio.py 와 align_audio.py 를 다시 돌린다. */\n')
        f.write('window.MOC = window.MOC || {};\n')
        f.write('window.MOC.ALIGN = ')
        json.dump(docs, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
    print('  js/align.js  %d쪽  %.0f KB' % (len(docs), os.path.getsize(out) / 1024))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pages', help='쉼표로 구분한 쪽 번호. 없으면 mp3 가 있는 전부')
    ap.add_argument('--file', help='특정 mp3 하나만 (쪽 번호는 파일명에서 읽는다)')
    ap.add_argument('--rebuild-js', action='store_true',
                    help='API 를 부르지 않고 이미 있는 json 으로 js/align.js 만 다시 만든다')
    a = ap.parse_args()

    if a.rebuild_js:
        build_js()
        return

    ps = pages()
    if a.pages:
        want = {int(x) for x in a.pages.split(',')}
        ps = [p for p in ps if p['n'] in want]

    todo = []
    for p in ps:
        mp3 = os.path.join(OUT, 'p%02d.mp3' % p['n'])
        if os.path.exists(mp3):
            todo.append((p, mp3))
    if not todo:
        sys.exit('assets/audio/pNN.mp3 가 없습니다. 먼저 make_pages_audio.py 를 돌리세요.')

    print('  쪽   낱말   맞춘 것   채운 것   길이\n')
    worst = 0
    for p, mp3 in todo:
        text = ' '.join(p['lines'])
        r = transcribe(mp3)
        words = align(text, r.get('words') or [])
        guessed = sum(1 for w in words if w['guess'])
        worst = max(worst, guessed / max(len(words), 1))

        # 문장 경계도 함께 저장해 둔다 — 문장 탭 재생에 쓴다
        lines, pos = [], 0
        for i, t in enumerate(p['lines']):
            c = text.index(t, pos)
            pos = c + len(t)
            ws = [w for w in words if c <= w['c'] < pos]
            lines.append({'i': i, 'c': c, 'len': len(t),
                          't': ws[0]['t'] if ws else 0.0,
                          't1': ws[-1]['t1'] if ws else 0.0})

        doc = {'n': p['n'], 'file': os.path.basename(mp3),
               'duration': float(r.get('duration') or 0),
               'text': text, 'lines': lines,
               'words': [{'c': w['c'], 't': round(w['t'], 3), 't1': round(w['t1'], 3)}
                         for w in words],
               'guessed': guessed}
        out = os.path.join(OUT, 'p%02d.json' % p['n'])
        with open(out, 'w', encoding='utf-8') as f:
            json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
        print('  %2d   %4d   %5d     %5d     %5.1f초   %s'
              % (p['n'], len(words), len(words) - guessed, guessed,
                 doc['duration'], '✓' if guessed / max(len(words), 1) < 0.05 else '⚠'))

    build_js()
    print('\n  채워넣은 비율이 가장 큰 쪽: %.1f%%' % (worst * 100))
    print('  5%% 아래면 믿을 만합니다. 그 위면 정렬을 다시 봐야 합니다.')
    print('\n  눈으로 확인: tools/align-check.html 을 서버로 열어 보세요.')


if __name__ == '__main__':
    main()
