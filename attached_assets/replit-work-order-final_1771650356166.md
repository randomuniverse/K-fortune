# 📋 리플렛 작업 지시서 — 오늘의 운세 대개선 (v2.0)

> ⚠️ **중요 규칙:**
> 1. 각 작업은 독립적입니다. 하나 완료 후 `npm run build` 테스트하고 다음으로 넘어가세요.
> 2. **파일을 통째로 교체하지 마세요.** 지시된 위치만 정확히 수정하세요.
> 3. 작업 순서: **반드시 1 → 2 → 3 → 4 → 5 → 6 → 7 순서**로 진행하세요.

---

## [작업 1/7] shared/schema.ts — FortuneData 인터페이스 확장

**목표:** 새로운 필드 추가 (시간대별 행운, 오늘의 처방, 한줄 신탁, 자미두수 점수)

**변경 위치:** 114행 `export interface FortuneData {` 블록

**현재 코드 (114~132행):**
```typescript
export interface FortuneData {
  sajuScore: number;
  sajuDirection: string;
  sajuCaution: string;
  sajuSpecial: string;
  sajuSummary: string;
  zodiacScore: number;
  zodiacLove: string;
  zodiacMoney: string;
  zodiacHealth: string;
  zodiacWork: string;
  zodiacSummary: string;
  luckyNumbers: number[];
  ziweiMessage: string;
  combinedScore: number;
  coherenceScore: number;
  commonKeywords: string[];
  coreMessage: string;
}
```

**이것을 아래로 교체:**
```typescript
export interface FortuneData {
  sajuScore: number;
  sajuDirection: string;
  sajuCaution: string;
  sajuSpecial: string;
  sajuSummary: string;
  zodiacScore: number;
  zodiacLove: string;
  zodiacMoney: string;
  zodiacHealth: string;
  zodiacWork: string;
  zodiacSummary: string;
  luckyNumbers: number[];
  ziweiScore: number;              // 추가: 자미두수 점수
  ziweiMessage: string;
  combinedScore: number;
  coherenceScore: number;
  commonKeywords: string[];
  coreMessage: string;
  // === v2.0 신규 필드 (선택적) ===
  oracleLine?: string;             // 한줄 신탁 (시적, 비유적 한 문장)
  todayPrescription?: string;      // 오늘의 행동 처방 1가지
  luckyColor?: string;             // 행운의 색상 (용신 기반)
  luckyTime?: string;              // 행운의 시간대 (용신 기반)
  timeGuide?: {                    // 시간대별 행운 가이드
    morning: { score: number; message: string };
    afternoon: { score: number; message: string };
    evening: { score: number; message: string };
  };
  sajuInsight?: string;            // 사주 로직 기반 오늘 특수 해석 (괴강살/식상생재 등)
  scoreDelta?: number;             // 어제 대비 점수 변화
}
```

**주의:** `ziweiScore`는 optional이 아닌 **필수** 필드입니다. 나머지 v2.0 필드는 모두 optional(`?`)입니다. 빌드 시 `ziweiScore` 관련 타입에러가 나면, 작업 3-E를 적용하면 해결됩니다.

---

## [작업 2/7] shared/saju.ts — 시간대별 행운 계산 + 일일 사주 인사이트 함수 추가

**목표:** GPT 호출 없이 로직으로 시간대별 행운과 특수살 기반 오늘 인사이트를 계산하는 함수 2개를 신규 추가

**변경 위치:** 파일 맨 끝 (현재 마지막 함수 `calculateMonthlyFortunes` 아래)에 추가

