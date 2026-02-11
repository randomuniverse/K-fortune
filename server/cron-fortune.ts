import { pool } from "./db";
import { storage } from "./storage";
import { generateFortuneForUser, sendTelegramMessage } from "./fortune-engine";

async function main() {
  console.log("[CRON] === Daily Fortune Generation Started ===");
  const now = new Date();
  const koreaOffset = 9 * 60 * 60 * 1000;
  const koreaTime = new Date(now.getTime() + koreaOffset);
  console.log(`[CRON] Korea Time: ${koreaTime.toISOString()}`);

  const allUsers = await storage.getAllUsers();
  console.log(`[CRON] Found ${allUsers.length} registered users`);

  let success = 0;
  let failed = 0;

  for (const user of allUsers) {
    try {
      const existingToday = await storage.getTodayFortuneByUserId(user.id);
      if (existingToday) {
        console.log(`[CRON] ${user.name} already has today's fortune, skipping`);
        success++;
        continue;
      }

      console.log(`[CRON] Generating fortune for ${user.name}...`);
      const { fortuneData, displayContent } = await generateFortuneForUser(user);

      await storage.createFortune({
        userId: user.id,
        content: displayContent,
        fortuneData: JSON.stringify(fortuneData),
      });

      const chatIdToUse = user.telegramChatId || (/^\d+$/.test(user.telegramId) ? user.telegramId : null);
      if (chatIdToUse) {
        const sent = await sendTelegramMessage(chatIdToUse, displayContent);
        console.log(`[CRON] Telegram for ${user.name}: ${sent ? 'OK' : 'FAILED'}`);
      }

      console.log(`[CRON] Fortune generated for ${user.name} (score: ${fortuneData.combinedScore})`);
      success++;
    } catch (err) {
      console.error(`[CRON] Error for ${user.name}:`, err);
      failed++;
    }
  }

  console.log(`[CRON] === Completed: ${success} success, ${failed} failed ===`);
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("[CRON] Fatal error:", err);
  process.exit(1);
});
