import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, updateUserSchema } from "@shared/routes";
import { z } from "zod";
import { getZodiacSign, getLifePathNumber, type FortuneData } from "@shared/schema";
import OpenAI from "openai";

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
    console.log(`[TELEGRAM] Message sent to ${chatId}`);
    return true;
  } catch (err) {
    console.error("[TELEGRAM] Error:", err);
    return false;
  }
}

function formatFortuneForTelegram(data: FortuneData, userName: string, dateStr: string, zodiacSign: string): string {
  return `<b>[오늘의 운세] ${dateStr}</b>
<b>${userName}님</b> (${zodiacSign})

<b>-- 종합 운세 점수: ${data.combinedScore}/100점</b>
  사주팔자: ${data.sajuScore}점 | 별자리: ${data.zodiacScore}점

<b>-- 행운의 방향:</b> ${data.sajuDirection}
<b>-- 행운의 숫자:</b> ${data.luckyNumbers.join(", ")}

<b>-- 사주팔자 운세</b>
${data.sajuSummary}

<b>-- 조심할 점:</b>
${data.sajuCaution}

<b>-- 특이사항:</b>
${data.sajuSpecial}

<b>-- 별자리 운세 (${zodiacSign})</b>
연애: ${data.zodiacLove}
재물: ${data.zodiacMoney}
건강: ${data.zodiacHealth}
직장: ${data.zodiacWork}

<b>-- 별자리 총평:</b>
${data.zodiacSummary}

<b>-- 수비학 메시지:</b>
${data.numerologyMessage}`;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post(api.users.create.path, async (req, res) => {
    try {
      const input = api.users.create.input.parse(req.body);
      
      const existing = await storage.getUserByTelegramId(input.telegramId);
      if (existing) {
        return res.status(409).json({ message: "User already exists" });
      }

      const user = await storage.createUser(input);
      res.status(201).json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.users.get.path, async (req, res) => {
    const user = await storage.getUserByTelegramId(req.params.telegramId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  });

  app.put(api.users.update.path, async (req, res) => {
    try {
      const data = updateUserSchema.parse(req.body);
      const user = await storage.updateUser(req.params.telegramId, data);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.post(api.fortunes.generate.path, async (req, res) => {
    try {
      const { telegramId } = req.body;
      const user = await storage.getUserByTelegramId(telegramId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const existingToday = await storage.getTodayFortuneByUserId(user.id);
      if (existingToday) {
        return res.status(429).json({ 
          message: "오늘의 운세는 이미 확인하셨습니다. 내일 다시 확인해주세요.",
          fortune: existingToday
        });
      }

      const now = new Date();
      const koreaOffset = 9 * 60 * 60 * 1000;
      const koreaTime = new Date(now.getTime() + koreaOffset);
      const dateStr = `${koreaTime.getFullYear()}년 ${koreaTime.getMonth() + 1}월 ${koreaTime.getDate()}일`;

      const zodiacSign = getZodiacSign(user.birthDate);
      const lifePathNumber = getLifePathNumber(user.birthDate);

      const sajuSystemPrompt = `당신은 60년 경력의 사주팔자(四柱八字) 및 동양 점성술 대가입니다.
사주팔자는 생년·생월·생일·생시의 네 기둥(天干·地支)으로 이루어집니다.
반드시 아래 규칙을 엄격히 따르세요:

[행운의 방향 규칙]
- 행운의 방향은 오행(五行)과 십이지(十二支)에 기반하여 결정합니다.
- 출생 일주(日柱)의 천간과 오늘 날짜의 천간·지지 관계로 방향을 도출합니다.
- 동일한 사주와 동일한 날짜라면 행운의 방향은 반드시 같아야 합니다.
- 방향은 동(東), 서(西), 남(南), 북(北), 동남, 동북, 서남, 서북 중 하나입니다.

[종합 운세 점수 규칙]
- 0~100점 사이의 정수로 산출합니다.
- 동일한 사주와 동일한 날짜라면 점수 편차는 ±3점 이내여야 합니다.

[조심할 점 규칙]
- 오늘의 충(沖), 형(刑), 파(破), 해(害) 관계를 분석하여 구체적으로 서술합니다.

[특이사항 규칙]
- 오늘 천간·지지의 합(合), 귀인(貴人), 역마(驛馬) 등 특수 관계를 분석합니다.

이모지를 절대 사용하지 마세요. 반드시 JSON 형식으로만 응답하세요:
{
  "score": 숫자,
  "direction": "방향",
  "caution": "조심할 점 내용",
  "special": "특이사항 내용",
  "summary": "전체 운세 요약 (3~4문장)"
}`;

      const sajuUserPrompt = `오늘 날짜: ${dateStr}
이름: ${user.name}
생년월일: ${user.birthDate}
태어난 시간: ${user.birthTime}
성별: ${user.gender === 'male' ? '남성(陽)' : '여성(陰)'}
${user.birthCountry ? `출생지: ${user.birthCountry} ${user.birthCity || ''}` : ''}
${user.mbti ? `MBTI: ${user.mbti}` : ''}

이 사람의 사주팔자를 정밀 분석하여 오늘(${dateStr})의 운세를 알려주세요.`;

      const zodiacSystemPrompt = `당신은 서양 점성술 전문가입니다. 별자리별 운세를 정확하게 분석합니다.
이모지를 절대 사용하지 마세요. 반드시 JSON 형식으로만 응답하세요:
{
  "score": 0~100 사이의 정수,
  "love": "연애운 (2~3문장)",
  "money": "재물운 (2~3문장)",
  "health": "건강운 (2~3문장)",
  "work": "직장/학업운 (2~3문장)",
  "summary": "별자리 운세 총평 (3~4문장)"
}`;

      const zodiacUserPrompt = `오늘 날짜: ${dateStr}
별자리: ${zodiacSign}
이름: ${user.name}
생년월일: ${user.birthDate}
성별: ${user.gender === 'male' ? '남성' : '여성'}

이 사람의 ${zodiacSign} 별자리 운세를 분석하여 오늘(${dateStr})의 연애운, 재물운, 건강운, 직장운을 알려주세요.`;

      const numerologySystemPrompt = `당신은 수비학(Numerology) 전문가입니다.
생년월일로부터 계산된 생명수(Life Path Number)와 오늘 날짜의 에너지를 결합하여 행운의 숫자와 메시지를 생성합니다.
이모지를 절대 사용하지 마세요. 반드시 JSON 형식으로만 응답하세요:
{
  "luckyNumbers": [숫자1, 숫자2, 숫자3],
  "message": "수비학 기반 오늘의 메시지 (3~4문장)"
}`;

      const numerologyUserPrompt = `오늘 날짜: ${dateStr}
생명수(Life Path Number): ${lifePathNumber}
이름: ${user.name}
생년월일: ${user.birthDate}

생명수 ${lifePathNumber}과 오늘 날짜의 수비학적 에너지를 분석하여:
1. 오늘의 행운의 숫자 3개 (1~99 사이)
2. 수비학 기반 오늘의 메시지
를 알려주세요.`;

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
        return res.status(500).json({ message: "운세 생성에 실패했습니다. 다시 시도해주세요." });
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
- 1개의 분석에서만 나타난 내용은 제외합니다.
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

      const fortune = await storage.createFortune({
        userId: user.id,
        content: displayContent,
        fortuneData: JSON.stringify(fortuneData),
      });

      sendTelegramMessage(user.telegramId, displayContent).catch(err => {
        console.error("[TELEGRAM] Background send error:", err);
      });

      res.status(201).json({
        message: "운세가 생성되어 전송되었습니다!",
        fortune
      });
    } catch (error) {
      console.error("Error generating fortune:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.fortunes.list.path, async (req, res) => {
    const user = await storage.getUserByTelegramId(req.params.telegramId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const fortunes = await storage.getFortunesByUserId(user.id);
    res.json(fortunes);
  });

  return httpServer;
}
