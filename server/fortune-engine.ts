import { storage } from "./storage";
import { getZodiacSign, getZodiacInfo, getLifePathNumber, type FortuneData } from "@shared/schema";
import { calculateFullSaju } from "@shared/saju";
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
"사주, 별자리, 수비학이 공통적으로 가리키는 메시지입니다."

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

<b>-- 🔢 수비학 (Order)</b>
${data.numerologyMessage}`;
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

const numSchema = z.object({
  luckyNumbers: z.array(z.number()).min(1),
  message: z.string().min(1),
});

// [업그레이드] 3자 교차 검증 결과 스키마
const synthesisSchema = z.object({
  coherenceScore: z.number().min(0).max(100).describe("3가지 운세(사주, 별자리, 수비학)의 일치도 점수"),
  commonKeywords: z.array(z.string()).describe("3가지 운세에서 공통적으로 발견된 키워드 3~5개"),
  coreMessage: z.string().describe("3가지 운세가 만장일치로 가리키는 오늘의 핵심 메시지"),
  sajuCaution: z.string(),
  sajuSpecial: z.string(),
  sajuSummary: z.string(),
  zodiacLove: z.string(),
  zodiacMoney: z.string(),
  zodiacHealth: z.string(),
  zodiacWork: z.string(),
  zodiacSummary: z.string(),
  numerologyMessage: z.string(),
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
  const lifePathNumber = getLifePathNumber(user.birthDate);

  const gender = user.gender === "male" ? "male" : "female" as "male" | "female";
  const sajuChart = calculateFullSaju(user.birthDate, user.birthTime, gender);

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

  // 3. 수비학 프롬프트
  const numerologySystemPrompt = `수비학 전문가로서 생명수(${lifePathNumber})와 오늘 날짜의 진동수를 분석하여 행운의 숫자(3개)와 메시지를 JSON으로 주세요.
이모지를 사용하지 말고, 반드시 아래 정확한 JSON 형식으로만 응답하세요:
{
  "luckyNumbers": [숫자1, 숫자2, 숫자3],
  "message": "수비학 메시지 (2~3문장)"
}`;
  const numerologyUserPrompt = `오늘 날짜: ${dateStr}, 생명수: ${lifePathNumber}. 행운의 숫자와 메시지 알려줘. JSON으로만 응답해.`;

  // 병렬 API 호출
  const [sajuRes, zodiacRes, numRes] = await Promise.all([
    generateWithRetry(sajuSystemPrompt, sajuUserPrompt, "사주"),
    generateWithRetry(zodiacSystemPrompt, zodiacUserPrompt, "별자리"),
    generateWithRetry(numerologySystemPrompt, numerologyUserPrompt, "수비학"),
  ]);

  const sajuData = parseJson(sajuRes, sajuSchema);
  const zodiacData = parseJson(zodiacRes, zodiacSchema);
  const numData = parseJson(numRes, numSchema);

  if (!sajuData || !zodiacData || !numData) {
    const failures = [];
    if (!sajuData) failures.push(`사주(raw: ${sajuRes.substring(0, 200)})`);
    if (!zodiacData) failures.push(`별자리(raw: ${zodiacRes.substring(0, 200)})`);
    if (!numData) failures.push(`수비학(raw: ${numRes.substring(0, 200)})`);
    console.error("[FORTUNE] 파싱 실패 항목:", failures.join(" | "));
    throw new Error("운세 데이터 파싱 실패: " + failures.map(f => f.split("(")[0]).join(", "));
  }

  // 4. [핵심] 3자 교차 검증 및 종합 분석 (Synthesizer)
  const synthesizePrompt = `당신은 '운명 데이터 융합 전문가'입니다.
동양의 명리학(사주), 서양의 점성술(별자리), 그리고 수의 파동(수비학) 결과를 **교차 검증(Cross-Validation)**하여, 이 3가지 시스템이 **공통적으로 가리키는 진실**을 찾아내세요.

[사주 분석 결과 (동양 - 시간)]
- 점수: ${sajuData.score}
- 요약: ${sajuData.summary}
- 주의: ${sajuData.caution}

[별자리 분석 결과 (서양 - 공간)]
- 점수: ${zodiacData.score}
- 요약: ${zodiacData.summary}
- 직장/재물: ${zodiacData.work} / ${zodiacData.money}

[수비학 분석 결과 (수리 - 질서)]
- 메시지: ${numData.message}
- 행운의 숫자: ${numData.luckyNumbers.join(", ")}

[융합 분석 지침]
1. **일치도 판단(Coherence Score):** 사주, 별자리, 수비학 이 3가지 흐름이 얼마나 유사한지 0~100점으로 평가하세요.
   - 3가지가 모두 길(吉)하거나 흉(凶)하면 90점 이상.
   - 서로 엇갈리면(예: 사주는 좋은데 수비학은 나쁨) 점수를 낮추세요.
