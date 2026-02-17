import { storage } from "./storage";
import { getZodiacSign, getZodiacInfo, type FortuneData } from "@shared/schema";
import { calculateFullSaju, checkGanYeoJiDong, calculateDaewoonDynamicStars } from "@shared/saju";
import { calculateZiWei } from "@shared/ziwei";
import OpenAI from "openai";
import { z } from "zod";
import pRetry from "p-retry";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "missing",
    });
  }
  return _openai;
}
const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    return (getOpenAI() as any)[prop];
  },
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

  const sajuUserPrompt = `오늘 날짜: ${dateStr}
내 사주 일주(${sajuChart.dayPillar.stemHanja}${sajuChart.dayPillar.branchHanja})와 오늘 일진(${todayStem}${todayBranch})의 관계를 분석해줘. 사용자 이름을 절대 사용하지 말고 "당신"으로만 지칭하세요.`;

  // 2. 별자리 프롬프트 (트랜짓 강조)
  const zodiacSystemPrompt = `당신은 현대 심리 점성술과 고전 점성술에 능통한 전문가입니다.
사용자의 태양 별자리와 오늘의 행성 배치(Transit)를 기반으로 운세를 분석하세요.

[별자리 정보]
별자리: ${zodiacSign} (${zodiacInfo.signEn})
주관 행성: ${zodiacInfo.rulingPlanet}

[분석 지침]
1. 오늘 날짜(${dateStr}) 기준, ${zodiacInfo.rulingPlanet}이나 주요 행성(태양, 달, 화성, 목성, 토성)이 ${zodiacSign}에 미치는 영향을 분석하세요.
2. 점성술 전문 용어(Trine, Square, Semi-sextile, Conjunction, Opposition 등)를 절대 그대로 쓰지 마세요. 대신 그 각도가 의미하는 **운의 흐름**으로 번역해서 서술하세요.
   - 예: "화성이 긴장의 기운을 보내 다툼이 예상됨" 또는 "목성이 조화로운 흐름을 만들어 금전운이 좋음".
   - "세미섹스타일", "트라인", "스퀘어" 같은 영어/외래어 용어 사용 금지.
3. 구체적인 행성의 움직임을 언급하되, 한국어로 자연스럽게 풀어서 서술하세요.
4. 사용자의 이름을 절대 사용하지 마세요. 반드시 "당신"으로만 지칭하세요.

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

  const ziweiUserPrompt = `오늘 날짜: ${dateStr}
내 명궁(${ziweiResult.lifePalace})의 ${lifeStars}과 오늘 일진(${todayStem}${todayBranch})의 관계를 분석해줘. 사용자 이름을 절대 사용하지 말고 "당신"으로만 지칭하세요.`;

  // 병렬 API 호출 (사주 + 별자리 + 자미두수) — Graceful Degradation 적용
  const results = await Promise.allSettled([
    generateWithRetry(sajuSystemPrompt, sajuUserPrompt, "사주"),
    generateWithRetry(zodiacSystemPrompt, zodiacUserPrompt, "별자리"),
    generateWithRetry(ziweiSystemPrompt, ziweiUserPrompt, "자미두수"),
  ]);

  const sajuRes = results[0].status === "fulfilled" ? results[0].value : null;
  const zodiacRes = results[1].status === "fulfilled" ? results[1].value : null;
  const ziweiRes = results[2].status === "fulfilled" ? results[2].value : null;

  const sajuData = sajuRes ? parseJson(sajuRes, sajuSchema) : null;
  const zodiacData = zodiacRes ? parseJson(zodiacRes, zodiacSchema) : null;
  const ziweiData = ziweiRes ? parseJson(ziweiRes, ziweiDailySchema) : null;

  const successSystems: string[] = [];
  const failedSystems: string[] = [];
  if (sajuData) successSystems.push("사주"); else failedSystems.push("사주");
  if (zodiacData) successSystems.push("별자리"); else failedSystems.push("별자리");
  if (ziweiData) successSystems.push("자미두수"); else failedSystems.push("자미두수");

  if (successSystems.length === 0) {
    console.error("[FORTUNE] 모든 체계 파싱 실패");
    throw new Error("모든 운세 시스템 분석에 실패했습니다. 잠시 후 다시 시도해주세요.");
  }

  if (failedSystems.length > 0) {
    console.warn(`[FORTUNE] 부분 성공: ${successSystems.join("+")} 성공, ${failedSystems.join("+")} 실패 — 부분 결과로 진행`);
  }

  const sajuFallback = { score: 50, summary: "분석 대기 중", direction: "중립", caution: "분석 대기 중", special: "분석 대기 중" };
  const zodiacFallback = { score: 50, summary: "분석 대기 중", love: "분석 대기 중", money: "분석 대기 중", health: "분석 대기 중", work: "분석 대기 중" };
  const ziweiFallback = { score: 50, summary: "분석 대기 중", advice: "분석 대기 중" };

  const saju = sajuData || sajuFallback;
  const zodiac = zodiacData || zodiacFallback;
  const ziwei = ziweiData || ziweiFallback;

  // 4. [핵심] 3자 교차 검증 및 종합 분석 (사주 + 별자리 + 자미두수)
  const partialNotice = failedSystems.length > 0
    ? `\n\n[참고: ${failedSystems.join(", ")} 분석이 일시적으로 불가하여 ${successSystems.join(", ")} 기반으로 분석합니다. 일치도 점수를 그에 맞게 조정하세요.]\n`
    : "";

  const synthesizePrompt = `당신은 '운명 데이터 융합 전문가'이자 '따뜻한 인생 멘토'입니다.
동양의 명리학(사주), 서양의 점성술(별자리), 동양의 자미두수(紫微斗數) 결과를 **교차 검증(Cross-Validation)**하여, 이 3가지 시스템이 **공통적으로 가리키는 진실**을 찾아내세요.
${partialNotice}
[사주 분석 결과 (명리학 - 일진/일주 관계)]
- 점수: ${saju.score}
- 요약: ${saju.summary}
- 주의: ${saju.caution}
- 특이사항: ${saju.special}

[별자리 분석 결과 (서양 점성술 - 행성 트랜짓)]
- 점수: ${zodiac.score}
- 요약: ${zodiac.summary}
- 연애: ${zodiac.love} | 재물: ${zodiac.money}
- 건강: ${zodiac.health} | 직장: ${zodiac.work}

