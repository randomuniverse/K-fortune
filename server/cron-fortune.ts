import { db } from "./db";
import { pool } from "./db";
import { users, fortunes, type User, type InsertFortune } from "@shared/schema";
import { getZodiacSign, getZodiacInfo, getLifePathNumber, type FortuneData } from "@shared/schema";
import { calculateFullSaju } from "@shared/saju";
import { eq, desc, and, gte } from "drizzle-orm";
import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
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
    return true;
  } catch (err) {
    console.error("[TELEGRAM] Error:", err);
    return false;
  }
}

function formatFortuneForTelegram(data: FortuneData, userName: string, dateStr: string, zodiacSign: string): string {
  return `<b>${userName}님의 오늘의 운세</b>
${dateStr} | ${zodiacSign}

<b>종합 점수: ${data.combinedScore}점</b>
사주팔자: ${data.sajuScore}점 | 별자리: ${data.zodiacScore}점
행운의 방향: ${data.sajuDirection}
행운의 숫자: ${data.luckyNumbers.join(", ")}

<b>-- 사주팔자 총평:</b>
${data.sajuSummary}

<b>-- 조심할 점:</b>
${data.sajuCaution}

<b>-- 특이사항:</b>
${data.sajuSpecial}

<b>-- 별자리 운세:</b>
연애: ${data.zodiacLove}
재물: ${data.zodiacMoney}
건강: ${data.zodiacHealth}
직장: ${data.zodiacWork}

<b>-- 별자리 총평:</b>
${data.zodiacSummary}

<b>-- 수비학 메시지:</b>
${data.numerologyMessage}`;
}

async function getTodayFortuneByUserId(userId: number) {
  const now = new Date();
  const koreaOffset = 9 * 60 * 60 * 1000;
  const koreaTime = new Date(now.getTime() + koreaOffset);
  const todayStart = new Date(koreaTime.getFullYear(), koreaTime.getMonth(), koreaTime.getDate());
  todayStart.setTime(todayStart.getTime() - koreaOffset);

  const result = await db
    .select()
    .from(fortunes)
    .where(and(eq(fortunes.userId, userId), gte(fortunes.createdAt, todayStart)))
    .orderBy(desc(fortunes.createdAt))
    .limit(1);

  return result[0];
}

