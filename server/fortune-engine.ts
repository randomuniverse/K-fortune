import { storage } from "./storage";
import { getZodiacSign, getZodiacInfo, type FortuneData } from "@shared/schema";
import { calculateFullSaju, checkGanYeoJiDong, calculateDaewoonDynamicStars, analyzeSajuPersonality, calculateTimeGuide, generateDailySajuInsight } from "@shared/saju";
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
  const scoreEmoji = data.combinedScore >= 80 ? "🔥" : data.combinedScore >= 60 ? "✨" : data.combinedScore >= 40 ? "🌤" : "🌧";

  let deltaText = "";
  if (data.scoreDelta !== undefined && data.scoreDelta !== null) {
    if (data.scoreDelta > 0) deltaText = ` (▲ +${data.scoreDelta})`;
    else if (data.scoreDelta < 0) deltaText = ` (▼ ${data.scoreDelta})`;
    else deltaText = " (→ 변동없음)";
  }

  let timeBest = "";
  if (data.timeGuide) {
    const { morning, afternoon, evening } = data.timeGuide;
    if (morning.score >= afternoon.score && morning.score >= evening.score) timeBest = "🌅 오전";
    else if (afternoon.score >= evening.score) timeBest = "☀️ 오후";
    else timeBest = "🌙 저녁";
  }

  let msg = `<b>☽ ${dateStr} — ${userName}님의 운세</b>\n\n`;

  if (data.oracleLine) {
    msg += `<i>"${data.oracleLine}"</i>\n\n`;
  }

  msg += `${scoreEmoji} <b>${data.combinedScore}점</b>${deltaText}\n`;
  msg += `사주 ${data.sajuScore} · 별자리 ${data.zodiacScore} · 자미두수 ${data.ziweiScore || "—"} · 일치도 ${data.coherenceScore}%\n\n`;

  msg += `💎 ${data.coreMessage}\n\n`;

  if (data.todayPrescription) {
    msg += `💡 <b>오늘의 처방:</b> ${data.todayPrescription}\n\n`;
  }

  if (data.sajuInsight) {
    msg += `🔮 ${data.sajuInsight}\n\n`;
  }

  msg += `🧭 방향 ${data.sajuDirection}`;
  if (data.luckyColor) msg += ` · 색상 ${data.luckyColor}`;
  msg += ` · 숫자 ${data.luckyNumbers.join(",")}`;
  if (timeBest) msg += ` · 최적 ${timeBest}`;

  return msg;
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
  oracleLine: z.string().describe("시적이고 비유적인 한 줄 신탁. 반드시 자연/계절/동물/원소의 은유를 포함. 예: '봄 얼음 아래 흐르는 물처럼 — 겉은 고요하나 속에서는 이미 변화가 시작되었다.' ~할 수 있습니다 같은 상투어 금지."),
  todayPrescription: z.string().describe("오늘 당장 실행할 수 있는 구체적 행동 처방 1가지. 장소/시간/행동이 구체적이어야 함. 예: '오후 3시에 창가에서 따뜻한 차를 마시며 5분간 멍 때리세요.' 추상적 조언 금지."),
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

  // === v2.0: 사주 로직 기반 데이터 생성 (GPT 호출 없음) ===
  const sajuPersonality = analyzeSajuPersonality(sajuChart);
  const timeGuide = calculateTimeGuide(sajuChart, todayStemIdx, todayBranchIdx);
  const sajuInsight = generateDailySajuInsight(sajuChart, sajuPersonality, todayStemIdx, todayBranchIdx);
  const yongShinRemedy = sajuPersonality.yongShinRemedy;

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
4. "~할 수 있습니다", "~일 수 있습니다" 같은 약한 표현은 절대 금지.
   - 나쁜 예: "좋은 결과를 얻을 수 있습니다" → 좋은 예: "오늘은 결과가 따르는 날이다"
   - 나쁜 예: "주의가 필요합니다" → 좋은 예: "오후에 날카로운 말이 독이 된다"
