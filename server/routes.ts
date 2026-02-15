import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, updateUserSchema } from "@shared/routes";
import { z } from "zod";
import { getZodiacInfo, getZodiacSign } from "@shared/schema";
import { calculateFullSaju, analyzeSajuPersonality } from "@shared/saju";
import { calculateZiWei } from "@shared/ziwei";
import { generateFortuneForUser, sendTelegramMessage, generateGuardianReport, generateYearlyFortune } from "./fortune-engine";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post(api.users.create.path, async (req, res) => {
    try {
      const input = api.users.create.input.parse(req.body);
      
      const existing = await storage.getUserByTelegramId(input.telegramId);
      if (existing) {
        return res.status(409).json({ message: "User already exists", telegramId: existing.telegramId });
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

      const { fortuneData, displayContent } = await generateFortuneForUser(user);

      const fortune = await storage.createFortune({
        userId: user.id,
        content: displayContent,
        fortuneData: JSON.stringify(fortuneData),
      });

      const chatIdToUse = user.telegramChatId || (/^\d+$/.test(user.telegramId) ? user.telegramId : null);
      if (chatIdToUse) {
        sendTelegramMessage(chatIdToUse, displayContent).catch(err => {
          console.error("[TELEGRAM] Background send error:", err);
        });
      } else {
        console.log("[TELEGRAM] No chat ID configured for user, skipping send");
      }

      res.status(201).json({
        message: "운세가 생성되어 전송되었습니다!",
        fortune
      });
    } catch (error) {
      console.error("Error generating fortune:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/telegram/webhook", async (req, res) => {
    try {
      const message = req.body?.message;
      if (!message) return res.json({ ok: true });

      const chatId = String(message.chat?.id);
      const username = message.from?.username;
      const text = message.text;

      if (text === "/start") {
        const users = await storage.getAllUsers();
        let matched = false;

        for (const u of users) {
          if (u.telegramChatId === chatId) {
            matched = true;
            break;
          }
          if (u.telegramId === chatId || (username && u.telegramId === username) || (username && u.telegramHandle === username) || (username && u.telegramHandle === `@${username}`)) {
            await storage.updateUser(u.telegramId, { telegramChatId: chatId });
            matched = true;

            const token = process.env.TELEGRAM_BOT_TOKEN;
            if (token) {
              await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: `${u.name}님, 텔레그램 연동이 완료되었습니다! 이제 운세가 자동으로 전송됩니다.`,
                }),
              });
            }
            break;
          }
        }

        if (!matched) {
          const token = process.env.TELEGRAM_BOT_TOKEN;
          if (token) {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: `안녕하세요! 천상의 운세 봇입니다.\n귀하의 Chat ID: ${chatId}\n\n웹사이트에서 회원가입 시 이 Chat ID를 입력하시면 운세를 자동으로 받으실 수 있습니다.`,
              }),
            });
          }
        }
      }

      res.json({ ok: true });
    } catch (err) {
      console.error("[TELEGRAM WEBHOOK] Error:", err);
      res.json({ ok: true });
    }
  });

  app.post("/api/fortunes/guardian-report", async (req, res) => {
    try {
      const { telegramId, regenerate } = req.body;
      const user = await storage.getUserByTelegramId(telegramId);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (!regenerate) {
        const existingReport = await storage.getGuardianReportByUserId(user.id);
        if (existingReport) {
          console.log(`[Guardian] Found existing master report for user ${user.id}`);
          return res.json(existingReport);
        }
      } else {
        await storage.deleteGuardianReportByUserId(user.id);
        console.log(`[Guardian] Deleted old report for user ${user.id}, regenerating...`);
      }

      console.log(`[Guardian] Generating NEW master report for user ${user.id}...`);

      const gender = (user.gender === "female" || user.gender === "여" || user.gender === "woman") ? "female" : "male" as "male" | "female";
      const sajuChart = calculateFullSaju(user.birthDate, user.birthTime, gender);
      const sajuPersonality = analyzeSajuPersonality(sajuChart);

      const [year, month, day] = user.birthDate.split('-').map(Number);
      const hour = parseInt(user.birthTime.split(':')[0]);
      const ziweiResult = calculateZiWei(year, month, day, hour, gender);

      const zodiacInfo = getZodiacInfo(user.birthDate);
      const zodiacSign = getZodiacSign(user.birthDate);

      const reportData = await generateGuardianReport({
        name: user.name,
        sajuChart,
        sajuPersonality,
        ziwei: ziweiResult,
        zodiac: { sign: zodiacSign, info: zodiacInfo },
        gender,
      });

      const savedReport = await storage.createGuardianReport({
        userId: user.id,
        coreEnergy: reportData.coreEnergy,
        coherenceScore: reportData.coherenceScore,
        keywords: reportData.keywords,
        pastInference: reportData.pastInference,
        currentState: reportData.currentState,
        bottleneck: reportData.bottleneck,
        solution: reportData.solution,
        businessAdvice: reportData.businessAdvice || null,
        loveAdvice: reportData.loveAdvice || null,
        healthAdvice: reportData.healthAdvice || null,
      });

      res.json(savedReport);
    } catch (error) {
      console.error("Guardian report generation error:", error);
      res.status(500).json({ message: "Failed to generate guardian report" });
    }
  });

  app.get("/api/guardian-report/:telegramId", async (req, res) => {
    try {
      const user = await storage.getUserByTelegramId(req.params.telegramId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const report = await storage.getGuardianReportByUserId(user.id);
      if (!report) return res.status(404).json({ message: "No report found" });
      res.json(report);
    } catch (error) {
      console.error("Guardian report fetch error:", error);
      res.status(500).json({ message: "Failed to fetch guardian report" });
    }
  });

  app.post("/api/fortunes/yearly", async (req, res) => {
    try {
      const bodySchema = z.object({
        telegramId: z.string().min(1, "telegramId is required"),
        year: z.number().int().min(2020).max(2030).optional().default(2026),
        regenerate: z.boolean().optional().default(false),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });
      }
      const { telegramId, year: targetYear, regenerate } = parsed.data;
      const user = await storage.getUserByTelegramId(telegramId);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (!regenerate) {
        const existing = await storage.getYearlyFortuneByUserId(user.id, targetYear);
        if (existing) {
          console.log(`[Yearly] Found existing ${targetYear} fortune for user ${user.id}`);
          return res.json(existing);
        }
      } else {
        await storage.deleteYearlyFortuneByUserId(user.id, targetYear);
      }

      console.log(`[Yearly] Generating ${targetYear} fortune for user ${user.id}...`);

      const gender = (user.gender === "female" || user.gender === "여" || user.gender === "woman") ? "female" : "male" as "male" | "female";
      const sajuChart = calculateFullSaju(user.birthDate, user.birthTime, gender);
      const sajuPersonality = analyzeSajuPersonality(sajuChart);

      const [yearVal, monthVal, dayVal] = user.birthDate.split('-').map(Number);
      const hourVal = parseInt(user.birthTime.split(':')[0]);
      const ziweiResult = calculateZiWei(yearVal, monthVal, dayVal, hourVal, gender);

      const zodiacInfo = getZodiacInfo(user.birthDate);
      const zodiacSign = getZodiacSign(user.birthDate);

      const fortuneData = await generateYearlyFortune({
        name: user.name,
        year: targetYear,
        sajuChart,
        sajuPersonality,
        ziwei: ziweiResult,
        zodiac: { sign: zodiacSign, info: zodiacInfo }
      });

      const saved = await storage.createYearlyFortune({
        userId: user.id,
        year: targetYear,
        overallSummary: fortuneData.overallSummary,
        coherenceScore: fortuneData.coherenceScore || 75,
        businessFortune: fortuneData.businessFortune || null,
        loveFortune: fortuneData.loveFortune || null,
        healthFortune: fortuneData.healthFortune || null,
        monthlyFlow: fortuneData.monthlyFlow || null,
        keywords: fortuneData.keywords || [],
        sajuMonthlyFlow: fortuneData.sajuMonthlyFlow || null,
        sajuSummary: fortuneData.sajuSummary || null,
        ziweiMonthlyFlow: fortuneData.ziweiMonthlyFlow || null,
        ziweiSummary: fortuneData.ziweiSummary || null,
        zodiacMonthlyFlow: fortuneData.zodiacMonthlyFlow || null,
        zodiacSummary: fortuneData.zodiacSummary || null,
      });

      res.json(saved);
    } catch (error) {
      console.error("Yearly fortune generation error:", error);
      res.status(500).json({ message: "Failed to generate yearly fortune" });
    }
  });

  app.get("/api/yearly-fortune/:telegramId/:year", async (req, res) => {
    try {
      const user = await storage.getUserByTelegramId(req.params.telegramId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const fortune = await storage.getYearlyFortuneByUserId(user.id, parseInt(req.params.year));
      if (!fortune) return res.status(404).json({ message: "No yearly fortune found" });
      res.json(fortune);
    } catch (error) {
      console.error("Yearly fortune fetch error:", error);
      res.status(500).json({ message: "Failed to fetch yearly fortune" });
    }
  });

  app.get("/api/saju/:telegramId", async (req, res) => {
    try {
      const user = await storage.getUserByTelegramId(req.params.telegramId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const gender = user.gender === "male" ? "male" : "female" as "male" | "female";
      const sajuChart = calculateFullSaju(user.birthDate, user.birthTime, gender);
      const personality = analyzeSajuPersonality(sajuChart);
      const zodiacInfo = getZodiacInfo(user.birthDate);
      const [bYear, bMonth, bDay] = user.birthDate.split('-').map(Number);
      const bHour = parseInt(user.birthTime.split(':')[0]);
      const ziweiData = calculateZiWei(bYear, bMonth, bDay, bHour, gender);
      res.json({ sajuChart, personality, zodiacInfo, ziweiData });
    } catch (error) {
      console.error("Error calculating saju:", error);
      res.status(500).json({ message: "사주 계산 중 오류가 발생했습니다." });
    }
  });

  app.post("/api/telegram/test-send/:telegramId", async (req, res) => {
    try {
      const user = await storage.getUserByTelegramId(req.params.telegramId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const chatIdToUse = user.telegramChatId || (/^\d+$/.test(user.telegramId) ? user.telegramId : null);
      if (!chatIdToUse) {
        return res.status(400).json({ message: "텔레그램 Chat ID가 설정되지 않았습니다.", debug: { telegramId: user.telegramId, telegramChatId: user.telegramChatId, telegramHandle: user.telegramHandle } });
      }

      const fortunes = await storage.getFortunesByUserId(user.id);
      const latestFortune = fortunes[0];

      let textToSend: string;
      if (latestFortune) {
        textToSend = latestFortune.content;
      } else {
        textToSend = `[테스트] ${user.name}님, 텔레그램 연동이 정상적으로 작동합니다! Chat ID: ${chatIdToUse}`;
      }

      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        return res.status(500).json({ message: "TELEGRAM_BOT_TOKEN이 설정되지 않았습니다." });
      }

      const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatIdToUse,
          text: textToSend,
          parse_mode: "HTML",
        }),
      });
      const tgData = await tgRes.json();

      if (!tgData.ok) {
        console.error("[TELEGRAM TEST] Send failed:", tgData);
        return res.status(400).json({ 
          message: `텔레그램 전송 실패: ${tgData.description}`, 
          debug: { chatId: chatIdToUse, error: tgData.description, errorCode: tgData.error_code }
        });
      }

      console.log(`[TELEGRAM TEST] Message sent to ${chatIdToUse}`);
      res.json({ message: "텔레그램으로 전송 완료!", chatId: chatIdToUse });
    } catch (error) {
      console.error("[TELEGRAM TEST] Error:", error);
      res.status(500).json({ message: "전송 중 오류 발생", error: String(error) });
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
