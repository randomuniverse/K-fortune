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

**[핵심 원칙: 6단 논리 구조]**
모든 섹션은 반드시 아래 6단계를 순서대로 밟아야 합니다:
① 강점 단정 → ② 그림자(부작용) 단정 → ③ 작동 메커니즘(왜 그런지) → ④ 반복 패턴(초반/중반/후반) → ⑤ 미래 리스크(방치 시 결과) → ⑥ 통제 규칙(행동 처방)

**[각 필드 작성법]**

**pastInference** (400자 이상, 7~10문장):
아래 순서로 반드시 서술:
- 1단계: "당신은 [사주 데이터 근거]의 영향으로 [구체적 강점]을 타고났습니다."
- 2단계: "하지만 이 강점에는 그림자가 있습니다. [강점의 부작용]."
- 3단계: "이 메커니즘은 이렇게 작동합니다: [왜 그런지 논리적 설명]."
- 4단계: "초반에는 [초반 패턴]. 중반에 이르면 [중반 패턴]. 후반에는 [후반 결과]."
- 5단계: "이 패턴이 반복되면 [구체적 미래 리스크]."
- 6단계: "이를 끊으려면 [행동 규칙]이 필요합니다."

**currentState** (250자 이상, 5~7문장):
- "지금 당신의 머리는 [A]를 원하고, 가슴은 [B]를 원합니다."로 시작.
- 이 갈등이 일상에서 어떻게 나타나는지 구체적 상황 2개 묘사.
- "이 상태가 6개월 이상 지속되면, 당신은 [구체적 부정적 결과]로 귀결됩니다."
- "시장은 '과정이 좋았던 사람'이 아니라 '결과를 확정한 사람'을 기억합니다."

**bottleneck** (250자 이상, 4~6문장):
- "당신의 병목은 능력이 아닙니다."로 시작.
- 병목의 정체를 하나의 태도/습관으로 특정.
- 그 태도가 왜 생겼는지 사주/자미두수 근거로 설명.
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
  "coreEnergy": "강점과 약점이 공존하는 모순적 타이틀 (예: 브레이크가 고장 난 페라리)",
  "coherenceScore": 85,
  "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  "pastInference": "여기에 400자 이상의 6단 논리 분석을 줄글로 작성. 당신은 [강점]을 타고났습니다. 하지만 이 강점에는 그림자가 있습니다... (7~10문장 이상)",
  "currentState": "여기에 250자 이상 작성. 지금 당신의 머리는 A를 원하고 가슴은 B를 원합니다... (5~7문장 이상)",
  "bottleneck": "여기에 250자 이상 작성. 당신의 병목은 능력이 아닙니다... (4~6문장 이상)",
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

