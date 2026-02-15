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
  const individualPrompt = `
당신은 '운명의 가디언'이자, 냉철한 데이터 분석가 및 실리콘밸리급 '인생 컨설턴트'입니다.
사용자의 사주, 자미두수, 별자리 데이터를 분석하여 **"논리적인 인과관계"**와 **"현실적인 성공 전략"**을 제시하세요.

**[절대 금지 사항]**
1. **소설 쓰기 금지:** "이불 속에서 울었다" 같은 가상의 감성적 장면 묘사 절대 금지.
2. **부정적 단어 금지:** "절망", "파멸" 같은 단어 사용 금지.
3. **추상적 조언 금지:** "마음을 비우세요" 같은 소리 금지.

**[작성 가이드라인 (Logic First)]**

1. **coreEnergy (타이틀)**:
   - 사용자의 강점과 약점을 동시에 보여주는 직관적 타이틀. (예: "브레이크가 고장 난 페라리")

2. **pastInference (운명의 추적 - 셜록 홈즈 모드)**:
   - **데이터 기반의 논리적 추론**이어야 합니다.
   - 구조: "당신은 [사주/별자리 데이터]의 영향으로 [재능]이 뛰어납니다. 하지만 [상충하는 데이터] 때문에 [구체적 실패 패턴]을 반복했을 확률이 높습니다."

3. **currentState (현재 딜레마 - Paradox)**:
   - 이성적 분석으로 접근하세요.
   - 예: "머리는 '안정'을 원하지만, 기질은 '변화'를 추구하여 타이밍을 놓치는 딜레마."

4. **bottleneck (결정적 병목)**:
   - 성장을 막는 **현실적인 원인**을 지적하세요. (예: "거절하지 못하는 태도", "선택 장애")

5. **solution (가디언 솔루션 - 행동과학)**:
   - **비즈니스 프레임워크**나 **검증된 생산성 법칙** 적용. (80:20 법칙, 에센셜리즘 등)
   - 예: "오늘 당장 '파레토 법칙'을 적용하세요. 상위 20% 업무 하나만 남기고 나머지는 위임하세요."

6. **businessAdvice (Guardian's Compass - 평생의 비즈니스 청사진)**:
   - **[주의] 2026년이나 특정 연도의 운세를 언급하지 마세요.** 오직 사용자의 타고난 '그릇'과 '적성'만 분석하세요.
   - **사주/자미두수 분석:** 재백궁(돈 그릇), 관록궁(직업 스타일), 용신(필요한 오행), 십성(재성/관성/식상)을 종합하세요.
   - **비즈니스 모델 추천:** 단순 업종 추천을 넘어, **"돈을 버는 방식"**을 설계하세요.
     (예: "당신은 직접 제조보다는 '중개/플랫폼'이 맞습니다.", "B2C보다는 기업 대상의 'B2B 컨설팅'이 큰돈이 됩니다.")
   - **최적의 산업군:** 사주의 기운을 보완하는 구체적 틈새시장(Niche)을 추천하세요.
     (예: "토(土) 기운이 필요하므로 부동산 중개나 프랜차이즈가 유리합니다.", "수(水) 기운이 강하므로 유통/물류 분야에서 수완을 발휘합니다.")
   - **수익 구조:** (예: "초기에는 프리랜서로 시작하되, 구독형 모델로 전환하세요.", "브랜드 권리(IP)를 파는 것이 직접 제조보다 이득입니다.")

7. **keywords**: 핵심 키워드 5개

**[출력 형식 (JSON)]**
{
  "coreEnergy": "직관적인 타이틀",
  "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  "pastInference": "데이터 근거 -> 성향 -> 과거 패턴 추론 (논리적)",
  "currentState": "상충하는 데이터로 인한 딜레마 분석",
  "bottleneck": "성장을 저해하는 현실적 원인",
  "solution": "비즈니스/생산성 프레임워크 기반의 구체적 조언",
  "businessAdvice": "평생 먹고살 비즈니스 모델 설계 (업종 추천 + 수익 구조)",
  "loveAdvice": null,
  "healthAdvice": null
}
`;

  const userPrompt = `
[사용자 프로필: ${data.name}]

1. [사주] 본성: ${data.saju.mainTrait}, 특수살: ${data.saju.specialSals.map((s: any) => s.name).join(", ")}, 용신: ${data.saju.yongShin.element}
2. [자미두수] 주성: ${data.ziwei.stars.life.map((s: any) => s.name).join(", ")}, 국: ${data.ziwei.bureau.name}
3. [별자리] ${data.zodiac.sign}, 특징: ${data.zodiac.info.traits?.join(", ") || data.zodiac.sign}

위 데이터를 종합 분석하여, 이 사람의 '과거 실패 패턴'을 추리하고, '과학적 행동 솔루션'을 내려주세요.
말투는 확신에 차 있고 예언적이지만, 논리적인 설득력을 갖추세요.
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
동일한 사용자 데이터를 3명의 독립 분석가가 각각 분석한 결과가 아래에 있습니다.

**[당신의 임무]**
1. 3개 리포트에서 **2개 이상이 공통적으로 언급한 내용만** 최종 리포트에 포함하세요.
2. 1개 리포트에서만 언급된 독자적 주장은 **제거**하세요.
3. 공통 키워드: [${commonKeywords.join(", ")}] — 이 키워드를 중심으로 종합하세요.
4. 소설/감성적 묘사 절대 금지. 논리적 인과관계와 데이터 근거만 사용하세요.
5. coherenceScore는 3개 리포트의 실제 일치도를 반영하세요 (공통점이 많으면 높게, 적으면 낮게).

**[분석가 A의 리포트]**
${JSON.stringify(report1, null, 2)}

**[분석가 B의 리포트]**
${JSON.stringify(report2, null, 2)}

**[분석가 C의 리포트]**
${JSON.stringify(report3, null, 2)}

위 3개를 교차 검증하여, 2개 이상 일치하는 내용만으로 **최종 종합 리포트**를 작성하세요.

**[출력 형식 (JSON)]**
{
  "coreEnergy": "3개 리포트의 공통 본질을 관통하는 타이틀",
  "coherenceScore": 70~95 (3개 리포트 간 실제 일치도),
  "keywords": ["공통키워드1", "공통키워드2", "공통키워드3"],
  "pastInference": "2개 이상 일치하는 과거 패턴 추론만 종합",
  "currentState": "2개 이상 일치하는 딜레마 분석만 종합",
  "bottleneck": "2개 이상 일치하는 병목 진단만 종합",
  "solution": "2개 이상 일치하는 솔루션만 종합 (비즈니스/생산성 프레임워크 기반)",
  "businessAdvice": "2개 이상 일치하는 평생 비즈니스 청사진만 종합 (돈 버는 방식 + 틈새시장 + 수익 구조, 특정 연도 언급 절대 금지)",
  "loveAdvice": null,
  "healthAdvice": null
}
`;

    const synthesisResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "당신은 3개의 독립 분석 리포트를 교차 검증하여 최종 종합 리포트를 작성하는 검증관입니다. 2개 이상 일치하는 내용만 채택하세요." },
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
당신은 동양 운세 전문가이자 데이터 분석가입니다.
사용자의 사주, 자미두수, 별자리 데이터를 기반으로 **${data.year}년 한 해의 운세**를 카테고리별로 분석하세요.

