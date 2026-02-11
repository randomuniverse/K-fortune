import { db } from "./db";
import { users, fortunes, type User, type InsertUser, type Fortune, type InsertFortune } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  createUser(user: InsertUser): Promise<User>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  createFortune(fortune: InsertFortune): Promise<Fortune>;
  getFortunesByUserId(userId: number): Promise<Fortune[]>;
  getUser(id: number): Promise<User | undefined>;
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
}

export const storage = new DatabaseStorage();
