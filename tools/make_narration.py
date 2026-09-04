#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
성우 음성 파일 만들기 — assets/audio/*.mp3

js/content.js 의 narrate 설정을 읽어, 각 쪽에서 성우가 읽을 문장만 모아
TTS API로 음성을 만들어 assets/audio/ 에 넣는다.

  # 어떤 목소리로 할지 먼저 들어 본다 (같은 문장을 여러 목소리로)
  python3 tools/make_narration.py --audition --play

  # 정해지면 전체를 만든다
  python3 tools/make_narration.py --style cinematic          # 기본 목소리 sage
  python3 tools/make_narration.py --provider elevenlabs --voice <voice_id>

  # 키 없이 맥 내장 음성으로 (품질은 한 단계 아래)
  python3 tools/make_narration.py --provider macos --voice "Ava (Premium)"

API 키는 환경변수로만 받는다. 코드나 저장소에 키를 두지 말 것.
  export OPENAI_API_KEY=...
  export ELEVENLABS_API_KEY=...

만들어진 파일이 있으면 앱이 그걸 재생하고, 없으면 조용히 시스템 음성으로 내려간다.
따라서 이 스크립트를 안 돌려도 앱은 그대로 동작한다.
"""

import argparse, json, os, subprocess, sys, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT  = os.path.join(ROOT, 'assets', 'audio')
TRY  = os.path.join(OUT, '_audition')
JSC  = '/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc'

# 낭독 톤을 말로 지시한다. OpenAI TTS는 이 지시를 실제로 따른다.
# (ElevenLabs 는 지시문을 받지 않는다 — 목소리와 settings 로만 정해진다)
STYLES = {
    'cinematic': (
        "You are the narrator of an animated film, speaking over the opening shot. "
        "Warm and low, unhurried, with a hush of wonder - as if the picture is only now "
        "coming into view. Land gently on the important words and let the silence after "
        "each sentence do some of the work. "
        "Never brisk, never newsreader-like, never sing-song or babyish."),
    'storyteller': (
        "Read aloud as a warm, gentle storyteller reading a picture book to a young child. "
        "Unhurried and soft, with a small smile in the voice. "
        "Let each sentence settle before the next one. Never brisk, never newsreader-like."),
    'hushed': (
        "Almost a whisper, close to the microphone, as if the child is falling asleep. "
        "Very slow, very soft, no projection at all. Long pauses. Never dramatic."),
}

# OpenAI 목소리.
# OpenAI 는 성별을 공식으로 표기하지 않는다. 아래는 '들리는 인상'이고
# 확실한 건 --audition 으로 직접 듣는 것뿐이다.
OPENAI_VOICES = [
    ('sage',    '여성으로 들림 · 차분하고 낮다. 내레이션에 가장 가깝다'),
    ('coral',   '여성으로 들림 · 따뜻하고 밝다. 동화 읽어주는 톤'),
    ('shimmer', '여성으로 들림 · 부드럽고 공기감 있다'),
    ('nova',    '여성으로 들림 · 또렷하고 젊다'),
    ('alloy',   '중성 · 평탄하다. 기준점으로 듣기 좋다'),
    ('fable',   '남성으로 들림 · 영국식 이야기꾼 톤'),
    ('ballad',  '남성으로 들림 · 느리고 서정적'),
    ('ash',     '남성으로 들림 · 건조하고 담담하다'),
    ('echo',    '남성으로 들림 · 중간 톤'),
    ('onyx',    '남성으로 들림 · 낮고 두껍다'),
]

# --audition 에서 목소리를 안 주면 이 넷만 만든다. 전부 들으려면 --voice all
AUDITION_DEFAULT = ['sage', 'coral', 'shimmer', 'nova']

AUDITION_LINE = ("Once upon a time there was a very old man and a very old woman. "
                 "They lived in a nice clean house which had flowers all around it.")


def read_manifest():
    """content.js 를 그대로 실행해 낭독 대상을 뽑는다 (데이터 중복을 만들지 않는다)."""
    if not os.path.exists(JSC):
        sys.exit('JavaScriptCore를 찾을 수 없습니다. macOS에서 실행해 주세요.')
    os.makedirs(OUT, exist_ok=True)
    shim = os.path.join(OUT, '.shim.js')
    with open(shim, 'w') as f:
        f.write('var window = globalThis;\n')
    code = ('var out = MOC.PAGES.filter(function(p){return p.narrate && p.narrate.audio;})'
            '.map(function(p){ return { n:p.n, file:p.narrate.audio,'
            ' text:(p.narrate.text || p.narrate.lines.map(function(i){return p.lines[i].t;}))'
            '.join(" ") }; });'
            'print(JSON.stringify(out));')
    try:
        raw = subprocess.check_output(
            [JSC, shim, os.path.join(ROOT, 'js', 'content.js'), '-e', code],
            text=True)
    finally:
        os.path.exists(shim) and os.remove(shim)
    return json.loads(raw.strip().splitlines()[-1])


def post(url, headers, payload):
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'),
                                 headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        sys.exit('API 오류 %s: %s' % (e.code, e.read().decode('utf-8', 'replace')[:400]))


def key(name):
    v = os.environ.get(name)
    if not v:
        sys.exit('%s 환경변수가 없습니다.  export %s=...' % (name, name))
    return v


def synth_openai(text, voice, model, style, speed):
    return post('https://api.openai.com/v1/audio/speech',
                {'Authorization': 'Bearer ' + key('OPENAI_API_KEY'),
                 'Content-Type': 'application/json'},
                {'model': model, 'voice': voice, 'input': text,
                 'instructions': style, 'response_format': 'mp3', 'speed': speed})


def synth_elevenlabs(text, voice, model, style, speed):
    return post('https://api.elevenlabs.io/v1/text-to-speech/' + voice,
                {'xi-api-key': key('ELEVENLABS_API_KEY'), 'Content-Type': 'application/json'},
                {'text': text, 'model_id': model,
                 'voice_settings': {'stability': 0.45, 'similarity_boost': 0.75,
                                    'style': 0.25, 'use_speaker_boost': True}})


def synth_macos(text, voice, model, style, speed):
    """키 없이 맥 내장 음성으로. Premium/Enhanced 목소리를 먼저 내려받아야 쓸 만하다.
       시스템 설정 -> 손쉬운 사용 -> 음성 콘텐츠 -> 시스템 음성 -> 음성 관리"""
    tmp = os.path.join(OUT, '.say.m4a')
    wpm = str(int(170 * speed))
    cmd = ['say', '-o', tmp, '--data-format=aac', '-r', wpm]
    if voice:
        cmd += ['-v', voice]
    subprocess.run(cmd + [text], check=True)
    with open(tmp, 'rb') as f:
        data = f.read()
    os.remove(tmp)
    return data


PROVIDERS = {
    #                만드는 함수      기본 목소리                기본 모델                 확장자
    'openai':     (synth_openai,     'sage',                  'gpt-4o-mini-tts',        '.mp3'),
    'elevenlabs': (synth_elevenlabs, 'XB0fDUnXU5powFXDhCwa',  'eleven_multilingual_v2', '.mp3'),
    'macos':      (synth_macos,      'Samantha',              '',                       '.m4a'),
}


def list_voices(provider):
    if provider == 'openai':
        print('OpenAI 목소리 (gpt-4o-mini-tts) — 지시문(--style)을 따릅니다\n')
        for v, note in OPENAI_VOICES:
            print('  %-9s %s' % (v, note))
        print('\n  --audition 으로 실제 문장을 들어 보고 고르세요.')
    elif provider == 'elevenlabs':
        req = urllib.request.Request('https://api.elevenlabs.io/v1/voices',
                                     headers={'xi-api-key': key('ELEVENLABS_API_KEY')})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.load(r)
        print('내 ElevenLabs 보관함\n')
        for v in data.get('voices', []):
            lab = v.get('labels') or {}
            note = ' · '.join(x for x in (lab.get('gender'), lab.get('age'),
                                          lab.get('accent'), lab.get('description')) if x)
            print('  %-24s %s\n      %s' % (v['name'], v['voice_id'], note))
    else:
        subprocess.run(['say', '-v', '?'])
        print('\n  (Premium / Enhanced 가 붙은 것만 쓸 만합니다. '
              '없으면 시스템 설정 -> 손쉬운 사용 -> 음성 콘텐츠에서 내려받으세요)')


def play(paths):
    if not os.path.exists('/usr/bin/afplay'):
        return
    for p in paths:
        print('   > ' + os.path.basename(p))
        subprocess.run(['afplay', p])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--provider', choices=list(PROVIDERS), default='openai')
    ap.add_argument('--voice', help='목소리 이름(openai/macos) 또는 voice_id(elevenlabs)')
    ap.add_argument('--model')
    ap.add_argument('--style', choices=list(STYLES), default='cinematic',
                    help='낭독 톤 지시문. openai 에서만 실제로 반영된다')
    ap.add_argument('--style-text', help='지시문을 직접 쓴다')
    ap.add_argument('--speed', type=float, default=0.9, help='말 속도 (1.0 이 보통)')
    ap.add_argument('--pages', help='쉼표로 구분한 쪽 번호. 없으면 전부')
    ap.add_argument('--dry-run', action='store_true', help='보낼 문장만 출력하고 끝낸다')
    ap.add_argument('--play', action='store_true', help='만든 뒤 바로 들려준다')
    ap.add_argument('--list-voices', action='store_true')
    ap.add_argument('--audition', action='store_true',
                    help='한 문장을 여러 목소리로 만들어 assets/audio/_audition/ 에 넣는다')
    a = ap.parse_args()

    if a.list_voices:
        list_voices(a.provider)
        return

    synth, voice, model, ext = PROVIDERS[a.provider]
    voice = a.voice or voice
    model = a.model or model
    style = a.style_text or STYLES[a.style]

    os.makedirs(OUT, exist_ok=True)

    # ── 목소리 고르기 ──
    if a.audition:
        if a.provider != 'openai':
            sys.exit('--audition 은 지금 openai 에서만 됩니다. '
                     '다른 곳은 --list-voices 로 목록을 보세요.')
        os.makedirs(TRY, exist_ok=True)
        names = ([v for v, _ in OPENAI_VOICES] if a.voice == 'all'
                 else a.voice.split(',') if a.voice else AUDITION_DEFAULT)
        made = []
        for v in names:
            path = os.path.join(TRY, '%s-%s%s' % (v, a.style, ext))
            print('  %-9s -> %s' % (v, os.path.relpath(path, ROOT)))
            if a.dry_run:
                continue
            with open(path, 'wb') as f:
                f.write(synth(AUDITION_LINE, v, model, style, a.speed))
            made.append(path)
        if a.play:
            play(made)
        print('\n마음에 드는 것을 고른 뒤:\n'
              '  python3 tools/make_narration.py --voice <이름> --style %s' % a.style)
        return

    # ── 실제 낭독 만들기 ──
    items = read_manifest()
    if a.pages:
        want = {int(x) for x in a.pages.split(',')}
        items = [i for i in items if i['n'] in want]
    if not items:
        sys.exit('만들 대상이 없습니다. content.js의 narrate.audio 를 확인하세요.')

    print('%s · %s · %s · 속도 %.2f\n' % (a.provider, voice, a.style, a.speed))
    made = []
    for it in items:
        print('%2d쪽  %-20s  %s' % (it['n'], it['file'],
                                    it['text'][:70] + ('…' if len(it['text']) > 70 else '')))
        if a.dry_run:
            continue
        data = synth(it['text'], voice, model, style, a.speed)
        # narrate.audio 는 .mp3 로 적혀 있다. 다른 형식이면 확장자를 맞춰 준다.
        name = os.path.splitext(it['file'])[0] + ext
        path = os.path.join(OUT, name)
        with open(path, 'wb') as f:
            f.write(data)
        made.append(path)
        note = ('   ※ content.js 의 audio 를 %s 로 고쳐야 합니다' % name) if name != it['file'] else ''
        print('      -> %s (%.0f KB)%s' % (path, len(data) / 1024, note))

    if a.play:
        play(made)

    if a.dry_run:
        print('\n(dry-run: 아무것도 만들지 않았습니다)')
    else:
        print('\n완료. 브라우저를 새로고침하면 시스템 음성 대신 이 파일이 재생됩니다.')


if __name__ == '__main__':
    main()
