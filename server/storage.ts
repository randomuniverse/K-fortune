import { db } from "./db";
import { users, fortunes, type User, type InsertUser, type Fortune, type InsertFortune } from "@shared/schema";
import { eq, desc, and, gte } from "drizzle-orm";

export interface IStorage {
  createUser(user: InsertUser): Promise<User>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  updateUser(telegramId: string, data: Partial<InsertUser>): Promise<User | undefined>;
  createFortune(fortune: InsertFortune): Promise<Fortune>;
  getFortunesByUserId(userId: number): Promise<Fortune[]>;
  getUser(id: number): Promise<User | undefined>;
  getTodayFortuneByUserId(userId: number): Promise<Fortune | undefined>;
  getAllUsers(): Promise<User[]>;
}

export class DatabaseStorage implements IStorage {
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.telegramId, telegramId));
    return user;
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async updateUser(telegramId: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set(data)
      .where(eq(users.telegramId, telegramId))
      .returning();
    return updated;
  }

  async createFortune(fortune: InsertFortune): Promise<Fortune> {
    const [newFortune] = await db.insert(fortunes).values(fortune).returning();
    return newFortune;
  }

  async getFortunesByUserId(userId: number): Promise<Fortune[]> {
    return db
      .select()
      .from(fortunes)
      .where(eq(fortunes.userId, userId))
      .orderBy(desc(fortunes.createdAt));
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getTodayFortuneByUserId(userId: number): Promise<Fortune | undefined> {
    const now = new Date();
    const koreaOffset = 9 * 60 * 60 * 1000;
    const koreaTime = new Date(now.getTime() + koreaOffset);
    const koreaDateStr = koreaTime.toISOString().slice(0, 10);
    const startOfDayKST = new Date(`${koreaDateStr}T00:00:00+09:00`);

    const [fortune] = await db
      .select()
      .from(fortunes)
      .where(and(eq(fortunes.userId, userId), gte(fortunes.createdAt, startOfDayKST)))
      .orderBy(desc(fortunes.createdAt))
      .limit(1);
    return fortune;
  }
}

export const storage = new DatabaseStorage();
