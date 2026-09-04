#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""쪽 단위 낭독 렌더 — assets/audio/pNN.mp3

한 쪽 전체를 하나의 mp3 로 만든다. 문장·단어 발음도 이 파일의 구간을 재생하면
되므로, 사전 178개·문장 64개를 따로 뽑을 필요가 없다.
한 파일에서 나오니 목소리가 갈릴 수도 없다.

  export OPENAI_API_KEY=...
  python3 tools/make_pages_audio.py --dry-run
  python3 tools/make_pages_audio.py
  python3 tools/make_pages_audio.py --pages 1,2

렌더 뒤 음량을 자동으로 맞춘다 (tools/normalize_audio.py 와 같은 설정).
"""

import argparse, json, os, subprocess, sys, urllib.request, urllib.error

ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT    = os.path.join(ROOT, 'assets', 'audio')
JSC    = '/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc'
FFMPEG = '/opt/homebrew/bin/ffmpeg'

MODEL = 'gpt-4o-mini-tts'
VOICE = 'sage'
SPEED = 0.92
STYLE = ("You are the narrator of an animated film, speaking over the opening shot. "
         "Warm and low, unhurried, with a hush of wonder - as if the picture is only now "
         "coming into view. Land gently on the important words and let the silence after "
         "each sentence do some of the work. "
         "Never brisk, never newsreader-like, never sing-song or babyish.")

# 음량 — 말소리 전용 필터로 조용한 구간을 올린 뒤 EBU R128 로 맞춘다.
# 재생할 때 배율로 키우면 튀는 구간이 잘려 나간다. 파일에서 끝내야 한다.
LOUD = 'speechnorm=e=25:r=0.0001:l=1,loudnorm=I=-12:TP=-1.0:LRA=7'


def pages():
    """content.js 를 그대로 실행해 쪽 본문을 뽑는다 (데이터를 복제하지 않는다)."""
    if not os.path.exists(JSC):
        sys.exit('JavaScriptCore 를 찾을 수 없습니다. macOS 에서 실행해 주세요.')
    code = ('var out = MOC.PAGES.map(function(p){'
            ' return { n:p.n, lines:p.lines.map(function(l){return l.t;}) }; });'
            'print(JSON.stringify(out));')
    raw = subprocess.check_output(
        [JSC, '-e', 'var window=globalThis;',
         os.path.join(ROOT, 'js', 'content.js'), '-e', code], text=True)
    return json.loads(raw.strip().splitlines()[-1])


def speak(text, voice, model, speed):
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        sys.exit('OPENAI_API_KEY 환경변수가 없습니다.  export OPENAI_API_KEY=...')
    body = json.dumps({'model': model, 'voice': voice, 'input': text,
                       'instructions': STYLE, 'response_format': 'mp3',
                       'speed': speed}).encode('utf-8')
    req = urllib.request.Request(
        'https://api.openai.com/v1/audio/speech', data=body, method='POST',
        headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        sys.exit('API 오류 %s: %s' % (e.code, e.read().decode('utf-8', 'replace')[:400]))


def loudness(path):
    subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', path,
                    '-af', LOUD, '-c:a', 'libmp3lame', '-b:a', '96k', path + '.n.mp3'],
                   check=True)
    os.replace(path + '.n.mp3', path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--voice', default=VOICE)
    ap.add_argument('--model', default=MODEL)
    ap.add_argument('--speed', type=float, default=SPEED)
    ap.add_argument('--pages', help='쉼표로 구분한 쪽 번호. 없으면 전부')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--no-normalize', action='store_true')
    a = ap.parse_args()

    os.makedirs(OUT, exist_ok=True)
    ps = pages()
    if a.pages:
        want = {int(x) for x in a.pages.split(',')}
        ps = [p for p in ps if p['n'] in want]

    total = sum(len(' '.join(p['lines'])) for p in ps)
    print('%s · %s · 속도 %.2f · %d쪽 %d자\n' % (a.model, a.voice, a.speed, len(ps), total))

    for p in ps:
        text = ' '.join(p['lines'])
        name = 'p%02d.mp3' % p['n']
        print('%2d쪽  %-9s %4d자  %s…' % (p['n'], name, len(text), text[:44]))
        if a.dry_run:
            continue
        path = os.path.join(OUT, name)
        with open(path, 'wb') as f:
            f.write(speak(text, a.voice, a.model, a.speed))
        if not a.no_normalize:
            loudness(path)
        print('        → %s (%.0f KB)' % (path, os.path.getsize(path) / 1024))

    if a.dry_run:
        print('\n(dry-run: 아무것도 만들지 않았습니다)')
    else:
        print('\n완료. 다음: python3 tools/align_audio.py')


if __name__ == '__main__':
    main()
