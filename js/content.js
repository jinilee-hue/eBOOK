/* ══════════════════════════════════════════════════════════════
   content.js — 원문 · 번역 · 문제 · 씬 지문
   원문: Project Gutenberg #74181 (Wanda Gág, 1928)
         "Public domain in the USA" — 원문 그대로 유지할 것.
   번역·문제·씬 지문: 이 프로젝트 창작물.

   ※ file:// 로 직접 열 수 있어야 하므로 ES 모듈이 아니라 전역에 실는다.

   각 쪽 필드
     n       쪽 번호
     scene   씬 이름 (한국어, 화면 표시용)
     bg      절차적 씬 키 (js/scenes.js에서 구현)
     video   assets/videos/ 안의 mp4 파일명. 없으면 절차적 씬으로 폴백
     prompt  AI 영상 생성용 영문 프롬프트
     rhyme   후렴 쪽 표시. 조판에는 영향을 주지 않는다(내용 설명용)
     lines   [{ t: 원문, ko: 한국어 }]
     narrate 낭독 설정 (없으면 낭독 없음)
               lines : 읽을 문장 번호(0부터). 나머지는 영상이 맡는다
               text  : 주면 원문 대신 이 문장을 읽는다 (한 줄이 너무 길 때)
               rate  : 낭독 속도    pitch : 음높이
               gap   : 문장 사이 숨(ms)    delay : 쪽이 열린 뒤 대기(ms)
               duck  : 읽는 동안 영상 소리 크기(0=무음, 1=원래대로)
     flip    영상을 좌우반전한다. 인물이 우측 본문 패널에 가릴 때만
     q/o/a   첫 번째 문제 / 보기 4개 / 정답 번호
     alt     같은 쪽의 다른 문제들. 문제 띠의 ↻ 로 돌아가며 나온다
   ══════════════════════════════════════════════════════════════ */

window.MOC = window.MOC || {};