**추가할 코드 (파일 끝에 그대로 붙여넣기):**
```typescript
// ================================================================
// [v2.0] 시간대별 행운 가이드 (API 호출 없음 — 순수 로직)
// ================================================================

export interface TimeGuide {
  morning: { score: number; message: string };
  afternoon: { score: number; message: string };
  evening: { score: number; message: string };
}

/**
 * 오늘의 일진과 사주 원국(용신)을 기반으로 시간대별 행운 점수를 계산합니다.
 * 
 * 원리: 각 시간대의 지지(時支)가 용신 오행을 생(生)하면 +점수, 극(剋)하면 -점수.
 *   - 오전 (06~12시): 묘시(卯)~사시(巳) → 주 기운 = 목(木)/화(火)
 *   - 오후 (12~18시): 오시(午)~신시(申) → 주 기운 = 화(火)/금(金)
 *   - 저녁 (18~24시): 유시(酉)~해시(亥) → 주 기운 = 금(金)/수(水)
 */
export function calculateTimeGuide(chart: SajuChart, todayStemIdx: number, todayBranchIdx: number): TimeGuide {
  const yongShinEl = FIVE_ELEMENTS.indexOf(chart.yongShin.element as typeof FIVE_ELEMENTS[number]);
  
  // 오행 상생: 목(0)→화(1)→토(2)→금(3)→수(4)→목(0)
  // 오행 상극: 목(0)→토(2), 토(2)→수(4), 수(4)→화(1), 화(1)→금(3), 금(3)→목(0)
  
  function getTimeScore(timeElements: number[]): number {
    let score = 60;
    for (const el of timeElements) {
      if (el === yongShinEl) score += 15;                          // 용신과 동일 오행
      else if ((el + 1) % 5 === yongShinEl) score += 10;          // 시간대 기운이 용신을 생
      else if ((yongShinEl + 1) % 5 === el) score += 5;           // 용신이 시간대를 생 (설기)
      else if ((el + 2) % 5 === yongShinEl) score -= 10;          // 시간대 기운이 용신을 극
      else if ((yongShinEl + 2) % 5 === el) score -= 5;           // 용신이 시간대를 극
    }
    
    // 오늘 일진 천간의 영향 가산
    const todayStemEl = STEM_ELEMENTS[todayStemIdx].element;
    if (todayStemEl === yongShinEl) score += 5;
    else if ((todayStemEl + 2) % 5 === yongShinEl) score -= 5;
    
    return Math.max(20, Math.min(95, score));
  }
  
  // 오전: 묘(木=0), 진(土=2), 사(火=1)
  const morningScore = getTimeScore([0, 2, 1]);
  // 오후: 오(火=1), 미(土=2), 신(金=3)
  const afternoonScore = getTimeScore([1, 2, 3]);
  // 저녁: 유(金=3), 술(土=2), 해(水=4)
  const eveningScore = getTimeScore([3, 2, 4]);
  
  const yongShinMessages: Record<string, { morning: string; afternoon: string; evening: string }> = {
    "목": {
      morning: "이른 아침의 나무 기운이 용신과 함께합니다. 새로운 시작에 좋은 시간.",
      afternoon: "오후의 불 기운이 에너지를 끌어올립니다. 활동적인 일에 적합합니다.",
      evening: "금 기운이 강해지는 저녁은 신중함이 필요합니다. 큰 결정은 피하세요.",
    },
    "화": {
      morning: "목 기운이 불을 살려주는 아침. 열정적인 활동에 적합합니다.",
      afternoon: "한낮의 화 기운이 최고조. 중요한 미팅이나 발표에 좋은 시간.",
      evening: "수 기운이 감도는 저녁은 휴식에 집중하세요. 감정 조절이 필요합니다.",
    },
    "토": {
      morning: "아침의 활기찬 에너지가 안정감을 줍니다. 계획 정리에 좋은 시간.",
      afternoon: "오후의 토 기운이 안정적. 실무와 정리에 최적의 시간입니다.",
      evening: "저녁은 무난하게 흘러갑니다. 가벼운 정리와 내일 준비에 적합합니다.",
    },
    "금": {
      morning: "아침의 목 기운과 갈등이 있을 수 있습니다. 급한 결정은 피하세요.",
      afternoon: "금 기운이 살아나는 오후가 핵심 시간. 결단이 필요한 일을 처리하세요.",
      evening: "저녁의 금·수 기운이 조화롭습니다. 마무리 작업과 복기에 좋습니다.",
    },
    "수": {
      morning: "아침은 보통입니다. 가볍게 준비하며 에너지를 비축하세요.",
      afternoon: "화 기운이 강한 오후는 신중하게. 감정적 충돌을 조심하세요.",
      evening: "수 기운이 살아나는 밤이 당신의 시간. 창의적 작업에 최적입니다.",
    },
  };
  
  const messages = yongShinMessages[chart.yongShin.element] || yongShinMessages["토"];
  
  return {
    morning: { score: morningScore, message: messages.morning },
    afternoon: { score: afternoonScore, message: messages.afternoon },
    evening: { score: eveningScore, message: messages.evening },
  };
}

/**
 * [v2.0] 오늘의 일진과 사주 원국의 특수살/구조 패턴을 기반으로 
 * "오늘만의 특별한 해석"을 생성합니다. (GPT 호출 없음 — 순수 로직)
 */
export function generateDailySajuInsight(
  chart: SajuChart, 
  personality: SajuPersonality,
  todayStemIdx: number, 
  todayBranchIdx: number
): string {
  const insights: string[] = [];
  const todayStemEl = STEM_ELEMENTS[todayStemIdx].element;
  const yongShinEl = FIVE_ELEMENTS.indexOf(chart.yongShin.element as typeof FIVE_ELEMENTS[number]);
  
  // 1. 용신과 오늘 일진의 관계
  if (todayStemEl === yongShinEl) {
    insights.push(`오늘 일진의 천간이 용신(${chart.yongShin.elementHanja})과 같은 기운입니다. 하늘이 당신 편인 날 — 중요한 일을 밀어붙이세요.`);
  } else if ((todayStemEl + 1) % 5 === yongShinEl) {
    insights.push(`오늘 일진이 용신(${chart.yongShin.elementHanja})을 살려주는 기운입니다. 순풍을 타는 흐름이니 적극적으로 움직이세요.`);
  } else if ((todayStemEl + 2) % 5 === yongShinEl) {
    insights.push(`오늘 일진이 용신(${chart.yongShin.elementHanja})을 누르는 기운입니다. 무리하지 말고 수비 위주로 하루를 보내세요.`);
  }
  
  // 2. 특수살 보유자의 오늘 특별 메시지 (가장 의미 있는 하나만)
  for (const sal of personality.specialSals) {
    if (sal.name === "괴강살") {
      const dayBranchIdx = chart.dayPillar.branchIndex;
      const isChung = (todayBranchIdx + 6) % 12 === dayBranchIdx || (dayBranchIdx + 6) % 12 === todayBranchIdx;
      if (isChung) {
        insights.push("괴강의 기운이 오늘 일진과 충돌합니다. 폭발적 에너지가 솟구치는 날 — 이 에너지를 결단이나 추진력으로 전환하세요.");
      } else {
        insights.push("괴강살 보유자인 당신은 오늘 리더십을 발휘할 기회가 있습니다. 주저하지 말고 앞장서세요.");
      }
      break;
    }
    if (sal.name === "도화살") {
      insights.push("도화살의 매력이 오늘 빛을 발합니다. 대인관계나 프레젠테이션에서 좋은 인상을 남길 수 있는 날.");
      break;
    }
    if (sal.name === "역마살") {
      insights.push("역마살의 기운이 활성화되는 날입니다. 움직이면 좋은 소식이 따라옵니다. 밖으로 나가세요.");
      break;
    }
    if (sal.name === "천을귀인") {
      insights.push("천을귀인의 별이 오늘을 비추고 있습니다. 뜻밖의 도움이나 좋은 만남이 예상됩니다.");
      break;
    }
  }
  
  // 3. 구조 패턴 기반 오늘 메시지
  if (insights.length < 2) {
    for (const pattern of personality.structurePatterns) {
      if (pattern.name === "식상생재" && (todayStemEl === yongShinEl || (todayStemEl + 1) % 5 === yongShinEl)) {
        insights.push("식상생재의 구조가 오늘 활성화됩니다. 아이디어가 돈이 되는 날 — 떠오르는 생각을 메모하세요.");
        break;
      }
      if (pattern.name === "관인상생") {
        insights.push("관인상생의 흐름이 오늘 작동합니다. 윗사람이나 멘토의 조언에 귀 기울이면 좋은 결과가 있습니다.");
        break;
      }
    }
  }
  
  // 기본 메시지 (아무것도 해당 안 될 때)
  if (insights.length === 0) {
    const remedy = personality.yongShinRemedy;
    insights.push(`오늘은 용신(${chart.yongShin.elementHanja}) 기운을 의식적으로 가까이 하세요. ${remedy.luckyColor.split("계열")[0]}계열 의상이 기운을 끌어올립니다.`);
  }
  
  return insights.join(" ");
}
```

