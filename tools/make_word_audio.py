#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""낱말 발음을 낱말마다 따로 만든다 — assets/audio-word/*.mp3

지금까지는 쪽 전체 낭독에서 그 낱말 구간만 잘라 들려주었다. 그런데 이어 말하는
자리에는 낱말 사이에 무음이 없어, 어디서 잘라도 앞뒤가 조금씩 딸려 나온다.
경계를 소리로 다시 잡고 이웃으로 잘라 내도 41%만 조용한 자리에서 끊겼다.

자를 일을 없애면 된다. 낱말 하나만 읽은 소리를 따로 두면 섞일 것이 없다.
사전에 있는 낱말만 눌리므로 178개면 전부 덮는다.

    export OPENAI_API_KEY=...
    python3 tools/make_word_audio.py
    python3 tools/make_word_audio.py --only cat,house    # 몇 개만 다시

파일 이름은 낱말 그림과 같은 규칙이다 — 아포스트로피를 뗀다 (couldn't → couldnt).
"""

import argparse, io, json, os, re, subprocess, sys, time, urllib.request, urllib.error

ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT    = os.path.join(ROOT, 'assets', 'audio-word')
JSC    = '/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc'
FFMPEG = '/opt/homebrew/bin/ffmpeg'

MODEL = 'gpt-4o-mini-tts'
VOICE = 'sage'
SPEED = 1.0
# 낱말 하나만 읽는 자리다. 문장처럼 억양을 얹으면 뒤가 올라가 어색하다.
# "clearly / for a young learner" 라고 하면 한 낱말을 3초씩 끌기도 한다 —
# 늘이지 말라고 못박는다.
STYLE = ("Read this one English word aloud, once, at a normal brisk pace, "
         "as in a word list. Do not stretch, hold, or draw out any sound. "
         "Neutral falling intonation. Say it once and stop. Do not spell it out.")

# 앞뒤 묵음만 뗀다. 크기는 뒤에서 파일마다 따로 맞춘다 —
# loudnorm 은 짧은 소리에서 값이 잘 안 맞는다.
TRIM = ('silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.03,'
        'areverse,silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.03,areverse')

# 낱말마다 크기를 같게 맞춘다. 눌러 보는 낱말끼리 소리가 들쭉날쭉하면
# 크게 들리는 낱말만 또렷하게 들린다 (잘라 쓰던 시절 편차가 37 dB 였다).
MEAN_TARGET = -18.0     # 평균 크기
PEAK_CEIL   = -1.5      # 이보다 큰 봉우리는 만들지 않는다

# 한 음절에 이 정도면 또박또박하면서 늘어지지 않는다
SEC_PER_SYL = 0.42


def words():
    code = ('var out = []; for (var k in MOC.DICT) out.push(k);'
            'print(JSON.stringify(out));')
    raw = subprocess.check_output(
        [JSC, '-e', 'var window=globalThis;',
         os.path.join(ROOT, 'js', 'dict.js'), '-e', code], text=True)
    return json.loads(raw.strip().splitlines()[-1])


def syllables(w):
    w = re.sub(r"[^a-z']", '', w.lower())
    n = len(re.findall(r'[aeiouy]+', w))
    if w.endswith('e') and n > 1:
        n -= 1
    return max(n, 1)


def levels(path):
    """평균·최대 크기(dB)"""
    out = subprocess.run([FFMPEG, '-hide_banner', '-i', path, '-filter:a', 'volumedetect',
                          '-f', 'null', '/dev/null'], capture_output=True, text=True).stderr
    m = re.search(r'mean_volume:\s*(\S+)', out)
    x = re.search(r'max_volume:\s*(\S+)', out)
    return (float(m.group(1)) if m else -99.0,
            float(x.group(1)) if x else -99.0)


def duration(path):
    return float(subprocess.check_output(
        ['/opt/homebrew/bin/ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'csv=p=0', path], text=True).strip())


def safe(w):
    """낱말 그림과 같은 규칙 — 아포스트로피를 뗀다"""
    return re.sub(r"[^a-z0-9]", '', w.lower())


def speak(text):
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        sys.exit('OPENAI_API_KEY 환경변수가 없습니다.')
    body = json.dumps({'model': MODEL, 'voice': VOICE, 'input': text,
                       'instructions': STYLE, 'response_format': 'mp3',
                       'speed': SPEED}).encode('utf-8')
    req = urllib.request.Request('https://api.openai.com/v1/audio/speech', data=body,
                                 method='POST',
                                 headers={'Authorization': 'Bearer ' + key,
                                          'Content-Type': 'application/json'})
    for tries in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            sys.exit('API 오류 %s: %s' % (e.code, e.read().decode('utf-8', 'replace')[:300]))
        except Exception as e:
            if tries == 3:
                sys.exit('통신이 계속 끊깁니다: %s' % e)
            time.sleep(1.5 * (tries + 1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', help='쉼표로 나눈 낱말만')
    ap.add_argument('--force', action='store_true', help='이미 있어도 다시 만든다')
    ap.add_argument('--takes', type=int, default=3,
                    help='이만큼 뽑아 기대 길이에 가까운 것을 남긴다')
    a = ap.parse_args()

    ws = words()
    if a.only:
        want = {x.strip().lower() for x in a.only.split(',')}
        ws = [w for w in ws if w.lower() in want or safe(w) in want]
    os.makedirs(OUT, exist_ok=True)
    # 지난번에 끊겨 남은 임시 파일을 치운다. 그대로 두면 낱말 목록에 섞인다.
    for f in os.listdir(OUT):
        if '.take' in f or f.endswith('.g.mp3') or f.endswith('.t.mp3'):
            os.remove(os.path.join(OUT, f))

    print('%s · %s · 속도 %.2f · 낱말 %d개\n' % (MODEL, VOICE, SPEED, len(ws)))
    made = skipped = 0
    for i, w in enumerate(ws, 1):
        path = os.path.join(OUT, safe(w) + '.mp3')
        if os.path.exists(path) and not a.force:
            skipped += 1
            continue
        # ── 여러 번 뽑아 고른다 ──
        # 같은 설정에도 결과가 크게 다르다. "thin" 이 3.30초로 나왔다가
        # 0.24초로 나왔다. 기대 길이(음절 × SEC_PER_SYL)에 가까운 것을 고른다.
        want = syllables(w) * SEC_PER_SYL
        best, best_off = None, None
        for take in range(max(1, a.takes)):
            tmp = path + '.take.mp3'
            with open(tmp, 'wb') as f:
                f.write(speak(w))
            # 가끔 통째로 잘려 못 읽는 파일이 나온다. 그 판은 버리고 넘어간다 —
            # 여기서 멈추면 남은 낱말을 못 만든다.
            try:
                subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', tmp,
                                '-af', TRIM, '-c:a', 'libmp3lame', '-b:a', '96k',
                                tmp + '.t.mp3'], check=True)
                os.replace(tmp + '.t.mp3', tmp)
                d = duration(tmp)
            except Exception:
                d = 0.0
            off = abs(d - want) / want if want else 9.9
            if d < 0.12:                      # 잘린 것은 버린다
                off = 9.9
            if best_off is None or off < best_off:
                best_off, best = off, open(tmp, 'rb').read()
            os.remove(tmp)
        if best is None:
            print('  %3d/%d  %-14s 쓸 만한 판이 없어 건너뜀' % (i, len(ws), w))
            continue
        with open(path, 'wb') as f:
            f.write(best)

        # ── 크기를 같게 맞춘다 ──
        # 평균을 목표에 맞추되, 봉우리가 천장을 넘지 않는 선까지만 올린다.
        mean, peak = levels(path)
        gain = min(MEAN_TARGET - mean, PEAK_CEIL - peak)
        subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', path,
                        '-af', 'volume=%.2fdB' % gain, '-c:a', 'libmp3lame', '-b:a', '96k',
                        path + '.g.mp3'], check=True)
        os.replace(path + '.g.mp3', path)
        made += 1
        d = duration(path)
        print('  %3d/%d  %-14s %5.2f초 (기대 %.2f)  %+5.1f dB  %3.0f KB'
              % (i, len(ws), w, d, want, gain, os.path.getsize(path) / 1024))

    tot = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print('\n새로 만든 것 %d개 · 건너뛴 것 %d개 · 합계 %.1f MB'
          % (made, skipped, tot / 1048576))


if __name__ == '__main__':
    main()