window.MOC.PAGES = [

/* ─────────── 1 · 꽃에 둘러싸인 오두막 · 등불 아래의 소원 ─────────── */
{n:1, scene:'꽃에 둘러싸인 오두막 · 등불 아래의 소원', bg:'cottage_interior', video:'01_opening.mp4',
 prompt:'A tiny cottage on a gentle hill surrounded by flowers, then inside by lamplight: a very old man and a very old woman talking across a wooden table. Warm amber light, folk-art texture, very slow camera drift.',
 lines:[
  {t:'Once upon a time there was a very old man and a very old woman.',
   ko:'옛날 옛적에 아주 나이 많은 할아버지와 아주 나이 많은 할머니가 살았습니다.'},
  {t:'They lived in a nice clean house which had flowers all around it, except where the door was.',
   ko:'두 사람은 문이 있는 자리만 빼고 온통 꽃으로 둘러싸인, 깨끗하고 아담한 집에 살았습니다.'},
  {t:'But they couldn\'t be happy because they were so very lonely.',
   ko:'하지만 두 사람은 너무나 외로워서 행복할 수가 없었습니다.'},
  {t:'"If we only had a cat!" sighed the very old woman.',
   ko:'"고양이 한 마리만 있으면 좋으련만!" 할머니가 한숨을 쉬었습니다.'},
  {t:'"A cat?" asked the very old man.',
   ko:'"고양이요?" 할아버지가 물었습니다.'},
  {t:'"Yes, a sweet little fluffy cat," said the very old woman.',
   ko:'"네, 조그맣고 폭신폭신한 귀여운 고양이요." 할머니가 말했습니다.'},
  {t:'"I will get you a cat, my dear," said the very old man.',
   ko:'"내가 한 마리 데려오리다, 여보." 할아버지가 말했습니다.'}],
 narrate:{lines:[0], rate:0.78, pitch:0.96, gap:260, duck:0.08, delay:700, audio:'01_narration.mp3'},
 alt:[
  {q:'What kind of cat did the old woman want?',
   o:['A big black cat','A sweet little fluffy cat','A cat with stripes','Hundreds of cats'], a:1}],
 q:'Why were the old man and the old woman unhappy?',
 o:['Their house was too small','They were very lonely','They had too many cats','The flowers would not grow'], a:1},

/* ─────────── 2 · 언덕을 넘어, 고양이로 뒤덮인 언덕까지 ─────────── */
{n:2, rhyme:true, scene:'언덕을 넘어, 고양이로 뒤덮인 언덕까지', bg:'cat_hill', video:'02_journey.mp4',
 prompt:'An old man walking over sunny hills and through cool shaded valleys, arriving at a hillside completely covered with cat silhouettes that multiply toward the horizon. Folk-art woodcut texture, limited palette, very slow camera drift.',
 lines:[
  {t:'And he set out over the hills to look for one.',
   ko:'그래서 할아버지는 고양이를 찾아 언덕을 넘어 길을 나섰습니다.'},
  {t:'He climbed over the sunny hills.',
   ko:'햇살이 드는 언덕을 올랐습니다.'},
  {t:'He trudged through the cool valleys.',
   ko:'서늘한 골짜기를 터벅터벅 걸었습니다.'},
  {t:'He walked a long, long time and at last he came to a hill which was quite covered with cats.',
   ko:'아주 오랫동안 걷고 또 걸어, 마침내 고양이로 온통 뒤덮인 언덕에 다다랐습니다.'},
  {t:'Cats here, cats there,',
   ko:'여기도 고양이, 저기도 고양이,'},
  {t:'Cats and kittens everywhere,',
   ko:'어디를 봐도 고양이와 새끼 고양이,'},
  {t:'Hundreds of cats,',
   ko:'수백 마리 고양이,'},
  {t:'Thousands of cats,',
   ko:'수천 마리 고양이,'},
  {t:'Millions and billions and trillions of cats.',
   ko:'수백만, 수십억, 수조 마리 고양이.'}],
 narrate:{lines:[0,1], rate:0.78, pitch:0.96, gap:260, duck:0.08, delay:700, audio:'02_narration.mp3'},
 alt:[
  {q:'What did the old man find at the end of his long walk?',
   o:['A pond full of water','A hill covered with cats','A house made of flowers','A baby tiger'], a:1},
  {q:'The numbers get bigger in every line. Why does the story do this?',
   o:['To count the cats exactly','To show the number growing huge','To give each cat a name','To end the story'], a:1},
  {q:'Which counting word comes last in the song?',
   o:['Hundreds','Thousands','Millions','Trillions'], a:3}],
 q:'How long did the old man walk before he found the cats?',
 o:['A long, long time','Only a few minutes','One hour','He never walked at all'], a:0},

/* ─────────── 3 · 첫 번째 고양이를 고르다 ─────────── */
{n:3, scene:'첫 번째 고양이를 고르다', bg:'choosing_white', video:'03_choosing.mp4',
 prompt:'Close view of a crowd of cat silhouettes on a hill, one white cat standing out among them, then a black-and-white one. Gentle shifting as the crowd stirs. Ink-drawing texture, pale sky.',
 lines:[
  {t:'"Oh," cried the old man joyfully, "Now I can choose the prettiest cat and take it home with me!"',
   ko:'"오," 할아버지가 기뻐서 외쳤습니다. "이제 제일 예쁜 고양이를 골라 집에 데려갈 수 있겠구나!"'},
  {t:'So he chose one. It was white.',
   ko:'그래서 한 마리를 골랐습니다. 흰 고양이였습니다.'},
  {t:'But just as he was about to leave, he saw another one all black and white and it seemed just as pretty as the first.',
   ko:'그런데 막 떠나려던 참에, 온통 검고 흰 고양이가 눈에 띄었는데 처음 고양이만큼이나 예뻐 보였습니다.'},
  {t:'So he took this one also.',
   ko:'그래서 이 고양이도 데려가기로 했습니다.'},
  {t:'But then he saw a fuzzy grey kitten way over here which was every bit as pretty as the others so he took it too.',
   ko:'그러다 저쪽에 보송보송한 회색 새끼 고양이가 보였는데 다른 고양이들만큼 예뻐서 그 고양이도 데려갔습니다.'}],
 alt:[
  {q:'What color was the very first cat he chose?',
   o:['White','Grey','Black','Brown and yellow'], a:0}],
 q:'Why did the old man take the second cat too?',
 o:['It was bigger','It seemed just as pretty as the first','The first cat ran away','The old woman told him to'], a:1},

/* ─────────── 4 · 고를수록 늘어나는 고양이 ─────────── */
{n:4, scene:'고를수록 늘어나는 고양이', bg:'choosing_more', video:'04_more.mp4',
 prompt:'The same hillside from different angles — a fuzzy grey kitten far off, one down in a corner, a black one, one with tiger stripes. Slow drifting attention from spot to spot. Ink-drawing texture.',
 lines:[
  {t:'And now he saw one way down in a corner which he thought too lovely to leave so he took this too.',
   ko:'이번엔 저 아래 구석에 있는 고양이가 눈에 들어왔는데 두고 가기엔 너무 사랑스러워서 그 고양이도 데려갔습니다.'},
  {t:'And just then, over here, the very old man found a kitten, which was black and very beautiful.',
   ko:'그리고 바로 그때 이쪽에서 할아버지는 새까맣고 아주 아름다운 새끼 고양이를 발견했습니다.'},
  {t:'"It would be a shame to leave that one," said the very old man. So he took it.',
   ko:'"저 아이를 두고 가면 아깝지." 할아버지가 말했습니다. 그래서 그 고양이도 데려갔습니다.'},
  {t:'And now, over there, he saw a cat which had brown and yellow stripes like a baby tiger.',
   ko:'그리고 저기에는 아기 호랑이처럼 갈색과 노란색 줄무늬가 있는 고양이가 있었습니다.'},
  {t:'"I simply must take it!" cried the very old man, and he did.',
   ko:'"이건 꼭 데려가야겠어!" 할아버지가 외쳤고, 정말 그렇게 했습니다.'}],
 alt:[
  {q:'Where was the kitten he thought too lovely to leave?',
   o:['Way over here','Down in a corner','On top of the hill','Beside the pond'], a:1}],
 q:'What did the striped cat look like?',
 o:['A baby tiger','A grey cloud','A white flower','A small dog'], a:0},

/* ─────────── 5 · 고양이를 전부 골라, 언덕을 넘어 돌아오다 ─────────── */
{n:5, scene:'고양이를 전부 골라, 언덕을 넘어 돌아오다', bg:'procession', video:'05_all.mp4',
 prompt:'A hillside emptying as every cat falls in behind one small figure, then an endless line of cat silhouettes winding back over sunny hills and down through cool valleys. Ink-drawing texture.',
 lines:[
  {t:'So it happened that every time the very old man looked up, he saw another cat which was so pretty he could not bear to leave it, and before he knew it, he had chosen them all.',
   ko:'그렇게 할아버지는 고개를 들 때마다 두고 가기엔 너무 예쁜 고양이를 또 발견했고, 어느새 고양이를 전부 골라 버렸습니다.'},
  {t:'And so he went back over the sunny hills and down through the cool valleys, to show all his pretty kittens to the very old woman.',
   ko:'그래서 할아버지는 햇살 언덕을 넘고 서늘한 골짜기를 내려와, 예쁜 고양이들을 모두 할머니에게 보여 주러 갔습니다.'},
  {t:'It was very funny to see those hundreds and thousands and millions and billions and trillions of cats following him.',
   ko:'수백, 수천, 수백만, 수십억, 수조 마리 고양이가 뒤를 따라오는 모습은 정말 우스웠습니다.'}],
 alt:[
  {q:'Why could the old man not leave any cat behind?',
   o:['Every cat followed him','Each one looked too pretty to leave','The cats were hungry','The old woman told him to'], a:1},
  {q:'Where was the old man going?',
   o:['Back home to the old woman','To another hill','To a pond','To find more cats'], a:0},
  {q:'What did the old man want to show the old woman?',
   o:['The sunny hills','His pretty kittens','A pond','A baby tiger'], a:1}],
 narrate:{lines:[0], text:['So it happened that every time the very old man looked up.'],
          rate:0.78, pitch:0.96, gap:260, duck:0.08, delay:700, audio:'05_narration.mp3'},
 q:'How many cats did the old man choose in the end?',
 o:['Only one','About ten','All of them','None of them'], a:2},

/* ─────────── 6 · 연못도 풀도 남지 않다 ─────────── */
{n:6, scene:'연못도 풀도 남지 않다', bg:'grass', video:'06_pond.mp4', flip:true,
 prompt:'A still pond ringed by countless cat silhouettes drinking until the bed is bare, then grassy hills swarming with cats until the hills are bare earth. Ink-drawing texture, muted palette.',
 lines:[
  {t:'They came to a pond.',
   ko:'일행은 연못에 다다랐습니다.'},
  {t:'"Mew, mew! We are thirsty!" cried the hundreds of cats, thousands of cats, millions and billions and trillions of cats.',
   ko:'"야옹, 야옹! 목말라요!" 수백 마리, 수천 마리, 수백만 수십억 수조 마리 고양이가 울었습니다.'},
  {t:'"Well, here is a great deal of water," said the very old man.',
   ko:'"여기 물이 아주 많단다." 할아버지가 말했습니다.'},
  {t:'Each cat took a sip of water, and the pond was gone!',
   ko:'고양이마다 물을 한 모금씩 마셨더니, 연못이 사라져 버렸습니다!'},
  {t:'"Mew, mew! Now we are hungry!" said the hundreds of cats, thousands of cats, millions and billions and trillions of cats.',
   ko:'"야옹, 야옹! 이제 배고파요!" 수백 마리, 수천 마리, 수백만 수십억 수조 마리 고양이가 말했습니다.'},
  {t:'"There is much grass on the hills," said the very old man.',
   ko:'"언덕에 풀이 많단다." 할아버지가 말했습니다.'},
  {t:'Each cat ate a mouthful of grass and not a blade was left!',
   ko:'고양이마다 풀을 한 입씩 먹었더니, 풀잎 하나 남지 않았습니다!'}],
 alt:[
  {q:'How much water did each cat drink?',
   o:['A whole pond','One sip','A mouthful','None at all'], a:1},
  {q:'What does "not a blade was left" mean here?',
   o:['The cats lost a knife','All the grass was eaten','The hills turned green','The grass grew taller'], a:1},
  {q:'What did each cat eat on the hills?',
   o:['A blade of flowers','A mouthful of grass','A sip of water','Nothing'], a:1}],
 q:'What happened to the pond?',
 o:['It froze','The cats drank it all','It rained into it','The old man filled it'], a:1},

/* ─────────── 7 · 집 앞에 밀려든 고양이 떼 · 같은 노래 ─────────── */
{n:7, rhyme:true, scene:'집 앞에 밀려든 고양이 떼 · 같은 노래', bg:'yard_flood', video:'07_arrival.mp4',
 prompt:'An unbroken tide of cat silhouettes flooding the flower-ringed cottage yard until it is packed to the edges of the frame, stirring like water. Ink-drawing texture.',
 lines:[
  {t:'Pretty soon, the very old woman saw them coming.',
   ko:'얼마 지나지 않아 할머니가 그들이 오는 것을 보았습니다.'},
  {t:'"My dear!" she cried, "What are you doing? I asked for one little cat, and what do I see?"',
   ko:'"여보!" 할머니가 소리쳤습니다. "지금 뭐 하시는 거예요? 나는 작은 고양이 한 마리를 부탁했는데, 이게 다 뭐예요?"'},
  {t:'Cats here, cats there,',
   ko:'여기도 고양이, 저기도 고양이,'},
  {t:'Cats and kittens everywhere,',
   ko:'어디를 봐도 고양이와 새끼 고양이,'},
  {t:'Hundreds of cats,',
   ko:'수백 마리 고양이,'},
  {t:'Thousands of cats,',
   ko:'수천 마리 고양이,'},
  {t:'Millions and billions and trillions of cats.',
   ko:'수백만, 수십억, 수조 마리 고양이.'},
  {t:'"But we can never feed them all," said the very old woman, "They will eat us out of house and home."',
   ko:'"하지만 저 고양이들을 다 먹일 순 없어요." 할머니가 말했습니다. "우리 집 살림까지 몽땅 거덜낼 거예요."'}],
 alt:[
  {q:'How many cats had the old woman asked for?',
   o:['One little cat','Two cats','Hundreds of cats','She asked for none'], a:0},
  {q:'Where did you hear these same words before?',
   o:['On the hill covered with cats','At the pond','Inside the house','At the very end'], a:0},
  {q:'Why does the story say these same lines a second time?',
   o:['To end the story','To show the same huge number again','To name the cats','To count them exactly'], a:1}],
 q:'How did the old woman feel when she saw the cats?',
 o:['Bored','Sleepy','Shocked','Angry at the cats'], a:2},

/* ─────────── 8 · 누가 제일 예쁘니? ─────────── */
{n:8, scene:'누가 제일 예쁘니?', bg:'yard_question', video:'08_question.mp4',
 prompt:'Countless cat silhouettes in the yard, all turning at once toward the same point as if answering. A ripple of movement passes through the whole crowd. Ink-drawing texture.',
 lines:[
  {t:'"I never thought of that," said the very old man, "What shall we do?"',
   ko:'"그 생각은 미처 못 했군." 할아버지가 말했습니다. "어떻게 하지?"'},
  {t:'The very old woman thought for a while and then she said, "I know! We will let the cats decide which one we should keep."',
   ko:'할머니는 잠시 생각하더니 말했습니다. "알았어요! 어느 고양이를 기를지 고양이들이 직접 정하게 해요."'},
  {t:'"Oh yes," said the very old man, and he called to the cats, "Which one of you is the prettiest?"',
   ko:'"그거 좋군." 할아버지가 고양이들을 향해 외쳤습니다. "너희 중에 누가 제일 예쁘니?"'},
  {t:'"I am!" "I am!" "No, I am!" "No, I am the prettiest!" "I am!" "No, I am! I am! I am!" cried hundreds and thousands and millions and billions and trillions of voices, for each cat thought itself the prettiest.',
   ko:'"나야!" "나야!" "아니, 나야!" "아니, 내가 제일 예뻐!" "나야!" "아니 나야! 나야! 나야!" 수백, 수천, 수백만, 수십억, 수조의 목소리가 외쳤습니다. 고양이마다 자기가 제일 예쁘다고 여겼으니까요.'}],
 alt:[
  {q:'Whose idea was it to let the cats decide?',
   o:['The old man','The old woman','The kitten','Nobody'], a:1}],
 q:'Why did every single cat answer the old man?',
 o:['Each one thought it was the prettiest','They were hungry again','They wanted to go home','The old woman asked them to'], a:0},

/* ─────────── 9 · 소란이 그치고, 텅 빈 마당 ─────────── */
{n:9, scene:'소란이 그치고, 텅 빈 마당', bg:'quarrel', video:'09_quarrel.mp4',
 prompt:'The packed yard of cat silhouettes churns violently, then the frame gradually empties until only bare ground and a window remain. No blood, no detail — only shapes dispersing. Ink-drawing texture, restrained.',
 lines:[
  {t:'And they began to quarrel.',
   ko:'그리고 고양이들은 다투기 시작했습니다.'},
  {t:'They bit and scratched and clawed each other and made such a great noise that the very old man and the very old woman ran into the house as fast as they could.',
   ko:'서로 물고 할퀴고 발톱을 세우며 어찌나 큰 소리를 냈는지, 할아버지와 할머니는 있는 힘껏 집 안으로 뛰어들어갔습니다.'},
  {t:'They did not like such quarreling.',
   ko:'두 사람은 그런 다툼을 좋아하지 않았습니다.'},
  {t:'But after a while the noise stopped and the very old man and the very old woman peeped out of the window to see what had happened.',
   ko:'얼마 뒤 소리가 그치자, 두 사람은 무슨 일이 있었는지 보려고 창밖을 살짝 내다보았습니다.'},
  {t:'They could not see a single cat!',
   ko:'고양이가 한 마리도 보이지 않았습니다!'},
  {t:'"I think they must have eaten each other all up," said the very old woman, "It\'s too bad!"',
   ko:'"서로 다 잡아먹어 버린 모양이에요." 할머니가 말했습니다. "안됐구나!"'}],
 alt:[
  {q:'What did they see when they peeped out of the window?',
   o:['Hundreds of cats','Not a single cat','One little kitten','The old woman'], a:1}],
 q:'Why did the old man and the old woman run into the house?',
 o:['They were hungry','They did not like the quarreling','It started to rain','They wanted to sleep'], a:1},

/* ─────────── 10 · 풀숲의 아기 고양이 ─────────── */
{n:10, scene:'풀숲의 아기 고양이', bg:'found_kitten', video:'10_kitten.mp4',
 prompt:'Empty bare yard with one tuft of tall grass still standing. Inside it, a very small silhouette sits perfectly still. Soft light gathers around it. Ink-drawing texture, quiet.',
 lines:[
  {t:'"But look!" said the very old man, and he pointed to a bunch of high grass.',
   ko:'"그런데 저것 봐요!" 할아버지가 키 큰 풀숲을 가리켰습니다.'},
  {t:'In it sat one little frightened kitten.',
   ko:'그 안에 겁먹은 새끼 고양이 한 마리가 앉아 있었습니다.'},
  {t:'They went out and picked it up. It was thin and scraggly.',
   ko:'두 사람은 나가서 고양이를 안아 올렸습니다. 야위고 볼품없는 고양이였습니다.'},
  {t:'"Dear little kitty," said the very old man, "how does it happen that you were not eaten up with all those hundreds and thousands and millions and billions and trillions of cats?"',
   ko:'"귀여운 아가야," 할아버지가 말했습니다. "수백 수천 수백만 수십억 수조 마리 고양이 틈에서 어떻게 너만 무사했니?"'},
  {t:'"Oh, I\'m just a very homely little cat," said the kitten, "So when you asked who was the prettiest, I didn\'t say anything. So nobody bothered about me."',
   ko:'"저는 그냥 아주 못생긴 고양이거든요." 새끼 고양이가 말했습니다. "그래서 누가 제일 예쁘냐고 물으셨을 때 아무 말도 안 했어요. 그래서 아무도 저한테 신경 쓰지 않았죠."'}],
 alt:[
  {q:'What did the kitten look like when they picked it up?',
   o:['Nice and plump','Thin and scraggly','Soft and shiny','Black and white'], a:1}],
 q:'Why was this kitten not eaten up?',
 o:['It ran away fast','It said nothing when they were asked','It hid inside the house','It was the biggest cat'], a:1},

/* ─────────── 11 · 세상에서 제일 아름다운 고양이 ─────────── */
{n:11, scene:'세상에서 제일 아름다운 고양이', bg:'ending', video:'11_ending.mp4',
 prompt:'Warm cottage interior at night, a small round cat silhouette curled beside a bowl in lamplight. Fur catches the light softly. Slow, steady, almost still. Warmest palette of the whole book.',
 lines:[
  {t:'They took the kitten into the house, where the very old woman gave it a warm bath and brushed its fur until it was soft and shiny.',
   ko:'두 사람은 새끼 고양이를 집으로 데려갔고, 할머니는 따뜻한 물로 목욕을 시키고 털이 부드럽고 반질반질해질 때까지 빗어 주었습니다.'},
  {t:'Every day they gave it plenty of milk, and soon it grew nice and plump.',
   ko:'매일 우유를 듬뿍 주었더니, 곧 통통하게 자랐습니다.'},
  {t:'"And it is a very pretty cat, after all!" said the very old woman.',
   ko:'"그러고 보니 정말 예쁜 고양이네요!" 할머니가 말했습니다.'},
  {t:'"It is the most beautiful cat in the whole world," said the very old man.',
   ko:'"세상에서 제일 아름다운 고양이야." 할아버지가 말했습니다.'},
  {t:'"I ought to know, for I\'ve seen hundreds of cats, thousands of cats, millions and billions and trillions of cats, and not one is as pretty as this one."',
   ko:'"내가 잘 알지. 수백 수천 수백만 수십억 수조 마리 고양이를 봤는데, 이 아이만큼 예쁜 고양이는 하나도 없었으니까."'}],
 alt:[
  {q:'How did the kitten grow nice and plump?',
   o:['It ate grass','They gave it plenty of milk','It drank the pond','It slept all day'], a:1}],
 q:'Why did the old man say this kitten was the most beautiful of all?',
 o:['It was the biggest one','It had the prettiest stripes','He had seen every other cat and loved this one','It was the only white cat'], a:2}

];

/* ── 마지막 화면 ──
   11쪽을 다 읽고 NEXT 를 누르면 나온다. 본문도 문제도 없이 영상과 THE END 뿐이다. */
window.MOC.END = { bg: 'ending', video: '12_end.mp4', label: 'THE END' };
