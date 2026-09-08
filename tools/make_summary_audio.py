#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""요약 낭독 만들기 — assets/audio-sum/pNN.mp3

흐름 판은 영상 소리가 이야기를 나른다. 대사가 끝난 자리에서 이 음성이
장면을 한두 문장으로 설명한다. 본문 전체 낭독은 책을 펼쳤을 때만 나간다.

  export OPENAI_API_KEY=...
  python3 tools/make_summary_audio.py --dry-run
  python3 tools/make_summary_audio.py
"""

import argparse, json, os, re, subprocess, sys, urllib.request, urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # find_speech 를 부른다

ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT    = os.path.join(ROOT, 'assets', 'audio-sum')
KEEP   = os.path.join(OUT, '_takes')   # 뽑은 판을 남겨 두는 곳
JSC    = '/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc'
FFMPEG = '/opt/homebrew/bin/ffmpeg'

MODEL = 'gpt-4o-mini-tts'
VOICE = 'sage'
SPEED = 1.0
# 쪽마다 다르게 두는 속도. 비워 두는 것이 맞다 —
# 1.0 을 넘기면 음성이 뭉개져 들린다(4쪽에서 1.06 을 시험했다가 되돌렸다).
# 길어서 느리게 들리는 쪽은 속도가 아니라 문장을 줄인다.
SPEED_AT = {}
# 본문 낭독보다 한 걸음 물러난 톤. 이야기를 읽는 것이 아니라 옆에서 짚어 주는 자리다.
#
# ※ 예전에는 "a little slower than normal speech" 라고 적어 두었다. 그 한 줄이
#   낱말을 늘어뜨렸고, 속도가 문장 안에서 들쭉날쭉해졌다(4쪽에서 "to" 가 0.56초).
#   speed 0.94 와 겹쳐 더 심했다. 느리게 해 달라고 하는 대신 "고르게" 를 요구한다.
STYLE = ("A gentle narrator explaining a picture to a young child. Calm, clear and warm. "
         "Keep an even, steady pace from the first word to the last - "
         "do not draw out or linger on any word, and do not rush. "
         "Natural conversational speed. Not dramatic, not performing - just telling.")
# 끝에 붙는 묵음을 떼어 낸다. 그만큼 요약이 길어 보여 대사 사이 틈에
# 못 들어가는 일이 생긴다 — 실제로 3쪽·9쪽이 그래서 영상 뒤로 밀렸다.
TRIM = ('areverse,silenceremove=start_periods=1:'
        'start_threshold=-45dB:start_silence=0.05,areverse')
LOUD = 'speechnorm=e=25:r=0.0001:l=1,loudnorm=I=-14:TP=-1.0:LRA=7,' + TRIM


def evenness(path):
    """이 낭독이 얼마나 고른가. 낮을수록 고르다.

    gpt-4o-mini-tts 는 같은 입력에도 매번 다르게 읽는다. 어떤 판은 첫 낱말을
    0.62초씩 늘여 놓고 뒤는 붙여 읽는다 — 전체 길이로 재면 멀쩡해 보이는데
    귀에는 늘어진다. 지시문을 고치거나 speed 를 곱해도 잡히지 않았다.
    그래서 여러 번 뽑아 재고 고른다.

    낱말마다 '음절 하나에 몇 초를 쓰는지'를 구해 그 흩어짐을 본다.
    긴 낱말이 길게 걸리는 것은 정상이므로 음절로 나눠야 한다."""
    try:
        from find_speech import _transcribe
    except Exception:
        return 0.0
    w = _transcribe(path)
    if len(w) < 3:
        return 9.9
    per = []
    for a, b, t in w:
        sy = max(1, len(re.findall(r'[aeiouy]+', re.sub(r"[^a-z']", '', t.lower()))))
        per.append((b - a) / sy)
    m = sum(per) / len(per)
    var = sum((x - m) ** 2 for x in per) / len(per)
    return var ** 0.5 / m if m else 9.9      # 변동계수


def summaries():
    code = ('var out = []; for (var n in MOC.SUMMARY) out.push({n:+n, t:MOC.SUMMARY[n]});'
            'out.sort(function(a,b){return a.n-b.n;}); print(JSON.stringify(out));')
    raw = subprocess.check_output(
        [JSC, '-e', 'var window=globalThis;',
         os.path.join(ROOT, 'content', 'summary.js'), '-e', code], text=True)
    return json.loads(raw.strip().splitlines()[-1])


def speak(text, speed):
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        sys.exit('OPENAI_API_KEY 환경변수가 없습니다.')
    body = json.dumps({'model': MODEL, 'voice': VOICE, 'input': text,
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pages')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--speed', type=float, help='이번 실행에만 쓰는 속도')
    ap.add_argument('--keep', action='store_true',
                    help='뽑은 것을 모두 assets/audio-sum/_takes/ 에 남긴다')
    ap.add_argument('--takes', type=int, default=1,
                    help='이만큼 뽑아 가장 고른 것을 남긴다 (권장 5)')
    a = ap.parse_args()

    os.makedirs(OUT, exist_ok=True)
    items = summaries()
    if a.pages:
        want = {int(x) for x in a.pages.split(',')}
        items = [i for i in items if i['n'] in want]

    print('%s · %s · 속도 %.2f\n' % (MODEL, VOICE, SPEED))
    for it in items:
        name = 'p%02d.mp3' % it['n']
        print('%2d쪽  %-9s 속도 %.2f  %s'
              % (it['n'], name, a.speed or SPEED_AT.get(it['n'], SPEED), it['t']))
        if a.dry_run:
            continue
        path = os.path.join(OUT, name)
        speed = a.speed if a.speed else SPEED_AT.get(it['n'], SPEED)
        best, best_score = None, None
        for take in range(max(1, a.takes)):
            tmp = path + '.take.mp3'
            with open(tmp, 'wb') as f:
                f.write(speak(it['t'], speed))
            subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', tmp,
                            '-af', LOUD, '-c:a', 'libmp3lame', '-b:a', '96k',
                            tmp + '.n.mp3'], check=True)
            os.replace(tmp + '.n.mp3', tmp)
            score = evenness(tmp) if a.takes > 1 else 0.0
            if a.takes > 1:
                print('        %d번째 · 고름 %.3f%s' % (take + 1, score,
                      '  ← 지금까지 가장 고름' if best_score is None or score < best_score else ''))
            if best_score is None or score < best_score:
                best_score, best = score, open(tmp, 'rb').read()
            # 뽑은 것을 모두 남긴다. 좋은 판을 실험하다 덮어써 잃은 적이 있다.
            if a.keep:
                os.makedirs(KEEP, exist_ok=True)
                with open(os.path.join(KEEP, 'p%02d_take%d_%.3f.mp3'
                                       % (it['n'], take + 1, score)), 'wb') as g:
                    g.write(open(tmp, 'rb').read())
            os.remove(tmp)
        with open(path, 'wb') as f:
            f.write(best)
        d = subprocess.check_output(['/opt/homebrew/bin/ffprobe', '-v', 'error',
                                     '-show_entries', 'format=duration', '-of', 'csv=p=0',
                                     path], text=True).strip()
        print('        → %.0f KB · %.1f초' % (os.path.getsize(path) / 1024, float(d)))

    print('\n(dry-run)' if a.dry_run else '\n완료.')


if __name__ == '__main__':
    main()