**주의:** 이 코드에서 사용하는 `STEM_ELEMENTS`, `FIVE_ELEMENTS`, `SajuChart`, `SajuPersonality` 타입은 모두 같은 파일(saju.ts)에 이미 존재합니다. 새로운 import는 필요하지 않습니다.

---

## [작업 3/7] server/fortune-engine.ts — 새 함수 연동 + FortuneData 필드 채우기

이 작업은 5개의 하위 단계(3-A ~ 3-E)로 구성됩니다.

### 3-A. import 수정

**변경 위치:** 3행

**현재:**
```typescript
import { calculateFullSaju, checkGanYeoJiDong, calculateDaewoonDynamicStars } from "@shared/saju";
```

**변경 후:**
```typescript
import { calculateFullSaju, checkGanYeoJiDong, calculateDaewoonDynamicStars, analyzeSajuPersonality, calculateTimeGuide, generateDailySajuInsight } from "@shared/saju";
```

### 3-B. generateFortuneForUser 함수 내부 — 사주 v2.0 데이터 생성

**변경 위치:** `generateFortuneForUser` 함수 내, 218행 `const todayBranch = BRANCHES_H[todayBranchIdx];` 바로 **아래** (그리고 `// 1. 사주 프롬프트` 바로 **위**)에 삽입

**삽입할 코드:**
```typescript

  // === v2.0: 사주 로직 기반 데이터 생성 (GPT 호출 없음) ===
  const sajuPersonality = analyzeSajuPersonality(sajuChart);
  const timeGuide = calculateTimeGuide(sajuChart, todayStemIdx, todayBranchIdx);
  const sajuInsight = generateDailySajuInsight(sajuChart, sajuPersonality, todayStemIdx, todayBranchIdx);
  const yongShinRemedy = sajuPersonality.yongShinRemedy;

```

