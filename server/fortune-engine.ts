import { storage } from "./storage";
import { getZodiacSign, getZodiacInfo, type FortuneData } from "@shared/schema";
import { calculateFullSaju } from "@shared/saju";
import { calculateZiWei } from "@shared/ziwei";
import OpenAI from "openai";
import { z } from "zod";
import pRetry from "p-retry";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("[TELEGRAM] Bot token not configured, skipping send");
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("[TELEGRAM] Send failed:", data.description);
      return false;
    }
    console.log(`[TELEGRAM] Message sent to ${chatId}`);
    return true;
  } catch (err) {
    console.error("[TELEGRAM] Error:", err);
    return false;
  }
}

// 텔레그램 메시지 포맷팅 함수 (3자 교차 검증 반영)
export function formatFortuneForTelegram(data: FortuneData, userName: string, dateStr: string, zodiacSign: string): string {
  let coherenceEmoji = "🤔";
  let coherenceText = "복합적인 하루";
  if (data.coherenceScore >= 85) {
    coherenceEmoji = "🌟";
    coherenceText = "운명적 일치 (강력 추천)";
  } else if (data.coherenceScore >= 70) {
    coherenceEmoji = "⚖️";
    coherenceText = "대체로 일치";
  }

  return `<b>[오늘의 운세] ${dateStr}</b>
<b>${userName}님</b> (${zodiacSign})

<b>${coherenceEmoji} 운세 일치도: ${data.coherenceScore}%</b>
(${coherenceText})
"사주, 별자리, 자미두수가 공통적으로 가리키는 메시지입니다."

<b>💎 오늘의 핵심 메시지:</b>
${data.coreMessage}

<b>🔗 공통 키워드:</b> ${data.commonKeywords.join(", ")}

<b>-- 종합 점수: ${data.combinedScore}점</b>
  사주: ${data.sajuScore}점 | 별자리: ${data.zodiacScore}점

<b>-- 행운 가이드</b>
방향: ${data.sajuDirection} | 숫자: ${data.luckyNumbers.join(", ")}

<b>-- 📜 사주팔자 (Time)</b>
${data.sajuSummary}
<b>⚠️ 주의:</b> ${data.sajuCaution}

<b>-- 🔭 별자리 (Space)</b>
${data.zodiacSummary}
<b>💡 팁:</b> ${data.zodiacWork}

<b>-- 🔮 자미두수 (Stars)</b>
${data.ziweiMessage}`;
}

function getKoreaTime() {
  const now = new Date();
  const koreaOffset = 9 * 60 * 60 * 1000;
  return new Date(now.getTime() + koreaOffset);
}

function getTodayJDN(koreaTime: Date) {
  const a = Math.floor((14 - (koreaTime.getMonth() + 1)) / 12);
  const y = koreaTime.getFullYear() + 4800 - a;
  const m = (koreaTime.getMonth() + 1) + 12 * a - 3;
  return koreaTime.getDate() + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

const STEMS_H = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES_H = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

function parseJson<T>(raw: string, schema: z.ZodSchema<T>): T | null {
  try {
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.lucky_numbers && !parsed.luckyNumbers) {
      parsed.luckyNumbers = parsed.lucky_numbers;
      delete parsed.lucky_numbers;
    }
    return schema.parse(parsed);
  } catch { return null; }
}

// Zod 스키마 정의
const sajuSchema = z.object({
  score: z.number().min(0).max(100),
  direction: z.string().min(1),
  caution: z.string().min(1),
  special: z.string().min(1),
  summary: z.string().min(1),
});

const zodiacSchema = z.object({
  score: z.number().min(0).max(100),
  love: z.string().min(1),
  money: z.string().min(1),
  health: z.string().min(1),
  work: z.string().min(1),
  summary: z.string().min(1),
});

const ziweiDailySchema = z.object({
  score: z.number().min(0).max(100),
  summary: z.string().min(1),
  advice: z.string().min(1),
});

const synthesisSchema = z.object({
  coherenceScore: z.number().min(0).max(100).describe("3가지 운세(사주, 별자리, 자미두수)의 일치도 점수"),
  commonKeywords: z.array(z.string()).describe("3가지 운세에서 공통적으로 발견된 키워드 3~5개"),
  coreMessage: z.string().describe("3가지 운세가 만장일치로 가리키는 오늘의 핵심 메시지"),
  luckyNumbers: z.array(z.number()).min(1).max(5).describe("오늘의 행운의 숫자 3개"),
  sajuCaution: z.string(),
  sajuSpecial: z.string(),
  sajuSummary: z.string(),
  zodiacLove: z.string(),
  zodiacMoney: z.string(),
  zodiacHealth: z.string(),
  zodiacWork: z.string(),
  zodiacSummary: z.string(),
  ziweiMessage: z.string(),
});

export interface FortuneGenerationResult {
  fortuneData: FortuneData;
  displayContent: string;
}

async function generateWithRetry(sys: string, usr: string, label: string): Promise<string> {
  return pRetry(
    async () => {
      const c = await openai.chat.completions.create({
        model: "gpt-4o", temperature: 0.4, // 창의성보다는 분석력을 위해 온도를 약간 낮춤
        messages: [{ role: "system", content: sys }, { role: "user", content: usr }],
      });
      const content = c.choices[0].message.content || "";
      if (!content.trim()) {
        throw new Error(`Empty response from AI for ${label}`);
      }
      return content;
    },
    {
      retries: 2,
      minTimeout: 1500,
      maxTimeout: 5000,
      onFailedAttempt: (context) => {
        console.warn(
          `[FORTUNE] ${label} API 호출 실패 (시도 ${context.attemptNumber}/${context.attemptNumber + context.retriesLeft}): ${context.error.message}`
        );
      },
    }
  );
}

