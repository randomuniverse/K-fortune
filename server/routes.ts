import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Create User
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

  // Get User
  app.get(api.users.get.path, async (req, res) => {
    const user = await storage.getUserByTelegramId(req.params.telegramId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  });

  // Generate Fortune (with daily limit + cross-validation voting)
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

      const today = new Date();
      const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

      const systemPrompt = `당신은 60년 경력의 사주팔자(四柱八字) 및 동양 점성술 대가입니다.
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

반드시 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 출력하세요:
{
  "score": 숫자,
  "direction": "방향",
  "caution": "조심할 점 내용",
  "special": "특이사항 내용",
  "summary": "전체 운세 요약 (3~4문장)"
}`;

      const userPrompt = `오늘 날짜: ${dateStr}
이름: ${user.name}
생년월일: ${user.birthDate}
태어난 시간: ${user.birthTime}
성별: ${user.gender === 'male' ? '남성(陽)' : '여성(陰)'}

이 사람의 사주팔자를 정밀 분석하여 오늘(${dateStr})의 운세를 알려주세요.`;

      const generateOne = async () => {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          temperature: 0.3,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
        return completion.choices[0].message.content || "";
      };

      const [raw1, raw2, raw3] = await Promise.all([
        generateOne(),
        generateOne(),
        generateOne(),
      ]);

      const fortuneSchema = z.object({
        score: z.number().min(0).max(100),
        direction: z.string().min(1),
        caution: z.string().min(1),
        special: z.string().min(1),
        summary: z.string().min(1),
      });

      const parseJson = (raw: string) => {
        try {
          const cleaned = raw.replace(/```json\s*/g, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleaned);
          return fortuneSchema.parse(parsed);
        } catch {
          return null;
        }
      };

      const results = [parseJson(raw1), parseJson(raw2), parseJson(raw3)].filter(
        (r): r is z.infer<typeof fortuneSchema> => r !== null
      );

      if (results.length < 2) {
        return res.status(500).json({ message: "운세 생성에 실패했습니다. 다시 시도해주세요." });
      }

      const avgScore = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);

      const directionCounts: Record<string, number> = {};
      results.forEach(r => {
        directionCounts[r.direction] = (directionCounts[r.direction] || 0) + 1;
      });
      const bestDirection = Object.entries(directionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || results[0].direction;

      const synthesizePrompt = `당신은 사주팔자 전문가입니다.
아래 3개의 독립적인 운세 분석 결과를 교차 검증하여, 공통으로 언급되는 핵심 내용만 선별해 최종 운세를 작성하세요.

[분석 결과 1] ${JSON.stringify(results[0])}
[분석 결과 2] ${JSON.stringify(results[1] || results[0])}
[분석 결과 3] ${JSON.stringify(results[2] || results[0])}

[교차 검증 규칙]
- 2개 이상의 분석에서 공통으로 언급된 내용만 채택합니다.
- 1개의 분석에서만 나타난 내용은 제외합니다.
- 표현은 자연스럽고 따뜻한 한국어로 작성합니다.

확정된 정보:
- 종합 운세 점수: ${avgScore}점
- 행운의 방향: ${bestDirection}

아래 형식으로 최종 운세를 작성해주세요 (텔레그램 메시지용, 간결하게):

[오늘의 운세] ${dateStr}

-- 종합 운세 점수: ${avgScore}/100점

-- 행운의 방향: ${bestDirection}

-- 조심할 점:
(공통 내용 요약)

-- 특이사항:
(공통 내용 요약)

-- 오늘의 한마디:
(격려의 말)`;

      const synthesisCompletion = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.2,
        messages: [
          { role: "system", content: "당신은 사주팔자 결과를 교차 검증하여 최종 운세를 작성하는 전문가입니다." },
          { role: "user", content: synthesizePrompt },
        ],
      });

      const fortuneContent = synthesisCompletion.choices[0].message.content || "운세를 생성할 수 없습니다.";

      const fortune = await storage.createFortune({
        userId: user.id,
        content: fortuneContent,
      });

      console.log(`[TELEGRAM] Fortune generated for ${user.telegramId} (${user.name})`);

      res.status(201).json({
        message: "운세가 생성되어 전송되었습니다!",
        fortune
      });
    } catch (error) {
      console.error("Error generating fortune:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // List Fortunes
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