### 3-C. synthesisSchema 확장

**변경 위치:** `const synthesisSchema = z.object({` 블록 (143행 부근)

**현재 `coreMessage` 필드 뒤에, `luckyNumbers` 앞에, 아래 2개 필드를 추가:**

`coreMessage` 라인:
```typescript
  coreMessage: z.string().describe("3가지 운세가 만장일치로 가리키는 오늘의 핵심 메시지"),
```

이 줄 바로 아래에 추가:
```typescript
  oracleLine: z.string().describe("시적이고 비유적인 한 줄 신탁. 반드시 자연/계절/동물/원소의 은유를 포함. 예: '봄 얼음 아래 흐르는 물처럼 — 겉은 고요하나 속에서는 이미 변화가 시작되었다.' ~할 수 있습니다 같은 상투어 금지."),
  todayPrescription: z.string().describe("오늘 당장 실행할 수 있는 구체적 행동 처방 1가지. 장소/시간/행동이 구체적이어야 함. 예: '오후 3시에 창가에서 따뜻한 차를 마시며 5분간 멍 때리세요.' 추상적 조언 금지."),
```

### 3-D. 교차검증 프롬프트(synthesizePrompt) 수정

**변경 위치:** `const synthesizePrompt` 문자열 내부 (352행 부근~)

**수정 1:** `[융합 분석 지침]`의 3번 항목을 교체합니다.

현재 3번:
```
3. **핵심 메시지:** 3가지 운세가 만장일치로 합의한 '오늘의 가장 확실한 운명'을 한 문장으로 정의하세요. 따뜻하고 격려하는 톤을 유지하세요.
```

교체:
```
3. **핵심 메시지:** 3가지 운세가 만장일치로 합의한 '오늘의 가장 확실한 운명'을 한 문장으로 정의하세요. "~할 수 있습니다" 같은 약한 표현 대신 "~하는 날이다", "~하라" 같은 단정형을 사용하세요.
```

**수정 2:** 기존 지침 6번(`**자미두수 메시지:**`) 바로 아래에 7번, 8번을 추가합니다.

추가:
```
7. **한 줄 신탁(oracleLine):** 오늘의 운세를 관통하는 시적이고 비유적인 한 문장을 작성하세요. 반드시 자연, 계절, 동물, 원소 등의 은유를 포함해야 합니다. 예: "봄 얼음 아래 흐르는 물처럼 — 겉은 고요하나 속에서는 이미 변화가 시작되었다." 매일 다른 이미지를 사용하세요. 절대로 "~할 수 있습니다" 같은 상투적 표현 금지.
8. **오늘의 처방(todayPrescription):** 오늘 당장 실행할 수 있는 구체적이고 독특한 행동 1가지를 처방하세요. "긍정적으로 생각하세요" 같은 추상적 조언 금지. 반드시 장소/시간/행동이 구체적이어야 합니다. 예: "점심에 평소 안 가던 카페를 가보세요. 뜻밖의 영감이 옵니다."
```

**수정 3:** 같은 프롬프트 내부의 JSON 출력 형식에서, `"ziweiMessage"` 줄 바로 아래에 추가:

```
  "oracleLine": "시적이고 비유적인 한 줄 신탁 (은유/비유 필수, 상투어 금지)",
  "todayPrescription": "오늘 당장 실행 가능한 구체적 행동 1가지 (장소/시간/행동 포함)"
```

### 3-E. FortuneData 조합 부분에 새 필드 추가

**변경 위치:** `const fortuneData: FortuneData = {` 블록 (약 419행)

**수정 1:** 어제 점수 비교 로직을 `const fortuneData` 선언 **바로 위**에 추가:

```typescript
  // === v2.0: 어제 대비 점수 변화 ===
  let scoreDelta: number | undefined;
  try {
    const yesterdayFortunes = await storage.getFortunesByUserId(user.id);
    if (yesterdayFortunes && yesterdayFortunes.length > 0) {
      const yesterday = yesterdayFortunes[0]; // 가장 최근 운세
      if (yesterday.fortuneData) {
        const prevData = JSON.parse(yesterday.fortuneData);
        scoreDelta = finalCombinedScore - (prevData.combinedScore || 0);
      }
    }
  } catch (e) {
    console.warn("[FORTUNE] 어제 점수 비교 실패:", e);
  }

```

**수정 2:** `const fortuneData: FortuneData = {` 블록 내부, `coreMessage: synthesis.coreMessage,` 줄 바로 아래(닫는 `};` 전)에 추가:

```typescript
    // === v2.0 신규 필드 ===
    ziweiScore: ziwei.score,
    oracleLine: synthesis.oracleLine || undefined,
    todayPrescription: synthesis.todayPrescription || undefined,
    luckyColor: yongShinRemedy.luckyColor.split("계열")[0] + "계열",
    luckyTime: yongShinRemedy.luckyTime.split("에")[0],
    timeGuide,
    sajuInsight,
    scoreDelta,
```

