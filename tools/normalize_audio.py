#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""성우 음성 음량 맞추기 — EBU R128 (ffmpeg loudnorm)

TTS 결과는 대체로 조용하다. 재생할 때 배율로 키우면 튀는 구간이 천장을 넘어
잘려 나간다 — 그게 "깨지는" 소리다. 파일 자체의 체감 음량을 목표치에 맞추고
피크만 리미터로 눌러야 한다.

두 번 돌린다. 한 번만 하면 추정으로 맞춰서 목표를 못 맞춘다.

  python3 tools/normalize_audio.py assets/audio/*.mp3
  python3 tools/normalize_audio.py --target -16 --dry-run assets/audio/*.mp3

원본은 <파일명>.orig 로 남긴다. --no-backup 으로 끌 수 있다.
"""

import argparse, json, os, re, shutil, subprocess, sys

FFMPEG = '/opt/homebrew/bin/ffmpeg'
if not os.path.exists(FFMPEG):
    FFMPEG = shutil.which('ffmpeg') or 'ffmpeg'

# 말소리 기준. 방송·스트리밍에서 흔히 쓰는 값이다.
TARGET_I, TARGET_TP, TARGET_LRA = -16.0, -1.5, 11.0


def run(args):
    return subprocess.run([FFMPEG, '-hide_banner', '-nostats'] + args,
                          capture_output=True, text=True).stderr


def measure(path):
    """현재 음량을 잰다. (통합 LUFS, 최대 트루피크 dB, 그 밖의 loudnorm 입력값)"""
    err = run(['-i', path, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'])
    m = re.search(r'\{[^{}]*"input_i"[^{}]*\}', err, re.S)
    if not m:
        return None
    return json.loads(m.group(0))


def normalize(path, target, backup, linear=True):
    a = measure(path)
    if not a:
        print('  %-26s 측정 실패' % os.path.basename(path))
        return
    before_i, before_tp = float(a['input_i']), float(a['input_tp'])

    flt = ('loudnorm=I={t}:TP={tp}:LRA={lra}'
           ':measured_I={i}:measured_TP={mtp}:measured_LRA={mlra}'
           ':measured_thresh={th}:offset={off}:{mode}'
           ).format(mode='linear=true' if linear else 'linear=false',t=target, tp=TARGET_TP, lra=TARGET_LRA,
                    i=a['input_i'], mtp=a['input_tp'], mlra=a['input_lra'],
                    th=a['input_thresh'], off=a['target_offset'])

    tmp = path + '.tmp.mp3'
    err = run(['-y', '-loglevel', 'error', '-i', path, '-af', flt,
               '-c:a', 'libmp3lame', '-b:a', '96k', tmp])
    if not os.path.exists(tmp) or os.path.getsize(tmp) == 0:
        print('  %-26s 변환 실패\n%s' % (os.path.basename(path), err[:300]))
        return
    if backup and not os.path.exists(path + '.orig'):
        shutil.copy2(path, path + '.orig')
    os.replace(tmp, path)

    b = measure(path)
    print('  %-26s %7.1f → %6.1f LUFS   피크 %6.1f → %5.1f dB'
          % (os.path.basename(path), before_i, float(b['input_i']),
             before_tp, float(b['input_tp'])))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('files', nargs='+')
    ap.add_argument('--target', type=float, default=TARGET_I, help='목표 LUFS (기본 -16)')
    ap.add_argument('--dry-run', action='store_true', help='지금 음량만 재고 끝낸다')
    ap.add_argument('--no-backup', action='store_true')
    ap.add_argument('--dynamic', action='store_true',
                    help='피크를 지키느라 목표에 못 미칠 때. 압축을 허용해 목표까지 올린다')
    a = ap.parse_args()

    if a.dry_run:
        print('  현재 음량\n')
        for f in a.files:
            m = measure(f)
            print('  %-26s %7.1f LUFS   피크 %6.1f dB'
                  % (os.path.basename(f), float(m['input_i']), float(m['input_tp']))
                  if m else '  %-26s 측정 실패' % os.path.basename(f))
        return

    print('  목표 %.1f LUFS · 피크 %.1f dB\n' % (a.target, TARGET_TP))
    for f in a.files:
        normalize(f, a.target, not a.no_backup, linear=not a.dynamic)


if __name__ == '__main__':
    main()
