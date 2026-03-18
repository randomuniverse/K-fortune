import { storage } from "./storage";
import { generateFortuneForUser, sendTelegramMessage } from "./fortune-engine";
import { runMigrations } from "./db";
import pRetry from "p-retry";
import pLimit from "p-limit";

const limit = pLimit(2);

async function generateFortuneWithRetry(user: {
  id: number;
  name: string;
  birthDate: string;
  birthTime: string;
  gender: string;
  birthCountry: string | null;
  birthCity: string | null;
  telegramId: string;
  telegramChatId: string | null;
}) {
  return pRetry(
    () => generateFortuneForUser(user),
    {
      retries: 3,
      minTimeout: 2000,
      maxTimeout: 10000,
      onFailedAttempt: (context) => {
        console.log(
          `[SCHEDULER] ${user.name} 운세 생성 실패 (시도 ${context.attemptNumber}/${context.attemptNumber + context.retriesLeft}): ${context.error.message}`
        );
      },
    }
  );
}

async function runDailyFortunes() {
  console.log("[SCHEDULER] === Daily Fortune Generation Started ===");
  const allUsers = await storage.getAllUsers();
  console.log(`[SCHEDULER] Found ${allUsers.length} registered users`);

  let success = 0;
  let failed = 0;

  const tasks = allUsers.map((user) =>
    limit(async () => {
      try {
        const existingToday = await storage.getTodayFortuneByUserId(user.id);
        if (existingToday) {
          console.log(`[SCHEDULER] ${user.name} already has today's fortune, skipping`);
          success++;
          return;
        }

        console.log(`[SCHEDULER] Generating fortune for ${user.name}...`);
        const { fortuneData, displayContent } = await generateFortuneWithRetry(user);

        await storage.createFortune({
          userId: user.id,
          content: displayContent,
          fortuneData: JSON.stringify(fortuneData),
        });

        const chatIdToUse =
          user.telegramChatId || (/^\d+$/.test(user.telegramId) ? user.telegramId : null);
        if (chatIdToUse) {
          const sent = await pRetry(() => sendTelegramMessage(chatIdToUse, displayContent), {
            retries: 2,
            minTimeout: 1000,
          });
          console.log(`[SCHEDULER] Telegram for ${user.name}: ${sent ? "OK" : "FAILED"}`);
        } else {
          console.log(`[SCHEDULER] No chat ID for ${user.name}, skipping Telegram`);
        }

        console.log(
          `[SCHEDULER] Fortune generated for ${user.name} (score: ${fortuneData.combinedScore})`
        );
        success++;
      } catch (err) {
        console.error(`[SCHEDULER] Error for ${user.name} after all retries:`, err);
        failed++;
      }
    })
  );

  await Promise.all(tasks);
  console.log(`[SCHEDULER] === Completed: ${success} success, ${failed} failed ===`);
}

function getKoreaTime() {
  const now = new Date();
  const koreaOffset = 9 * 60 * 60 * 1000;
  return new Date(now.getTime() + koreaOffset);
}

function getNextRunTime(): number {
  const now = new Date();
  const koreaOffset = 9 * 60 * 60 * 1000;
  const koreaTime = new Date(now.getTime() + koreaOffset);

  const target = new Date(
    koreaTime.getFullYear(),
    koreaTime.getMonth(),
    koreaTime.getDate(),
    7,
    0,
    0,
    0
  );

  if (koreaTime >= target) {
    target.setDate(target.getDate() + 1);
  }

  const targetUTC = new Date(target.getTime() - koreaOffset);
  return targetUTC.getTime() - now.getTime();
}

async function checkMissedRun() {
  const koreaTime = getKoreaTime();
  const currentHour = koreaTime.getHours();
  const currentMinute = koreaTime.getMinutes();

  if (currentHour >= 7) {
    console.log(`[SCHEDULER] Server started after 07:00 KST (current: ${currentHour}:${String(currentMinute).padStart(2, '0')} KST), checking for missed fortunes...`);

    const allUsers = await storage.getAllUsers();
    let needsRun = false;

    for (const user of allUsers) {
      const existingToday = await storage.getTodayFortuneByUserId(user.id);
      if (!existingToday) {
        needsRun = true;
        console.log(`[SCHEDULER] ${user.name} is missing today's fortune`);
        break;
      }
    }

    if (needsRun) {
      console.log("[SCHEDULER] Missed run detected! Running fortune generation now...");
      await runDailyFortunes();
    } else {
      console.log("[SCHEDULER] All users already have today's fortune, no missed run");
    }
  }
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
  console.log("[SCHEDULER] Fortune scheduler initialized (unified)");

  if (process.env.NODE_ENV === "production") {
    checkMissedRun().catch((err) => {
      console.error("[SCHEDULER] Error checking missed run:", err);
    });
  } else {
    console.log("[SCHEDULER] 개발 환경에서는 missed run 체크를 건너뜁니다.");
  }

  scheduleNext();
}

const args = process.argv.slice(2);
if (args.includes("--run-now")) {
  console.log("[SCHEDULER] Manual run triggered");
  runMigrations()
    .then(() => runDailyFortunes())
    .then(() => {
      console.log("[SCHEDULER] Manual run completed");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[SCHEDULER] Manual run failed:", err);
      process.exit(1);
    });
}