---

## [작업 4/7] server/fortune-engine.ts — 텔레그램 메시지 "신탁 스타일" 리디자인

**목표:** `formatFortuneForTelegram` 함수를 완전히 교체. 웹에서는 상세 정보를 모두 보여주고, 텔레그램은 짧고 임팩트 있는 신탁 스타일로.

**변경 위치:** 50~89행의 `formatFortuneForTelegram` 함수 전체

**현재 함수(50~89행)를 통째로 아래로 교체:**

```typescript
export function formatFortuneForTelegram(data: FortuneData, userName: string, dateStr: string, zodiacSign: string): string {
  // 점수 이모지
  const scoreEmoji = data.combinedScore >= 80 ? "🔥" : data.combinedScore >= 60 ? "✨" : data.combinedScore >= 40 ? "🌤" : "🌧";
  
  // 점수 변화 표시
  let deltaText = "";
  if (data.scoreDelta !== undefined && data.scoreDelta !== null) {
    if (data.scoreDelta > 0) deltaText = ` (▲ +${data.scoreDelta})`;
    else if (data.scoreDelta < 0) deltaText = ` (▼ ${data.scoreDelta})`;
    else deltaText = " (→ 변동없음)";
  }

  // 최적 시간대 판별
  let timeBest = "";
  if (data.timeGuide) {
    const { morning, afternoon, evening } = data.timeGuide;
    if (morning.score >= afternoon.score && morning.score >= evening.score) timeBest = "🌅 오전";
    else if (afternoon.score >= evening.score) timeBest = "☀️ 오후";
    else timeBest = "🌙 저녁";
  }

  let msg = `<b>☽ ${dateStr} — ${userName}님의 운세</b>\n\n`;
  
  // 한 줄 신탁 (가장 임팩트 있는 부분 — 최상단)
  if (data.oracleLine) {
    msg += `<i>"${data.oracleLine}"</i>\n\n`;
  }
  
  // 종합 점수 (한 줄로 압축)
  msg += `${scoreEmoji} <b>${data.combinedScore}점</b>${deltaText}\n`;
  msg += `사주 ${data.sajuScore} · 별자리 ${data.zodiacScore} · 자미두수 ${data.ziweiScore || "—"} · 일치도 ${data.coherenceScore}%\n\n`;
  
  // 핵심 메시지
  msg += `💎 ${data.coreMessage}\n\n`;
  
  // 오늘의 처방
  if (data.todayPrescription) {
    msg += `💡 <b>오늘의 처방:</b> ${data.todayPrescription}\n\n`;
  }
  
  // 사주 인사이트 (특수살/구조 패턴 기반 — GPT가 아닌 로직 결과)
  if (data.sajuInsight) {
    msg += `🔮 ${data.sajuInsight}\n\n`;
  }

  // 행운 가이드 (한 줄로 압축)
  msg += `🧭 방향 ${data.sajuDirection}`;
  if (data.luckyColor) msg += ` · 색상 ${data.luckyColor}`;
  msg += ` · 숫자 ${data.luckyNumbers.join(",")}`;
  if (timeBest) msg += ` · 최적 ${timeBest}`;
  
  return msg;
}
```

**핵심 변경점:**
- **이전:** 사주/별자리/자미두수 상세 텍스트가 모두 포함 → 텔레그램 메시지가 매우 길었음
- **이후:** 신탁 한줄 + 핵심 메시지 + 처방 + 사주 인사이트 + 행운 가이드 = 짧고 임팩트 있는 메시지
- 상세 내용(사주 요약, 별자리 연애운/재물운/건강운/직장운 등)은 **웹에서만** 표시됨

---

## [작업 5/7] server/fortune-engine.ts — GPT 프롬프트 톤 개선

**목표:** GPT가 "~할 수 있습니다" 대신 단정적이고 구체적인 문장을 생성하도록 프롬프트 수정

### 5-A. 사주 프롬프트

**변경 위치:** `sajuSystemPrompt` 내부 `[분석 지침]` (약 229행)

현재 지침 3번 다음에 4번, 5번을 **추가**:
```
4. "~할 수 있습니다", "~일 수 있습니다" 같은 약한 표현은 절대 금지.
   - 나쁜 예: "좋은 결과를 얻을 수 있습니다" → 좋은 예: "오늘은 결과가 따르는 날이다"
   - 나쁜 예: "주의가 필요합니다" → 좋은 예: "오후에 날카로운 말이 독이 된다"
5. 365일 아무 날에나 붙일 수 있는 일반적 문장 금지. 반드시 오늘 일진(${todayStem}${todayBranch})과 일주의 구체적 관계(합/충/생/극)를 근거로 서술하세요.
```

### 5-B. 별자리 프롬프트