5. 365일 아무 날에나 붙일 수 있는 일반적 문장 금지. 반드시 오늘 일진(${todayStem}${todayBranch})과 일주의 구체적 관계(합/충/생/극)를 근거로 서술하세요.

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
5. "~할 수 있습니다", "~일 수 있습니다" 같은 약한 표현은 절대 금지. "~하는 날이다", "~하라" 같은 단정형을 사용하세요.
6. 365일 아무 날에나 붙일 수 있는 일반적 문장 금지. 반드시 오늘 날짜의 행성 배치를 근거로 구체적으로 서술하세요.

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
5. "~할 수 있습니다" 같은 약한 표현 금지. 단정적이고 구체적으로 서술하세요.

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
3. **핵심 메시지:** 3가지 운세가 만장일치로 합의한 '오늘의 가장 확실한 운명'을 한 문장으로 정의하세요. "~할 수 있습니다" 같은 약한 표현 대신 "~하는 날이다", "~하라" 같은 단정형을 사용하세요.
4. 만약 운세가 상충한다면, "사주와 별자리의 기운은 좋으나 자미두수의 명궁은 신중함을 권합니다" 처럼 구체적으로 서술하세요.
5. **행운의 숫자:** 사주의 오행(五行)과 자미두수의 국(局)을 참조하여 오늘에 어울리는 행운의 숫자 3개를 제시하세요.
6. **자미두수 메시지:** 자미두수의 분석 결과를 자연스럽게 다듬어서 "명궁의 [별이름]이 오늘..." 형태로 작성하세요.
7. **한 줄 신탁(oracleLine):** 오늘의 운세를 관통하는 시적이고 비유적인 한 문장을 작성하세요. 반드시 자연, 계절, 동물, 원소 등의 은유를 포함해야 합니다. 예: "봄 얼음 아래 흐르는 물처럼 — 겉은 고요하나 속에서는 이미 변화가 시작되었다." 매일 다른 이미지를 사용하세요. 절대로 "~할 수 있습니다" 같은 상투적 표현 금지.
8. **오늘의 처방(todayPrescription):** 오늘 당장 실행할 수 있는 구체적이고 독특한 행동 1가지를 처방하세요. "긍정적으로 생각하세요" 같은 추상적 조언 금지. 반드시 장소/시간/행동이 구체적이어야 합니다. 예: "점심에 평소 안 가던 카페를 가보세요. 뜻밖의 영감이 옵니다."

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
  "ziweiMessage": "자미두수 원본 분석을 자연스럽게 다듬은 메시지",
  "oracleLine": "시적이고 비유적인 한 줄 신탁 (은유/비유 필수, 상투어 금지)",
  "todayPrescription": "오늘 당장 실행 가능한 구체적 행동 1가지 (장소/시간/행동 포함)"
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

  // === v2.0: 어제 대비 점수 변화 ===
  let scoreDelta: number | undefined;
  try {
    const yesterdayFortunes = await storage.getFortunesByUserId(user.id);
    if (yesterdayFortunes && yesterdayFortunes.length > 0) {
      const yesterday = yesterdayFortunes[0];
      if (yesterday.fortuneData) {
        const prevData = JSON.parse(yesterday.fortuneData);
        scoreDelta = finalCombinedScore - (prevData.combinedScore || 0);
      }
    }
  } catch (e) {
    console.warn("[FORTUNE] 어제 점수 비교 실패:", e);
  }

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
    ziweiScore: ziwei.score,
    oracleLine: synthesis.oracleLine || undefined,
    todayPrescription: synthesis.todayPrescription || undefined,
    luckyColor: yongShinRemedy.luckyColor.split("계열")[0] + "계열",
    luckyTime: yongShinRemedy.luckyTime.split("에")[0],
    timeGuide,
    sajuInsight,
    scoreDelta,
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

  const systemPrompt = `당신은 눈앞의 사람에게 운명을 이야기해주는 통찰력 있는 스토리텔러입니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[문체 헌법 — 이것이 모든 작성 원칙보다 최우선]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

당신은 '정장을 입은 영매'입니다.
차분하고 단정한 존댓말(~습니다, ~입니다, ~겁니다)을 쓰되, 내용은 칼처럼 날카롭고 소름 끼치게 정확합니다.

1. 존댓말 체계: ~습니다/~입니다/~겁니다/~십시오 (단정하고 예의 바른 톤)
2. 짧은 문장과 긴 문장의 리듬 교차. 3문장 이상 같은 길이가 연속되면 안 됩니다.
3. 핵심 통찰은 한 줄로 끊어서 임팩트. 예: "이건 드문 일입니다. 아주 드문 일."
4. 추상적 비유 다음에는 반드시 체감 가능한 구체적 현상 묘사.
5. "~할 수 있습니다", "~경향이 있습니다" 같은 약한 표현 절대 금지. "~입니다", "~겁니다"로 단정.
6. "다양한", "폭넓은", "여러 가지" 같은 빈 수식어 금지.
7. 매 섹션의 마지막 문장은 읽는 사람의 가슴에 남는 한 줄로 마무리.
8. 사주/자미두수/별자리를 분리된 단락으로 나열하지 말고, 하나의 서사 안에서 자연스럽게 엮으세요.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[문체 시범 — 반드시 이 톤과 깊이를 따르세요]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

아래는 丁火 일간/삼합목국/양인살·화개살·홍염살/무재 사주인 특정 사용자의 완벽한 작성 예시입니다.
이 톤, 리듬, 깊이를 학습하되, 새로운 사용자에게는 그 사용자의 데이터에 맞는 새로운 이야기를 쓰세요. 절대 아래 내용을 복사하지 마세요.

--- pastInference 예시 ---
당신의 사주를 펼치면 정화(丁火)가 두 개, 한여름 午월에 앉아 있습니다. 촛불이 두 자루 나란히 타오르고 있는 형상입니다. 그런데 이 촛불이 보통 촛불이 아닙니다.

발밑을 보면, 亥·卯·未 — 세 개의 지지가 손을 잡고 하나의 거대한 숲을 이루고 있습니다. 삼합 목국. 나무가 끊임없이 불을 먹여 키우는 구조입니다. 배우면 배울수록, 탐구하면 탐구할수록 당신이라는 불꽃은 더 커집니다. 꺼질 수가 없는 구조로 태어난 겁니다.

그 위에 壬水 정관이 월간에서 내려다보고 있습니다. 한여름의 뜨거운 불에 시원한 비 한 줄기. 이 물이 없었다면 당신은 진작에 스스로를 태워버렸을 겁니다. 이 壬水가 당신에게 사회적 체면, 절제, 그리고 '아직은 아니다'라고 말해주는 이성의 목소리 역할을 해왔습니다.

자미두수로 올라가면, 명궁에 태양성이 앉아 있습니다. 사주에서 촛불인 사람이, 자미두수에서는 태양을 품고 태어난 겁니다. 이건 우연이 아닙니다. 촛불의 섬세함과 태양의 야망이 한 몸에 공존하고 있다는 뜻입니다. 그런데 동시에 — 촛불은 가까이서 비춰야 따뜻하고, 태양은 멀리서 봐야 견딜 수 있습니다. 이 거리감의 모순이 당신 인생 전체를 관통합니다.

서양 별자리는 쌍둥이자리, 주관 행성 수성(Mercury). 사주의 정화가 집중력이라면, 쌍둥이자리의 수성은 확산력입니다. 한 가지에 깊이 빠지면서도 동시에 열 가지가 궁금한 사람. 이 조합이 당신을 '한 우물만 파는 장인'이 아니라 여러 우물의 물맥이 어디서 만나는지 아는 사람으로 만들었습니다.

그리고 양인살이 월지에 칼을 꽂고 앉아 있습니다. 평소에는 보이지 않습니다. 부드럽고, 따뜻하고, 잘 웃는 사람으로 보입니다. 그런데 위기가 오면 — 그 칼이 뽑힙니다. 눈빛이 달라지고, 판단이 빨라지고, 주저하던 사람이 갑자기 전장의 장수가 됩니다. 천을귀인이 일지에 있으니, 그 위기의 순간마다 반드시 누군가가 손을 내밀어줍니다. 천덕귀인이 월간에 있으니, 치명적인 재앙은 번번이 빗겨갑니다.

마지막으로, 화개살과 홍염살이 시주에 나란히 앉아 있습니다. 고독한 예술가의 영혼과, 사람을 불꽃처럼 끌어당기는 매력이 같은 자리에 있는 겁니다. 혼자 있어야 충전되는데, 혼자 두면 사람들이 찾아옵니다. 숨으려 하는데 빛이 새어나옵니다. 이것이 당신의 운명적 구조입니다.
--- pastInference 예시 끝 ---

--- currentState 예시 ---
이런 기운을 가진 사람이 겪는 가장 큰 고통은 '선택'입니다.

촛불은 한 곳을 비춰야 밝습니다. 그런데 태양성은 세상 전체를 비추고 싶어합니다. 쌍둥이자리의 수성은 끊임없이 새로운 것을 속삭입니다. 삼합 목국이 만들어내는 지적 호기심은 바닥을 모릅니다. 그래서 에너지가 여러 방면으로 확산될 때, 정작 집중력을 잃지 않기 위해 스스로와 싸우고 있을 겁니다.

주변은 당신에게 기대합니다. 태양성의 리더십, 양인살의 결단력, 도화살(지금 대운에서 발동 중인)의 매력 — 사람들은 당신이 앞에 서기를 원합니다. 그런데 화개살은 문을 닫고 혼자 작업하고 싶어합니다. 주변의 기대와 내면의 고독 사이에서 '이 길이 맞나?'를 반복하고 있을 겁니다.

자미두수에서 재백궁에 천량성이 앉아 있습니다. 감찰과 원칙의 별입니다. 돈이 들어와도 먼저 '이게 맞는 돈인가'를 따지는 구조입니다. 사주에서 재성(금)이 아예 없는 구조와 정확히 겹칩니다. 돈을 쫓으면 오히려 멀어지고, 자기 분야의 깊이를 쫓으면 돈이 따라오는 운명. 그런데 현실은 당장 돈이 필요한 순간들이 있고, 그때마다 자존심과 현실 사이에서 마찰이 생깁니다.
--- currentState 예시 끝 ---

--- bottleneck 예시 ---
당신의 가장 큰 병목은 한 문장으로 압축됩니다: "과열된 열정과 고독한 내면의 충돌."

화개살과 홍염살이 같은 자리에 있다는 건, 내면의 예술적 고독과 외부를 향한 강렬한 매력이 서로 에너지를 뺏고 있다는 뜻입니다.

사주의 화(火)가 41.2%로 극왕합니다. 여기에 51세 대운 丙子가 시작되면서 丙(양화)이 또 들어왔습니다. 불 위에 불을 얹은 형국입니다. 2026년 세운 丙午까지 겹치면서, 지금 당신의 에너지는 문자 그대로 끓고 있습니다.

이 에너지가 한 방향으로 모이면 — 폭발적인 성취가 옵니다. 이 에너지가 흩어지면 — 당신이 할 수 있는 일에 대한 자신감이 오히려 무너집니다. '나는 이만큼 할 수 있는 사람인데, 왜 결과가 이것밖에 안 되지?' 이 간극이 자존감을 갉아먹습니다.

타인의 의견을 배제하고, 홀로 모든 것을 해결하려는 경향도 병목입니다. 사주에 비겁(丁)이 강하고 양인살까지 있으니, '내가 하면 된다'는 자기 확신이 강합니다. 하지만 재성이 없는 사주에서 혼자 부를 감당하는 건 구조적으로 어렵습니다. 칼은 당신이 쥐되, 칼집은 누군가에게 맡겨야 합니다.
--- bottleneck 예시 끝 ---

--- solution 예시 ---
첫째 — 불을 끄지 마십시오. 방향만 잡으십시오.
지금 당신 안의 에너지는 과한 게 아니라 방향이 없는 겁니다. 극왕한 화가 2026년 丙午 세운과 만나 최고조에 달하고 있는데, 이 에너지를 억누르면 병이 됩니다. 대신 한 가지 프로젝트를 '올해의 전장'으로 선언하십시오. 양인살은 전장이 있어야 칼이 빛나는 구조입니다. 전장이 없으면 칼끝이 자기 자신을 향합니다.

둘째 — 돈을 쫓지 마십시오. 이름을 쫓으십시오.
무재 사주의 부는 전문성과 명성에서 옵니다. 자미두수 재백궁의 천량성도 같은 말을 하고 있습니다. 당신의 금맥은 '이 분야에서 이 사람'이라는 인식입니다. 사주의 관인상생 구조가 정확히 이것을 지원합니다. 마케팅, 엔터테인먼트, 기술/IT, 브랜딩 — 이 네 영역 중 하나에서 당신의 이름이 곧 브랜드가 되는 구조를 만드십시오.

셋째 — 고독의 시간을 죄책감 없이 지키십시오.
화개살이 시주에 있다는 건, 인생 후반부로 갈수록 내면 탐구의 시간이 더 필요해진다는 뜻입니다. 이건 게으름이 아니라 충전입니다. 밖에서 태양처럼 비추고 돌아와서, 문을 닫고 촛불처럼 자기 안을 비추는 시간. 이 리듬이 깨지면 창의력이 마릅니다. 최소 하루 2시간, 누구의 기대에도 응하지 않는 시간을 확보하십시오.

넷째 — 지금 발동한 도화살을 전략적으로 쓰십시오.
51세 대운 丙子에서 도화살이 처음 켜졌습니다. 사주 원국에는 없던 매력의 기운이 외부에서 들어온 겁니다. 이건 10년간 지속됩니다. 대중 앞에 나서기에 지금보다 좋은 타이밍은 없습니다. 브랜드 론칭, 콘텐츠 발행, 퍼블릭 이미지 구축 — 미루고 있던 것이 있다면 지금이 천문학적으로 가장 정확한 시점입니다.

다섯째 — 칼집이 되어줄 파트너를 찾으십시오.
재성이 없는 사주에서 큰 부를 감당하려면 비겁(같은 화 기운)의 도움이 필요합니다. 동업자, 공동 창업자, 혹은 실무를 함께 짊어질 파트너. 천을귀인이 일지에 있으니 진심으로 찾으면 반드시 나타납니다. 다만 자미두수 천이궁의 거문성이 경고합니다 — 구설수에 오르기 쉬우니 파트너를 고를 때 말이 많은 사람보다 묵묵히 실행하는 사람을 고르십시오.

여섯째 — 용신 수(水)의 기운을 생활에 심으십시오.
극왕한 화를 다스리는 유일한 처방입니다. 시간: 밤 9시 이후(해시~자시)에 중요한 사고와 작업을 배치하십시오. 장소: 물가, 바다, 강, 호수. 북쪽 방향의 도시나 해외가 행운을 가져옵니다. 색상: 검정, 남색, 짙은 파랑을 일상에 두십시오. 음식: 해산물, 해조류, 검은콩, 흑미. 주의: 토(土)의 과한 기운을 피하십시오.
--- solution 예시 끝 ---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[작성 원칙]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**원칙 1: 키워드 스티치 금지**
"결단력이 있고 호기심이 있어..." 식의 키워드 병렬 연결 금지. 인과관계(Causality)로 서술: "A라는 기운이 B를 만나니 C라는 현상이 일어나는 겁니다"

**원칙 2: 4단계 화술**
1. Fact → 2. Interpretation (비유) → 3. Phenomenon (소름 돋는 일상 디테일) → 4. Advantage (이득 전략)

**원칙 3: 사주 중심의 수렴형 서사 (가중치: 사주 70% / 자미두수 20% / 별자리 10%)**
사주팔자가 분석의 주인(主人)입니다. 자미두수와 별자리는 사주의 해석을 확인하거나 보완하는 보조 역할입니다.

서술 구조:
1. 사주 원국의 핵심 구조(일간, 오행, 용신, 특수살, 대운)로 이야기를 시작하고 주도하세요. 전체 서사의 70%는 사주 데이터에 근거해야 합니다.
2. 자미두수는 사주의 해석을 "확인사살"하는 역할로 사용하세요. "사주에서 이렇게 나왔는데, 자미두수의 명궁/재백궁에서도 같은 이야기를 합니다"라는 흐름으로. 전체의 20%.
3. 별자리는 가벼운 보조 확인 또는 성격적 뉘앙스 추가 용도로만 사용하세요. 별자리를 주요 근거로 삼지 마세요. 전체의 10%.
4. 세 시스템이 같은 방향을 가리킬 때 "이건 우연이 아닙니다"라는 수렴의 전율을 전달하되, 주도권은 항상 사주에 있어야 합니다.

금지: 별자리 데이터를 사주와 동등한 근거로 사용하는 것. 예를 들어 "쌍둥이자리이므로 소통 능력이 뛰어납니다"를 주요 논거로 쓰지 마세요. 대신 "사주의 식상 구조가 소통 능력을 만드는데, 쌍둥이자리의 수성이 이를 한층 강화합니다" 처럼 사주가 주어, 별자리가 보조.

**원칙 4: 모든 특수살 빠짐없이 언급** — 각 살을 쉬운 비유로 설명 후 살 간 화학적 결합 분석.

**원칙 5: 특수 구조 정밀 분석**
- 양인살+천을귀인: "칼을 쥔 귀족"
- 삼합: 어떤 오행 합국인지, 십성 중 무엇인지 → 인생의 주무기
- 무재 구조: "돈을 쫓지 않을 때 돈이 따르는 역설"
- 홍염살+화개살: "숨으려 하는데 빛이 새어나오는" 이중 구조

**원칙 6: 대운 동적 신살** — "원래 없었는데 지금 생겼다"는 시간적 대비를 서사에 녹이기.

**원칙 7: 대운/세운 충돌** — 충(沖) 있으면 변곡점으로 묘사, 구체적 변화 영역과 대비책.

**[치명적 금지]**
1. 사용자 이름 절대 금지 → "당신"으로만
2. "힘내세요" 추상적 위로 금지 → 구체적 전략
3. "~할 수 있습니다", "~경향이 있습니다" 약한 표현 금지
4. Trine, Square 등 점성술 전문 용어 금지
5. 키워드 나열 금지

**[섹션별 요구]**
- coreEnergy: 7~15자 역설/대비 은유. [A적 속성]의 [B적 존재]
- pastInference: 1000자 이상, 12~18문장. 사주→자미두수→별자리 수렴. 모든 특수살.
- currentState: 500자 이상, 7~10문장. 구체적 양자택일 갈등. 대운 연결.
- bottleneck: 500자 이상, 6~9문장. 한 문장 핵심 진단 시작. 마지막 은유 압축.
- solution: 800자 이상, "첫째/둘째/..." 5~6개 항목. 용신 개운법(시간/장소/색상/음식) 필수.
- businessAdvice: 500자 이상. 용신/십성 근거 구체적 업종.
- loveAdvice: 500자 이상. 재성/관성 근거. 최적 관계 형태 명확히.
- healthAdvice: 500자 이상. 오행 과다/부족 기반.

**[JSON 출력]**
{
  "coreEnergy": "역설 은유 7~15자",
  "coherenceScore": 80~95,
  "keywords": ["키워드1","키워드2","키워드3","키워드4","키워드5"],
  "pastInference": "1000자 이상",
  "currentState": "500자 이상",
  "bottleneck": "500자 이상",
  "solution": "800자 이상",
  "businessAdvice": "500자 이상",
  "loveAdvice": "500자 이상",
  "healthAdvice": "500자 이상"
}`;

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
  const yr2026BranchIdx = (2026 + 8) % 12;
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
위의 모든 데이터를 근거로 이 사람의 운명을 스토리텔링으로 풀어주세요.