export async function generateFortuneForUser(user: {
  id: number;
  name: string;
  birthDate: string;
  birthTime: string;
  gender: string;
  birthCountry: string | null;
  birthCity: string | null;
  telegramId: string;
  telegramChatId: string | null;
}): Promise<FortuneGenerationResult> {
  const koreaTime = getKoreaTime();
  const dateStr = `${koreaTime.getFullYear()}년 ${koreaTime.getMonth() + 1}월 ${koreaTime.getDate()}일`;

  const zodiacSign = getZodiacSign(user.birthDate);
  const zodiacInfo = getZodiacInfo(user.birthDate);

  const genderVal = (user.gender === "female" || user.gender === "여" || user.gender === "woman") ? "female" : "male" as "male" | "female";
  const sajuChart = calculateFullSaju(user.birthDate, user.birthTime, genderVal);

  const [yearVal, monthVal, dayVal] = user.birthDate.split('-').map(Number);
  const hourVal = parseInt(user.birthTime.split(':')[0]);
  const ziweiResult = calculateZiWei(yearVal, monthVal, dayVal, hourVal, genderVal);

  const todayJDN = getTodayJDN(koreaTime);
  const todayStemIdx = ((todayJDN + 2) % 10 + 10) % 10;
  const todayBranchIdx = ((todayJDN) % 12 + 12) % 12;
  const todayStem = STEMS_H[todayStemIdx];
  const todayBranch = BRANCHES_H[todayBranchIdx];

  // 1. 사주 프롬프트
  const sajuSystemPrompt = `당신은 60년 경력의 정통 명리학자입니다.
아래 사주 원국과 오늘의 일진을 대조하여 정확한 일일 운세를 분석하세요.

[사주 원국 정보]
일주(본인): ${sajuChart.dayPillar.stemHanja}${sajuChart.dayPillar.branchHanja} (일간/${sajuChart.dayBranchTenGod.name})
용신: ${sajuChart.yongShin.elementHanja}(${sajuChart.yongShin.element})
오늘 일진: ${todayStem}${todayBranch} (천간:${STEMS_H[todayStemIdx]}/지지:${BRANCHES_H[todayBranchIdx]})

[분석 지침]
1. 오늘 일진(${todayStem}${todayBranch})이 일주(${sajuChart.dayPillar.stemHanja}${sajuChart.dayPillar.branchHanja})에 미치는 형/충/회/합/원진 관계를 분석하세요.
2. 용신(${sajuChart.yongShin.elementHanja})이 오늘 힘을 받는지, 극을 당하는지 확인하세요.
3. 이를 바탕으로 재물, 직장, 대인관계의 유불리를 명확히 판단하세요.

JSON 형식 응답:
{
  "score": 0~100,
  "direction": "동/서/남/북/중앙 중 택1",
  "caution": "오늘 특히 조심해야 할 점 (충/살 작용 기반)",
  "special": "오늘의 특이사항 (귀인/합 등 긍정적 요소)",
  "summary": "오늘의 사주 총평 (인과관계 명시)"
}`;

  const sajuUserPrompt = `오늘 날짜: ${dateStr}, 이름: ${user.name}
내 사주 일주(${sajuChart.dayPillar.stemHanja}${sajuChart.dayPillar.branchHanja})와 오늘 일진(${todayStem}${todayBranch})의 관계를 분석해줘.`;

  // 2. 별자리 프롬프트 (트랜짓 강조)
  const zodiacSystemPrompt = `당신은 현대 심리 점성술과 고전 점성술에 능통한 전문가입니다.
사용자의 태양 별자리와 오늘의 행성 배치(Transit)를 기반으로 운세를 분석하세요.

[별자리 정보]
별자리: ${zodiacSign} (${zodiacInfo.signEn})
주관 행성: ${zodiacInfo.rulingPlanet}

[분석 지침]
1. 오늘 날짜(${dateStr}) 기준, ${zodiacInfo.rulingPlanet}이나 주요 행성(태양, 달, 화성, 목성, 토성)이 ${zodiacSign}에 미치는 영향(각도/Aspect)을 상상하여 분석하세요.
2. 예: "화성이 긴장 각도를 맺어 다툼이 예상됨" 또는 "목성이 조화로워 금전운이 좋음".
3. 구체적인 행성의 움직임을 언급하며 근거를 제시하세요.

JSON 형식 응답:
{
  "score": 0~100,
  "love": "금성/달의 영향 기반 연애운",
  "money": "목성/금성의 영향 기반 재물운",
  "health": "화성/토성의 영향 기반 건강운",
  "work": "수성/태양의 영향 기반 직장운",
  "summary": "행성 트랜짓에 기반한 오늘의 총평"
}`;

  const zodiacUserPrompt = `오늘 날짜: ${dateStr}, 별자리: ${zodiacSign}.
오늘 행성들이 내 별자리에 어떤 영향을 주는지 분석해줘.`;

  // 3. 자미두수 프롬프트 (수비학 → 자미두수로 교체)
  const lifeStars = ziweiResult.stars.life.map(s => `${s.name}(${s.keyword})`).join(", ") || "명무정성(유연한 운명)";
  const wealthStars = ziweiResult.stars.wealth.map(s => `${s.name}(${s.keyword})`).join(", ") || "없음";
  const spouseStars = ziweiResult.stars.spouse.map(s => `${s.name}(${s.keyword})`).join(", ") || "없음";

  const ziweiSystemPrompt = `당신은 자미두수(紫微斗數) 전문가입니다.
사용자의 명궁 주성과 오늘의 일진 기운을 대조하여 일일 운세를 분석하세요.

[자미두수 원국 정보]
명궁(命宮): ${ziweiResult.lifePalace} 궁
국(局): ${ziweiResult.bureau.name} - ${ziweiResult.bureau.desc}
명궁 주성: ${lifeStars}
재백궁 주성: ${wealthStars}
부처궁 주성: ${spouseStars}

[오늘의 일진]
${todayStem}${todayBranch} (천간:${STEMS_H[todayStemIdx]}/지지:${BRANCHES_H[todayBranchIdx]})

[분석 지침]
1. 오늘의 일진(${todayStem}${todayBranch})이 명궁(${ziweiResult.lifePalace})의 주성(${lifeStars})에 어떤 영향을 주는지 분석하세요.
2. 재백궁과 부처궁의 별도 오늘의 기운과 어떻게 상호작용하는지 판단하세요.
3. 명궁 주성의 특성(성격, 재물 스타일)이 오늘 강화되는지, 약화되는지 설명하세요.
4. 따뜻하고 격려하는 톤을 유지하세요.

이모지를 사용하지 말고, 반드시 아래 정확한 JSON 형식으로만 응답하세요:
{
  "score": 0~100,
  "summary": "명궁 주성과 오늘 일진의 상호작용 분석 (2~3문장)",
  "advice": "자미두수 관점에서 오늘의 구체적 조언 (1~2문장)"
}`;

  const ziweiUserPrompt = `오늘 날짜: ${dateStr}, 이름: ${user.name}
내 명궁(${ziweiResult.lifePalace})의 ${lifeStars}과 오늘 일진(${todayStem}${todayBranch})의 관계를 분석해줘.`;

  // 병렬 API 호출 (사주 + 별자리 + 자미두수)
  const [sajuRes, zodiacRes, ziweiRes] = await Promise.all([
    generateWithRetry(sajuSystemPrompt, sajuUserPrompt, "사주"),
    generateWithRetry(zodiacSystemPrompt, zodiacUserPrompt, "별자리"),
    generateWithRetry(ziweiSystemPrompt, ziweiUserPrompt, "자미두수"),
  ]);

  const sajuData = parseJson(sajuRes, sajuSchema);
  const zodiacData = parseJson(zodiacRes, zodiacSchema);
  const ziweiData = parseJson(ziweiRes, ziweiDailySchema);

  if (!sajuData || !zodiacData || !ziweiData) {
    const failures = [];
    if (!sajuData) failures.push(`사주(raw: ${sajuRes.substring(0, 200)})`);
    if (!zodiacData) failures.push(`별자리(raw: ${zodiacRes.substring(0, 200)})`);
    if (!ziweiData) failures.push(`자미두수(raw: ${ziweiRes.substring(0, 200)})`);
    console.error("[FORTUNE] 파싱 실패 항목:", failures.join(" | "));
    throw new Error("운세 데이터 파싱 실패: " + failures.map(f => f.split("(")[0]).join(", "));
  }

  // 4. [핵심] 3자 교차 검증 및 종합 분석 (사주 + 별자리 + 자미두수)
  const synthesizePrompt = `당신은 '운명 데이터 융합 전문가'이자 '따뜻한 인생 멘토'입니다.
동양의 명리학(사주), 서양의 점성술(별자리), 동양의 자미두수(紫微斗數) 결과를 **교차 검증(Cross-Validation)**하여, 이 3가지 시스템이 **공통적으로 가리키는 진실**을 찾아내세요.

[사주 분석 결과 (명리학 - 일진/일주 관계)]
- 점수: ${sajuData.score}
- 요약: ${sajuData.summary}
- 주의: ${sajuData.caution}
- 특이사항: ${sajuData.special}

[별자리 분석 결과 (서양 점성술 - 행성 트랜짓)]
- 점수: ${zodiacData.score}
- 요약: ${zodiacData.summary}
- 연애: ${zodiacData.love} | 재물: ${zodiacData.money}
- 건강: ${zodiacData.health} | 직장: ${zodiacData.work}

[자미두수 분석 결과 (명궁 주성 - 별의 기운)]
- 점수: ${ziweiData.score}
- 요약: ${ziweiData.summary}
- 조언: ${ziweiData.advice}

[융합 분석 지침]
1. **일치도 판단(Coherence Score):** 사주, 별자리, 자미두수 이 3가지 흐름이 얼마나 유사한지 0~100점으로 평가하세요.
   - 3가지가 모두 길(吉)하거나 흉(凶)하면 90점 이상.
   - 서로 엇갈리면 점수를 낮추세요.
2. **공통 키워드 추출:** 3가지 분석에서 공통으로 발견되는 주제(예: "이동", "사람 조심", "계약 성사")를 찾아내세요.
3. **핵심 메시지:** 3가지 운세가 만장일치로 합의한 '오늘의 가장 확실한 운명'을 한 문장으로 정의하세요. 따뜻하고 격려하는 톤을 유지하세요.
4. 만약 운세가 상충한다면, "사주와 별자리의 기운은 좋으나 자미두수의 명궁은 신중함을 권합니다" 처럼 구체적으로 서술하세요.
5. **행운의 숫자:** 사주의 오행(五行)과 자미두수의 국(局)을 참조하여 오늘에 어울리는 행운의 숫자 3개를 제시하세요.
6. **자미두수 메시지:** 자미두수의 분석 결과를 자연스럽게 다듬어서 "명궁의 [별이름]이 오늘..." 형태로 작성하세요.

중요: 각 원본 필드(sajuSummary, zodiacLove 등)는 위의 원본 내용을 그대로 가져와서 자연스럽게 다듬어 주세요.

이모지를 사용하지 말고, 반드시 아래 JSON 형식으로 응답하세요:
{
  "coherenceScore": 0~100 숫자,
  "commonKeywords": ["키워드1", "키워드2", "키워드3"],
  "coreMessage": "3가지 운세가 공통으로 가리키는 오늘의 핵심 메시지 (1문장, 따뜻한 톤)",
  "luckyNumbers": [숫자1, 숫자2, 숫자3],
  "sajuCaution": "사주 원본의 주의사항 유지하되 다듬기",
  "sajuSpecial": "사주 원본 특이사항 유지",
  "sajuSummary": "사주 원본 요약 유지",
  "zodiacLove": "별자리 원본 유지",
  "zodiacMoney": "별자리 원본 유지",
  "zodiacHealth": "별자리 원본 유지",
  "zodiacWork": "별자리 원본 유지",
  "zodiacSummary": "별자리 원본 요약 유지",
  "ziweiMessage": "자미두수 원본 분석을 자연스럽게 다듬은 메시지"
}`;

  const synthesisRaw = await generateWithRetry(
    "당신은 사주, 별자리, 자미두수를 교차 검증하여 종합하는 운명 데이터 융합 분석가입니다. JSON으로만 응답하세요.",
    synthesizePrompt,
    "교차검증"
  );

  const synthesis = parseJson(synthesisRaw, synthesisSchema);
  if (!synthesis) {
    throw new Error("교차 검증 데이터 파싱 실패");
  }

  // 최종 점수 계산 (3자 평균 + 일치도 가중치)
  const baseScore = Math.round((sajuData.score + zodiacData.score + ziweiData.score) / 3);
  const finalCombinedScore = synthesis.coherenceScore >= 80 
    ? Math.min(100, baseScore + 5)
    : baseScore;

  const fortuneData: FortuneData = {
    sajuScore: sajuData.score,
    sajuDirection: sajuData.direction,
    sajuCaution: synthesis.sajuCaution,
    sajuSpecial: synthesis.sajuSpecial || sajuData.special,
    sajuSummary: synthesis.sajuSummary,
    zodiacScore: zodiacData.score,
    zodiacLove: synthesis.zodiacLove,
    zodiacMoney: synthesis.zodiacMoney,
    zodiacHealth: synthesis.zodiacHealth,
    zodiacWork: synthesis.zodiacWork,
    zodiacSummary: synthesis.zodiacSummary,
    luckyNumbers: synthesis.luckyNumbers || [3, 7, 9],
    ziweiMessage: (synthesis.ziweiMessage && synthesis.ziweiMessage.length > 10 && !synthesis.ziweiMessage.includes("원본 유지"))
      ? synthesis.ziweiMessage 
      : `${ziweiData.summary} ${ziweiData.advice}`,
    combinedScore: finalCombinedScore,
    coherenceScore: synthesis.coherenceScore,
    commonKeywords: synthesis.commonKeywords,
    coreMessage: synthesis.coreMessage,
  };

  const displayContent = formatFortuneForTelegram(fortuneData, user.name, dateStr, zodiacSign);

  return { fortuneData, displayContent };
}

