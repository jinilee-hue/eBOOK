# Millions of Cats — 인터랙티브 eBook

Wanda Gág의 『Millions of Cats』(1928)를 배경 영상 위에서 읽는
영어 학습 eBook 프로토타입. 태블릿 가로 화면이 주 사용 환경이다.

- **대상** 초등 저·중학년 한국인 영어 학습자
- **기기** 태블릿 가로 — 검증 해상도 1194×834 / 1180×820 / 1024×768.
  웹 페이지이므로 데스크톱 브라우저에서도 열린다
- **원문** Project Gutenberg #74181 — 미국 내 퍼블릭 도메인

## 실행

빌드가 없다. `index.html` 을 브라우저로 열면 된다.

```
open index.html
```

일부 기능은 `file://` 에서 제한된다(서비스 워커, 로컬 서버 연동).
전체를 보려면 정적 서버를 띄운다.

```
python3 -m http.server 8899
# http://localhost:8899/
```

### 개발용 주소 옵션

| | |
|---|---|
| `?dev=1` | 검증 패널 (음성 선택·쪽 이동·조판 계측) |
| `?dev=1&audit=1` | 11쪽 조판 자동 감사 |
| `?cue=1` | NEXT 신호(세모)를 계속 켜 둔다 |
| `?voice=reset` | 고정된 음성을 풀고 자동 선택으로 |

## 검사

```
bash tools/smoke.sh        # 부팅·조판·정의 없는 호출
python3 tools/check_defs.py
```

`smoke.sh` 는 헤드리스 크롬으로 실제 페이지를 띄워
문장이 그려지는지, 11쪽이 전부 한 화면에 들어가는지 확인한다.
구문 검사로는 안 잡히는 종류를 잡는다.

## 구조

```
index.html              앱 셸
styles/tokens.css       색·간격·반경·그림자
styles/reader.css       레이아웃, 본문, 문제 띠, 모달
js/content.js           원문 + 번역 + 문제 (content/pages.js 와 동일)
js/dict.js              클릭 사전 178개
js/fit.js               폰트 맞춤 + 쪽 자동 분할
js/scenes.js            배경 영상 + 절차적 씬 폴백
js/tts.js               읽어주기 (브라우저 내장 음성)
js/app.js               상태 기계, 렌더, 이벤트
assets/videos/          쪽별 배경 mp4 (11쪽 + 마지막 화면)
assets/words/           단어장 카드 이미지
assets/fonts/           SIL Andika (OFL)
```

설계 규칙과 확정 사항은 `CLAUDE.md` 에 있다.
쪽별 원문은 `PAGES.md` 참조.

## 저작권

- 원문은 미국 내 퍼블릭 도메인이다.
- 한국어 번역과 문제는 이 프로젝트의 창작물이다.
- 서체 SIL Andika 는 OFL 라이선스 — `assets/fonts/OFL.txt` 참조.
- 배경 영상은 AI로 생성했다.
