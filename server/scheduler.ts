import { storage } from "./storage";
import { generateFortuneForUser, sendTelegramMessage } from "./fortune-engine";

async function runDailyFortunes() {
  console.log("[SCHEDULER] === Daily Fortune Generation Started ===");
  const allUsers = await storage.getAllUsers();
  console.log(`[SCHEDULER] Found ${allUsers.length} registered users`);

  let success = 0;
  let failed = 0;

  for (const user of allUsers) {
    try {
      const existingToday = await storage.getTodayFortuneByUserId(user.id);
      if (existingToday) {
        console.log(`[SCHEDULER] ${user.name} already has today's fortune, skipping`);
        success++;
        continue;
      }

      console.log(`[SCHEDULER] Generating fortune for ${user.name}...`);
      const { fortuneData, displayContent } = await generateFortuneForUser(user);

      await storage.createFortune({
        userId: user.id,
        content: displayContent,
        fortuneData: JSON.stringify(fortuneData),
      });

      const chatIdToUse = user.telegramChatId || (/^\d+$/.test(user.telegramId) ? user.telegramId : null);
      if (chatIdToUse) {
        const sent = await sendTelegramMessage(chatIdToUse, displayContent);
        console.log(`[SCHEDULER] Telegram for ${user.name}: ${sent ? 'OK' : 'FAILED'}`);
      } else {
        console.log(`[SCHEDULER] No chat ID for ${user.name}, skipping Telegram`);
      }

      console.log(`[SCHEDULER] Fortune generated for ${user.name} (score: ${fortuneData.combinedScore})`);
      success++;
    } catch (err) {
      console.error(`[SCHEDULER] Error for ${user.name}:`, err);
      failed++;
    }
  }

  console.log(`[SCHEDULER] === Completed: ${success} success, ${failed} failed ===`);
}

function getNextRunTime(): number {
  const now = new Date();
  const koreaOffset = 9 * 60 * 60 * 1000;
  const koreaTime = new Date(now.getTime() + koreaOffset);

  const target = new Date(koreaTime.getFullYear(), koreaTime.getMonth(), koreaTime.getDate(), 7, 0, 0, 0);

  if (koreaTime >= target) {
    target.setDate(target.getDate() + 1);
  }

  const targetUTC = new Date(target.getTime() - koreaOffset);
  return targetUTC.getTime() - now.getTime();
}

function scheduleNext() {
  const msUntilNext = getNextRunTime();
  const hours = Math.floor(msUntilNext / (1000 * 60 * 60));
  const minutes = Math.floor((msUntilNext % (1000 * 60 * 60)) / (1000 * 60));
  console.log(`[SCHEDULER] Next fortune generation in ${hours}h ${minutes}m (07:00 KST)`);

  setTimeout(async () => {
    await runDailyFortunes();
    scheduleNext();
  }, msUntilNext);
}

export function startScheduler() {
  console.log("[SCHEDULER] Fortune scheduler initialized");
  scheduleNext();
}