// ================================================================
// 가디언 리포트 (운명 종합 분석) 생성
// ================================================================
export interface GuardianReport {
  coreEnergy: string;
  coherenceScore: number;
  keywords: string[];
  currentState: string;
  bottleneck: string;
  solution: string;
}

export async function generateGuardianReport(data: {
  name: string;
  sajuChart: any;
  sajuPersonality: any;
  ziwei: any;
  zodiac: any;
}) {
  const individualPrompt = `
당신은 '운명의 가디언'이자, 냉철한 데이터 프로파일러입니다.
사용자의 사주/자미두수/별자리 데이터를 분석하여 **사용자의 뼈를 때리는 '팩트'**와 **논리적인 '인생 메커니즘'**을 서술하세요.

**[치명적 금지 사항 - 위반 시 즉시 실패 처리]**
1. 사용자 이름 절대 사용 금지. 무조건 "당신"으로만 지칭.
2. 짧은 글 금지. pastInference는 반드시 400자 이상, currentState/bottleneck/solution/businessAdvice는 각각 250자 이상 작성. 이보다 짧으면 실패.
3. "경향이 있습니다", "다양한 가능성" 같은 약한 표현 금지. "~패턴이 반복됩니다", "이것이 당신의 발목을 잡습니다"처럼 단정.

**[작성 가이드라인: Hybrid Deep-Scan (인과관계 통합)]**

모든 섹션은 **[원인(Why) → 결과(What)]**의 인과관계 흐름으로 작성하세요.
사주(Nature, 타고난 본성)와 자미두수/별자리(Desire, 욕망/지향)는 종종 서로 **충돌**합니다.
이 충돌이 현실에서 **구체적 행동 패턴**으로 나타납니다. 이 두 레이어를 반드시 연결하세요.

**[각 필드 작성법]**

**pastInference** (400자 이상, 7~10문장):
아래 두 단계를 반드시 순서대로 밟으세요:
- **Step 1 (내면의 전쟁 — 원인):** 사주 데이터(Nature)와 자미두수/별자리(Desire) 사이의 **'모순'**이나 **'충돌'**을 찾아내세요. 예: "당신의 일간 [간지]는 [성향]을 추구하지만, 명궁의 [성진]은 정반대로 [성향]을 갈구합니다. 머리는 안정을 원하나 가슴은 모험을 원하는 구조입니다."
- **Step 2 (현실의 증상 — 결과):** 그 내면 충돌 때문에 현실에서 반복되는 **'구체적 행동 패턴'**을 묘사하세요. 예: "그래서 당신은 시작은 화려하나 마무리가 약합니다. 책상 위에 읽다 만 책이 수두룩하고, 컴퓨터에는 반쯤 완성된 프로젝트 폴더가 늘어가며, 결정을 내린 뒤에도 새벽에 '이게 맞나' 되짚는 고민을 반복합니다."
- 이 두 단계를 합쳐 400자 이상, 7~10문장으로 풍성하게 서술.
- 반드시 사주 간지, 십성, 자미두수 성진 등 **구체적 데이터 이름**을 인용하며 논증.

**currentState** (250자 이상, 5~7문장):
- "지금 당신의 머리는 [A]를 원하고, 가슴은 [B]를 원합니다."로 시작.
- 이 갈등이 일상에서 어떻게 나타나는지 **소름 돋는 디테일**(책상, 폰, 새벽, 대화 습관 등)로 구체적 상황 2개 묘사.
- "이 상태가 6개월 이상 지속되면, 당신은 [구체적 부정적 결과]로 귀결됩니다."
- "시장은 '과정이 좋았던 사람'이 아니라 '결과를 확정한 사람'을 기억합니다."

**bottleneck** (250자 이상, 4~6문장):
- "당신의 병목은 능력이 아닙니다."로 시작.
- 추상적인 단어가 아니라, **'잘못된 습관'**이나 **'회피 반응'**을 지적하세요. 예: "당신의 병목은 '완벽하지 않으면 시작하지 않으려는 강박'입니다."
- 그 습관이 왜 생겼는지 사주/자미두수 데이터(간지, 십성, 성진)를 근거로 설명.
- 이 병목이 구체적으로 어떤 기회를 날려버리는지 서술.

**solution** (250자 이상, 5~7문장):
- "오늘부터 규칙은 하나입니다."로 시작.
- 구체적인 행동 규칙 선언 (예: "결정 후 24시간 수정 금지").
- "지금 당장 1분 동안 [구체적 행동]을 하세요."
- 이 규칙을 지켰을 때의 기대 효과 2가지 서술.
- 비즈니스 프레임워크 하나 인용 (에센셜리즘, 파레토 법칙 등).

**businessAdvice** (250자 이상, 5~7문장):
- 사주 용신/십성 기반으로 적성 분석.
- 구체적 비즈니스 모델/업종 추천 (B2B vs B2C, 중개 vs 직접 등).
- 2026년 올해의 전략적 태도 제안.

**[JSON 출력 형식]**
{
  "coreEnergy": "내면의 충돌을 관통하는 모순적 타이틀 (예: 브레이크가 고장 난 페라리)",
  "coherenceScore": 85,
  "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  "pastInference": "여기에 400자 이상. Step1(내면의 전쟁: 사주 vs 자미두수/별자리 충돌) → Step2(현실의 증상: 구체적 행동 패턴) 순서로 줄글 서술. (7~10문장 이상)",
  "currentState": "여기에 250자 이상 작성. 지금 당신의 머리는 A를 원하고 가슴은 B를 원합니다... 소름 돋는 디테일 포함 (5~7문장 이상)",
  "bottleneck": "여기에 250자 이상 작성. 당신의 병목은 능력이 아닙니다. 구체적 습관/회피 반응 지적... (4~6문장 이상)",
  "solution": "여기에 250자 이상 작성. 오늘부터 규칙은 하나입니다... (5~7문장 이상)",
  "businessAdvice": "여기에 250자 이상 작성. 당신의 사주에서 [용신]은... (5~7문장 이상)",
  "loveAdvice": null,
  "healthAdvice": null
}
`;

  const sp = data.sajuPersonality;
  const sc = data.sajuChart;
  const zw = data.ziwei;

  const userPrompt = `
[사용자 운명 데이터 - 이름 절대 사용 금지, 반드시 "당신"으로만 지칭]

━━━━ 1. 사주팔자 (四柱八字) 원본 데이터 ━━━━
■ 사주 원국:
  - 년주: ${sc.yearPillar?.stem}${sc.yearPillar?.branch} (${sc.yearPillar?.stemHanja}${sc.yearPillar?.branchHanja})
  - 월주: ${sc.monthPillar?.stem}${sc.monthPillar?.branch} (${sc.monthPillar?.stemHanja}${sc.monthPillar?.branchHanja})
  - 일주: ${sc.dayPillar?.stem}${sc.dayPillar?.branch} (${sc.dayPillar?.stemHanja}${sc.dayPillar?.branchHanja}) ← 일간(나)
  - 시주: ${sc.hourPillar?.stem}${sc.hourPillar?.branch} (${sc.hourPillar?.stemHanja}${sc.hourPillar?.branchHanja})

■ 일간 성격: ${sp.mainTrait}
■ 일간 상세: ${sp.elementPersonality}
■ 일주 강약: ${sc.dayMasterStrength} (${sp.dayMasterDescription})

■ 오행 분포:
${sc.fiveElementRatios?.map((r: any) => `  - ${r.element}(${r.elementHanja}): ${r.ratio}% (가중치 ${r.weight})`).join("\n") || "  데이터 없음"}
■ 지배 오행: ${sc.dominantElement}

■ 용신(用神): ${sc.yongShin?.element}(${sc.yongShin?.elementHanja}) — ${sc.yongShin?.reason}

■ 십성(十星) 배치: ${sp.tenGodProfile}
■ 부특성: ${sp.subTraits?.join(", ") || "없음"}

■ 천부적 재능: ${sp.talent}
■ 하늘이 준 선물: ${sp.heavenlyGift}
■ 약점: ${sp.weakPoint}

■ 특수살: ${sp.specialSals?.map((s: any) => `${s.name}(${s.hanja}) — ${s.description}`).join("\n  ") || "없음"}

■ 구조 패턴: ${sp.structurePatterns?.map((p: any) => `${p.name}(${p.hanja}) — ${p.description}`).join("\n  ") || "없음"}

■ 용신 보완법: ${sp.yongShinRemedy ? `방향: ${sp.yongShinRemedy.luckyDirection}, 색상: ${sp.yongShinRemedy.luckyColor}, 활동: ${sp.yongShinRemedy.luckyActivity}` : "없음"}

■ 대운 흐름 (10년 단위):
${sc.daeun?.slice(0, 6).map((d: any) => `  - ${d.age}세(${d.year}년): ${d.stem}${d.branch}(${d.stemHanja}${d.branchHanja})`).join("\n") || "  데이터 없음"}

━━━━ 2. 자미두수 (紫微斗數) 원본 데이터 ━━━━
■ 명궁(命宮): ${zw.lifePalace}궁
■ 국(局): ${zw.bureau?.name} — ${zw.bureau?.desc}
■ 명궁 주성: ${zw.stars?.life?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}
■ 부처궁(配偶宮) 성진: ${zw.stars?.spouse?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}
■ 재백궁(財帛宮) 성진: ${zw.stars?.wealth?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}
■ 천이궁(遷移宮) 성진: ${zw.stars?.travel?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}
■ 해석: ${zw.interpretation}

━━━━ 3. 서양 별자리 데이터 ━━━━
■ 별자리: ${data.zodiac.sign}
■ 원소: ${data.zodiac.info.element || ""}
■ 수호성: ${data.zodiac.info.ruling || ""}
■ 특징: ${data.zodiac.info.traits?.join(", ") || data.zodiac.sign}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
위의 사주 원국, 십성 배치, 오행 분포, 특수살, 구조 패턴, 자미두수 각 궁의 성진, 별자리 데이터를 근거로
이 사람의 '사고 메커니즘'과 '반복 실패 패턴'을 추론하고, '과학적 행동 솔루션'을 처방하세요.
각 분석에서 반드시 위 데이터의 구체적 요소(간지, 십성, 오행, 성진 이름 등)를 인용하며 논증하세요.
절대로 사용자의 이름을 사용하지 말고, 반드시 "당신"이라고만 지칭하세요.
`;

  try {
    console.log("[Guardian] 3회 교차 검증 시작 (독립 리포트 3개 병렬 생성)...");

    const generateOne = async (runIndex: number) => {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: individualPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.85,
      });
      const content = response.choices[0].message.content || "{}";
      console.log(`[Guardian] 독립 리포트 #${runIndex + 1} 생성 완료`);
      return JSON.parse(content);
    };

    const [report1, report2, report3] = await Promise.all([
      generateOne(0),
      generateOne(1),
      generateOne(2),
    ]);

    console.log("[Guardian] 3개 독립 리포트 완료. 교차 검증 종합 분석 시작...");

    const allKeywords = [
      ...(report1.keywords || []),
      ...(report2.keywords || []),
      ...(report3.keywords || []),
    ];
    const keywordCount: Record<string, number> = {};
    allKeywords.forEach((kw: string) => {
      keywordCount[kw] = (keywordCount[kw] || 0) + 1;
    });
    const commonKeywords = Object.entries(keywordCount)
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([kw]) => kw)
      .slice(0, 5);

    const synthesisPrompt = `
당신은 '운명의 가디언' 최종 검증관입니다.
3명의 독립 분석가가 동일한 사용자를 분석한 결과가 아래에 있습니다.

**[치명적 규칙 - 위반 시 즉시 실패]**
1. 사용자 이름 절대 사용 금지. 무조건 "당신"으로만 지칭. 원본에 이름이 있어도 "당신"으로 교체.
2. 짧은 글 절대 금지. pastInference는 400자 이상(7~10문장), currentState/bottleneck/solution/businessAdvice는 각 250자 이상(5~7문장). 원본보다 더 길고 풍성하게 종합해야 합니다.
3. 3개 리포트에서 2개 이상 공통 언급된 내용만 채택. 1개만 언급된 독자적 주장은 제거.
4. 종합할 때 단순 요약하지 말고, 공통 내용을 더 깊이 파고들어 확장하세요.

**[종합 원칙: 인과관계 연결 (Hybrid Logic)]**
단순히 공통점을 나열하지 마세요. 3개의 리포트 내용을 바탕으로 **'한 편의 완결된 스토리'**를 재구성하세요.

**[pastInference 작성 템플릿]**
"당신의 사주와 별자리 데이터에는 흥미로운 모순이 있습니다. [분석가들이 공통적으로 지적한 내면의 충돌 설명 — 사주(Nature)와 자미두수/별자리(Desire) 사이의 갈등]. (Step 1: 내면의 전쟁)
이러한 내면의 기운은 현실에서 [구체적인 행동 패턴/증상]으로 나타납니다. [반복되는 실수나 습관 묘사 — 책상, 새벽, 대화 습관 등 소름 돋는 디테일]. (Step 2: 현실의 증상)
아마도 당신은 [사용자가 느꼈을 감정]을 자주 경험했을 것입니다."
이 템플릿을 참고하되, 3개 리포트의 공통 맥락을 녹여 400자 이상 풍성하게 작성하세요.

**[필수 지침]**
1. **소름 돋는 디테일:** "책상 위", "컴퓨터 파일", "새벽의 고민", "대화 중 말꼬리" 등 구체적 정황을 묘사하되, 3개 리포트 중 2개 이상이 동의하는 맥락에서만 사용할 것.
2. **bottleneck은 추상 금지:** "능력 부족"이 아니라 "완벽하지 않으면 시작하지 않으려는 강박" 같은 구체적 습관/회피 반응으로 지적.
3. **모든 섹션에서 [원인(내면의 충돌) → 결과(행동 패턴)]의 인과관계를 유지.**

공통 키워드: [${commonKeywords.join(", ")}]

**[분석가 A]**
${JSON.stringify(report1, null, 2)}

**[분석가 B]**
${JSON.stringify(report2, null, 2)}

**[분석가 C]**
${JSON.stringify(report3, null, 2)}

위 3개를 교차 검증하여 **최종 종합 리포트**를 작성하세요. 원본보다 반드시 더 길고 깊이 있게 작성하세요.

**[JSON 출력]**
{
  "coreEnergy": "내면의 충돌을 관통하는 모순적 타이틀",
  "coherenceScore": 70~95,
  "keywords": ["공통키워드1", "공통키워드2", "공통키워드3", "공통키워드4", "공통키워드5"],
  "pastInference": "400자 이상. Step1(내면의 전쟁) → Step2(현실의 증상) → 감정 공감 순서로 서술. (7~10문장)",
  "currentState": "250자 이상. 지금 당신의 머리는 A를 원하고 가슴은 B를 원합니다... 소름 돋는 디테일 포함 (5~7문장)",
  "bottleneck": "250자 이상. 당신의 병목은 능력이 아닙니다. 구체적 습관/회피 반응 지적... (4~6문장)",
  "solution": "250자 이상. 오늘부터 규칙은 하나입니다... (5~7문장)",
  "businessAdvice": "250자 이상. 용신과 십성 기반 적성 분석 + 비즈니스 모델 + 올해 전략 (5~7문장)",
  "loveAdvice": null,
  "healthAdvice": null
}
`;

    const synthesisResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "당신은 3개의 독립 분석 리포트를 교차 검증하여 최종 종합 리포트를 작성하는 검증관입니다. 2개 이상 일치하는 내용만 채택하세요. [치명적 금지] 사용자의 이름(예: Ricky)을 절대 사용하지 마세요. 모든 텍스트에서 반드시 '당신'이라고만 지칭하세요. 원본 리포트에 이름이 있더라도 '당신'으로 교체하세요. 각 섹션은 최소 3~5문장으로 길게 서술하세요." },
        { role: "user", content: synthesisPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const finalContent = synthesisResponse.choices[0].message.content || "{}";
    const finalResult = JSON.parse(finalContent);

    if (!finalResult.pastInference) finalResult.pastInference = "데이터 분석 중 과거 패턴을 특정할 수 없습니다.";
    if (!finalResult.keywords || finalResult.keywords.length === 0) finalResult.keywords = commonKeywords;

    console.log(`[Guardian] 3회 교차 검증 완료. 일치도: ${finalResult.coherenceScore}%`);

    return finalResult;
  } catch (e) {
    console.error("Guardian Report Generation Error:", e);
    return {
      coreEnergy: "운명의 탐구자",
      coherenceScore: 50,
      keywords: ["분석", "대기", "연결"],
      pastInference: "현재 운명 데이터 서버와 연결이 불안정하여 과거 패턴을 불러오지 못했습니다.",
      currentState: "일시적인 연결 오류가 발생했습니다.",
      bottleneck: "시스템 연결 대기 중",
      solution: "잠시 후 다시 시도해주세요."
    };
  }
}