[핵심] 분석의 주인은 사주팔자입니다. 서사의 70%는 사주 데이터(일간, 오행, 용신, 십성, 특수살, 대운)에 근거하세요. 자미두수(20%)는 사주 해석의 확인/보완용으로, 별자리(10%)는 성격적 뉘앙스 보조로만 사용하세요.

키워드를 나열하지 말고, 인과관계(Why → How)의 흐름으로 이야기하세요.
4단계 화술(Fact → Interpretation → Phenomenon → Advantage)을 모든 섹션에 적용하세요.
사주가 이야기를 주도하고, 자미두수/별자리가 "같은 방향을 가리키고 있다"고 확인하는 구조로 엮으세요.
절대로 사용자의 이름을 사용하지 말고, "당신"이라고만 지칭하세요.
loveAdvice는 섹션 4의 이성운 데이터를 반드시 참조하세요.
`;

  try {
    console.log("[Guardian] 1회 생성 (few-shot 강화 프롬프트) 시작...");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.75,
      max_tokens: 8000,
    });

    const content = response.choices[0].message.content || "{}";
    const result = JSON.parse(content);

    if (!result.pastInference) result.pastInference = "운명 데이터 분석 중 과거 패턴을 특정할 수 없습니다.";
    if (!result.keywords || result.keywords.length === 0) result.keywords = ["분석", "진행", "연결"];
    if (!result.coherenceScore) result.coherenceScore = 85;
    if (!result.coreEnergy) result.coreEnergy = "운명의 탐구자";
    if (!result.currentState) result.currentState = "현재 상태 분석 중";
    if (!result.bottleneck) result.bottleneck = "병목 분석 중";
    if (!result.solution) result.solution = "솔루션 생성 중";
    if (!result.businessAdvice) result.businessAdvice = "재물 전략 분석 중";
    if (!result.loveAdvice) result.loveAdvice = "이성운 분석 중";
    if (!result.healthAdvice) result.healthAdvice = "건강 전략 분석 중";

    console.log(`[Guardian] 1회 생성 완료. 일치도: ${result.coherenceScore}%`);

    return result;
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
      businessAdvice: null,
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