**[6단 논리 구조 강제]**
pastInference는 반드시: ① 강점 단정 → ② 그림자 → ③ 작동 메커니즘 → ④ 반복 패턴(초반/중반/후반) → ⑤ 미래 리스크 → ⑥ 통제 규칙 순서로 서술.

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
  "coreEnergy": "공통 본질을 관통하는 모순적 타이틀",
  "coherenceScore": 70~95,
  "keywords": ["공통키워드1", "공통키워드2", "공통키워드3", "공통키워드4", "공통키워드5"],
  "pastInference": "400자 이상. 6단 논리 구조로 서술. 당신은 [강점]을 타고났습니다. 하지만... (7~10문장)",
  "currentState": "250자 이상. 지금 당신의 머리는 A를 원하고 가슴은 B를 원합니다... (5~7문장)",
  "bottleneck": "250자 이상. 당신의 병목은 능력이 아닙니다... (4~6문장)",
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
  saju: any;
  ziwei: any;
  zodiac: any;
}) {
  const individualPrompt = `
당신은 ${data.year}년(병오년, 붉은 말의 해)의 운세를 분석하는 '동양철학 마스터'이자 '따뜻한 인생 멘토'입니다.
단순한 요약이 아니라, **사주의 구체적인 기운(간지, 십성)**을 바탕으로 자미두수와 별자리의 흐름을 더해 **풍성하고 희망찬 조언**을 제공해야 합니다.

**[작성 원칙: 풍성함과 디테일]**

1. **월별 운세 필수 포맷 (monthlyFlow):**
   - 반드시 **"O월은 OO(간지)의 기운입니다."**로 시작하세요. (예: "1월은 경인(庚寅)의 기운입니다.")
   - 그 기운이 사용자에게 미치는 영향을 **구체적으로 설명**하세요. (예: "문서운이 강하게 들어오니 계약에 유리합니다.")
   - 자미두수의 기운을 참조하여 조언을 덧붙이세요.
   - 말투는 **"~하는 것이 좋습니다.", "~기운이 가득합니다."** 처럼 부드럽고 격려하는 톤을 유지하세요. (단답형 금지)
   - 각 월별로 **최소 2~3문장** 이상 작성하세요.
   - **사고 순서:** 월별 분석을 먼저 완성한 뒤, 그 흐름을 종합하여 총평(overallSummary)을 작성하세요.

2. **businessFortune (사업/재물운 & 월별 전략):**
   - 월별 흐름을 분석한 뒤, 이를 바탕으로 **가장 이득이 되는 시기**와 **사업 형태**를 구체적으로 제안하세요.
   - **반드시 포함:** ${data.year}년에 가장 이득이 되는 **구체적인 비즈니스 형태** (예: "올해는 확장보다는 내실", "여름에 신규 계약 추진").
   - **근거:** 사주의 세운(Yearly Luck)과 자미두수의 유년(Limit) 데이터를 근거로 드세요.
   - 상반기/하반기 구분하여 투자 시기, 확장/수성 전략 구체적으로.

3. **loveFortune (연애/인간관계운):**
   - ${data.year}년의 대인관계와 연애 흐름. 좋은 인연을 만날 시기, 주의할 시기.
   - 도화살이나 홍염살의 작용 여부 분석. 싱글/커플별 조언.

4. **healthFortune (건강운):**
   - ${data.year}년의 화(火) 기운과 관련하여 조심해야 할 **구체적 신체 부위**나 컨디션 관리법.
   - 오행 균형에 기반한 식이/운동/생활습관 구체적 조언.

5. **overallSummary (${data.year}년 총평):**
   - 월별 흐름을 종합하여, 한 해를 관통하는 핵심 조언과 분위기를 3~4문장으로 요약.
   - 병오년 화(火) 기운이 사용자의 사주/자미두수와 어떻게 상호작용하는지 핵심 포인트.

6. **점수 산정:**
   - 각 달의 운세 흐름(Good/Bad)에 맞춰 0~100점 사이의 점수를 **논리적으로** 부여하세요. (운세 내용과 점수가 따로 놀지 않게 하세요.)

7. **keywords**: 올해를 관통하는 핵심 키워드 5개

**[출력 형식 (JSON)]**
{
  "overallSummary": "월별 흐름을 종합한 ${data.year}년 총평 (3~4문장)",
  "businessFortune": "사업/재물운 & 월별 전략 상세 분석",
  "loveFortune": "연애/인간관계운 상세 분석 (도화살/홍염살 포함)",
  "healthFortune": "건강운 상세 분석 (화 기운 관련 신체 부위 포함)",
  "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  "monthlyFlow": [
    {"month": 1, "score": 85, "keyword": "문서운", "summary": "1월은 경인(庚寅)의 기운입니다. 문서운이 강하게 들어오므로 계약이나 서류 처리에 유리한 시기입니다. 특히 자미두수의 기운이 더해져 새로운 시작을 알리는 좋은 에너지가 감돌고 있습니다."},
    {"month": 2, "score": 70, "keyword": "인내", "summary": "2월은 신묘(辛卯)의 기운입니다. ..."},
    ...
    {"month": 12, "score": 75, "keyword": "결실", "summary": "12월은 ..."}
  ]
}
`;

  const userPrompt = `
[사용자: ${data.name}] - ${data.year}년 운세 분석

1. [사주] 본성: ${data.saju.mainTrait}, 특수살: ${data.saju.specialSals.map((s: any) => s.name).join(", ")}, 용신: ${data.saju.yongShin.element}, 일주 강약: ${data.saju.dayMasterStrength}
2. [자미두수] 주성: ${data.ziwei.stars.life.map((s: any) => s.name).join(", ")}, 국: ${data.ziwei.bureau.name}
3. [별자리] ${data.zodiac.sign}, 특징: ${data.zodiac.info.traits?.join(", ") || data.zodiac.sign}

위 데이터를 종합하여 ${data.year}년 운세를 카테고리별로 분석하세요.
`;

  try {
    console.log(`[Yearly] ${data.year}년 운세 3회 교차 검증 시작...`);

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
당신은 ${data.year}년 운세의 최종 검증관이자 '따뜻한 인생 멘토'입니다.
동일 사용자의 ${data.year}년 운세를 3명의 독립 분석가가 각각 분석한 결과입니다.

**[당신의 임무]**
1. 3개 분석에서 **2개 이상이 공통적으로 언급한 내용만** 최종 리포트에 포함.
2. 1개에서만 언급된 독자적 주장은 제거.
3. 공통 키워드: [${commonKeywords.join(", ")}]
4. 월별 점수는 3개 평균을 사용: ${avgMonthlyScores.map(m => `${m.month}월=${m.avgScore}점`).join(", ")}
5. coherenceScore: 3개 분석 간 실제 일치도 반영.

**[중요: 월별 운세 풍성함 유지]**
- 월별 summary는 반드시 **"O월은 OO(간지)의 기운입니다."**로 시작하세요.
- 각 월별 summary는 **최소 2~3문장** 이상으로 풍성하게 작성하세요. 단답형/축약형 금지.
- 3개 분석의 월별 내용 중 2개 이상 일치하는 구체적 조언을 살려서 종합하세요.
- 말투는 **"~하는 것이 좋습니다.", "~기운이 가득합니다."** 처럼 부드럽고 격려하는 톤을 유지하세요.

**[분석가 A]**
${JSON.stringify(report1, null, 2)}

**[분석가 B]**
${JSON.stringify(report2, null, 2)}

**[분석가 C]**
${JSON.stringify(report3, null, 2)}

**[출력 형식 (JSON)]**
{
  "overallSummary": "월별 흐름을 종합한 ${data.year}년 총평 (따뜻하고 희망적인 톤, 3~4문장)",
  "coherenceScore": 70~95,
  "businessFortune": "2개 이상 일치하는 사업/재물운만 종합 (월별 Best/Worst 포함)",
  "loveFortune": "2개 이상 일치하는 연애/인간관계운만 종합 (도화살/홍염살 포함)",
  "healthFortune": "2개 이상 일치하는 건강운만 종합 (화 기운 관련 신체 부위 포함)",
  "keywords": ["공통키워드1", "공통키워드2", ...],
  "monthlyFlow": [
    {"month": 1, "score": 평균점수, "keyword": "공통키워드", "summary": "1월은 OO(간지)의 기운입니다. 2개 이상 일치하는 구체적 조언 2~3문장 이상"},
    ... (1~12월 전체)
  ]
}
`;

    const synthesisResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: `당신은 3개의 독립 ${data.year}년 운세 분석을 교차 검증하여 최종 종합 리포트를 작성하는 검증관이자 따뜻한 인생 멘토입니다. 2개 이상 일치하는 내용만 채택하되, 월별 운세는 반드시 "O월은 OO(간지)의 기운입니다"로 시작하고 최소 2~3문장 이상 풍성하게 작성하세요.` },
        { role: "user", content: synthesisPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
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
    if (!finalResult.monthlyFlow) {
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
      overallSummary: "운세 데이터 서버 연결이 불안정합니다. 잠시 후 다시 시도해주세요.",
      coherenceScore: 50,
      businessFortune: "분석 대기 중",
      loveFortune: "분석 대기 중",
      healthFortune: "분석 대기 중",
      keywords: ["대기", "연결"],
      monthlyFlow: Array.from({ length: 12 }, (_, i) => ({
        month: i + 1, score: 50, keyword: "대기", summary: "분석 대기 중"
      })),
    };
  }
}