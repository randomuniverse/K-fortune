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

  // Generate Fortune
  app.post(api.fortunes.generate.path, async (req, res) => {
    try {
      const { telegramId } = req.body;
      const user = await storage.getUserByTelegramId(telegramId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // 1. Generate Fortune with OpenAI
      const prompt = `
        다음 정보를 가진 사람의 오늘의 운세를 분석해줘:
        이름: ${user.name}
        생년월일: ${user.birthDate}
        태어난 시간: ${user.birthTime}
        성별: ${user.gender === 'male' ? '남성' : '여성'}
        
        다음 내용을 포함해서 요약해줘:
        1. 오늘의 종합 운세 점수 (0-100)
        2. 행운의 방향
        3. 조심해야 할 점
        4. 특이사항
        
        텔레그램 메시지로 보내기 적합하도록 간결하게 한국어로 작성해줘.
      `;

      const completion = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "system", content: "당신은 전문 사주풀이 및 점성술 전문가입니다." }, { role: "user", content: prompt }],
      });

      const fortuneContent = completion.choices[0].message.content || "운세를 생성할 수 없습니다.";

      // 2. Save to DB
      const fortune = await storage.createFortune({
        userId: user.id,
        content: fortuneContent,
      });

      // 3. Mock sending Telegram message (In production, we'd use a bot API here)
      console.log(`[MOCK TELEGRAM] Sending to ${user.telegramId}: ${fortuneContent}`);

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
