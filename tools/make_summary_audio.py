#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""요약 낭독 만들기 — assets/audio-sum/pNN.mp3

흐름 판은 영상 소리가 이야기를 나른다. 대사가 끝난 자리에서 이 음성이
장면을 한두 문장으로 설명한다. 본문 전체 낭독은 책을 펼쳤을 때만 나간다.

  export OPENAI_API_KEY=...
  python3 tools/make_summary_audio.py --dry-run
  python3 tools/make_summary_audio.py
"""

import argparse, json, os, subprocess, sys, urllib.request, urllib.error

ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT    = os.path.join(ROOT, 'assets', 'audio-sum')
JSC    = '/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc'
FFMPEG = '/opt/homebrew/bin/ffmpeg'

MODEL = 'gpt-4o-mini-tts'
VOICE = 'sage'
SPEED = 0.94
# 본문 낭독보다 한 걸음 물러난 톤. 이야기를 읽는 것이 아니라 옆에서 짚어 주는 자리다.
STYLE = ("A gentle narrator explaining what is happening in a picture, to a young child. "
         "Calm and clear, a little slower than normal speech, with warmth. "
         "Not dramatic, not performing - just telling.")
# 끝에 붙는 묵음을 떼어 낸다. 그만큼 요약이 길어 보여 대사 사이 틈에
# 못 들어가는 일이 생긴다 — 실제로 3쪽·9쪽이 그래서 영상 뒤로 밀렸다.
TRIM = ('areverse,silenceremove=start_periods=1:'
        'start_threshold=-45dB:start_silence=0.05,areverse')
LOUD = 'speechnorm=e=25:r=0.0001:l=1,loudnorm=I=-14:TP=-1.0:LRA=7,' + TRIM


def summaries():
    code = ('var out = []; for (var n in MOC.SUMMARY) out.push({n:+n, t:MOC.SUMMARY[n]});'
            'out.sort(function(a,b){return a.n-b.n;}); print(JSON.stringify(out));')
    raw = subprocess.check_output(
        [JSC, '-e', 'var window=globalThis;',
         os.path.join(ROOT, 'content', 'summary.js'), '-e', code], text=True)
    return json.loads(raw.strip().splitlines()[-1])


def speak(text):
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        sys.exit('OPENAI_API_KEY 환경변수가 없습니다.')
    body = json.dumps({'model': MODEL, 'voice': VOICE, 'input': text,
                       'instructions': STYLE, 'response_format': 'mp3',
                       'speed': SPEED}).encode('utf-8')
    req = urllib.request.Request(
        'https://api.openai.com/v1/audio/speech', data=body, method='POST',
        headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        sys.exit('API 오류 %s: %s' % (e.code, e.read().decode('utf-8', 'replace')[:400]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pages')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    os.makedirs(OUT, exist_ok=True)
    items = summaries()
    if a.pages:
        want = {int(x) for x in a.pages.split(',')}
        items = [i for i in items if i['n'] in want]

    print('%s · %s · 속도 %.2f\n' % (MODEL, VOICE, SPEED))
    for it in items:
        name = 'p%02d.mp3' % it['n']
        print('%2d쪽  %-9s %s' % (it['n'], name, it['t']))
        if a.dry_run:
            continue
        path = os.path.join(OUT, name)
        with open(path, 'wb') as f:
            f.write(speak(it['t']))
        subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', path,
                        '-af', LOUD, '-c:a', 'libmp3lame', '-b:a', '96k',
                        path + '.n.mp3'], check=True)
        os.replace(path + '.n.mp3', path)
        d = subprocess.check_output(['/opt/homebrew/bin/ffprobe', '-v', 'error',
                                     '-show_entries', 'format=duration', '-of', 'csv=p=0',
                                     path], text=True).strip()
        print('        → %.0f KB · %.1f초' % (os.path.getsize(path) / 1024, float(d)))

    print('\n(dry-run)' if a.dry_run else '\n완료.')


if __name__ == '__main__':
    main()