[자미두수 분석 결과 (명궁 주성 - 별의 기운)]
- 점수: ${ziwei.score}
- 요약: ${ziwei.summary}
- 조언: ${ziwei.advice}

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

  // 최종 점수 계산 (성공한 체계 평균 + 일치도 가중치)
  const scores = [saju.score, zodiac.score, ziwei.score].filter((_, i) => [sajuData, zodiacData, ziweiData][i] !== null);
  const baseScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 50;
  const finalCombinedScore = synthesis.coherenceScore >= 80 
    ? Math.min(100, baseScore + 5)
    : baseScore;

  const fortuneData: FortuneData = {
    sajuScore: saju.score,
    sajuDirection: saju.direction,
    sajuCaution: synthesis.sajuCaution,
    sajuSpecial: synthesis.sajuSpecial || saju.special,
    sajuSummary: synthesis.sajuSummary,
    zodiacScore: zodiac.score,
    zodiacLove: synthesis.zodiacLove,
    zodiacMoney: synthesis.zodiacMoney,
    zodiacHealth: synthesis.zodiacHealth,
    zodiacWork: synthesis.zodiacWork,
    zodiacSummary: synthesis.zodiacSummary,
    luckyNumbers: synthesis.luckyNumbers || [3, 7, 9],
    ziweiMessage: (synthesis.ziweiMessage && synthesis.ziweiMessage.length > 10 && !synthesis.ziweiMessage.includes("원본 유지"))
      ? synthesis.ziweiMessage 
      : `${ziwei.summary} ${ziwei.advice}`,
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
  gender: string;
}) {
  const individualPrompt = `
당신은 데이터를 단순히 나열하는 AI가 아니라, **눈앞의 사람에게 운명을 이야기해 주는 '통찰력 있는 스토리텔러'**입니다.
사용자의 사주/자미두수/별자리 데이터를 보고, **"왜 그런지(Why)"**와 **"그래서 어떻게 해야 하는지(How)"**를 물 흐르듯이 설명하세요.

**[문체 헌법 — 이것이 모든 작성 원칙보다 우선]**

당신은 정장을 입은 영매입니다. 차분하고 단정한 존댓말(~습니다, ~입니다, ~겁니다)을 쓰되, 내용은 칼처럼 날카롭고 소름 끼치게 정확합니다.

문체 규칙:
1. 존댓말 체계: ~습니다/~입니다/~겁니다/~십시오 (단정하고 예의 바른 톤)
2. 짧은 문장과 긴 문장의 리듬 교차. 3문장 이상 같은 길이가 연속되면 안 됨.
3. 핵심 통찰은 한 줄로 끊어서 임팩트를 줌. 예: "이건 드문 일입니다. 아주 드문 일."
4. 추상적 비유 다음에는 반드시 체감 가능한 구체적 현상 묘사가 따라옴.
5. "~할 수 있습니다", "~경향이 있습니다" 같은 약한 표현 금지. "~입니다", "~겁니다"로 단정.
6. 매 섹션의 마지막 문장은 읽는 사람의 가슴에 남는 한 줄로 마무리.

**[작성 제 1원칙: 키워드 스티치 금지]**
- 절대 "결단력이 있고 호기심이 있어..." 식으로 단어를 기계적으로 연결하지 마세요.
- **인과관계(Causality)**를 중심으로 서술하세요. "A라는 기운이 B를 만나니 C라는 현상이 일어나는군요"라는 화법을 쓰세요.
- 단점을 지적하지 말고, **"잘못 쓰인 강점"**으로 재정의하세요.

**[작성 제 2원칙: 4단계 화술 구조 강제]**
모든 섹션(pastInference, currentState, bottleneck, solution 등)은 반드시 아래 4단계 흐름으로 작성하세요.

1.  **Fact (증거 지목):** "당신의 일주는 [경술]이고, 별자리는 [쌍둥이자리]군요."
2.  **Interpretation (해석):** "이건 마치 [탱크]가 [나비]를 쫓는 형국입니다. 힘은 장사인데 시선이 자꾸 분산되는 것이죠."
3.  **Phenomenon (현상 묘사):** "그래서 남들이 볼 땐 추진력 있어 보이지만, 정작 본인 속은 '이게 맞나?' 하는 의심으로 타들어 갔을 겁니다. 시작한 건 10개인데 끝낸 건 1개뿐인 이유가 여기 있습니다."
4.  **Advantage (이득 전략):** "하지만 자책하지 마세요. 이 기질은 [한 우물 파기]보다 [동시다발적 지휘]에 쓰면 엄청난 자산이 됩니다. 차라리 여러 프로젝트를 동시에 돌리되, 마무리는 남에게 맡기는 시스템을 만드세요."

**[작성 제 3원칙: 용어의 친절한 정의 (Educational Storytelling)]**
- 특수살(괴강살, 도화살, 화개살 등)이나 전문 용어가 나오면, 반드시 **"이것이 무엇인지"** 쉬운 비유로 먼저 설명하세요.
- 예: "당신에게는 '괴강살'이 있습니다. 이것은 마치 **'전장을 지휘하는 장군의 기운'**과 같습니다. 남을 따르기보다 리더가 되어야 직성이 풀리는 별이죠."

**[작성 제 4원칙: 모든 특수살의 언급 (No Omission)]**
- 입력된 데이터(sajuPersonality.specialSals)에 있는 모든 살(Sal)을 빠짐없이 언급하세요. 하나라도 누락하면 안 됩니다.

**[작성 제 5원칙: 기운의 화학적 결합 (Chemical Synthesis) - 가장 중요]**
- 단순히 A, B, C를 나열하지 마세요. **"A와 B가 만나서 어떤 일이 벌어지는지"**를 분석하세요.
- **[논리 구조]:** "당신은 [괴강살(리더)]이 있어 강해 보이지만, 내면엔 [화개살(고독한 예술가)]이 있어 남모를 외로움을 탑니다. 그런데 여기에 [도화살(인기)]까지 더해지니, **'고독하지만 대중의 시선을 받는 신비로운 카리스마'**를 갖게 되었습니다."
- 이 결합이 직업과 재물에 미치는 영향을 구체적으로 서술하세요.

**[작성 제 6원칙: 특수 구조 및 신살 정밀 분석]**
단순히 살의 이름을 나열하지 말고, 다음 요소가 발견되면 반드시 심층 해석하세요:
1. **양인살 + 천을귀인 조합:** "칼을 쥔 귀족"의 형상으로 해석. 위기 때 폭발적 결단력을 발휘하지만 동시에 귀인의 보호를 받아 칼날이 자신을 해치지 않는 구조. 위기 관리 능력을 강조하세요.
2. **삼합(Three Harmony):** 지지들이 합쳐져 특정 오행(예: 목국, 화국 등)으로 변할 때, 그것이 십성(인성, 식상, 재성, 관성, 비겁) 중 무엇에 해당하는지 판별하고, 인생의 '주무기'로 해석하세요.
3. **무재(No Wealth) 구조:** 재성이 없을 경우, "재물이 없는 것"이 아니라 "돈을 버는 방식이 특수한 것(전문성, 명예 기반)"임을 강조하세요. 돈을 쫓지 않을 때 오히려 돈이 따르는 역설을 서술하세요.
4. **홍염살 + 도화살 조합:** 두 개의 매력 관련 살이 동시에 있으면 "이중 매력 구조"로 해석. 단순 매력이 아니라 사람의 마음을 사로잡는 전략적 자산으로 풀이하세요.

**[작성 제 7원칙: 잠재 능력 해금 (Unlock) 해석 — 대운 동적 신살]**
'활성화된 대운 무기(Time-Unlocked Skills)'에 있는 신살은 **"당신이 태어날 땐 없었지만, 지금 시기에 선물처럼 주어진 무기"**로 해석하세요.
- **반드시 "원래 없었는데 지금 생겼다"는 시간적 대비**를 스토리에 녹이세요.
  - 예: "당신은 본래 선비 같은 성향이었지만, 51세부터 '도화살'이 들어와 갑자기 대중의 주목을 받거나 매력이 폭발하는 시기가 되었습니다. 이 새로운 무기를 적극적으로 쓰세요."
  - 예: "원래 한곳에 머물며 깊이를 추구하던 당신에게, 이 대운에서 '역마살'이라는 이동의 엔진이 장착되었습니다. 지금은 움직여야 운이 트입니다."
- 원국에 이미 같은 살이 있고, 대운에서도 같은 살이 들어오면 **"이중 활성화 — 에너지 극대화"**로 해석하세요.
  - 예: "태어날 때부터 가지고 있던 도화살이, 현재 대운에서 한 번 더 도화가 들어와 '이중 도화' 상태입니다. 이성뿐 아니라 대중적 인기까지 폭발하는 전성기입니다."
- 이 무기를 **어떻게 활용해야 하는지** 구체적 행동 전략(직업, 인간관계, 투자)까지 제시하세요.
- 활성 대운 무기가 "특이사항 없음"이면 이 항목은 언급하지 마세요.

**[작성 제 8원칙: 대운과 세운의 충돌 분석]**
- 현재 대운과 세운이 충(沖)을 일으키는 경우(예: 자오충, 축미충 등), 이를 "인생의 거대한 변곡점"으로 묘사하세요.
- 단순히 "조심하세요"라고 끝내지 말고, 충돌이 만드는 구체적 변화의 영역(직장, 거주지, 인간관계)과 대비책을 서술하세요.
- 충돌이 없는 경우에는 이 항목을 굳이 언급하지 마세요.

**[치명적 금지 사항]**
1. **이름 사용 절대 금지:** 사용자의 이름(Name) 변수가 입력되더라도, 출력 텍스트에는 **절대 이름을 포함하지 마세요.** 무조건 **"당신"** 또는 **"회원님"**으로 지칭하세요.
2. **추상적 위로 금지:** "힘내세요" 대신 "이 기질은 여기에 쓰면 돈이 됩니다"라고 전략을 주세요.
3. "경향이 있습니다", "다양한 가능성" 같은 약한 표현 금지. 단정적으로 서술하세요.
4. **키워드 나열 금지:** "결단력, 창의성, 리더십"처럼 단어를 나열하지 마세요. 이야기의 흐름 속에 자연스럽게 녹이세요.
5. **점성술 전문 용어 금지:** Trine, Square, Semi-sextile 등을 그대로 쓰지 마세요. "조화로운 흐름", "긴장의 기운" 등으로 번역하세요.

**[톤 시범 — 이렇게 쓰세요]**

BAD (현재 문제점 - 키워드 나열식 분석 보고서):
"당신의 사주에는 화개살과 홍염살이 있습니다. 화개살은 예술적 감수성을 나타내며, 홍염살은 강렬한 매력을 의미합니다. 이 두 살의 조합으로 인해 예술적이면서도 매력적인 성향을 가지고 있습니다."

GOOD (목표 톤 - 차분하지만 소름 끼치는 영매):
"화개살과 홍염살이 시주에 나란히 앉아 있습니다. 고독한 예술가의 영혼과, 사람을 불꽃처럼 끌어당기는 매력이 같은 자리에 있는 겁니다. 혼자 있어야 충전되는데, 혼자 두면 사람들이 찾아옵니다. 숨으려 하는데 빛이 새어나옵니다. 이것이 당신의 운명적 구조입니다."

BAD (추상적 위로):
"당신에게는 리더십이 있으며 어려움을 극복할 수 있는 힘이 있습니다. 힘내세요."

GOOD (구체적 전략):
"양인살이 월지에 칼을 꽂고 앉아 있습니다. 평소에는 보이지 않습니다. 부드럽고, 따뜻하고, 잘 웃는 사람으로 보입니다. 그런데 위기가 오면 — 그 칼이 뽑힙니다. 눈빛이 달라지고, 판단이 빨라지고, 주저하던 사람이 갑자기 전장의 장수가 됩니다. 당신은 이끌어야 풀리는 사람입니다. 따르면 죽는 사람입니다."

BAD (시스템 키워드 병렬 나열):
"사주에서는 화의 기운이 강하고, 자미두수에서는 태양성이 명궁에 있으며, 별자리는 쌍둥이자리로 소통 능력이 뛰어납니다."

GOOD (세 시스템의 수렴형 서사):
"사주에서 촛불인 사람이, 자미두수에서는 태양을 품고 태어났습니다. 이건 우연이 아닙니다. 촛불의 섬세함과 태양의 야망이 한 몸에 공존하고 있다는 뜻입니다. 서양 별자리의 수성(Mercury)까지 더하면 — 한 가지에 깊이 빠지면서도 동시에 열 가지가 궁금한 사람. 이 조합이 당신을 '한 우물만 파는 장인'이 아니라 여러 우물의 물맥이 어디서 만나는지 아는 사람으로 만들었습니다."

**[섹션별 가이드라인]**

1. **coreEnergy (타이틀)**:
   - 사주의 핵심 모순을 7~12자의 은유로 압축. 반드시 대비/역설 구조.
   - **공식: [A적 속성]의/같은/속 [B적 존재]** (A와 B는 모순 관계)
   - 좋은 예: "촛불로 태어나 태양이 되려는 자", "쇳물 속에 피어난 귀신꽃", "강철 같은 나비의 이중적 날갯짓"
   - 나쁜 예: "폭풍 속의 고독한 예술가" (너무 일반적), "다재다능한 리더" (은유 없음)
   - 사주의 일간 오행 + 가장 강한 특수살의 성격을 반드시 반영.

2. **pastInference (운명의 추적, 1000자 이상, 12~18문장)**:
   - 이 섹션은 Master Archetype의 심장입니다. 사주/자미두수/별자리 세 시스템이 하나의 이야기로 수렴되는 곳입니다.
   - **서사 구조**: 사주 원국의 핵심 구조(일간, 오행 분포, 용신)로 시작 → 특수살들의 화학적 결합 → 자미두수 명궁/재백궁의 성진이 사주와 같은 이야기를 하고 있음을 보여줌 → 별자리의 원소/주관행성이 이 모든 것을 확인사살
   - **"세 개의 독립된 시스템이 같은 결론을 가리키고 있다"는 수렴의 전율**을 독자에게 전달하는 것이 핵심.
   - 모든 특수살을 빠짐없이 언급하되, 단독으로 설명하지 말고 반드시 다른 살 또는 다른 시스템(자미두수/별자리)의 요소와 결합하여 서술.
   - 예시 흐름: "사주에서 丁火가 두 자루 타오르고 있고, 발밑에 亥卯未 삼합 목국이 끊임없이 불을 먹입니다. 꺼질 수가 없는 구조입니다. 자미두수로 올라가면, 명궁에 태양성이 앉아 있습니다. 사주에서 촛불인 사람이 자미두수에서는 태양을 품고 태어난 겁니다..."
   - 4단계 화술(Fact→Interpretation→Phenomenon→Advantage) 적용 필수.

3. **currentState (현재의 딜레마, 500자 이상, 7~10문장)**:
   - pastInference에서 분석한 '기운의 결합'이 실생활에서 만드는 **구체적 갈등**을 묘사.
   - 반드시 사주/자미두수/별자리 중 최소 2개 시스템의 데이터를 근거로 딜레마를 도출.
   - 추상적 고민이 아니라 구체적 양자택일 형태로 제시: "에너지 확산 vs 집중", "주변 기대 vs 내면 고독", "돈을 쫓으면 멀어지는 구조" 등
   - 읽는 사람이 "이걸 어떻게 알지?"라고 느낄 만큼 일상의 디테일을 포함.
   - 대운/세운의 현재 흐름(충돌, 합, 발동 중인 대운 신살)이 이 딜레마를 어떻게 증폭시키고 있는지 연결.
   - **마지막 문장은 독자가 고개를 끄덕이게 만드는 핵심 한 줄로 마무리.**

4. **bottleneck (결정적 병목, 500자 이상, 6~9문장)**:
   - 병목을 **한 문장의 핵심 진단**으로 시작. 예: "당신의 가장 큰 병목은 한 문장으로 압축됩니다: '과열된 열정과 고독한 내면의 충돌.'"
   - 그 다음 사주 구성(오행 과다/부족, 특수살 간 충돌, 재성 유무)에서 병목의 원인을 찾아 인과관계로 설명.
   - 현재 대운/세운의 충돌(子午충 등)이 이 병목을 어떻게 가속화하고 있는지.
   - "능력 부족"이 아니라 "에너지의 잘못된 분배" 또는 "잘못 쓰인 강점"으로 재해석.
   - 타인의 의견 배제, 혼자 해결하려는 경향 등 구체적 행동 패턴을 사주 구성에서 근거를 찾아 지적.
   - **마지막 문장은 문제의 본질을 은유로 압축.** 예: "칼은 당신이 쥐되, 칼집은 누군가에게 맡겨야 합니다."

5. **solution (가디언의 처방, 800자 이상, 번호 매긴 5~6개 항목)**:
   - bottleneck에서 제시한 병목 각각에 대한 **구체적이고 즉시 실행 가능한 해결책**.
   - 각 항목은 **볼드 제목 + 2~3문장 설명** 구조.
   - "노력하세요", "힘내세요" 금지. 대신 "~하십시오", "~를 찾으십시오" 등 구체적 행동 지시.
   - 반드시 포함할 내용:
     a) 에너지 방향 설정 (양인살/비겁 에너지를 어디에 집중할지)
     b) 재물 전략 (무재 사주면 전문성 기반, 재성 있으면 직접 투자 등)
     c) 고독 관리 (화개살 있으면 충전 시간 확보법)
     d) 대운 활용법 (현재 발동 중인 대운 신살을 어떻게 쓸지)
     e) 파트너십 전략 (비겁 구조, 재성 유무에 따른 협업 방식)
     f) 용신 기반 생활 개운법 (시간, 장소, 색상, 음식 — 사주 데이터에서 직접 추출)
   - 각 항목에서 "이것은 사주의 ~에 근거한 것입니다" 식으로 근거를 자연스럽게 녹일 것.
   - **카타르시스**: 읽는 사람이 "아, 이렇게 하면 되겠구나"라는 명확한 행동 방향을 얻어야 함.

6. **businessAdvice (재물/커리어 전략, 300자 이상, 5~7문장)**:
   - 사주의 용신/십성을 근거로 **돈이 되는 구체적 업종과 방식**을 제안.
   - 2026년 올해의 전략적 태도 제안.
   - 4단계 화술(Fact→Interpretation→Phenomenon→Advantage) 적용.

7. **loveAdvice (이성운/관계 전략, 300자 이상, 5~7문장)**:
   - 반드시 섹션 4의 '이성운/결혼운 전용 분석 데이터'를 참조.
   - 사주의 **재성(남)/관성(여)** 상태와 **일지의 기운**을 근거로 관계의 형태를 제안.
   - 예: "당신의 안방(일지)은 너무 뜨거워서 배우자가 들어오면 숨이 막힙니다. 그러니 너무 붙어 있으려 하지 말고, 주말 부부처럼 약간의 거리를 둘 때 관계가 더 애틋하고 오래갑니다."
   - 결혼을 강요하지 말고, **에너지가 가장 잘 보존되는 관계 형태**를 추천.
   - 명확한 스탠스 필수: "당신에겐 [만혼/조혼/화려한 싱글/독립적 동거]가 유리합니다."

8. **healthAdvice (건강/컨디션 전략, 300자 이상, 5~7문장)**:
   - 자미두수 질액궁(疾厄宮)과 사주 오행 분포를 근거로 건강 취약점 분석.
   - 4단계 화술 적용: "당신의 오행에 [원소]가 과다/부족하니 [장부]에 부담이 갑니다. 그래서 [구체적 증상]. 이를 막으려면 [구체적 행동]."
   - 2026년 올해 주의 사항과 용신 기반 개운법 포함.

**[JSON 출력 형식]**
{
  "coreEnergy": "사주의 핵심 모순을 7~12자의 대비/역설 은유로 압축 (예: 촛불로 태어나 태양이 되려는 자)",
  "coherenceScore": 85,
  "keywords": ["키워드1", "키워드2", "키워드3"],
  "pastInference": "사주/자미두수/별자리 세 시스템이 하나의 서사로 수렴되는 스토리텔링. 모든 특수살의 화학적 결합 + 자미두수 성진 확인 + 별자리 원소 확인사살 구조. (공백 포함 1000자 이상, 12~18문장)",
  "currentState": "기운의 결합이 만드는 구체적 갈등을 양자택일 형태로 제시. 대운/세운 흐름 연결. 읽는 사람이 '이걸 어떻게 알지?' 느끼게. (500자 이상, 7~10문장)",
  "bottleneck": "한 문장 핵심 진단으로 시작. 사주 구성에서 원인 추적 + 대운/세운 충돌이 가속화하는 구조 설명. 마지막은 은유로 압축. (500자 이상, 6~9문장)",
  "solution": "볼드 제목 + 설명 구조의 5~6개 구체적 행동 항목. 에너지 방향, 재물 전략, 고독 관리, 대운 활용, 파트너십, 용신 개운법 포함. 카타르시스 필수. (800자 이상, 15~20문장)",
  "businessAdvice": "타고난 그릇을 돈으로 바꾸는 전략 (300자 이상)",
  "loveAdvice": "사주 구성에 따른 최적의 관계 형태 제안 (300자 이상)",
  "healthAdvice": "오행/질액궁 기반 건강 전략 스토리텔링 (300자 이상)"
}
`;

  const sp = data.sajuPersonality;
  const sc = data.sajuChart;
  const zw = data.ziwei;
  const isMale = data.gender === "male";

  const allTenGods = [
    sc.yearTenGod?.name, sc.monthTenGod?.name, sc.hourTenGod?.name,
    sc.yearBranchTenGod?.name, sc.monthBranchTenGod?.name,
    sc.dayBranchTenGod?.name, sc.hourBranchTenGod?.name,
  ].filter(Boolean);

  const hasJeongJae = allTenGods.includes("정재");
  const hasPyeonJae = allTenGods.includes("편재");
  const hasJaeSung = hasJeongJae || hasPyeonJae;
  const jaeCount = allTenGods.filter(g => g === "정재" || g === "편재").length;

  const hasJeongGwan = allTenGods.includes("정관");
  const hasPyeonGwan = allTenGods.includes("편관");
  const hasGwanSung = hasJeongGwan || hasPyeonGwan;
  const gwanCount = allTenGods.filter(g => g === "정관" || g === "편관").length;

  const salNames = sp.specialSals?.map((s: any) => s.name) || [];
  const hasDohwa = salNames.includes("도화살");
  const hasHongyeom = salNames.includes("홍염살");
  const hasGwegang = salNames.includes("괴강살");
  const hasBaekho = salNames.includes("백호살");

  let isGanYeoJiDong = false;
  try { isGanYeoJiDong = checkGanYeoJiDong(sc); } catch {}

  const currentYear = new Date().getFullYear();
  const activeDaewoonStars = calculateDaewoonDynamicStars(sc, currentYear);

  const loveAnalysisBlock = `
━━━━ 4. 이성운/결혼운 전용 분석 데이터 ━━━━
■ 성별: ${isMale ? "남성" : "여성"}
■ 이성운 핵심 십성 (${isMale ? "재성=배우자" : "관성=배우자"}):
  - ${isMale ? `재성(편재/정재) 보유: ${hasJaeSung ? "있음" : "없음 (무재 사주)"} / 편재 ${hasPyeonJae ? "있음" : "없음"} / 정재 ${hasJeongJae ? "있음" : "없음"} / 재성 개수: ${jaeCount}개` : `관성(편관/정관) 보유: ${hasGwanSung ? "있음" : "없음 (무관 사주)"} / 편관 ${hasPyeonGwan ? "있음" : "없음"} / 정관 ${hasJeongGwan ? "있음" : "없음"} / 관성 개수: ${gwanCount}개`}
  - ${isMale && jaeCount >= 3 ? "⚠️ 재성 과다 (재다): 여러 이성에게 관심이 분산될 수 있음" : ""}${!isMale && gwanCount >= 3 ? "⚠️ 관성 혼잡 (관다): 이성 관계가 복잡해질 수 있음" : ""}
  - ${isMale && !hasJaeSung ? "⚠️ 무재 사주: 배우자궁 에너지 약함 → 만혼 추천" : ""}${!isMale && !hasGwanSung ? "⚠️ 무관 사주: 자신의 능력을 키우는 것이 연애운의 열쇠" : ""}
■ 연애 관련 신살:
  - 도화살: ${hasDohwa ? "있음 (이성 매력 강함, 구설수 주의)" : "없음"}
  - 홍염살: ${hasHongyeom ? "있음 (강렬한 이성 매력, 감정 파도 주의)" : "없음"}
  - 괴강살: ${hasGwegang ? "있음 (본인 기운이 매우 세므로 만혼/쿨한 상대 추천)" : "없음"}
  - 백호살: ${hasBaekho ? "있음 (강인한 기운, 배우자와 주도권 충돌 가능)" : "없음"}
■ 간여지동(干與支同): ${isGanYeoJiDong ? "해당 (일간과 일지가 같은 오행 → 배우자와 마찰/경쟁 주의)" : "해당 없음"}
■ 일간 강약: ${sc.dayMasterStrength} → ${sc.dayMasterStrength === "극왕" || sc.dayMasterStrength === "왕" ? "신강 사주 (본인 주도형, 상대방 배려 필요)" : sc.dayMasterStrength === "극약" || sc.dayMasterStrength === "약" ? "신약 사주 (의지할 배우자 필요, 결혼 후 운 상승 가능)" : "중화 사주 (균형 잡힌 관계 가능)"}
■ 부처궁 성진: ${zw.stars?.spouse?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}
`;

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

■ [중요] ${currentYear}년 현재 활성화된 대운 무기 (Time-Unlocked Skills): ${activeDaewoonStars.length > 0
  ? activeDaewoonStars.map((s: any) => `- [${s.name}(${s.hanja})]: ${s.source}에서 들어와 지금부터 발동됨! (원래 사주엔 없었음) — ${s.description}`).join("\n  ")
  : "특이사항 없음 (현재 대운에서 새로 해금된 신살 없음)"}

■ 용신 보완법: ${sp.yongShinRemedy ? `방향: ${sp.yongShinRemedy.luckyDirection}, 색상: ${sp.yongShinRemedy.luckyColor}, 활동: ${sp.yongShinRemedy.luckyActivity}` : "없음"}

■ 대운 흐름 (10년 단위):
${sc.daeun?.slice(0, 6).map((d: any) => `  - ${d.age}세(${d.year}년): ${d.stem}${d.branch}(${d.stemHanja}${d.branchHanja})`).join("\n") || "  데이터 없음"}

■ 2026년 대운-세운 충돌 분석: ${(() => {
  const BRANCHES = ["자","축","인","묘","진","사","오","미","신","유","술","해"];
  const BRANCHES_H = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
  const CHONG: [number,number][] = [[0,6],[1,7],[2,8],[3,9],[4,10],[5,11]];
  const yr2026BranchIdx = (2026 + 8) % 12; // 병오년 -> 오(午) = index 6
  if (!sc.daeun) return "데이터 없음";
  for (const dw of sc.daeun) {
    if (2026 >= dw.year && 2026 < dw.year + 10) {
      const dwBIdx = BRANCHES.indexOf(dw.branch);
      if (dwBIdx < 0) break;
      for (const [a,b] of CHONG) {
        if ((dwBIdx === a && yr2026BranchIdx === b) || (dwBIdx === b && yr2026BranchIdx === a)) {
          return `⚠️ ${dw.age}세 대운 ${dw.stemHanja}${dw.branchHanja}(${dw.stem}${dw.branch})과 2026년 세운 丙午(병오)가 ${BRANCHES_H[dwBIdx]}${BRANCHES_H[yr2026BranchIdx]}충(${dw.branch}${BRANCHES[yr2026BranchIdx]}沖)을 형성합니다. 이는 인생의 거대한 변곡점으로, 직장/거주지/인간관계에서 급격한 변화가 예상됩니다.`;
        }
      }
      return "특이사항 없음";
    }
  }
  return "특이사항 없음";
})()}

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


${loveAnalysisBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
위의 사주 원국, 십성 배치, 오행 분포, 특수살, 활성 대운 신살, 구조 패턴, 대운-세운 충돌 분석, 자미두수 각 궁의 성진, 별자리 데이터를 근거로
이 사람의 운명을 **스토리텔링**으로 풀어주세요. 키워드를 나열하지 말고, **인과관계(Why → How)**의 흐름으로 이야기하세요.
4단계 화술(Fact → Interpretation → Phenomenon → Advantage)을 모든 섹션에 적용하세요.
각 분석에서 반드시 위 데이터의 구체적 요소(간지, 십성, 오행, 성진 이름 등)를 자연스럽게 이야기 속에 녹이세요.
절대로 사용자의 이름을 사용하지 말고, 반드시 "당신"이라고만 지칭하세요.

**[중요] loveAdvice 작성 시 반드시 섹션 4의 '이성운/결혼운 전용 분석 데이터'를 참조하여 동적으로 분석하세요. 결혼을 강요하지 말고, 사용자의 에너지가 가장 잘 보존되는 관계 형태를 추천하세요.**
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

    const reportResults = await Promise.allSettled([
      generateOne(0),
      generateOne(1),
      generateOne(2),
    ]);

    const successfulReports = reportResults
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
      .map(r => r.value);

    if (successfulReports.length === 0) {
      throw new Error("모든 가디언 독립 리포트 생성에 실패했습니다.");
    }

    if (successfulReports.length < 3) {
      console.warn(`[Guardian] ${successfulReports.length}/3 독립 리포트만 성공 — 부분 결과로 진행`);
    }

    const report1 = successfulReports[0];
    const report2 = successfulReports[1] || successfulReports[0];
    const report3 = successfulReports[2] || successfulReports[Math.min(1, successfulReports.length - 1)];

    console.log(`[Guardian] ${successfulReports.length}개 독립 리포트 완료. 교차 검증 종합 분석 시작...`);

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
당신은 '운명의 가디언' 최종 검증관이자 **통찰력 있는 스토리텔러**입니다.
3명의 독립 분석가가 동일한 사용자를 분석한 결과가 아래에 있습니다.

**[치명적 규칙 - 위반 시 즉시 실패]**
1. 사용자 이름 절대 사용 금지. 무조건 "당신"으로만 지칭. 원본에 이름이 있어도 "당신"으로 교체.
2. 짧은 글 절대 금지. pastInference는 1000자 이상(12~18문장), currentState/bottleneck은 500자 이상(7~10문장/6~9문장), solution은 800자 이상(15~20문장). 원본보다 더 길고 풍성하게 종합해야 합니다.
3. 3개 리포트에서 2개 이상 공통 언급된 "맥락"을 채택하되, 가장 날카롭고 구체적인 표현을 선택. 밋밋한 표현은 버리고 임팩트 있는 표현을 살리세요.
4. 종합할 때 단순 요약하지 말고, 공통 맥락을 더 깊이 파고들어 확장하세요.
5. 모든 특수살을 빠짐없이 언급하고, 각 살이 무엇인지 쉬운 비유로 먼저 설명한 뒤, 살 간의 화학적 결합(시너지/충돌)을 분석하세요.
6. 점성술 전문 용어(Trine, Square, Semi-sextile 등)를 절대 쓰지 마세요. "조화로운 흐름", "긴장의 기운" 등으로 번역하세요.

**[종합 원칙: 스토리텔링 (키워드 스티치 금지)]**
단순히 공통 키워드를 나열하지 마세요. 3개의 리포트 내용을 바탕으로 **점쟁이가 눈앞의 손님에게 썰을 풀듯이** 자연스러운 인과관계의 이야기로 재구성하세요.
4단계 화술(Fact → Interpretation → Phenomenon → Advantage)을 모든 섹션에 적용하세요.
단점을 지적하지 말고 **"잘못 쓰인 강점"**으로 재해석하세요.

**[pastInference 작성 템플릿]**
"당신의 사주를 보니 [구체적 글자/오행]이 이렇게 배치되어 있군요. 이건 마치 [생생한 비유]와 같습니다. 그래서 과거에 [구체적 상황]을 겪었을 텐데, 이건 당신의 잘못이 아닙니다. 이 기질을 [맞는 환경]에 놓으면 엄청난 자산이 됩니다."
이 템플릿을 참고하되, 3개 리포트의 공통 맥락을 녹여 800자 이상 풍성하게 작성하세요.
모든 특수살을 빠짐없이 설명하고, 살 간의 화학적 결합(시너지/충돌)을 분석하세요.

**[필수 지침]**
1. **키워드 나열 금지:** "결단력, 창의성, 리더십"처럼 단어를 기계적으로 연결하지 마세요. 이야기의 흐름 속에 자연스럽게 녹이세요.
2. **소름 돋는 디테일:** "책상 위", "새벽의 고민", "대화 중 말꼬리" 등 구체적 정황을 묘사하되, 3개 리포트 중 2개 이상이 동의하는 맥락에서만.
3. **bottleneck은 에너지 낭비:** 구체적 습관/회피 반응으로 지적. 사주 구성에서 원인을 찾아 인과관계로 설명.
4. **loveAdvice:** 결혼을 강요하지 말고 에너지가 가장 잘 보존되는 관계 형태를 추천. 명확한 스탠스 필수.
5. **모든 섹션에서 인과관계(Why → How)의 흐름 유지.**

공통 키워드: [${commonKeywords.join(", ")}]

**[분석가 A]**
${JSON.stringify(report1, null, 2)}

**[분석가 B]**
${JSON.stringify(report2, null, 2)}

**[분석가 C]**
${JSON.stringify(report3, null, 2)}

위 3개를 교차 검증하여 **최종 종합 리포트**를 작성하세요. 원본보다 반드시 더 길고 깊이 있게, **스토리텔링** 톤으로 작성하세요.

**[JSON 출력]**
{
  "coreEnergy": "사용자의 모순을 관통하는 한 줄 은유 (예: 폭주기관차 같은 햄릿)",
  "coherenceScore": 70~95,
  "keywords": ["공통키워드1", "공통키워드2", "공통키워드3", "공통키워드4", "공통키워드5"],
  "pastInference": "1000자 이상. 사주/자미두수/별자리 세 시스템이 하나의 서사로 수렴되는 스토리텔링. 모든 특수살의 화학적 결합 + 자미두수 성진 확인 + 별자리 원소 확인사살 구조. (12~18문장)",
  "currentState": "500자 이상. 기운의 결합이 만드는 구체적 갈등을 양자택일 형태로 제시. 대운/세운 흐름 연결. 읽는 사람이 '이걸 어떻게 알지?' 느끼게. (7~10문장)",
  "bottleneck": "500자 이상. 한 문장 핵심 진단으로 시작. 사주 구성에서 원인 추적 + 대운/세운 충돌이 가속화하는 구조 설명. 마지막은 은유로 압축. (6~9문장)",
  "solution": "800자 이상. 볼드 제목 + 설명 구조의 5~6개 구체적 행동 항목. 에너지 방향, 재물 전략, 고독 관리, 대운 활용, 파트너십, 용신 개운법 포함. 카타르시스 필수. (15~20문장)",
  "businessAdvice": "300자 이상. 타고난 그릇을 돈으로 바꾸는 전략. 4단계 화술 적용 (5~7문장)",
  "loveAdvice": "300자 이상. 재성/관성/신살 기반 최적의 관계 형태 제안. 명확한 스탠스 필수 (5~7문장)",
  "healthAdvice": "300자 이상. 오행/질액궁 기반 건강 전략 스토리텔링 (5~7문장)"
}
`;

    const synthesisResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: `당신은 3개의 독립 분석 리포트를 교차 검증하여 최종 종합 리포트를 작성하는 스토리텔러입니다.

[최우선 원칙 — 문체]
당신은 정장을 입은 영매입니다. 차분하고 단정한 존댓말(~습니다, ~입니다, ~겁니다)을 쓰되, 내용은 칼처럼 날카롭고 소름 끼치게 정확합니다.
- 짧은 문장과 긴 문장의 리듬을 교차하세요.
- "~할 수 있습니다", "~경향이 있습니다" 같은 약한 표현 금지. 단정적으로 서술하세요.
- 키워드를 기계적으로 나열하지 마세요. 인과관계(Why→How)의 흐름으로 이야기하세요.
- 사주/자미두수/별자리 세 시스템이 하나의 이야기로 수렴되는 전율을 전달하세요.

[교차검증 원칙]
- 2개 이상 일치하는 "맥락"을 채택하세요. 단, 가장 날카롭고 구체적인 표현을 선택하세요.
- 3개 리포트 중 가장 밋밋한 표현을 버리고, 가장 임팩트 있는 표현을 살리세요.
- 종합할 때 단순 요약하지 말고, 공통 맥락을 더 깊이 파고들어 확장하세요.
- 사용자 이름 사용 절대 금지. 반드시 "당신"으로만 지칭.` },
        { role: "user", content: synthesisPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.55,
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
      solution: "잠시 후 다시 시도해주세요.",
      loveAdvice: null,
      healthAdvice: null
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

  const toneRules = `
**[톤 & 어조 규칙 - 매우 중요]**
- **균형 잡힌 분석가의 톤:** 과도하게 들뜨거나 흥분하지 마세요. "엄청난!", "놀라운!", "대박!" 같은 과장 표현 금지.
- **좋은 점과 주의할 점을 반드시 함께** 서술하세요. 모든 섹션에서 기회(+)와 리스크(-)를 균형 있게 다루세요.
- **과도한 응원/아부 금지:** 철학관 선생님처럼 담담하고 신뢰감 있게. 근거 없는 장밋빛 전망 금지.
`;

  const monthlyFlowFormat = `
**[monthlyFlow 작성 규칙]**
- 반드시 1~12월 전체 작성
- 각 월 **"O월은 OO(간지)의 기운입니다."**로 시작
- 각 월별 **최소 3문장** 이상
- 점수 0~100, 매달 장단점 균형
- **[출력 형식 (JSON)]**
{
  "summary": "300자 이상의 총평 (기회와 리스크 균형)",
  "keywords": ["키워드1", "키워드2", "키워드3"],
  "monthlyFlow": [
    {"month": 1, "score": 85, "keyword": "키워드", "summary": "1월은 ... (3문장 이상)"},
    ...12개월
  ]
}`;

  const daeunInfo = sc.daeun
    ? sc.daeun.slice(0, 6).map((d: any) => `${d.age}세(${d.year}년): ${d.stem}${d.branch}(${d.stemHanja}${d.branchHanja})`).join("\n  ")
    : "대운 데이터 없음";

  const sajuDataBlock = `
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
■ 대운 흐름 (10년 단위):
  ${daeunInfo}`;

  const ziweiDataBlock = `
■ 명궁(命宮): ${zw.lifePalace}궁
■ 국(局): ${zw.bureau?.name} — ${zw.bureau?.desc}
■ 명궁 주성: ${zw.stars?.life?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}
■ 부처궁 성진: ${zw.stars?.spouse?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}
■ 재백궁 성진: ${zw.stars?.wealth?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}
■ 천이궁 성진: ${zw.stars?.travel?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}
■ 관록궁 성진: ${zw.stars?.career?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}
■ 질액궁 성진: ${zw.stars?.health?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}`;

  const zodiacDataBlock = `
■ 별자리: ${data.zodiac.sign}
■ 원소: ${data.zodiac.info.element || ""}
■ 수호성: ${data.zodiac.info.ruling || ""}
■ 특징: ${data.zodiac.info.traits?.join(", ") || data.zodiac.sign}`;

  const sajuPrompt = `당신은 60년 경력의 정통 명리학 대가입니다. **오직 사주팔자(四柱八字) 명리학만** 사용하여 ${data.year}년(병오년) 운세를 분석하세요.
다른 체계(자미두수, 별자리)는 절대 참조하지 마세요. 순수 명리학적 관점으로만 분석합니다.
${toneRules}

[분석 방법]
1. ${data.year}년 세운(병오)이 일주(${sc.dayPillar?.stemHanja}${sc.dayPillar?.branchHanja})와 맺는 합/충/형/파/해 관계 분석
2. 대운과 세운의 상호작용 분석 (대운이 바뀌는 해인지, 현재 대운이 세운과 어떤 관계인지)
3. 용신(${sc.yongShin?.elementHanja})이 올해 힘을 받는지/극을 당하는지
4. 십성 관점에서 올해 재성/관성/식상/인성의 흐름
5. 월별 흐름은 각 월의 간지와 일주의 관계로 분석

${monthlyFlowFormat}`;

  const ziweiPrompt = `당신은 자미두수(紫微斗數) 전문 명리가입니다. **오직 자미두수 체계만** 사용하여 ${data.year}년 운세를 분석하세요.
다른 체계(사주팔자, 별자리)는 절대 참조하지 마세요. 순수 자미두수적 관점으로만 분석합니다.
${toneRules}

[분석 방법]
1. 명궁(${zw.lifePalace}궁)의 주성 배치가 ${data.year}년 유년(流年)에 미치는 영향
2. 재백궁/관록궁 성진의 올해 작용력 (사업/재물 관련)
3. 부처궁 성진의 올해 작용력 (인간관계/연애)
4. 질액궁 성진의 올해 작용력 (건강)
5. 천이궁 성진의 올해 변동 (이동/변화)
6. 월별 흐름은 유월(流月) 성진의 이동에 따라 분석 (각 궁의 성진이 순행하는 월별 변화)

${monthlyFlowFormat}`;

  const zodiacPrompt = `당신은 서양 점성술(Astrology) 전문가입니다. **오직 서양 점성술 체계만** 사용하여 ${data.year}년 운세를 분석하세요.
다른 체계(사주팔자, 자미두수)는 절대 참조하지 마세요. 순수 점성술적 관점으로만 분석합니다.
${toneRules}

[분석 방법]
1. ${data.zodiac.sign}자리의 ${data.year}년 주요 행성 트랜짓 (목성, 토성, 천왕성 등)
2. 수호성(${data.zodiac.info.ruling || ""})의 올해 위치와 영향
3. 원소(${data.zodiac.info.element || ""})와 올해 에너지의 조화/충돌
4. 월별 흐름은 태양, 달, 수성, 금성, 화성의 이동에 따른 트랜짓 분석
5. 레트로그레이드(역행) 시기의 영향도 반영

[점성술 용어 순화 규칙]
- 점성술 전문 용어(Trine, Square, Semi-sextile, Conjunction, Opposition 등)를 절대 그대로 쓰지 마세요.
- 대신 그 각도가 의미하는 **운의 흐름**으로 번역하세요: "아주 좋은 흐름", "약간 긴장된 기운", "조화로운 만남", "대립의 에너지" 등.
- "세미섹스타일", "트라인", "스퀘어" 같은 영어/외래어 용어 사용 금지.

${monthlyFlowFormat}`;

  try {
    console.log(`[Yearly] ${data.year}년 운세 생성 시작 (3체계 독립 분석)...`);

    const generateSaju = async () => {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: sajuPrompt },
          { role: "user", content: `${data.year}년 사주팔자 분석. 사용자 이름을 절대 사용하지 말고 "당신"으로만 지칭하세요.\n\n${sajuDataBlock}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.85,
      });
      console.log(`[Yearly] 사주팔자 독립 분석 완료`);
      return JSON.parse(response.choices[0].message.content || "{}");
    };

    const generateZiwei = async () => {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: ziweiPrompt },
          { role: "user", content: `${data.year}년 자미두수 분석. 사용자 이름을 절대 사용하지 말고 "당신"으로만 지칭하세요.\n\n${ziweiDataBlock}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.9,
      });
      console.log(`[Yearly] 자미두수 독립 분석 완료`);
      return JSON.parse(response.choices[0].message.content || "{}");
    };

    const generateZodiac = async () => {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: zodiacPrompt },
          { role: "user", content: `${data.year}년 별자리 운세 분석. 사용자 이름을 절대 사용하지 말고 "당신"으로만 지칭하세요.\n\n${zodiacDataBlock}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.9,
      });
      console.log(`[Yearly] 별자리 독립 분석 완료`);
      return JSON.parse(response.choices[0].message.content || "{}");
    };

    const yearlyResults = await Promise.allSettled([
      generateSaju(),
      generateZiwei(),
      generateZodiac(),
    ]);

    const sajuReport = yearlyResults[0].status === "fulfilled" ? yearlyResults[0].value : null;
    const ziweiReport = yearlyResults[1].status === "fulfilled" ? yearlyResults[1].value : null;
    const zodiacReport = yearlyResults[2].status === "fulfilled" ? yearlyResults[2].value : null;

    const yearlySuccess: string[] = [];
    const yearlyFailed: string[] = [];
    if (sajuReport) yearlySuccess.push("사주"); else yearlyFailed.push("사주");
    if (ziweiReport) yearlySuccess.push("자미두수"); else yearlyFailed.push("자미두수");
    if (zodiacReport) yearlySuccess.push("별자리"); else yearlyFailed.push("별자리");

    if (yearlySuccess.length === 0) {
      throw new Error("모든 연간 운세 체계 분석에 실패했습니다.");
    }

    if (yearlyFailed.length > 0) {
      console.warn(`[Yearly] 부분 성공: ${yearlySuccess.join("+")} 성공, ${yearlyFailed.join("+")} 실패 — 부분 결과로 진행`);
    }

    const sajuFallback = { summary: "분석 대기 중", keywords: [], monthlyFlow: [] };
    const ziweiFallbackY = { summary: "분석 대기 중", keywords: [], monthlyFlow: [] };
    const zodiacFallbackY = { summary: "분석 대기 중", keywords: [], monthlyFlow: [] };

    const safeSaju = sajuReport || sajuFallback;
    const safeZiwei = ziweiReport || ziweiFallbackY;
    const safeZodiac = zodiacReport || zodiacFallbackY;

    console.log(`[Yearly] ${yearlySuccess.length}/3 체계 독립 분석 완료. 가디언 교차 검증 종합 시작...`);

    const allKeywords = [
      ...(safeSaju.keywords || []),
      ...(safeZiwei.keywords || []),
      ...(safeZodiac.keywords || []),
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
    [safeSaju, safeZiwei, safeZodiac].forEach((r) => {
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
당신은 '운명 데이터 융합 전문가'이자 최종 검증관입니다.
동양의 명리학(사주팔자), 동양의 자미두수(紫微斗數), 서양의 점성술(별자리) — 3개의 **완전히 독립된 체계**로 분석한 결과를 교차 검증하여 종합합니다.

**[종합 원칙]**
1. **3체계 교차 검증:** 2개 이상의 체계에서 공통적으로 언급하는 내용만 채택하세요. 1개 체계에서만 독자적으로 주장한 내용은 제거합니다.
2. **대운 강조:** 사주 분석의 대운 흐름을 overallSummary 맨 앞에 배치하세요.
3. **분량:**
   - overallSummary: 1000자 내외 (3체계가 공통으로 가리키는 핵심 메시지 중심)
   - business/love/health: 각 500자 내외
   - monthlyFlow: 각 월별 3문장 이상, 3체계 점수 평균 사용
4. 월별 점수는 3체계 평균: ${avgMonthlyScores.map(m => `${m.month}월=${m.avgScore}점`).join(", ")}
5. 공통 키워드: [${commonKeywords.join(", ")}]
6. 월별 summary는 **"O월은 OO(간지)의 기운입니다."**로 시작
7. 각 체계의 고유한 강점을 살려 종합하되, 모순되는 부분은 명확히 밝히세요.

${yearlyFailed.length > 0 ? `\n[참고: ${yearlyFailed.join(", ")} 분석이 일시적으로 불가하여 ${yearlySuccess.join(", ")} 기반으로 분석합니다.]\n` : ""}
**[사주팔자 분석 결과]**
${sajuReport ? JSON.stringify(sajuReport, null, 2) : "(분석 실패 — 이 체계 결과 없이 나머지 체계 기반으로 종합하세요)"}

**[자미두수 분석 결과]**
${ziweiReport ? JSON.stringify(ziweiReport, null, 2) : "(분석 실패 — 이 체계 결과 없이 나머지 체계 기반으로 종합하세요)"}

**[별자리 분석 결과]**
${zodiacReport ? JSON.stringify(zodiacReport, null, 2) : "(분석 실패 — 이 체계 결과 없이 나머지 체계 기반으로 종합하세요)"}

**[출력 형식 (JSON)]**
{
  "overallSummary": "3체계 교차 검증 기반 1000자 분량의 심층 총평",
  "coherenceScore": 70~95,
  "businessFortune": "500자 이상 사업/재물 전략 (3체계 종합)",
  "loveFortune": "500자 이상 연애/인간관계 조언 (3체계 종합)",
  "healthFortune": "500자 이상 건강 관리법 (3체계 종합)",
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
        { role: "system", content: "당신은 균형 잡힌 시각의 운세 에디터입니다. 사주팔자, 자미두수, 별자리 3체계를 교차 검증하여 종합합니다. 과도한 긍정이나 흥분은 금지. 기회와 리스크를 항상 함께 서술하세요." },
        { role: "user", content: synthesisPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.35,
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

    const monthlyFlowSchema = z.array(z.object({
      month: z.number().int().min(1).max(12),
      score: z.number().min(0).max(100),
      keyword: z.string(),
      summary: z.string(),
    }));

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
        month: m.month, score: m.avgScore, keyword: "분석", summary: "데이터 종합 중"
      }));
    }

    const parseSingleFlow = (report: any) => {
      const flow = monthlyFlowSchema.safeParse(report.monthlyFlow);
      return {
        summary: report.summary || report.overallSummary || "",
        monthlyFlow: flow.success ? flow.data : (report.monthlyFlow || []),
      };
    };

    const emptyFlow = { summary: "", monthlyFlow: [] };
    const sajuParsed = sajuReport ? parseSingleFlow(sajuReport) : emptyFlow;
    const ziweiParsed = ziweiReport ? parseSingleFlow(ziweiReport) : emptyFlow;
    const zodiacParsed = zodiacReport ? parseSingleFlow(zodiacReport) : emptyFlow;

    console.log(`[Yearly] ${data.year}년 운세 3체계 교차 검증 완료. 일치도: ${finalResult.coherenceScore}%`);

    return {
      ...finalResult,
      sajuMonthlyFlow: sajuParsed.monthlyFlow,
      sajuSummary: sajuParsed.summary,
      ziweiMonthlyFlow: ziweiParsed.monthlyFlow,
      ziweiSummary: ziweiParsed.summary,
      zodiacMonthlyFlow: zodiacParsed.monthlyFlow,
      zodiacSummary: zodiacParsed.summary,
    };
  } catch (e) {
    console.error("Yearly Fortune Generation Error:", e);
    const emptyFlow = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1, score: 50, keyword: "대기", summary: "분석 대기 중"
    }));
    return {
      overallSummary: "운세 데이터를 분석하는 중 문제가 발생했습니다.",
      coherenceScore: 50,
      businessFortune: "잠시 후 다시 시도해주세요.",
      loveFortune: "잠시 후 다시 시도해주세요.",
      healthFortune: "잠시 후 다시 시도해주세요.",
      keywords: ["분석", "대기"],
      monthlyFlow: emptyFlow,
      sajuMonthlyFlow: emptyFlow,
      sajuSummary: "분석 대기 중",
      ziweiMonthlyFlow: emptyFlow,
      ziweiSummary: "분석 대기 중",
      zodiacMonthlyFlow: emptyFlow,
      zodiacSummary: "분석 대기 중",
    };
  }
}