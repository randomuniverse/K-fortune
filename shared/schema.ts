import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").unique().notNull(),
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
  const dates = [
    [1, 20], [2, 19], [3, 20], [4, 20], [5, 21], [6, 21],
    [7, 22], [8, 23], [9, 23], [10, 23], [11, 22], [12, 22]
  ];
  const signs = zodiacSigns;
  for (let i = 0; i < 12; i++) {
    if (month === dates[i][0] && day <= dates[i][1]) {
      return signs[i === 0 ? 11 : i - 1];
    }
    if (month === dates[i][0] && day > dates[i][1]) {
      return signs[i];
    }
  }
  return signs[11];
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
}