2. **공통 키워드 추출:** 3가지 분석에서 공통으로 발견되는 주제(예: "이동", "사람 조심", "계약 성사")를 찾아내세요. 수비학 메시지도 반드시 포함해서 비교하세요.
3. **핵심 메시지:** 3가지 운세가 만장일치로 합의한 '오늘의 가장 확실한 운명'을 한 문장으로 정의하세요.
4. 만약 운세가 상충한다면, "사주와 별자리의 기운은 좋으나 수비학적으로는 신중함이 필요합니다" 처럼 구체적으로 서술하세요.

중요: 각 원본 필드(sajuSummary, zodiacLove, numerologyMessage 등)는 위의 원본 내용을 그대로 가져와서 자연스럽게 다듬어 주세요. 특히 numerologyMessage는 위의 수비학 메시지 원본을 반드시 그대로 사용하세요.

이모지를 사용하지 말고, 반드시 아래 JSON 형식으로 응답하세요:
{
  "coherenceScore": 0~100 숫자,
  "commonKeywords": ["키워드1", "키워드2", "키워드3"],
  "coreMessage": "3가지 운세가 공통으로 가리키는 오늘의 핵심 메시지 (1문장)",
  "sajuCaution": "사주 원본의 주의사항 유지하되 다듬기",
  "sajuSpecial": "사주 원본 특이사항 유지",
  "sajuSummary": "사주 원본 요약 유지",
  "zodiacLove": "별자리 원본 유지",
  "zodiacMoney": "별자리 원본 유지",
  "zodiacHealth": "별자리 원본 유지",
  "zodiacWork": "별자리 원본 유지",
  "zodiacSummary": "별자리 원본 요약 유지",
  "numerologyMessage": "수비학 원본 메시지를 그대로 사용"
}`;

  const synthesisRaw = await generateWithRetry(
    "당신은 운명 데이터 융합 분석가입니다. JSON으로만 응답하세요.",
    synthesizePrompt,
    "교차검증"
  );

  const synthesis = parseJson(synthesisRaw, synthesisSchema);
  if (!synthesis) {
    throw new Error("교차 검증 데이터 파싱 실패");
  }

  // 최종 점수 계산 (일치도가 높으면 가중치 부여)
  const baseScore = Math.round((sajuData.score + zodiacData.score) / 2);
  const finalCombinedScore = synthesis.coherenceScore >= 80 
    ? Math.min(100, baseScore + 5) // 확신이 높으면 점수 상향
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
    luckyNumbers: numData.luckyNumbers,
    numerologyMessage: (synthesis.numerologyMessage && synthesis.numerologyMessage.length > 10 && !synthesis.numerologyMessage.includes("원본 유지"))
      ? synthesis.numerologyMessage 
      : numData.message,
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
  saju: any;
  ziwei: any;
  zodiac: any;
}) {
  const systemPrompt = `
당신은 운명의 가디언이자 인생 컨설턴트입니다.
사용자의 사주, 자미두수, 별자리 데이터를 교차 분석하여 **'심리적 병목(Bottleneck)'**을 찾아내고 해결책을 제시하세요.

**분석 단계:**
1. **데이터 융합 (Cross-Validation):** 3가지 운세에서 공통적으로 나타나는 키워드와 성향을 추출하세요.
2. **모순 발견 (Conflict Detection):** (예: 사주는 리더인데, 별자리는 소심함) 서로 상충하는 에너지가 만드는 내면의 갈등을 포착하세요.
3. **병목 진단 (Bottleneck Theory):** 현재 사용자의 잠재력을 가로막고 있는 '단 하나의 원인'을 지적하세요.
4. **솔루션 (Fulfillment):** 구체적이고 실천 가능한 행동 지침을 내리세요.

**출력 형식 (JSON):**
{
  "coreEnergy": "사용자를 정의하는 핵심 아키타입 (예: 상처 입은 치유자, 브레이크 고장 난 전차)",
  "coherenceScore": 0~100 사이의 정수 (3가지 운세의 일치도/데이터 신뢰도),
  "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  "currentState": "현재 심리 상태와 딜레마 분석 (모순점 위주로 날카롭게)",
  "bottleneck": "현재 인생의 결정적 병목 구간 (원인)",
  "solution": "가디언의 해결 솔루션 (행동 지침)"
}
`;

  const userPrompt = `
사용자 이름: ${data.name}
1. [사주] 본성: ${data.saju.mainTrait}, 특수살: ${data.saju.specialSals.map((s: any) => s.name).join(", ")}, 용신: ${data.saju.yongShin.element} (${data.saju.yongShin.reason})
2. [자미두수] 주성: ${data.ziwei.stars.life.map((s: any) => s.name).join(", ")}, 국: ${data.ziwei.bureau.name}
3. [별자리] ${data.zodiac.sign}, 특징: ${data.zodiac.info.traits?.join(", ") || data.zodiac.sign}

위 데이터를 바탕으로 분석해주세요. 
특히 서로 다른 운세가 충돌하는 지점(모순)을 찾아내어, 그로 인한 답답함을 '병목'으로 정의하고 풀어주세요.
`;

  const result = await pRetry(async () => {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty GPT response for guardian report");
    return JSON.parse(content) as GuardianReport;
  }, { retries: 2 });

  return result;
}