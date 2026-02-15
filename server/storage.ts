import { db } from "./db";
import { users, fortunes, guardianReports, yearlyFortunes, type User, type InsertUser, type Fortune, type InsertFortune, type GuardianReportType, type InsertGuardianReport, type YearlyFortuneType, type InsertYearlyFortune } from "@shared/schema";
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
  createGuardianReport(report: InsertGuardianReport): Promise<GuardianReportType>;
  getGuardianReportByUserId(userId: number): Promise<GuardianReportType | undefined>;
  deleteGuardianReportByUserId(userId: number): Promise<void>;
  createYearlyFortune(fortune: InsertYearlyFortune): Promise<YearlyFortuneType>;
  getYearlyFortuneByUserId(userId: number, year: number): Promise<YearlyFortuneType | undefined>;
  deleteYearlyFortuneByUserId(userId: number, year: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.telegramId, telegramId));
    if (user) return user;
    const handle = telegramId.replace(/^@/, '');
    const [byHandle] = await db.select().from(users).where(eq(users.telegramHandle, handle));
    return byHandle;
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

  async createGuardianReport(report: InsertGuardianReport): Promise<GuardianReportType> {
    const [newReport] = await db.insert(guardianReports).values(report).returning();
    return newReport;
  }

  async getGuardianReportByUserId(userId: number): Promise<GuardianReportType | undefined> {
    const [report] = await db
      .select()
      .from(guardianReports)
      .where(eq(guardianReports.userId, userId))
      .orderBy(desc(guardianReports.createdAt))
      .limit(1);
    return report;
  }

  async deleteGuardianReportByUserId(userId: number): Promise<void> {
    await db.delete(guardianReports).where(eq(guardianReports.userId, userId));
  }

  async createYearlyFortune(fortune: InsertYearlyFortune): Promise<YearlyFortuneType> {
    const [newFortune] = await db.insert(yearlyFortunes).values(fortune).returning();
    return newFortune;
  }

  async getYearlyFortuneByUserId(userId: number, year: number): Promise<YearlyFortuneType | undefined> {
    const [fortune] = await db
      .select()
      .from(yearlyFortunes)
      .where(and(eq(yearlyFortunes.userId, userId), eq(yearlyFortunes.year, year)))
      .orderBy(desc(yearlyFortunes.createdAt))
      .limit(1);
    return fortune;
  }

  async deleteYearlyFortuneByUserId(userId: number, year: number): Promise<void> {
    await db.delete(yearlyFortunes).where(and(eq(yearlyFortunes.userId, userId), eq(yearlyFortunes.year, year)));
  }
}

export const storage = new DatabaseStorage();
