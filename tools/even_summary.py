#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""요약 낭독의 속도를 쪽마다 고르게 맞춘다 — assets/audio-sum/*.mp3

gpt-4o-mini-tts 는 같은 지시를 줘도 쪽마다 다르게 읽는다. "고르게 읽어 달라"고
적어 봐도 편차가 오히려 커졌다(0.34 → 0.49). 말로 부탁할 일이 아니다.

그래서 뽑아 놓은 소리를 재고, 목표 속도에 맞게 tempo 를 건다.
atempo 는 음높이를 건드리지 않아 목소리가 변하지 않는다. 보정폭도 좁게 묶는다 —
크게 당기면 그것대로 부자연스럽다.

    python3 tools/even_summary.py            # 전체
    python3 tools/even_summary.py --pages 4  # 일부
"""

import argparse, io, json, os, re, subprocess, sys

ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUM    = os.path.join(ROOT, 'assets', 'audio-sum')
FFMPEG = '/opt/homebrew/bin/ffmpeg'
FFPROBE = '/opt/homebrew/bin/ffprobe'

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

TARGET = 3.13     # 음절/초(쉼 제외). 1쪽이 앉아 있는 자리
LO, HI = 0.80, 1.30   # 보정폭. 이보다 크게 당기면 소리가 상한다


def texts():
    """content/summary.js 에 적힌 문장. 이것이 흔들리지 않는 기준이다."""
    s = io.open(os.path.join(ROOT, 'content', 'summary.js'), encoding='utf-8').read()
    return dict((int(k), v) for k, v in
                re.findall(r"^\s*(\d+):\s*'((?:[^'\\]|\\.)*)'", s, re.M))


def syllables(text):
    """영어 음절 어림수. 모음 덩어리를 센다 — 낱말 수보다 말의 양에 가깝다."""
    n = 0
    for w in text.split():
        w = re.sub(r"[^a-z']", '', w.lower())
        if not w:
            continue
        c = len(re.findall(r'[aeiouy]+', w))
        if w.endswith('e') and c > 1:
            c -= 1
        n += max(c, 1)
    return n


def duration(path):
    return float(subprocess.check_output(
        [FFPROBE, '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'csv=p=0', path], text=True).strip())


def silence(path):
    """무음의 합. 문장 사이의 쉼이 여기 잡힌다."""
    out = subprocess.run([FFMPEG, '-hide_banner', '-i', path, '-af',
                          'silencedetect=noise=-42dB:d=0.15', '-f', 'null', '/dev/null'],
                         capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r'silence_start: (\S+)', out)]
    en = [float(x) for x in re.findall(r'silence_end: (\S+)', out)]
    d = duration(path)
    tot = 0.0
    for i, a in enumerate(st):
        tot += (en[i] if i < len(en) else d) - a
    return tot


def rate(path, text):
    """말하는 속도(음절/초). 쉼은 빼고 잰다.

    전체 길이로 재면 안 된다 — 어떤 쪽은 빠르게 말하고 길게 쉬고, 어떤 쪽은
    느리게 말하고 거의 안 쉰다. 둘의 전체 길이가 같아도 귀에는 전혀 다르다.
    실제로 1쪽(0.90초 쉼)과 4쪽(0.23초 쉼)이 그랬다.

    Whisper 는 쓰지 않는다 — 낱말 분할이 매번 달라 값이 튀고, 문장 사이의
    쉼을 앞 낱말에 붙여 버려 "1.16초짜리 he" 같은 것이 나온다.
    문장은 정해져 있으므로 음절 수는 상수고, 소리로 무음만 재면 된다."""
    d = duration(path)
    talk = d - silence(path)
    return (syllables(text) / talk) if talk > 0.1 else None


def smooth(path, thresh=1.45, keep=1.12):
    """한 낱말만 늘어진 것을 그 낱말만 줄여 편다.

    gpt-4o-mini-tts 는 문장에서 하나를 골라 길게 끈다. 어느 것을 고를지는
    그때그때 다르다 — 문장을 바꾸면 늘어짐이 다른 낱말로 옮겨갈 뿐이었다.
    전체에 atempo 를 걸면 멀쩡한 낱말까지 빨라진다. 그래서 튀는 낱말만 집는다.

    잣대는 '음절 하나에 몇 초를 쓰는가'다. 그 값이 이 파일의 중앙값보다
    thresh 배 넘게 크면 keep 배까지 줄인다. 자르는 자리는 낱말 사이의
    조용한 구간이라 이음매가 드러나지 않는다.
    """
    from find_speech import _transcribe
    w = _transcribe(path)
    if len(w) < 3:
        return None
    def syl(t):
        t = re.sub(r"[^a-z']", '', t.lower())
        return max(1, len(re.findall(r'[aeiouy]+', t)))
    per = sorted((b - a) / syl(t) for a, b, t in w)
    med = per[len(per) // 2]

    d = duration(path)
    segs, at, fixed = [], 0.0, []
    for a, b, t in w:
        r = (b - a) / syl(t)
        if r <= med * thresh or (b - a) < 0.35:
            continue
        target = syl(t) * med * keep
        k = max(0.55, min(1.0, target / (b - a)))
        if k > 0.97:
            continue
        if a > at:
            segs.append((at, a, 1.0))
        segs.append((a, b, k))
        at = b
        fixed.append((t.strip(), b - a, (b - a) * k))
    if not fixed:
        return []
    if at < d:
        segs.append((at, d, 1.0))

    # 조각을 mp3 로 만들어 이어 붙이면 안 된다 — mp3 는 파일마다 앞뒤에
    # 인코더 여백이 붙어, 조각 수만큼 소리가 길어진다(실제로 5.2초가 6.3초가 됐다).
    # 한 번의 filter_complex 안에서 잘라 붙이고, 마지막에 한 번만 mp3 로 굽는다.
    fc, names = [], []
    for i, (a, b, k) in enumerate(segs):
        lbl = 'a%d' % i
        f = '[0:a]atrim=%.3f:%.3f,asetpts=PTS-STARTPTS' % (a, b)
        if abs(k - 1) > 0.001:
            f += ',atempo=%.4f' % k
        fc.append(f + '[%s]' % lbl)
        names.append('[%s]' % lbl)
    fc.append('%sconcat=n=%d:v=0:a=1[out]' % (''.join(names), len(segs)))
    # 끝에 남는 묵음은 떼어 낸다. 그만큼 요약이 길어 보여 대사 사이 틈에
    # 못 들어가는 일이 생긴다 (make_summary_audio.py 의 TRIM 과 같은 규칙).
    fc.append('[out]areverse,silenceremove=start_periods=1:'
              'start_threshold=-45dB:start_silence=0.05,areverse[fin]')
    out = path + '.sm.mp3'
    subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', path,
                    '-filter_complex', ';'.join(fc), '-map', '[fin]',
                    '-c:a', 'libmp3lame', '-b:a', '96k', out], check=True)
    os.replace(out, path)
    return fixed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pages')
    ap.add_argument('--target', type=float, default=TARGET)
    ap.add_argument('--smooth', action='store_true',
                    help='한 낱말만 늘어진 것을 그 낱말만 줄인다')
    a = ap.parse_args()
    want = {int(x) for x in a.pages.split(',')} if a.pages else None

    T = texts()
    print('목표 %.2f 음절/초 · 보정폭 %.2f~%.2f\n' % (a.target, LO, HI))
    print(' 쪽    전     배속    후     결과')
    for n in range(1, 12):
        f = os.path.join(SUM, 'p%02d.mp3' % n)
        if not os.path.exists(f) or (want and n not in want):
            continue
        if a.smooth:
            fx = smooth(f)
            if fx:
                for t, before, after in fx:
                    print(' %2d   "%s" %.2f초 → %.2f초' % (n, t, before, after))
            else:
                print(' %2d   늘어진 낱말 없음' % n)
            continue
        r0 = rate(f, T.get(n, ''))
        if not r0:
            print(' %2d   (길이를 못 읽음 — 건너뜀)' % n)
            continue
        k = max(LO, min(HI, a.target / r0))
        if abs(k - 1) < 0.02:
            print(' %2d   %5.2f   그대로  %5.2f   손대지 않음' % (n, r0, r0))
            continue
        tmp = f + '.t.mp3'
        subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', f,
                        '-af', 'atempo=%.4f' % k,
                        '-c:a', 'libmp3lame', '-b:a', '96k', tmp], check=True)
        os.replace(tmp, f)
        r1 = rate(f, T.get(n, ''))
        print(' %2d   %5.2f   %5.3f   %5.2f   %s'
              % (n, r0, k, r1 or 0,
                 '맞춤' if r1 and abs(r1 - a.target) < 0.25 else '아직 벗어남'))
    print('\n완료.')


if __name__ == '__main__':
    main()