**변경 위치:** `zodiacSystemPrompt` 내부, 기존 지침 4번 뒤에 (약 261행)

기존 4번 `4. 사용자의 이름을 절대 사용하지 마세요...` 아래에 **추가**:
```
5. "~할 수 있습니다", "~일 수 있습니다" 같은 약한 표현은 절대 금지. "~하는 날이다", "~하라" 같은 단정형을 사용하세요.
6. 365일 아무 날에나 붙일 수 있는 일반적 문장 금지. 반드시 오늘 날짜의 행성 배치를 근거로 구체적으로 서술하세요.
```

### 5-C. 자미두수 프롬프트

**변경 위치:** `ziweiSystemPrompt` 내부, 기존 지침 4번 뒤에 (약 298행)

기존 4번 `4. 따뜻하고 격려하는 톤을 유지하세요.` 아래에 **추가**:
```
5. "~할 수 있습니다" 같은 약한 표현 금지. 단정적이고 구체적으로 서술하세요.
```

---

## [작업 6/7] client/src/components/FortuneScoreCard.tsx — 웹 UI 재구성

**목표:** 한줄 신탁 최상단 배치, 자미두수 점수바 추가, 시간대별 가이드, 행동 처방, 상세 접기(accordion)

**변경 위치:** 전체 파일 교체 (기존 170행 → 약 250행)

**전체 파일을 아래 코드로 교체:**

