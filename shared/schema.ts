import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").unique().notNull(),
  telegramChatId: text("telegram_chat_id"),
  telegramHandle: text("telegram_handle"),
  name: text("name").notNull(),
  birthDate: text("birth_date").notNull(),
  birthTime: text("birth_time").notNull(),
  gender: text("gender").notNull(),
  mbti: text("mbti"),
  birthCountry: text("birth_country"),
  birthCity: text("birth_city"),
  preferredDeliveryTime: text("preferred_delivery_time").default("07:00").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const fortunes = pgTable("fortunes", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id),
  content: text("content").notNull(),
  fortuneData: text("fortune_data"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  createdAt: true 
});

export const insertFortuneSchema = createInsertSchema(fortunes).omit({ 
  id: true, 
  createdAt: true 
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Fortune = typeof fortunes.$inferSelect;
export type InsertFortune = z.infer<typeof insertFortuneSchema>;

export const zodiacSigns = [
  "양자리", "황소자리", "쌍둥이자리", "게자리", 
  "사자자리", "처녀자리", "천칭자리", "전갈자리",
  "궁수자리", "염소자리", "물병자리", "물고기자리"
] as const;

export function getZodiacSign(birthDate: string): string {
  const [, month, day] = birthDate.split("-").map(Number);
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "양자리";
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "황소자리";
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "쌍둥이자리";
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "게자리";
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "사자자리";
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "처녀자리";
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "천칭자리";
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return "전갈자리";
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return "궁수자리";
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return "염소자리";
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return "물병자리";
  if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return "물고기자리";
  return "양자리";
}

export interface ZodiacInfo {
  sign: string;
  signEn: string;
  symbol: string;
  element: string;
  elementEn: string;
  quality: string;
  qualityEn: string;
  rulingPlanet: string;
  rulingPlanetEn: string;
  compatibleSigns: string[];
  dateRange: string;
  traits: string[];
}

const ZODIAC_DATA: Record<string, Omit<ZodiacInfo, "sign">> = {
  "양자리": { signEn: "Aries", symbol: "Ram", element: "불", elementEn: "Fire", quality: "활동궁", qualityEn: "Cardinal", rulingPlanet: "화성", rulingPlanetEn: "Mars", compatibleSigns: ["사자자리", "궁수자리"], dateRange: "3/21 - 4/19", traits: ["리더십", "열정", "용기"] },
  "황소자리": { signEn: "Taurus", symbol: "Bull", element: "흙", elementEn: "Earth", quality: "고정궁", qualityEn: "Fixed", rulingPlanet: "금성", rulingPlanetEn: "Venus", compatibleSigns: ["처녀자리", "염소자리"], dateRange: "4/20 - 5/20", traits: ["안정", "인내", "감각"] },
  "쌍둥이자리": { signEn: "Gemini", symbol: "Twins", element: "공기", elementEn: "Air", quality: "변동궁", qualityEn: "Mutable", rulingPlanet: "수성", rulingPlanetEn: "Mercury", compatibleSigns: ["천칭자리", "물병자리"], dateRange: "5/21 - 6/20", traits: ["소통", "호기심", "다재다능"] },
  "게자리": { signEn: "Cancer", symbol: "Crab", element: "물", elementEn: "Water", quality: "활동궁", qualityEn: "Cardinal", rulingPlanet: "달", rulingPlanetEn: "Moon", compatibleSigns: ["전갈자리", "물고기자리"], dateRange: "6/21 - 7/22", traits: ["감성", "보호본능", "직감"] },
  "사자자리": { signEn: "Leo", symbol: "Lion", element: "불", elementEn: "Fire", quality: "고정궁", qualityEn: "Fixed", rulingPlanet: "태양", rulingPlanetEn: "Sun", compatibleSigns: ["양자리", "궁수자리"], dateRange: "7/23 - 8/22", traits: ["카리스마", "창의성", "자신감"] },
  "처녀자리": { signEn: "Virgo", symbol: "Maiden", element: "흙", elementEn: "Earth", quality: "변동궁", qualityEn: "Mutable", rulingPlanet: "수성", rulingPlanetEn: "Mercury", compatibleSigns: ["황소자리", "염소자리"], dateRange: "8/23 - 9/22", traits: ["분석력", "완벽주의", "실용성"] },
  "천칭자리": { signEn: "Libra", symbol: "Scales", element: "공기", elementEn: "Air", quality: "활동궁", qualityEn: "Cardinal", rulingPlanet: "금성", rulingPlanetEn: "Venus", compatibleSigns: ["쌍둥이자리", "물병자리"], dateRange: "9/23 - 10/22", traits: ["조화", "공정", "미적감각"] },
  "전갈자리": { signEn: "Scorpio", symbol: "Scorpion", element: "물", elementEn: "Water", quality: "고정궁", qualityEn: "Fixed", rulingPlanet: "명왕성", rulingPlanetEn: "Pluto", compatibleSigns: ["게자리", "물고기자리"], dateRange: "10/23 - 11/21", traits: ["통찰력", "결단력", "열정"] },
  "궁수자리": { signEn: "Sagittarius", symbol: "Archer", element: "불", elementEn: "Fire", quality: "변동궁", qualityEn: "Mutable", rulingPlanet: "목성", rulingPlanetEn: "Jupiter", compatibleSigns: ["양자리", "사자자리"], dateRange: "11/22 - 12/21", traits: ["모험심", "낙관", "자유"] },
  "염소자리": { signEn: "Capricorn", symbol: "Goat", element: "흙", elementEn: "Earth", quality: "활동궁", qualityEn: "Cardinal", rulingPlanet: "토성", rulingPlanetEn: "Saturn", compatibleSigns: ["황소자리", "처녀자리"], dateRange: "12/22 - 1/19", traits: ["책임감", "야망", "인내"] },
  "물병자리": { signEn: "Aquarius", symbol: "Water Bearer", element: "공기", elementEn: "Air", quality: "고정궁", qualityEn: "Fixed", rulingPlanet: "천왕성", rulingPlanetEn: "Uranus", compatibleSigns: ["쌍둥이자리", "천칭자리"], dateRange: "1/20 - 2/18", traits: ["독창성", "인도주의", "혁신"] },
  "물고기자리": { signEn: "Pisces", symbol: "Fish", element: "물", elementEn: "Water", quality: "변동궁", qualityEn: "Mutable", rulingPlanet: "해왕성", rulingPlanetEn: "Neptune", compatibleSigns: ["게자리", "전갈자리"], dateRange: "2/19 - 3/20", traits: ["직감", "공감", "상상력"] },
};

export function getZodiacInfo(birthDate: string): ZodiacInfo {
  const sign = getZodiacSign(birthDate);
  const data = ZODIAC_DATA[sign]!;
  return { sign, ...data };
}

export function getLifePathNumber(birthDate: string): number {
  const digits = birthDate.replace(/-/g, "").split("").map(Number);
  let sum = digits.reduce((a, b) => a + b, 0);
  while (sum > 9 && sum !== 11 && sum !== 22 && sum !== 33) {
    sum = sum.toString().split("").map(Number).reduce((a, b) => a + b, 0);
  }
  return sum;
}

export interface FortuneData {
  sajuScore: number;
  sajuDirection: string;
  sajuCaution: string;
  sajuSpecial: string;
  sajuSummary: string;
  zodiacScore: number;
  zodiacLove: string;
  zodiacMoney: string;
  zodiacHealth: string;
  zodiacWork: string;
  zodiacSummary: string;
  luckyNumbers: number[];
  numerologyMessage: string;
  combinedScore: number;
  coherenceScore: number;
  commonKeywords: string[];
  coreMessage: string;
}

export const guardianReports = pgTable("guardian_reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  coreEnergy: text("core_energy").notNull(),
  coherenceScore: integer("coherence_score").notNull(),
  keywords: text("keywords").array(),
  pastInference: text("past_inference"),
  currentState: text("current_state").notNull(),
  bottleneck: text("bottleneck").notNull(),
  solution: text("solution").notNull(),
  businessAdvice: text("business_advice"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGuardianReportSchema = createInsertSchema(guardianReports).pick({
  userId: true,
  coreEnergy: true,
  coherenceScore: true,
  keywords: true,
  pastInference: true,
  currentState: true,
  bottleneck: true,
  solution: true,
  businessAdvice: true,
});

export type GuardianReportType = typeof guardianReports.$inferSelect;
export type InsertGuardianReport = z.infer<typeof insertGuardianReportSchema>;