**[절대 금지 사항]**
1. 소설/감성적 묘사 금지. 데이터 기반 논리적 분석만.
2. "절망", "파멸" 같은 부정적 단어 금지.
3. 추상적 조언 금지.

**[분석 가이드라인]**

1. **overallSummary (${data.year}년 총평)**:
   - ${data.year}년의 전체적인 운세 흐름을 3~4문장으로 요약.
   - 올해의 핵심 테마와 기회/주의사항을 명확히.

2. **businessFortune (사업/재물운)**:
   - ${data.year}년의 재물 흐름, 투자 시기, 사업 확장/수성 전략.
   - 상반기/하반기 구분하여 구체적으로.

3. **loveFortune (연애/인간관계운)**:
   - ${data.year}년의 대인관계와 연애 흐름.
   - 좋은 인연을 만날 시기, 주의할 시기.

4. **healthFortune (건강운)**:
   - ${data.year}년에 특히 조심할 건강 이슈.
   - 오행 균형에 기반한 구체적 건강 관리법.

5. **monthlyFlow (월별 흐름)**: 1~12월 각각에 대해:
   - score: 1~100점
   - keyword: 핵심 키워드 하나
   - summary: 1~2문장 요약

6. **keywords**: 올해를 관통하는 핵심 키워드 5개

**[출력 형식 (JSON)]**
{
  "overallSummary": "${data.year}년 총평 (3~4문장)",
  "businessFortune": "사업/재물운 상세 분석",
  "loveFortune": "연애/인간관계운 상세 분석",
  "healthFortune": "건강운 상세 분석",
  "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  "monthlyFlow": [
    {"month": 1, "score": 65, "keyword": "준비", "summary": "새해 계획을 세우기 좋은 시기"},
    {"month": 2, "score": 70, "keyword": "실행", "summary": "..."},
    ...
    {"month": 12, "score": 75, "keyword": "결실", "summary": "..."}
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
당신은 ${data.year}년 운세의 최종 검증관입니다.
동일 사용자의 ${data.year}년 운세를 3명의 독립 분석가가 각각 분석한 결과입니다.

**[당신의 임무]**
1. 3개 분석에서 **2개 이상이 공통적으로 언급한 내용만** 최종 리포트에 포함.
2. 1개에서만 언급된 독자적 주장은 제거.
3. 공통 키워드: [${commonKeywords.join(", ")}]
4. 월별 점수는 3개 평균을 사용: ${avgMonthlyScores.map(m => `${m.month}월=${m.avgScore}점`).join(", ")}
5. coherenceScore: 3개 분석 간 실제 일치도 반영.

**[분석가 A]**
${JSON.stringify(report1, null, 2)}

**[분석가 B]**
${JSON.stringify(report2, null, 2)}

**[분석가 C]**
${JSON.stringify(report3, null, 2)}

**[출력 형식 (JSON)]**
{
  "overallSummary": "2개 이상 일치하는 내용으로 종합한 ${data.year}년 총평",
  "coherenceScore": 70~95,
  "businessFortune": "2개 이상 일치하는 사업/재물운만 종합",
  "loveFortune": "2개 이상 일치하는 연애/인간관계운만 종합",
  "healthFortune": "2개 이상 일치하는 건강운만 종합",
  "keywords": ["공통키워드1", "공통키워드2", ...],
  "monthlyFlow": [
    {"month": 1, "score": 평균점수, "keyword": "공통키워드", "summary": "2개 이상 일치하는 내용"},
    ... (1~12월 전체)
  ]
}
`;

    const synthesisResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: `당신은 3개의 독립 ${data.year}년 운세 분석을 교차 검증하여 최종 종합 리포트를 작성하는 검증관입니다. 2개 이상 일치하는 내용만 채택하세요.` },
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