async function generateFortuneForUser(user: User): Promise<boolean> {
  try {
    const existing = await getTodayFortuneByUserId(user.id);
    if (existing) {
      console.log(`[CRON] User ${user.name} already has today's fortune, skipping`);
      return true;
    }

    const now = new Date();
    const koreaOffset = 9 * 60 * 60 * 1000;
    const koreaTime = new Date(now.getTime() + koreaOffset);
    const dateStr = `${koreaTime.getFullYear()}년 ${koreaTime.getMonth() + 1}월 ${koreaTime.getDate()}일`;

    const zodiacSign = getZodiacSign(user.birthDate);
    const zodiacInfo = getZodiacInfo(user.birthDate);
    const lifePathNumber = getLifePathNumber(user.birthDate);

    const gender = user.gender === "male" ? "male" : "female" as "male" | "female";
    const sajuChart = calculateFullSaju(user.birthDate, user.birthTime, gender);

    const todayJDN = (() => {
      const a = Math.floor((14 - (koreaTime.getMonth() + 1)) / 12);
      const y = koreaTime.getFullYear() + 4800 - a;
      const m = (koreaTime.getMonth() + 1) + 12 * a - 3;
      return koreaTime.getDate() + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    })();
    const todayStemIdx = ((todayJDN + 2) % 10 + 10) % 10;
    const todayBranchIdx = ((todayJDN) % 12 + 12) % 12;
    const STEMS_H = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
    const BRANCHES_H = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
    const todayStem = STEMS_H[todayStemIdx];
    const todayBranch = BRANCHES_H[todayBranchIdx];

    const sajuSystemPrompt = `당신은 60년 경력의 사주팔자(四柱八字) 전문가입니다.
아래에 이 사람의 정확한 사주 사기둥이 제공됩니다. 이 데이터를 기반으로 오늘의 운세를 분석하세요.

[이 사람의 사주팔자 - 정확한 계산 결과]
연주(年柱): ${sajuChart.yearPillar.stemHanja}${sajuChart.yearPillar.branchHanja} (${sajuChart.yearTenGod.name}/${sajuChart.yearBranchTenGod.name})
월주(月柱): ${sajuChart.monthPillar.stemHanja}${sajuChart.monthPillar.branchHanja} (${sajuChart.monthTenGod.name}/${sajuChart.monthBranchTenGod.name})
일주(日柱): ${sajuChart.dayPillar.stemHanja}${sajuChart.dayPillar.branchHanja} (일간/${sajuChart.dayBranchTenGod.name})
시주(時柱): ${sajuChart.hourPillar.stemHanja}${sajuChart.hourPillar.branchHanja} (${sajuChart.hourTenGod.name}/${sajuChart.hourBranchTenGod.name})

일간 강약: ${sajuChart.dayMasterStrength}
용신: ${sajuChart.yongShin.elementHanja}(${sajuChart.yongShin.element})
오행 분포: ${sajuChart.fiveElementRatios.filter(e => e.ratio > 0).map(e => `${e.elementHanja}(${e.element}) ${e.ratio}%`).join(", ")}
띠: ${sajuChart.chineseZodiac}

오늘 일진: ${todayStem}${todayBranch}

[분석 지침]
1. 반드시 위의 정확한 사주 데이터를 사용하세요.
2. 오늘 일진(${todayStem}${todayBranch})과 일주(${sajuChart.dayPillar.stemHanja}${sajuChart.dayPillar.branchHanja}) 간의 관계를 분석하세요.
3. 용신(${sajuChart.yongShin.elementHanja})의 기운이 오늘 어떤 영향을 미치는지 설명하세요.
4. 행운의 방향은 용신의 오행 방위에 따라 결정하세요 (목=동, 화=남, 토=중앙, 금=서, 수=북).

이모지를 절대 사용하지 마세요. 반드시 JSON 형식으로만 응답하세요:
{
  "score": 숫자(0~100),
  "direction": "방향",
  "caution": "조심할 점 (3~4문장)",
  "special": "특이사항 (3~4문장)",
  "summary": "사주 운세 요약 (4~5문장)"
}`;

    const sajuUserPrompt = `오늘 날짜: ${dateStr}
이름: ${user.name}
생년월일(양력): ${user.birthDate}
태어난 시간: ${user.birthTime}
성별: ${user.gender === 'male' ? '남성(陽)' : '여성(陰)'}
${user.birthCountry ? `출생지: ${user.birthCountry} ${user.birthCity || ''}` : ''}

위에 제공된 정확한 사주 사기둥 데이터를 기반으로 오늘(${dateStr}, 일진 ${todayStem}${todayBranch})의 운세를 분석해주세요.`;

    const zodiacSystemPrompt = `당신은 서양 점성술 전문가입니다.

[이 사람의 별자리 정보]
별자리: ${zodiacSign} (${zodiacInfo.signEn})
주관 행성: ${zodiacInfo.rulingPlanet} (${zodiacInfo.rulingPlanetEn})
원소: ${zodiacInfo.element} (${zodiacInfo.elementEn})

이모지를 절대 사용하지 마세요. 반드시 JSON 형식으로만 응답하세요:
{
  "score": 0~100 사이의 정수,
  "love": "연애운 (3~4문장)",
  "money": "재물운 (3~4문장)",
  "health": "건강운 (3~4문장)",
  "work": "직장/학업운 (3~4문장)",
  "summary": "총평 (4~5문장)"
}`;

    const zodiacUserPrompt = `오늘 날짜: ${dateStr}
별자리: ${zodiacSign} (${zodiacInfo.signEn})
이름: ${user.name}
생년월일: ${user.birthDate}

오늘(${dateStr})의 운세를 분석해주세요.`;

    const numerologySystemPrompt = `당신은 수비학(Numerology) 전문가입니다.
이모지를 절대 사용하지 마세요. 반드시 JSON 형식으로만 응답하세요:
{
  "luckyNumbers": [숫자1, 숫자2, 숫자3],
  "message": "수비학 기반 오늘의 메시지 (3~4문장)"
}`;

    const numerologyUserPrompt = `오늘 날짜: ${dateStr}
생명수(Life Path Number): ${lifePathNumber}
이름: ${user.name}
생년월일: ${user.birthDate}

오늘의 행운의 숫자 3개와 수비학 메시지를 알려주세요.`;

    const generateSaju = async () => {
      const c = await openai.chat.completions.create({
        model: "gpt-4o", temperature: 0.3,
        messages: [{ role: "system", content: sajuSystemPrompt }, { role: "user", content: sajuUserPrompt }],
      });
      return c.choices[0].message.content || "";
    };

    const generateZodiac = async () => {
      const c = await openai.chat.completions.create({
        model: "gpt-4o", temperature: 0.3,
        messages: [{ role: "system", content: zodiacSystemPrompt }, { role: "user", content: zodiacUserPrompt }],
      });
      return c.choices[0].message.content || "";
    };

    const generateNumerology = async () => {
      const c = await openai.chat.completions.create({
        model: "gpt-4o", temperature: 0.3,
        messages: [{ role: "system", content: numerologySystemPrompt }, { role: "user", content: numerologyUserPrompt }],
      });
      return c.choices[0].message.content || "";
    };

    console.log(`[CRON] Generating 9 fortune readings for ${user.name}...`);

    const [saju1, saju2, saju3, zodiac1, zodiac2, zodiac3, num1, num2, num3] = await Promise.all([
      generateSaju(), generateSaju(), generateSaju(),
      generateZodiac(), generateZodiac(), generateZodiac(),
      generateNumerology(), generateNumerology(), generateNumerology(),
    ]);

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

    const parseJson = <T>(raw: string, schema: z.ZodSchema<T>): T | null => {
      try {
        const cleaned = raw.replace(/```json\s*/g, "").replace(/```/g, "").trim();
        return schema.parse(JSON.parse(cleaned));
      } catch { return null; }
    };

    const sajuResults = [parseJson(saju1, sajuSchema), parseJson(saju2, sajuSchema), parseJson(saju3, sajuSchema)]
      .filter((r): r is z.infer<typeof sajuSchema> => r !== null);
    const zodiacResults = [parseJson(zodiac1, zodiacSchema), parseJson(zodiac2, zodiacSchema), parseJson(zodiac3, zodiacSchema)]
      .filter((r): r is z.infer<typeof zodiacSchema> => r !== null);
    const numResults = [parseJson(num1, numSchema), parseJson(num2, numSchema), parseJson(num3, numSchema)]
      .filter((r): r is z.infer<typeof numSchema> => r !== null);

    if (sajuResults.length < 2 || zodiacResults.length < 2) {
      console.error(`[CRON] Not enough results for ${user.name}: saju=${sajuResults.length}, zodiac=${zodiacResults.length}`);
      return false;
    }

    const sajuAvgScore = Math.round(sajuResults.reduce((s, r) => s + r.score, 0) / sajuResults.length);
    const zodiacAvgScore = Math.round(zodiacResults.reduce((s, r) => s + r.score, 0) / zodiacResults.length);
    const combinedScore = Math.round((sajuAvgScore + zodiacAvgScore) / 2);

    const directionCounts: Record<string, number> = {};
    sajuResults.forEach(r => { directionCounts[r.direction] = (directionCounts[r.direction] || 0) + 1; });
    const bestDirection = Object.entries(directionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || sajuResults[0].direction;

    const allLuckyNumbers = numResults.flatMap(r => r.luckyNumbers);
    const numCounts: Record<number, number> = {};
    allLuckyNumbers.forEach(n => { numCounts[n] = (numCounts[n] || 0) + 1; });
    const sortedNums = Object.entries(numCounts).sort((a, b) => Number(b[1]) - Number(a[1]));
    const luckyNumbers = sortedNums.slice(0, 3).map(([n]) => Number(n));
    if (luckyNumbers.length === 0) luckyNumbers.push(lifePathNumber, (lifePathNumber * 3) % 99 + 1, (lifePathNumber * 7) % 99 + 1);

    const synthesizePrompt = `당신은 종합 운세 전문가입니다.
아래는 사주팔자, 별자리, 수비학의 교차 검증된 결과입니다. 각 카테고리에서 2개 이상의 분석에서 공통으로 언급된 내용만 선별하여 최종 운세를 작성하세요.
이모지를 절대 사용하지 마세요.

[사주팔자 분석 결과들]
${sajuResults.map((r, i) => `분석${i + 1}: ${JSON.stringify(r)}`).join("\n")}

[별자리 분석 결과들]
${zodiacResults.map((r, i) => `분석${i + 1}: ${JSON.stringify(r)}`).join("\n")}

[수비학 분석 결과들]
${numResults.map((r, i) => `분석${i + 1}: ${JSON.stringify(r)}`).join("\n")}

[교차 검증 규칙]
- 2개 이상의 분석에서 공통으로 언급된 내용만 채택합니다.
- 표현은 자연스럽고 따뜻한 한국어로 작성합니다.

확정된 정보:
- 사주팔자 점수: ${sajuAvgScore}점
- 별자리 점수: ${zodiacAvgScore}점
- 종합 점수: ${combinedScore}점
- 행운의 방향: ${bestDirection}
- 행운의 숫자: ${luckyNumbers.join(", ")}

반드시 JSON 형식으로만 응답하세요:
{
  "sajuCaution": "교차 검증된 조심할 점 (2~3문장)",
  "sajuSpecial": "교차 검증된 특이사항 (2~3문장)",
  "sajuSummary": "교차 검증된 사주팔자 운세 요약 (3~4문장)",
  "zodiacLove": "교차 검증된 연애운 (2~3문장)",
  "zodiacMoney": "교차 검증된 재물운 (2~3문장)",
  "zodiacHealth": "교차 검증된 건강운 (2~3문장)",
  "zodiacWork": "교차 검증된 직장운 (2~3문장)",
  "zodiacSummary": "교차 검증된 별자리 총평 (3~4문장)",
  "numerologyMessage": "교차 검증된 수비학 메시지 (3~4문장)"
}`;

    const synthesisCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      messages: [
        { role: "system", content: "당신은 운세 교차 검증 전문가입니다. 이모지를 절대 사용하지 마세요. 반드시 JSON 형식으로만 응답하세요." },
        { role: "user", content: synthesizePrompt },
      ],
    });

    const synthesisRaw = synthesisCompletion.choices[0].message.content || "";
    const synthesisSchema = z.object({
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

    let synthesis = parseJson(synthesisRaw, synthesisSchema);
    if (!synthesis) {
      synthesis = {
        sajuCaution: sajuResults[0].caution,
        sajuSpecial: sajuResults[0].special,
        sajuSummary: sajuResults[0].summary,
        zodiacLove: zodiacResults[0].love,
        zodiacMoney: zodiacResults[0].money,
        zodiacHealth: zodiacResults[0].health,
        zodiacWork: zodiacResults[0].work,
        zodiacSummary: zodiacResults[0].summary,
        numerologyMessage: numResults[0]?.message || "오늘은 생명수의 에너지가 당신을 이끕니다.",
      };
    }

    const fortuneData: FortuneData = {
      sajuScore: sajuAvgScore,
      sajuDirection: bestDirection,
      sajuCaution: synthesis.sajuCaution,
      sajuSpecial: synthesis.sajuSpecial,
      sajuSummary: synthesis.sajuSummary,
      zodiacScore: zodiacAvgScore,
      zodiacLove: synthesis.zodiacLove,
      zodiacMoney: synthesis.zodiacMoney,
      zodiacHealth: synthesis.zodiacHealth,
      zodiacWork: synthesis.zodiacWork,
      zodiacSummary: synthesis.zodiacSummary,
      luckyNumbers,
      numerologyMessage: synthesis.numerologyMessage,
      combinedScore,
    };

    const displayContent = formatFortuneForTelegram(fortuneData, user.name, dateStr, zodiacSign);

    await db.insert(fortunes).values({
      userId: user.id,
      content: displayContent,
      fortuneData: JSON.stringify(fortuneData),
    });

    const chatIdToUse = user.telegramChatId || (/^\d+$/.test(user.telegramId) ? user.telegramId : null);
    if (chatIdToUse) {
      const sent = await sendTelegramMessage(chatIdToUse, displayContent);
      console.log(`[CRON] Telegram send for ${user.name}: ${sent ? 'SUCCESS' : 'FAILED'}`);
    } else {
      console.log(`[CRON] No chat ID for ${user.name}, skipping Telegram`);
    }

    console.log(`[CRON] Fortune generated for ${user.name} (score: ${combinedScore})`);
    return true;
  } catch (err) {
    console.error(`[CRON] Error generating fortune for ${user.name}:`, err);
    return false;
  }
}

async function main() {
  console.log("[CRON] === Daily Fortune Generation Started ===");
  const now = new Date();
  const koreaOffset = 9 * 60 * 60 * 1000;
  const koreaTime = new Date(now.getTime() + koreaOffset);
  console.log(`[CRON] Korea Time: ${koreaTime.toISOString()}`);

  const allUsers = await db.select().from(users);
  console.log(`[CRON] Found ${allUsers.length} registered users`);

  let success = 0;
  let failed = 0;

  for (const user of allUsers) {
    const result = await generateFortuneForUser(user);
    if (result) success++;
    else failed++;
  }

  console.log(`[CRON] === Completed: ${success} success, ${failed} failed ===`);

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("[CRON] Fatal error:", err);
  process.exit(1);
});