```tsx
import { motion } from "framer-motion";
import { useState } from "react";
import { Compass, Hash, Heart, Wallet, Activity, Briefcase, Star, Link, Target, Clock, ChevronDown, ChevronUp, Zap } from "lucide-react";
import type { FortuneData } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  data: FortuneData;
  zodiacSign: string;
}

function ScoreRing({ score, size = 120, strokeWidth = 8 }: { score: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 80 ? "hsl(45, 93%, 55%)" : score >= 60 ? "hsl(45, 70%, 50%)" : score >= 40 ? "hsl(30, 60%, 50%)" : "hsl(0, 50%, 50%)";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
        <motion.circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: circumference - progress }} transition={{ duration: 1.2, ease: "easeOut" }} strokeDasharray={circumference} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span className="text-3xl font-bold text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} data-testid="text-combined-score">{score}</motion.span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

function MiniScore({ label, score }: { label: string; score: number }) {
  const barColor = score >= 70 ? "bg-primary" : score >= 50 ? "bg-amber-500" : "bg-orange-500";
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-16 text-right">{label}</span>
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div className={`h-full rounded-full ${barColor}`} initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }} />
      </div>
      <span className="text-xs font-medium text-white w-8">{score}점</span>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Compass; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
      <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm text-white/90 leading-relaxed">{value}</p>
      </div>
    </div>
  );
}

export function FortuneScoreCard({ data, zodiacSign }: Props) {
  const [showSajuDetail, setShowSajuDetail] = useState(false);
  const [showZodiacDetail, setShowZodiacDetail] = useState(false);

  // 점수 변화 텍스트
  const deltaText = data.scoreDelta !== undefined && data.scoreDelta !== null
    ? data.scoreDelta > 0 ? `▲ +${data.scoreDelta}` : data.scoreDelta < 0 ? `▼ ${data.scoreDelta}` : "→ 변동없음"
    : null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-4" data-testid="fortune-score-card">

      {/* 한 줄 신탁 — 최상단, 가장 먼저 눈에 들어옴 */}
      {data.oracleLine && (
        <Card className="bg-gradient-to-r from-primary/10 via-transparent to-primary/5 border-primary/20 p-6 text-center">
          <p className="text-base md:text-lg text-white/90 font-serif italic leading-relaxed">"{data.oracleLine}"</p>
        </Card>
      )}

      {/* 메인 점수 카드 */}
      <Card className="bg-white/[0.03] border-white/10 p-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <ScoreRing score={data.combinedScore} />
          <div className="flex-1 w-full space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-lg font-serif text-white">종합 운세 점수</h3>
              <span className="text-xs text-muted-foreground font-normal">
                {(() => { const now = new Date(); const utc = now.getTime() + now.getTimezoneOffset() * 60000; const kst = new Date(utc + 9 * 3600000); return `${kst.getMonth() + 1}월${kst.getDate()}일`; })()}
              </span>
              {deltaText && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${(data.scoreDelta || 0) > 0 ? "bg-emerald-500/20 text-emerald-400" : (data.scoreDelta || 0) < 0 ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white/50"}`}>{deltaText}</span>
              )}
            </div>
            <MiniScore label="사주팔자" score={data.sajuScore} />
            <MiniScore label="별자리" score={data.zodiacScore} />
            <MiniScore label="자미두수" score={data.ziweiScore || 0} />
          </div>
        </div>

        {/* 교차 검증 */}
        {data.coherenceScore != null && (
          <div className="mt-5 bg-white/[0.03] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-xs font-serif text-primary">동서양 교차 검증</span>
              <span className={`ml-auto text-sm font-bold ${data.coherenceScore >= 80 ? "text-emerald-400" : data.coherenceScore >= 60 ? "text-primary" : "text-amber-400"}`} data-testid="text-coherence-score">일치도 {data.coherenceScore}%</span>
            </div>
            {data.coreMessage && <p className="text-sm text-white/90 leading-relaxed font-medium" data-testid="text-core-message">{data.coreMessage}</p>}
            {data.commonKeywords && data.commonKeywords.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Link className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                {data.commonKeywords.map((kw, i) => (<Badge key={i} variant="secondary" className="text-xs" data-testid={`badge-keyword-${i}`}>{kw}</Badge>))}
              </div>
            )}
          </div>
        )}

        {/* 오늘의 처방 */}
        {data.todayPrescription && (
          <div className="mt-4 bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
            <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-primary font-medium mb-1">오늘의 처방</p>
              <p className="text-sm text-white/90 leading-relaxed">{data.todayPrescription}</p>
            </div>
          </div>
        )}

        {/* 행운 가이드 (2~4칸 그리드) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <div className="bg-white/[0.03] rounded-xl p-3 flex items-center gap-2">
            <Compass className="w-4 h-4 text-primary shrink-0" />
            <div><p className="text-[10px] text-muted-foreground">방향</p><p className="text-xs font-medium text-white">{data.sajuDirection}</p></div>
          </div>
          <div className="bg-white/[0.03] rounded-xl p-3 flex items-center gap-2">
            <Hash className="w-4 h-4 text-primary shrink-0" />
            <div><p className="text-[10px] text-muted-foreground">숫자</p><p className="text-xs font-medium text-white">{data.luckyNumbers.join(", ")}</p></div>
          </div>
          {data.luckyColor && (
            <div className="bg-white/[0.03] rounded-xl p-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-primary shrink-0" />
              <div><p className="text-[10px] text-muted-foreground">색상</p><p className="text-xs font-medium text-white">{data.luckyColor}</p></div>
            </div>
          )}
          {data.luckyTime && (
            <div className="bg-white/[0.03] rounded-xl p-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary shrink-0" />
              <div><p className="text-[10px] text-muted-foreground">시간</p><p className="text-xs font-medium text-white">{data.luckyTime}</p></div>
            </div>
          )}
        </div>
      </Card>

      {/* 시간대별 행운 가이드 */}
      {data.timeGuide && (
        <Card className="bg-white/[0.03] border-white/10 p-5">
          <h4 className="text-xs font-serif text-primary mb-4 flex items-center gap-2"><Clock className="w-4 h-4" /> 시간대별 운세 흐름</h4>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "morning" as const, label: "오전", sub: "06~12시", td: data.timeGuide.morning },
              { key: "afternoon" as const, label: "오후", sub: "12~18시", td: data.timeGuide.afternoon },
              { key: "evening" as const, label: "저녁", sub: "18~24시", td: data.timeGuide.evening },
            ].map(({ key, label, sub, td }) => (
              <div key={key} className={`rounded-xl p-3 text-center border ${td.score >= 70 ? "border-emerald-500/20 bg-emerald-500/5" : td.score < 45 ? "border-red-500/20 bg-red-500/5" : "border-white/5 bg-white/[0.02]"}`}>
                <p className="text-xs font-medium text-white">{label}</p>
                <p className="text-[10px] text-muted-foreground">{sub}</p>
                <p className={`text-lg font-bold mt-1 ${td.score >= 70 ? "text-emerald-400" : td.score < 45 ? "text-red-400" : "text-primary"}`}>{td.score}</p>
                <p className="text-[10px] text-white/60 mt-1 leading-snug">{td.message}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 사주 인사이트 (특수살/구조 패턴 기반) */}
      {data.sajuInsight && (
        <Card className="bg-white/[0.03] border-white/10 p-5">
          <div className="flex items-start gap-3">
            <Star className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div><h4 className="text-xs font-serif text-amber-400 mb-1">오늘의 사주 인사이트</h4><p className="text-sm text-white/80 leading-relaxed">{data.sajuInsight}</p></div>
          </div>
        </Card>
      )}

      {/* 자미두수 메시지 */}
      {data.ziweiMessage && (
        <Card className="bg-white/[0.03] border-white/10 p-5">
          <h4 className="text-xs font-serif text-purple-400 mb-2">자미두수 메시지</h4>
          <p className="text-sm text-white/80 leading-relaxed">{data.ziweiMessage}</p>
        </Card>
      )}

      {/* 상세 분석 (접이식 — accordion) */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-white/[0.03] border-white/10">
          <button className="w-full p-5 flex items-center justify-between text-left" onClick={() => setShowSajuDetail(!showSajuDetail)}>
            <h4 className="text-sm font-serif text-primary">사주팔자 운세</h4>
            {showSajuDetail ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showSajuDetail && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 pb-5 space-y-1 border-t border-white/5 pt-3">
              <p className="text-sm text-white/80 leading-relaxed mb-3">{data.sajuSummary}</p>
              <InfoRow icon={Star} label="조심할 점" value={data.sajuCaution} />
              <InfoRow icon={Star} label="특이사항" value={data.sajuSpecial} />
            </motion.div>
          )}
        </Card>

        <Card className="bg-white/[0.03] border-white/10">
          <button className="w-full p-5 flex items-center justify-between text-left" onClick={() => setShowZodiacDetail(!showZodiacDetail)}>
            <h4 className="text-sm font-serif text-primary">별자리 운세 ({zodiacSign})</h4>
            {showZodiacDetail ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showZodiacDetail && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 pb-5 space-y-1 border-t border-white/5 pt-3">
              <p className="text-sm text-white/80 leading-relaxed mb-3">{data.zodiacSummary}</p>
              <InfoRow icon={Heart} label="연애운" value={data.zodiacLove} />
              <InfoRow icon={Wallet} label="재물운" value={data.zodiacMoney} />
              <InfoRow icon={Activity} label="건강운" value={data.zodiacHealth} />
              <InfoRow icon={Briefcase} label="직장운" value={data.zodiacWork} />
            </motion.div>
          )}
        </Card>
      </div>
    </motion.div>
  );
}
```

---

## [작업 7/7] 검증 및 마무리

### 7-A. 빌드 확인
```bash
npm run build
```
에러 없으면 성공.

### 7-B. 기능 테스트

1. 웹에서 "오늘의 운세" 생성 버튼 클릭
2. 확인할 것:
   - [ ] 한줄 신탁이 카드 최상단에 표시되는가?
   - [ ] 점수바가 3개(사주/별자리/자미두수) 표시되는가?
   - [ ] 시간대별 운세(오전/오후/저녁) 카드가 표시되는가?
   - [ ] "오늘의 처방"이 표시되는가?
   - [ ] 사주/별자리 상세가 접혀 있고, 클릭하면 펼쳐지는가?
   - [ ] "~할 수 있습니다" 문체가 사라졌는가?
3. 텔레그램 테스트 전송
   - [ ] 메시지가 짧아졌는가? (이전 대비 50% 이상 축소)
   - [ ] 한줄 신탁이 최상단에 이탤릭으로 표시되는가?

### 7-C. FortuneCard.tsx 주의사항

`FortuneCard.tsx`는 과거 운세 히스토리를 표시하는 컴포넌트인데, 현재 `cleanTelegramContent` 함수가 이전 텔레그램 포맷("-- 📜 사주팔자", "-- 🔭 별자리" 등)을 파싱합니다. 작업 4에서 텔레그램 포맷이 바뀌면 과거 운세 표시가 깨질 수 있지만, **이전에 생성된 운세는 이미 DB에 저장된 content를 사용하므로 영향 없습니다.** 새로운 포맷의 운세만 다르게 파싱되면 됩니다. 만약 새 포맷 파싱에 문제가 생기면, `FortuneCard.tsx`의 `cleanTelegramContent` 함수에 새 포맷 대응 로직을 추가하면 됩니다 — 하지만 이건 이번 작업 범위 밖이므로, 문제가 생길 때 별도로 수정하세요.

---

## 예상되는 빌드 에러 & 해결

| 에러 | 원인 | 해결 |
|------|------|------|
| `ziweiScore` 속성이 FortuneData에 없음 | 작업 1 전에 작업 3 진행 | 작업 1부터 순서대로 |
| `analyzeSajuPersonality` import 에러 | 작업 2 전에 작업 3 진행 | 작업 2부터 순서대로 |
| `oracleLine` 속성이 synthesisSchema에 없음 | 작업 3-C 누락 | synthesisSchema에 필드 추가 |
| lucide-react 아이콘 누락 (Zap 등) | lucide-react 버전 | `Zap` → `Lightning` 등으로 대체 |
| `storage.getFortunesByUserId` 에러 | 메서드명 다를 수 있음 | 실제 storage.ts의 메서드명 확인 |

---

## 변경 파일 요약

| 파일 | 작업 번호 | 변경 유형 |
|------|-----------|-----------|
| `shared/schema.ts` | 1 | FortuneData 인터페이스 확장 |
| `shared/saju.ts` | 2 | 함수 2개 추가 (파일 끝) |
| `server/fortune-engine.ts` | 3, 4, 5 | import 수정 + 데이터 연동 + 텔레그램 함수 교체 + 프롬프트 개선 |
| `client/src/components/FortuneScoreCard.tsx` | 6 | 전체 교체 |
| `server/scheduler.ts` | — | 변경 없음 (자동 적용) |
