import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").unique().notNull(),
  telegramHandle: text("telegram_handle"), // @username
  name: text("name").notNull(),
  birthDate: text("birth_date").notNull(), // YYYY-MM-DD
  birthTime: text("birth_time").notNull(), // HH:mm
  gender: text("gender").notNull(), // 'male' | 'female'
  preferredDeliveryTime: text("preferred_delivery_time").default("09:00").notNull(), // HH:mm
  createdAt: timestamp("created_at").defaultNow(),
});

export const fortunes = pgTable("fortunes", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id),
  content: text("content").notNull(),
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