export async function generateYearlyFortune(data: {
  name: string;
  year: number;
  sajuChart: any;
  sajuPersonality: any;
  ziwei: any;
  zodiac: any;
}) {
  const sc = data.sajuChart;
  const sp = data.sajuPersonality;
  const zw = data.ziwei;

  const individualPrompt = `
당신은 ${data.year}년(병오년, 붉은 말의 해)의 운세를 분석하는 '정통 명리학 대가'이자 '인생 전략가'입니다.
AI 같은 기계적인 요약투를 버리고, 실제 철학관에서 상담하듯 **깊이 있고 풍성한 통찰**을 제공하세요.

**[치명적 지시사항 - 위반 시 실패]**
1. **분량 강제:** 모든 섹션은 **최소 10문장(500자) 이상** 작성하세요. UI 박스 크기는 신경 쓰지 말고, 할 말을 끝까지 다 하세요.
2. **대운(Big Cycle) 필수 분석:** 제공된 '대운(Daewoon)' 데이터를 반드시 확인하세요. 대운이 바뀌는 시기거나, 현재 대운이 올해와 합/충이 되는 경우 이를 구체적으로 서술하세요.
3. **구체적 액션 플랜:** "좋습니다"로 끝내지 말고, 구체적인 행동 방향과 시기를 제시하세요.

**[톤 & 어조 규칙 - 매우 중요]**
- **균형 잡힌 분석가의 톤:** 과도하게 들뜨거나 흥분하지 마세요. "엄청난!", "놀라운!", "대박!" 같은 과장 표현 금지.
- **좋은 점과 주의할 점을 반드시 함께** 서술하세요. 모든 섹션에서 기회(+)와 리스크(-)를 균형 있게 다루세요.
- **근거 기반 서술:** "좋은 해입니다"라고만 하지 말고, 왜 좋은지/왜 주의해야 하는지를 사주 데이터(간지, 십성, 오행, 대운)로 논증하세요.
- **과도한 응원/아부 금지:** 사용자의 기분을 좋게 하려는 빈말은 쓰지 마세요. 철학관 선생님처럼 담담하고 신뢰감 있게 말하세요. "당신은 대단합니다" 같은 아부보다 "이 시기에 이런 점을 조심하면 좋은 흐름을 탈 수 있습니다" 같은 실용적 조언이 더 가치 있습니다.
- 결론은 희망적이되, **근거 없는 장밋빛 전망은 금지.** 데이터가 뒷받침하는 만큼만 긍정적으로 서술.

**[작성 가이드라인]**

1. **overallSummary (${data.year}년 총평 - 가장 중요):**
   - **형식:** 심층 칼럼 형식.
   - **내용:** 병오년(세운)과 사용자 사주(일주/대운)의 상호작용을 **기회와 리스크 양면**에서 분석하세요.
   - **대운 분석:** "올해는 대운의 흐름이..." 라는 문장을 포함하되, 대운이 긍정적이면 기회를, 부정적이면 주의점을 함께 서술.
   - **분량:** 1000자 내외의 심층 총평.

2. **businessFortune (사업/재물운):**
   - 올해 전체의 **재물 그릇**을 설명하되, **유리한 시기와 불리한 시기를 구분**하세요.
   - **비즈니스 모델:** "유통보다는 제조", "확장보다는 내실" 등 구체적 전략 + 피해야 할 전략도 함께 제시.
   - **분량:** 500자 이상.

3. **loveFortune (연애/인간관계운):**
   - 상황별(싱글/커플)로 **상세하게** 서술하되, **주의해야 할 시기나 함정**도 반드시 언급.
   - 도화살, 홍염살의 작용 여부 분석. 좋은 인연을 만날 시기 + 갈등이 예상되는 시기.
   - **분량:** 500자 이상.

4. **healthFortune (건강운):**
   - 신체 부위별로 **상세하게** 서술. 특히 올해 오행 기운(화火)과 사용자 오행의 충돌에서 오는 **취약 부위를 명확히 지적**.
   - 오행 균형에 기반한 식이/운동/생활습관 구체적 조언.
   - **분량:** 500자 이상.

5. **monthlyFlow (월별 흐름):**
   - 반드시 **"O월은 OO(간지)의 기운입니다."**로 시작.
   - 각 월별 **최소 3문장** 이상 작성.
   - 점수는 0~100점 사이, 운세 내용과 점수가 일관되게.
   - **매달 장단점을 균형 있게 서술.** 모든 달이 좋거나 모든 달이 나쁜 분석은 비현실적입니다.

**[출력 형식 (JSON)]**
{
  "overallSummary": "대운과 세운을 아우르는 1000자 분량의 심층 총평 (기회와 리스크 균형)",
  "businessFortune": "500자 이상의 구체적 사업/재물 전략 (유리한 시기 + 불리한 시기)",
  "loveFortune": "500자 이상의 상세 연애/인간관계 조언 (기회 + 주의점)",
  "healthFortune": "500자 이상의 건강 관리법 (취약 부위 + 보강법)",
  "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  "monthlyFlow": [
    {"month": 1, "score": 85, "keyword": "문서운", "summary": "1월은 ... (3문장 이상, 장단점 균형)"},
    ...
  ]
}
`;

  const daeunInfo = sc.daeun
    ? sc.daeun.slice(0, 6).map((d: any) => `${d.age}세(${d.year}년): ${d.stem}${d.branch}(${d.stemHanja}${d.branchHanja})`).join("\n  ")
    : "대운 데이터 없음";

  const userPrompt = `
[사용자: ${data.name}] - ${data.year}년 운세 정밀 분석

━━━━ 1. 사주팔자 (四柱八字) 원본 데이터 ━━━━
■ 사주 원국:
  - 년주: ${sc.yearPillar?.stem}${sc.yearPillar?.branch} (${sc.yearPillar?.stemHanja}${sc.yearPillar?.branchHanja})
  - 월주: ${sc.monthPillar?.stem}${sc.monthPillar?.branch} (${sc.monthPillar?.stemHanja}${sc.monthPillar?.branchHanja})
  - 일주: ${sc.dayPillar?.stem}${sc.dayPillar?.branch} (${sc.dayPillar?.stemHanja}${sc.dayPillar?.branchHanja}) ← 일간(나)
  - 시주: ${sc.hourPillar?.stem}${sc.hourPillar?.branch} (${sc.hourPillar?.stemHanja}${sc.hourPillar?.branchHanja})

■ 일간 성격: ${sp.mainTrait}
■ 일주 강약: ${sc.dayMasterStrength} (${sp.dayMasterDescription})

■ 오행 분포:
${sc.fiveElementRatios?.map((r: any) => `  - ${r.element}(${r.elementHanja}): ${r.ratio}% (가중치 ${r.weight})`).join("\n") || "  데이터 없음"}

■ 용신(用神): ${sc.yongShin?.element}(${sc.yongShin?.elementHanja}) — ${sc.yongShin?.reason}

■ 십성(十星) 배치: ${sp.tenGodProfile}
■ 특수살: ${sp.specialSals?.map((s: any) => `${s.name}(${s.hanja})`).join(", ") || "없음"}
■ 구조 패턴: ${sp.structurePatterns?.map((p: any) => `${p.name}(${p.hanja})`).join(", ") || "없음"}

■ **대운 흐름 (10년 단위) — 반드시 분석할 것:**
  ${daeunInfo}
  (현재 나이와 대운을 대조하여, ${data.year}년에 어떤 대운이 작용하는지 최우선으로 분석하세요)

━━━━ 2. 자미두수 (紫微斗數) 데이터 ━━━━
■ 명궁(命宮): ${zw.lifePalace}궁
■ 국(局): ${zw.bureau?.name} — ${zw.bureau?.desc}
■ 명궁 주성: ${zw.stars?.life?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}
■ 부처궁 성진: ${zw.stars?.spouse?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}
■ 재백궁 성진: ${zw.stars?.wealth?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}
■ 천이궁 성진: ${zw.stars?.travel?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}

━━━━ 3. 서양 별자리 데이터 ━━━━
■ 별자리: ${data.zodiac.sign}
■ 원소: ${data.zodiac.info.element || ""}
■ 수호성: ${data.zodiac.info.ruling || ""}
■ 특징: ${data.zodiac.info.traits?.join(", ") || data.zodiac.sign}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
위 데이터를 바탕으로, 특히 **'대운'의 작용**을 강조하여 ${data.year}년 운세를 아주 상세하게(섹션당 500자 이상) 서술하세요.
`;

  try {
    console.log(`[Yearly] ${data.year}년 운세 생성 시작 (Deep Mode)...`);

    const generateOne = async (runIndex: number) => {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: individualPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.85 + (runIndex * 0.05),
      });
      const content = response.choices[0].message.content || "{}";
      console.log(`[Yearly] 독립 분석 #${runIndex + 1} 완료`);
      return JSON.parse(content);
    };

    const [report1, report2, report3] = await Promise.all([
      generateOne(0),
      generateOne(1),
      generateOne(2),
    ]);

    console.log("[Yearly] 3개 독립 분석 완료. 교차 검증 종합 시작...");

    const allKeywords = [
      ...(report1.keywords || []),
      ...(report2.keywords || []),
      ...(report3.keywords || []),
    ];
    const keywordCount: Record<string, number> = {};
    allKeywords.forEach((kw: string) => {
      keywordCount[kw] = (keywordCount[kw] || 0) + 1;
    });
    const commonKeywords = Object.entries(keywordCount)
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([kw]) => kw)
      .slice(0, 5);

    const monthlyScores: Record<number, number[]> = {};
    [report1, report2, report3].forEach((r) => {
      (r.monthlyFlow || []).forEach((m: any) => {
        if (!monthlyScores[m.month]) monthlyScores[m.month] = [];
        monthlyScores[m.month].push(m.score);
      });
    });

    const avgMonthlyScores = Object.entries(monthlyScores).map(([month, scores]) => ({
      month: Number(month),
      avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }));

    const synthesisPrompt = `
당신은 최종 검증관입니다. 3개의 분석 리포트를 종합하세요.

**[종합 원칙]**
1. **절대 요약 금지:** 3개 리포트의 내용을 합쳐서 **가장 길고 자세한 버전**을 만드세요. 줄이지 마세요.
2. **대운 강조:** "올해는 대운이 들어오는 해입니다" 같은 강력한 멘트를 overallSummary 맨 앞에 배치하세요.
3. **2개 이상 공통 언급된 내용만 채택.** 1개에서만 언급된 독자적 주장은 제거.
4. **분량:**
   - overallSummary: 1000자 내외
   - business/love/health: 각 500자 내외
   - monthlyFlow: 각 월별 3문장 이상
5. 월별 점수는 3개 평균을 사용: ${avgMonthlyScores.map(m => `${m.month}월=${m.avgScore}점`).join(", ")}
6. 공통 키워드: [${commonKeywords.join(", ")}]
7. 월별 summary는 반드시 **"O월은 OO(간지)의 기운입니다."**로 시작하세요.

**[분석가 A]**
${JSON.stringify(report1, null, 2)}

**[분석가 B]**
${JSON.stringify(report2, null, 2)}

**[분석가 C]**
${JSON.stringify(report3, null, 2)}

**[출력 형식 (JSON)]**
{
  "overallSummary": "대운과 세운을 아우르는 1000자 분량의 심층 총평",
  "coherenceScore": 70~95,
  "businessFortune": "500자 이상 사업/재물 전략",
  "loveFortune": "500자 이상 연애/인간관계 조언",
  "healthFortune": "500자 이상 건강 관리법",
  "keywords": ["공통키워드1", "공통키워드2", ...],
  "monthlyFlow": [
    {"month": 1, "score": 평균점수, "keyword": "공통키워드", "summary": "1월은 OO(간지)의 기운입니다. 3문장 이상"},
    ... (1~12월 전체)
  ]
}
`;

    const synthesisResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "당신은 균형 잡힌 시각의 운세 에디터입니다. 내용을 길고 풍성하게 작성하되, 과도한 긍정이나 흥분은 금지합니다. 기회와 리스크를 항상 함께 서술하세요. 2개 이상 일치하는 내용만 채택하되, 대운 분석을 반드시 포함하고, 월별 운세는 'O월은 OO(간지)의 기운입니다'로 시작하세요." },
        { role: "user", content: synthesisPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    });

    const yearlyFortuneResponseSchema = z.object({
      overallSummary: z.string().min(1),
      coherenceScore: z.number().min(0).max(100).default(75),
      businessFortune: z.string().nullable().default(null),
      loveFortune: z.string().nullable().default(null),
      healthFortune: z.string().nullable().default(null),
      keywords: z.array(z.string()).default([]),
      monthlyFlow: z.array(z.object({
        month: z.number().int().min(1).max(12),
        score: z.number().min(0).max(100),
        keyword: z.string(),
        summary: z.string(),
      })).default([]),
    });

    const finalContent = synthesisResponse.choices[0].message.content || "{}";
    const rawResult = JSON.parse(finalContent);
    const parsed = yearlyFortuneResponseSchema.safeParse(rawResult);
    const finalResult = parsed.success ? parsed.data : {
      overallSummary: rawResult.overallSummary || "분석 결과를 정리하는 중입니다.",
      coherenceScore: rawResult.coherenceScore || 70,
      businessFortune: rawResult.businessFortune || null,
      loveFortune: rawResult.loveFortune || null,
      healthFortune: rawResult.healthFortune || null,
      keywords: commonKeywords,
      monthlyFlow: avgMonthlyScores.map(m => ({ month: m.month, score: m.avgScore, keyword: "분석", summary: "데이터 종합 중" })),
    };

    if (!finalResult.keywords || finalResult.keywords.length === 0) finalResult.keywords = commonKeywords;
    if (!finalResult.monthlyFlow || finalResult.monthlyFlow.length === 0) {
      finalResult.monthlyFlow = avgMonthlyScores.map(m => ({
        month: m.month,
        score: m.avgScore,
        keyword: "분석",
        summary: "데이터 종합 중"
      }));
    }

    console.log(`[Yearly] ${data.year}년 운세 3회 교차 검증 완료. 일치도: ${finalResult.coherenceScore}%`);

    return finalResult;
  } catch (e) {
    console.error("Yearly Fortune Generation Error:", e);
    return {
      overallSummary: "운세 데이터를 분석하는 중 문제가 발생했습니다.",
      coherenceScore: 50,
      businessFortune: "잠시 후 다시 시도해주세요.",
      loveFortune: "잠시 후 다시 시도해주세요.",
      healthFortune: "잠시 후 다시 시도해주세요.",
      keywords: ["분석", "대기"],
      monthlyFlow: Array.from({ length: 12 }, (_, i) => ({
        month: i + 1, score: 50, keyword: "대기", summary: "분석 대기 중"
      })),
    };
  }
}