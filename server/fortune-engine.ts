import { storage } from "./storage";
import { getZodiacSign, getZodiacInfo, type FortuneData } from "@shared/schema";
import { calculateFullSaju, checkGanYeoJiDong, calculateDaewoonDynamicStars, analyzeSajuPersonality, calculateTimeGuide, generateDailySajuInsight, analyzeSinsalIntegrated, getTenGodName } from "@shared/saju";
import { calculateZiWei } from "@shared/ziwei";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import pRetry from "p-retry";

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || "missing",
    });
  }
  return _anthropic;
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("[TELEGRAM] Bot token not configured, skipping send");
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("[TELEGRAM] Send failed:", data.description);
      return false;
    }
    console.log(`[TELEGRAM] Message sent to ${chatId}`);
    return true;
  } catch (err) {
    console.error("[TELEGRAM] Error:", err);
    return false;
  }
}

// 점수 시각화 바
function scoreBar(score: number): string {
  const filled = Math.round(score / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

// 점수 변화 표시
function deltaText(delta: number | undefined): string {
  if (delta == null || delta === 0) return "";
  return delta > 0 ? ` ↑+${delta}` : ` ↓${delta}`;
}

// 텔레그램 메시지 포맷팅 함수
export function formatFortuneForTelegram(data: FortuneData, userName: string, dateStr: string, zodiacSign: string): string {
  let msg = `<b>☀️ ${dateStr}</b>\n`;
  msg += `${userName}님의 오늘\n\n`;

  // 신탁 한 줄
  if (data.oracleLine) {
    msg += `<i>"${data.oracleLine}"</i>\n\n`;
  }

  // 종합 점수 + 변화
  msg += `📊 에너지: ${scoreBar(data.combinedScore)} ${data.combinedScore}점${deltaText(data.scoreDelta)}\n`;
  msg += `   사주 ${data.sajuScore} · 별자리 ${data.zodiacScore} · 자미두수 ${data.ziweiScore}\n\n`;

  // 핵심 메시지
  if (data.coreMessage) {
    msg += `💎 ${data.coreMessage}\n\n`;
  }

  // 키워드
  if (data.commonKeywords?.length) {
    msg += `🔑 ${data.commonKeywords.join(" · ")}\n\n`;
  }

  msg += `━━━━━━━━━━━━━━━\n`;

  // 사주
  msg += `🌙 <b>사주</b>\n${data.sajuSummary}\n`;
  if (data.sajuSpecial) msg += `✦ ${data.sajuSpecial}\n`;
  if (data.sajuCaution) msg += `⚠️ ${data.sajuCaution}\n`;
  msg += `\n`;

  // 별자리
  msg += `⭐ <b>${zodiacSign}</b>\n`;
  msg += `연애 ${data.zodiacLove}\n`;
  msg += `재물 ${data.zodiacMoney}\n`;
  msg += `건강 ${data.zodiacHealth}\n`;
  msg += `직장 ${data.zodiacWork}\n\n`;

  // 자미두수
  msg += `🌟 <b>자미두수</b>\n${data.ziweiMessage}\n\n`;

  msg += `━━━━━━━━━━━━━━━\n`;

  // 시간대별 가이드
  if (data.timeGuide) {
    msg += `⏰ <b>시간대별</b>\n`;
    msg += `오전 ${data.timeGuide.morning.score}점 ${data.timeGuide.morning.message}\n`;
    msg += `오후 ${data.timeGuide.afternoon.score}점 ${data.timeGuide.afternoon.message}\n`;
    msg += `저녁 ${data.timeGuide.evening.score}점 ${data.timeGuide.evening.message}\n\n`;
  }

  // 오늘의 처방
  if (data.todayPrescription) {
    msg += `💊 <b>오늘의 처방</b>\n${data.todayPrescription}\n\n`;
  }

  // 멘토 조언
  if (data.mentorWisdom && data.mentorSource) {
    msg += `📖 <i>"${data.mentorWisdom}"</i>\n— ${data.mentorSource}\n\n`;
  }

  return msg.trimEnd();
}

function getKoreaTime() {
  const now = new Date();
  const koreaOffset = 9 * 60 * 60 * 1000;
  return new Date(now.getTime() + koreaOffset);
}

function getTodayJDN(koreaTime: Date) {
  const a = Math.floor((14 - (koreaTime.getMonth() + 1)) / 12);
  const y = koreaTime.getFullYear() + 4800 - a;
  const m = (koreaTime.getMonth() + 1) + 12 * a - 3;
  return koreaTime.getDate() + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

const STEMS_H = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES_H = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

function parseJson<T>(raw: string, schema: z.ZodSchema<T>): T | null {
  try {
    let cleaned = raw.replace(/```json\s*/g, "").replace(/```/g, "").trim();
    
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart > 0 || (jsonEnd >= 0 && jsonEnd < cleaned.length - 1)) {
      if (jsonStart >= 0 && jsonEnd >= 0) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
      }
    }
    
    const parsed = JSON.parse(cleaned);
    return schema.parse(parsed);
  } catch (e: any) {
    console.error(`[parseJson] 파싱 실패: ${e.message}`);
    console.error(`[parseJson] 원본 응답 (첫 500자): ${raw.substring(0, 500)}`);
    if (e.issues) {
      console.error(`[parseJson] Zod 검증 에러:`, JSON.stringify(e.issues, null, 2));
    }
    return null;
  }
}

// Zod 스키마 정의 (3체계 분석 + 교차검증을 1회 호출로 통합)
const consolidatedDailySchema = z.object({
  // 사주
  sajuScore: z.number().min(0).max(100),
  sajuDirection: z.string().min(1),
  sajuCaution: z.string().min(1),
  sajuSpecial: z.string().min(1),
  sajuSummary: z.string().min(1),
  // 별자리
  zodiacScore: z.number().min(0).max(100),
  zodiacLove: z.string().min(1),
  zodiacMoney: z.string().min(1),
  zodiacHealth: z.string().min(1),
  zodiacWork: z.string().min(1),
  zodiacSummary: z.string().min(1),
  // 자미두수
  ziweiScore: z.number().min(0).max(100),
  ziweiMessage: z.string().min(1),
  // 교차 검증 종합
  coherenceScore: z.number().min(0).max(100),
  commonKeywords: z.array(z.string()),
  coreMessage: z.string(),
  oracleLine: z.string(),
  todayPrescription: z.string(),
  mentorWisdom: z.string(),
  mentorSource: z.string(),
});

export interface FortuneGenerationResult {
  fortuneData: FortuneData;
  displayContent: string;
}

async function generateWithClaude(sys: string, usr: string, label: string, temperature = 0.4, maxTokens = 4096): Promise<string> {
  return pRetry(
    async () => {
      const c = await getAnthropic().messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        temperature,
        system: sys,
        messages: [{ role: "user", content: usr }],
      });
      console.log(`[Claude] ${label} stop_reason=${c.stop_reason}, usage=${JSON.stringify(c.usage)}`);
      const content = c.content[0].type === "text" ? c.content[0].text : "";
      if (!content.trim()) {
        throw new Error(`Empty response from Claude for ${label}`);
      }
      return content;
    },
    {
      retries: 2,
      minTimeout: 1500,
      maxTimeout: 5000,
      onFailedAttempt: (context) => {
        console.warn(
          `[FORTUNE] ${label} Claude 호출 실패 (시도 ${context.attemptNumber}/${context.attemptNumber + context.retriesLeft}): ${context.error.message}`
        );
      },
    }
  );
}

export async function generateFortuneForUser(user: {
  id: number;
  name: string;
  birthDate: string;
  birthTime: string;
  gender: string;
  birthCountry: string | null;
  birthCity: string | null;
  telegramId: string;
  telegramChatId: string | null;
}): Promise<FortuneGenerationResult> {
  const koreaTime = getKoreaTime();
  const dateStr = `${koreaTime.getFullYear()}년 ${koreaTime.getMonth() + 1}월 ${koreaTime.getDate()}일`;

  const zodiacSign = getZodiacSign(user.birthDate);
  const zodiacInfo = getZodiacInfo(user.birthDate);

  const genderVal = (user.gender === "female" || user.gender === "여" || user.gender === "woman") ? "female" : "male" as "male" | "female";
  const sajuChart = calculateFullSaju(user.birthDate, user.birthTime, genderVal);

  const [yearVal, monthVal, dayVal] = user.birthDate.split('-').map(Number);
  const hourVal = parseInt(user.birthTime.split(':')[0]);
  const ziweiResult = calculateZiWei(yearVal, monthVal, dayVal, hourVal, genderVal);

  const todayJDN = getTodayJDN(koreaTime);
  const todayStemIdx = ((todayJDN + 2) % 10 + 10) % 10;
  const todayBranchIdx = ((todayJDN) % 12 + 12) % 12;
  const todayStem = STEMS_H[todayStemIdx];
  const todayBranch = BRANCHES_H[todayBranchIdx];

  // === v2.0: 사주 로직 기반 데이터 생성 (GPT 호출 없음) ===
  const sajuPersonality = analyzeSajuPersonality(sajuChart, genderVal);
  const timeGuide = calculateTimeGuide(sajuChart, todayStemIdx, todayBranchIdx);
  const sajuInsight = generateDailySajuInsight(sajuChart, sajuPersonality, todayStemIdx, todayBranchIdx);
  const yongShinRemedy = sajuPersonality.yongShinRemedy;

  // === v2.1: AI 프롬프트 보강용 추가 데이터 계산 ===
  const currentYear = koreaTime.getFullYear();
  const sinsalAnalysis = analyzeSinsalIntegrated(sajuChart, currentYear, genderVal);
  const daewoonStars = calculateDaewoonDynamicStars(sajuChart, currentYear);
  const userBirthYear = parseInt(user.birthDate.split('-')[0]);
  const activeDaeun = sajuChart.daeun.find(d => currentYear >= d.year && currentYear < d.year + 10);
  const dailyStemRelation = getTenGodName(sajuChart.dayPillar.stemIndex, todayStemIdx);
  // 지지 본기 장간 매핑 (BRANCH_HIDDEN_STEMS 각 첫 번째 값)
  const branchMainStems = [9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8];
  const dailyBranchRelation = getTenGodName(sajuChart.dayPillar.stemIndex, branchMainStems[todayBranchIdx]);
  const isGanYeoJiDong = checkGanYeoJiDong(sajuChart);

  // === 1회 통합 호출: 사주 + 별자리 + 자미두수 분석 + 교차검증 동시 수행 ===
  const lifeStars = ziweiResult.stars.life.map(s => `${s.name}(${s.keyword})`).join(", ") || "명무정성(유연한 운명)";
  const wealthStars = ziweiResult.stars.wealth.map(s => `${s.name}(${s.keyword})`).join(", ") || "없음";
  const spouseStars = ziweiResult.stars.spouse.map(s => `${s.name}(${s.keyword})`).join(", ") || "없음";

  // 멘토 카테고리 로테이션 (날짜 기반, 매일 다른 카테고리 강제)
  const mentorCategories = ["투자/비즈니스", "동양 고전", "서양 철학", "심리/자기계발", "과학/리더십"];
  const dayOfYear = Math.floor((koreaTime.getTime() - new Date(koreaTime.getFullYear(), 0, 0).getTime()) / 86400000);
  const todayMentorCategory = mentorCategories[dayOfYear % mentorCategories.length];

  const consolidatedSystemPrompt = `당신은 동양의 명리학(사주팔자), 서양의 점성술(별자리), 동양의 자미두수(紫微斗數) 세 관점으로 오늘의 운세를 동시에 분석하고 교차 검증하는 '운명 데이터 융합 전문가'입니다.

[공통 금지 사항]
- 사용자 이름 절대 사용 금지 → 반드시 "당신"으로만 지칭
- "~할 수 있습니다", "~일 수 있습니다" 같은 약한 표현 절대 금지 → "~하는 날이다", "~하라" 단정형 사용
- 365일 어느 날에나 붙일 수 있는 일반적 문장 금지 → 오늘 일진/행성 배치에 근거한 구체적 서술 필수
- 이모지 사용 금지
- 점성술 전문 용어(Trine, Square, Conjunction 등) 한국어로 풀어서 서술

━━━━ [1. 사주 분석 지침] ━━━━
제공된 4주 전체(년/월/일/시)와 각 기둥의 십성을 반드시 참조하세요.
일진(${todayStem}${todayBranch})과 일주(${sajuChart.dayPillar.stemHanja}${sajuChart.dayPillar.branchHanja})의 형/충/회/합/원진 관계를 분석하세요.
일진 천간과 일간의 십성 관계(User 데이터에 명시)를 근거로 오늘의 에너지 흐름을 판단하세요.
용신(${sajuChart.yongShin.elementHanja})이 오늘 힘을 받는지, 극을 당하는지 확인하세요.
오행 비율의 편향과 일간 강약을 고려하여 재물/직장/대인관계의 유불리를 판단하세요.
세운 동적 신살과 삼재는 1년간 지속되는 배경 기운이므로, sajuCaution에서 매일 반복 언급하지 마세요.
sajuCaution은 반드시 **오늘 일진과 원국의 충/형/파/해/원진 관계**에서 도출하세요. 어제와 다른 일진이므로 주의사항도 매일 달라야 합니다.
삼재/탕화살 등 연간 신살은 sajuSummary에서 배경으로만 간략히 언급하세요.
현재 대운과 대운 동적 별이 있다면 오늘의 운세에 대운의 큰 흐름도 함께 반영하세요.
구조 패턴(식상생재, 관인상생 등)이 있다면 오늘 일진과의 시너지/갈등을 판단하세요.
사주 인사이트와 시간대별 가이드는 참조하되, 독자적으로 재해석하여 서술하세요.

━━━━ [2. 별자리 분석 지침] ━━━━
오늘 날짜(${dateStr}) 기준, ${zodiacInfo.rulingPlanet}과 주요 행성(태양/달/화성/목성/토성)이 ${zodiacSign}에 미치는 영향을 분석하세요.
행성 이름은 쓰되 각도 용어는 한국어 운의 흐름으로 번역하세요.

━━━━ [3. 자미두수 분석 지침] ━━━━
오늘 일진(${todayStem}${todayBranch})이 명궁(${ziweiResult.lifePalace})의 주성(${lifeStars})에 미치는 영향을 분석하세요.
재백궁(${wealthStars})과 부처궁(${spouseStars})의 상호작용도 판단하세요.

━━━━ [4. 교차 검증 및 종합 지침] ━━━━
1. 일치도(coherenceScore): 3체계 흐름이 얼마나 유사한지 0~100. 3개 모두 길/흉이면 90+, 엇갈리면 낮게.
2. 공통 키워드(commonKeywords): 3체계에서 공통으로 발견되는 주제 3~5개.
3. 핵심 메시지(coreMessage): 3체계가 만장일치로 가리키는 오늘의 운명 한 문장. 단정형 필수.
4. 자미두수 메시지(ziweiMessage): "명궁의 [별이름]이 오늘..." 형태로 자연스럽게 다듬기.
5. 한 줄 신탁(oracleLine): 자연/계절/동물/원소 은유 포함. 매일 다른 이미지. 상투어 금지.
6. 오늘의 처방(todayPrescription): 장소/시간/행동이 구체적인 실행 처방 1가지. 추상 조언 금지.
7. 멘토 조언(mentorWisdom + mentorSource):
   - 아래 풀에서 오늘 운세에 맞는 인물 1명을 선택
   - mentorWisdom: 그 인물의 **검증 가능한 실제 명언/저서 원문**을 한국어로 인용한 뒤, 오늘의 운세와 연결하는 해석 1문장 추가. 총 2~3문장.
   - ⛔ 금지: 인물이 하지 않은 말을 만들어내는 것. 사주/삼재/오행 등 동양 운세 용어를 멘토 발언에 섞는 것. 멘토는 자신의 분야에서만 말한다.
   - mentorSource: 인물명만 (예: "세네카"). mentorWisdom 본문에 인물명을 넣지 마세요 (출처에서 표시하므로 중복).
   - ⚠️ 같은 인물 최소 7일 간격. 아래 풀에서 골고루 순환.
   - 🎯 오늘은 [${todayMentorCategory}] 카테고리에서 선택하세요. (시스템이 자동 로테이션)
   - 멘토 풀 (60명):
     [투자/비즈니스] 워렌 버핏, 찰리 멍거, 레이 달리오, 피터 린치, 조지 소로스, 제프 베조스, 일론 머스크, 스티브 잡스, 빌 게이츠, 샘 올트먼, Naval Ravikant, Paul Graham, 피터 드러커, 피터 틸, 마크 저커버그, 제시 리버모어
     [동양 고전] 노자, 장자, 공자, 맹자, 손자, 한비자, 왕양명, 미야모토 무사시, 퇴계 이황, 율곡 이이, 묵자, 순자
     [서양 철학] 세네카, 마르쿠스 아우렐리우스, 에픽테토스, 니체, 쇼펜하우어, 키르케고르, 몽테뉴, 파스칼, 소크라테스, 아리스토텔레스, 데카르트, 칸트
     [심리/자기계발] 빅토르 프랭클, 칼 융, 알프레드 아들러, 미하이 칙센트미하이, 나심 탈레브, 라이언 홀리데이, 제임스 클리어, 앤절라 더크워스, 대니얼 카너먼, 캐롤 드웩
     [과학/리더십] 리처드 파인만, 찰스 다윈, 넬슨 만델라, 윈스턴 처칠, 벤저민 프랭클린, 레오나르도 다빈치, 앨버트 아인슈타인, 마리 퀴리, 스티븐 호킹, 이순신

이모지 없이, 반드시 아래 JSON 형식으로만 응답하세요:
{
  "sajuScore": 0~100,
  "sajuCaution": "오늘 일진과 원국의 충/형/파/해 관계에서 도출한 주의점 (연간 신살 반복 금지, 단정형)",
  "sajuSpecial": "오늘의 특이사항 (귀인/합 등 긍정적 요소)",
  "sajuSummary": "오늘의 사주 총평 (인과관계 명시)",
  "zodiacScore": 0~100,
  "zodiacLove": "금성/달 영향 기반 연애운",
  "zodiacMoney": "목성/금성 영향 기반 재물운",
  "zodiacHealth": "화성/토성 영향 기반 건강운",
  "zodiacWork": "수성/태양 영향 기반 직장운",
  "zodiacSummary": "행성 트랜짓 기반 오늘 총평",
  "ziweiScore": 0~100,
  "ziweiMessage": "명궁 주성과 오늘 일진 상호작용 분석",
  "coherenceScore": 0~100,
  "commonKeywords": ["키워드1", "키워드2", "키워드3"],
  "coreMessage": "3체계 공통 핵심 메시지 (1문장, 단정형)",
  "oracleLine": "시적 한 줄 신탁 (자연/계절/동물/원소 은유 필수)",
  "todayPrescription": "구체적 행동 처방 (장소/시간/행동 포함)",
  "mentorWisdom": "실제 명언 인용 + 오늘 운세 연결 해석 (인물명 넣지 말것, 운세용어 섞지 말것)",
  "mentorSource": "인물명만 (60명 풀에서 매일 다른 인물)"
}`;

  const consolidatedUserPrompt = `오늘 날짜: ${dateStr}

━━━━ [사주 원국 데이터] ━━━━
■ 4주(四柱):
  년주: ${sajuChart.yearPillar.stemHanja}${sajuChart.yearPillar.branchHanja} (${sajuChart.yearTenGod.name}/${sajuChart.yearBranchTenGod.name})
  월주: ${sajuChart.monthPillar.stemHanja}${sajuChart.monthPillar.branchHanja} (${sajuChart.monthTenGod.name}/${sajuChart.monthBranchTenGod.name})
  일주: ${sajuChart.dayPillar.stemHanja}${sajuChart.dayPillar.branchHanja} (일간/${sajuChart.dayBranchTenGod.name})
  시주: ${sajuChart.hourPillar.stemHanja}${sajuChart.hourPillar.branchHanja} (${sajuChart.hourTenGod.name}/${sajuChart.hourBranchTenGod.name})
■ 일간 강약: ${sajuChart.dayMasterStrength}
■ 용신: ${sajuChart.yongShin.elementHanja}(${sajuChart.yongShin.element}) — ${sajuChart.yongShin.reason}
■ 오행 비율: ${sajuChart.fiveElementRatios.map(r => `${r.elementHanja}(${r.ratio}%)`).join(' / ')}
■ 간여지동: ${isGanYeoJiDong ? "해당 (일간과 일지가 같은 오행)" : "해당 없음"}
■ 구조 패턴: ${sajuPersonality.structurePatterns.length > 0 ? sajuPersonality.structurePatterns.map(p => `${p.name}(${p.hanja})`).join(', ') : "특별 패턴 없음"}
■ 원국 신살: ${sajuPersonality.specialSals.slice(0, 8).map(s => `${s.name}(${s.category}, ${s.foundIn || '원국'})`).join(', ') || "없음"}
■ 세운(${currentYear}년) 동적 신살: ${sinsalAnalysis.dynamicSinsal.map(s => s.name).join(', ') || "없음"}${sinsalAnalysis.overlapping.length > 0 ? `\n  → 원국+세운 중복 강화: ${sinsalAnalysis.overlapping.map(s => s.name).join(', ')}` : ''}${sinsalAnalysis.samjae ? `\n  → 삼재: ${sinsalAnalysis.samjae.name} — ${sinsalAnalysis.samjae.description}` : ''}
■ 현재 대운: ${activeDaeun ? `${activeDaeun.stemHanja}${activeDaeun.branchHanja} (${activeDaeun.age}세~${activeDaeun.age + 9}세)` : "대운 정보 없음"}${daewoonStars.length > 0 ? `\n■ 대운 동적 별: ${daewoonStars.map(s => `${s.name}(${s.source})`).join(', ')}` : ''}

━━━━ [오늘 일진 분석] ━━━━
■ 오늘 일진: ${todayStem}${todayBranch}
■ 일진↔일간 천간 관계: ${dailyStemRelation}
■ 일진↔일간 지지 관계: ${dailyBranchRelation}
■ 사주 인사이트: ${sajuInsight}
■ 시간대별 가이드:
  오전: ${timeGuide.morning.score}점 — ${timeGuide.morning.message}
  오후: ${timeGuide.afternoon.score}점 — ${timeGuide.afternoon.message}
  저녁: ${timeGuide.evening.score}점 — ${timeGuide.evening.message}

━━━━ [별자리 데이터] ━━━━
별자리: ${zodiacSign} (${zodiacInfo.signEn})
주관 행성: ${zodiacInfo.rulingPlanet}

━━━━ [자미두수 데이터] ━━━━
명궁: ${ziweiResult.lifePalace}궁 / 국: ${ziweiResult.bureau.name}(${ziweiResult.bureau.desc})
명궁 주성: ${lifeStars}
재백궁: ${wealthStars} / 부처궁: ${spouseStars}

위 3체계를 동시에 분석하고 교차 검증하여 JSON으로 응답하세요.`;

  console.log("[FORTUNE] Claude 1회 통합 호출 시작 (사주+별자리+자미두수+교차검증)...");
  const consolidatedRaw = await generateWithClaude(
    consolidatedSystemPrompt,
    consolidatedUserPrompt,
    "일일운세통합",
    0.7,
    4096
  );

  const result = parseJson(consolidatedRaw, consolidatedDailySchema);
  if (!result) {
    throw new Error("일일 운세 통합 분석 파싱 실패");
  }
  console.log("[FORTUNE] Claude 통합 호출 완료. 일치도:", result.coherenceScore + "%");

  // 최종 점수 계산
  const baseScore = Math.round((result.sajuScore + result.zodiacScore + result.ziweiScore) / 3);
  const finalCombinedScore = result.coherenceScore >= 80 ? Math.min(100, baseScore + 5) : baseScore;

  // 어제 대비 점수 변화
  let scoreDelta: number | undefined;
  try {
    const yesterdayFortunes = await storage.getFortunesByUserId(user.id);
    if (yesterdayFortunes && yesterdayFortunes.length > 0) {
      const yesterday = yesterdayFortunes[0];
      if (yesterday.fortuneData) {
        const prevData = JSON.parse(yesterday.fortuneData);
        scoreDelta = finalCombinedScore - (prevData.combinedScore || 0);
      }
    }
  } catch (e) {
    console.warn("[FORTUNE] 어제 점수 비교 실패:", e);
  }

  const fortuneData: FortuneData = {
    sajuScore: result.sajuScore,
    sajuDirection: result.sajuDirection || "중앙",
    sajuCaution: result.sajuCaution,
    sajuSpecial: result.sajuSpecial,
    sajuSummary: result.sajuSummary,
    zodiacScore: result.zodiacScore,
    zodiacLove: result.zodiacLove,
    zodiacMoney: result.zodiacMoney,
    zodiacHealth: result.zodiacHealth,
    zodiacWork: result.zodiacWork,
    zodiacSummary: result.zodiacSummary,
    luckyNumbers: [],
    ziweiMessage: result.ziweiMessage,
    combinedScore: finalCombinedScore,
    coherenceScore: result.coherenceScore,
    commonKeywords: result.commonKeywords,
    coreMessage: result.coreMessage,
    ziweiScore: result.ziweiScore,
    oracleLine: result.oracleLine || undefined,
    todayPrescription: result.todayPrescription || undefined,
    timeGuide,
    sajuInsight,
    scoreDelta,
    mentorWisdom: result.mentorWisdom || undefined,
    mentorSource: result.mentorSource || undefined,
  };

  const displayContent = formatFortuneForTelegram(fortuneData, user.name, dateStr, zodiacSign);

  return { fortuneData, displayContent };
}

// ================================================================
// 가디언 리포트 (운명 종합 분석) 생성
// ================================================================
export interface GuardianReport {
  coreEnergy: string;
  coherenceScore: number;
  keywords: string[];
  currentState: string;
  bottleneck: string;
  solution: string;
}

export async function generateGuardianReport(data: {
  name: string;
  sajuChart: any;
  sajuPersonality: any;
  ziwei: any;
  zodiac: any;
  gender: string;
}) {
  const sp = data.sajuPersonality;
  const sc = data.sajuChart;
  const zw = data.ziwei;
  const isMale = data.gender === "male";

  const allTenGods = [
    sc.yearTenGod?.name, sc.monthTenGod?.name, sc.hourTenGod?.name,
    sc.yearBranchTenGod?.name, sc.monthBranchTenGod?.name,
    sc.dayBranchTenGod?.name, sc.hourBranchTenGod?.name,
  ].filter(Boolean);

  const hasJeongJae = allTenGods.includes("정재");
  const hasPyeonJae = allTenGods.includes("편재");
  const hasJaeSung = hasJeongJae || hasPyeonJae;
  const jaeCount = allTenGods.filter(g => g === "정재" || g === "편재").length;

  const hasJeongGwan = allTenGods.includes("정관");
  const hasPyeonGwan = allTenGods.includes("편관");
  const hasGwanSung = hasJeongGwan || hasPyeonGwan;
  const gwanCount = allTenGods.filter(g => g === "정관" || g === "편관").length;

  const salNames = sp.specialSals?.map((s: any) => s.name) || [];
  const hasDohwa = salNames.includes("도화살");
  const hasHongyeom = salNames.includes("홍염살");
  const hasGwegang = salNames.includes("괴강살");
  const hasBaekho = salNames.includes("백호살");

  let isGanYeoJiDong = false;
  try { isGanYeoJiDong = checkGanYeoJiDong(sc); } catch {}

  const currentYear = new Date().getFullYear();
  const activeDaewoonStars = calculateDaewoonDynamicStars(sc, currentYear);
  const genderForSinsal = isMale ? "male" : "female" as "male" | "female";
  const sinsalAnalysis = analyzeSinsalIntegrated(sc, currentYear, genderForSinsal);

  const loveAnalysisBlock = `
━━━━ 4. 이성운/결혼운 전용 분석 데이터 ━━━━
■ 성별: ${isMale ? "남성" : "여성"}
■ 이성운 핵심 십성 (${isMale ? "재성=배우자" : "관성=배우자"}):
  - ${isMale ? `재성(편재/정재) 보유: ${hasJaeSung ? "있음" : "없음 (무재 사주)"} / 편재 ${hasPyeonJae ? "있음" : "없음"} / 정재 ${hasJeongJae ? "있음" : "없음"} / 재성 개수: ${jaeCount}개` : `관성(편관/정관) 보유: ${hasGwanSung ? "있음" : "없음 (무관 사주)"} / 편관 ${hasPyeonGwan ? "있음" : "없음"} / 정관 ${hasJeongGwan ? "있음" : "없음"} / 관성 개수: ${gwanCount}개`}
  - ${isMale && jaeCount >= 3 ? "⚠️ 재성 과다 (재다): 여러 이성에게 관심이 분산될 수 있음" : ""}${!isMale && gwanCount >= 3 ? "⚠️ 관성 혼잡 (관다): 이성 관계가 복잡해질 수 있음" : ""}
  - ${isMale && !hasJaeSung ? "⚠️ 무재 사주: 배우자궁 에너지 약함 → 만혼 추천" : ""}${!isMale && !hasGwanSung ? "⚠️ 무관 사주: 자신의 능력을 키우는 것이 연애운의 열쇠" : ""}
■ 연애 관련 신살:
  - 도화살: ${hasDohwa ? "있음 (이성 매력 강함, 구설수 주의)" : "없음"}
  - 홍염살: ${hasHongyeom ? "있음 (강렬한 이성 매력, 감정 파도 주의)" : "없음"}
  - 괴강살: ${hasGwegang ? "있음 (본인 기운이 매우 세므로 만혼/쿨한 상대 추천)" : "없음"}
  - 백호살: ${hasBaekho ? "있음 (강인한 기운, 배우자와 주도권 충돌 가능)" : "없음"}
■ 간여지동(干與支同): ${isGanYeoJiDong ? "해당 (일간과 일지가 같은 오행 → 배우자와 마찰/경쟁 주의)" : "해당 없음"}
■ 일간 강약: ${sc.dayMasterStrength} → ${sc.dayMasterStrength === "극왕" || sc.dayMasterStrength === "왕" ? "신강 사주 (본인 주도형, 상대방 배려 필요)" : sc.dayMasterStrength === "극약" || sc.dayMasterStrength === "약" ? "신약 사주 (의지할 배우자 필요, 결혼 후 운 상승 가능)" : "중화 사주 (균형 잡힌 관계 가능)"}
■ 부처궁 성진: ${zw.stars?.spouse?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}
`;

  const systemPrompt = `당신은 눈앞의 사람에게 운명을 이야기해주는 통찰력 있는 스토리텔러입니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[문체 헌법 — 이것이 모든 작성 원칙보다 최우선]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

당신은 '정장을 입은 영매'입니다.
차분하고 단정한 존댓말(~습니다, ~입니다, ~겁니다)을 쓰되, 내용은 칼처럼 날카롭고 소름 끼치게 정확합니다.

1. 존댓말 체계: ~습니다/~입니다/~겁니다/~십시오 (단정하고 예의 바른 톤)
2. 짧은 문장과 긴 문장의 리듬 교차. 3문장 이상 같은 길이가 연속되면 안 됩니다.
3. 핵심 통찰은 한 줄로 끊어서 임팩트. 예: "이건 드문 일입니다. 아주 드문 일."
4. 추상적 비유 다음에는 반드시 체감 가능한 구체적 현상 묘사.
5. "~할 수 있습니다", "~경향이 있습니다" 같은 약한 표현 절대 금지. "~입니다", "~겁니다"로 단정.
6. "다양한", "폭넓은", "여러 가지" 같은 빈 수식어 금지.
7. 매 섹션의 마지막 문장은 읽는 사람의 가슴에 남는 한 줄로 마무리.
8. 사주/자미두수/별자리를 분리된 단락으로 나열하지 말고, 하나의 서사 안에서 자연스럽게 엮으세요.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[톤과 깊이 참고 — 아래 수준으로 작성하되, 표현은 절대 재사용 금지]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ 아래는 분석 깊이의 기준선입니다. 이 비유/표현을 그대로 쓰면 실격.
이 사용자의 실제 일간/오행/살/구조에서 완전히 새로운 비유와 서사를 창작하세요.

— 깊이 기준: 데이터 → 해석 → 체감 현상 —
"발밑을 보면, 亥·卯·未 — 세 개의 지지가 손을 잡고 하나의 거대한 숲을 이루고 있습니다. 삼합 목국. 나무가 끊임없이 불을 먹여 키우는 구조입니다."
→ 이처럼 사주의 실제 한자/지지/합을 서사의 뼈대로 사용.

— 깊이 기준: 수치 인용 + 대운 연결 —
"사주의 화(火)가 41.2%로 극왕합니다. 여기에 51세 대운 丙子가 시작되면서 丙(양화)이 또 들어왔습니다."
→ 이처럼 실제 오행 비율(%)과 대운 정보를 구체적으로 인용.

— 깊이 기준: 데이터 근거 → 구체적 처방 —
"첫째 — 불을 끄지 마십시오. 방향만 잡으십시오. 극왕한 화가 2026년 丙午 세운과 만나 최고조에 달하고 있는데, 이 에너지를 억누르면 병이 됩니다."
→ 이처럼 모든 조언은 사주 데이터의 구체적 근거(오행/신살/대운)에서 출발.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[개인화 필수 요건 — 빠지면 실격]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 일간의 한자(甲/乙/丙/丁/戊/己/庚/辛/壬/癸)를 서사의 주인공으로 삼으세요. "이 사람"이 아니라 "壬水가", "丁火가" 처럼.
2. 오행 비율의 실제 수치(%)를 pastInference/bottleneck에서 반드시 인용하세요. "화가 강하다" (X) → "화(火)가 38.5%로 사주의 절반 가까이를 차지합니다" (O)
3. 특수살은 이름만 나열하지 말고, 원국의 어디에 앉아있는지(년지/월지/일지/시지)와 함께 서사에 녹이세요. "양인살이 있다" (X) → "양인살이 월지에 칼을 꽂고 앉아 있습니다" (O)
4. 올해 세운에서 새로 작동하는 동적 신살과 삼재 정보를 currentState와 bottleneck에 반드시 반영하세요. 올해만의 특수한 기운이 핵심.
5. 대운에서 새로 해금된 신살(Time-Unlocked Skills)은 "원래 없었는데 지금 발동됨"이라는 시간적 대비로 서술하세요.
6. 원국+세운 중복 작동 신살은 "올해 극대화"라는 강조 서사 필수.
7. solution의 모든 항목은 반드시 사주 데이터의 구체적 근거(용신, 오행 비율, 십성, 신살 이름)에서 출발해야 합니다. 근거 없는 추상적 조언("균형을 잡으세요", "열심히 하세요")은 금지.
8. 용신 개운법은 시간대/장소/색상/음식/활동을 모두 포함하되, 용신의 오행에 정확히 맞는 구체적 처방이어야 합니다.
9. businessAdvice는 십성 구조(식상생재, 관인상생 등)와 용신 기반의 구체적 업종/직업군 제시 필수.
10. loveAdvice는 이성운 전용 분석 데이터(섹션 4)를 반드시 참조하고, 재성/관성 유무와 개수에 근거하세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[작성 원칙]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**원칙 1: 키워드 스티치 금지**
"결단력이 있고 호기심이 있어..." 식의 키워드 병렬 연결 금지. 인과관계(Causality)로 서술: "A라는 기운이 B를 만나니 C라는 현상이 일어나는 겁니다"

**원칙 2: 4단계 화술**
1. Fact → 2. Interpretation (비유) → 3. Phenomenon (소름 돋는 일상 디테일) → 4. Advantage (이득 전략)

**원칙 3: 사주 중심의 수렴형 서사 (가중치: 사주 70% / 자미두수 20% / 별자리 10%)**
사주팔자가 분석의 주인(主人)입니다. 자미두수와 별자리는 사주의 해석을 확인하거나 보완하는 보조 역할입니다.

서술 구조:
1. 사주 원국의 핵심 구조(일간, 오행, 용신, 특수살, 대운)로 이야기를 시작하고 주도하세요. 전체 서사의 70%는 사주 데이터에 근거해야 합니다.
2. 자미두수는 사주의 해석을 "확인사살"하는 역할로 사용하세요. "사주에서 이렇게 나왔는데, 자미두수의 명궁/재백궁에서도 같은 이야기를 합니다"라는 흐름으로. 전체의 20%.
3. 별자리는 가벼운 보조 확인 또는 성격적 뉘앙스 추가 용도로만 사용하세요. 별자리를 주요 근거로 삼지 마세요. 전체의 10%.
4. 세 시스템이 같은 방향을 가리킬 때 "이건 우연이 아닙니다"라는 수렴의 전율을 전달하되, 주도권은 항상 사주에 있어야 합니다.

금지: 별자리 데이터를 사주와 동등한 근거로 사용하는 것. 예를 들어 "쌍둥이자리이므로 소통 능력이 뛰어납니다"를 주요 논거로 쓰지 마세요. 대신 "사주의 식상 구조가 소통 능력을 만드는데, 쌍둥이자리의 수성이 이를 한층 강화합니다" 처럼 사주가 주어, 별자리가 보조.

**원칙 4: 핵심 신살 중심 분석** — 길신(吉神)과 흉신(凶神)의 핵심 3~5개를 깊이 분석하고, 나머지는 조합 관점에서 화학적 결합만 간단히 언급. 모든 살을 나열하지 말고, 이 사람의 운명을 결정짓는 핵심 살 위주로 서술.

**원칙 5: 길흉 신살 간 화학적 결합 분석**
- 양인살+천을귀인: "칼을 쥔 귀족"
- 도화+귀문관살: "예민한 감각의 매력가"
- 역마+장성: "세계를 무대로 움직이는 리더"
- 공망+암록: "비어 보이지만 숨겨진 복록"
- 천을귀인+백호대살: "위기를 기회로 바꾸는 강인한 행운아"
- 문창귀인+화개: "학문과 예술을 겸비한 지식인"
길신이 흉신을 제어하는 관계, 흉신이 오히려 전문성이 되는 역전 관계를 분석하세요.

**원칙 6: 대운 동적 신살** — "원래 없었는데 지금 생겼다"는 시간적 대비를 서사에 녹이기.

**원칙 7: 대운/세운 충돌** — 충(沖) 있으면 변곡점으로 묘사, 구체적 변화 영역과 대비책.

**[치명적 금지]**
1. 사용자 이름 절대 금지 → "당신"으로만
2. "힘내세요" 추상적 위로 금지 → 구체적 전략
3. "~할 수 있습니다", "~경향이 있습니다" 약한 표현 금지
4. Trine, Square 등 점성술 전문 용어 금지
5. 키워드 나열 금지

**[섹션별 요구]**
- coreEnergy: 7~15자 역설/대비 은유. [A적 속성]의 [B적 존재]
- pastInference: 1000자 이상, 12~18문장. 사주→자미두수→별자리 수렴. 모든 특수살.
- currentState: 500자 이상, 7~10문장. 구체적 양자택일 갈등. 대운 연결.
- bottleneck: 500자 이상, 6~9문장. 한 문장 핵심 진단 시작. 마지막 은유 압축.
- solution: 800자 이상, "첫째/둘째/..." 5~6개 항목. 용신 개운법(시간/장소/색상/음식) 필수.
- businessAdvice: 500자 이상. 용신/십성 근거 구체적 업종.
- loveAdvice: 500자 이상. 재성/관성 근거. 최적 관계 형태 명확히.
- healthAdvice: 500자 이상. 오행 과다/부족 기반.

**[JSON 출력]**
{
  "coreEnergy": "역설 은유 7~15자",
  "coherenceScore": 80~95,
  "keywords": ["키워드1","키워드2","키워드3","키워드4","키워드5"],
  "pastInference": "1000자 이상",
  "currentState": "500자 이상",
  "bottleneck": "500자 이상",
  "solution": "800자 이상",
  "businessAdvice": "500자 이상",
  "loveAdvice": "500자 이상",
  "healthAdvice": "500자 이상"
}`;

  const userPrompt = `
[사용자 운명 데이터 - 이름 절대 사용 금지, 반드시 "당신"으로만 지칭]

━━━━ 1. 사주팔자 (四柱八字) 원본 데이터 ━━━━
■ 사주 원국:
  - 년주: ${sc.yearPillar?.stem}${sc.yearPillar?.branch} (${sc.yearPillar?.stemHanja}${sc.yearPillar?.branchHanja})
  - 월주: ${sc.monthPillar?.stem}${sc.monthPillar?.branch} (${sc.monthPillar?.stemHanja}${sc.monthPillar?.branchHanja})
  - 일주: ${sc.dayPillar?.stem}${sc.dayPillar?.branch} (${sc.dayPillar?.stemHanja}${sc.dayPillar?.branchHanja}) ← 일간(나)
  - 시주: ${sc.hourPillar?.stem}${sc.hourPillar?.branch} (${sc.hourPillar?.stemHanja}${sc.hourPillar?.branchHanja})

■ 일간 성격: ${sp.mainTrait}
■ 일간 상세: ${sp.elementPersonality}
■ 일주 강약: ${sc.dayMasterStrength} (${sp.dayMasterDescription})

■ 오행 분포:
${sc.fiveElementRatios?.map((r: any) => `  - ${r.element}(${r.elementHanja}): ${r.ratio}% (가중치 ${r.weight})`).join("\n") || "  데이터 없음"}
■ 지배 오행: ${sc.dominantElement}

■ 용신(用神): ${sc.yongShin?.element}(${sc.yongShin?.elementHanja}) — ${sc.yongShin?.reason}

■ 십성(十星) 배치: ${sp.tenGodProfile}
■ 부특성: ${sp.subTraits?.join(", ") || "없음"}

■ 천부적 재능: ${sp.talent}
■ 하늘이 준 선물: ${sp.heavenlyGift}
■ 약점: ${sp.weakPoint}

■ 특수살 [길신]: ${sp.specialSals?.filter((s: any) => s.category === "길신").map((s: any) => `${s.name}(${s.hanja}) — ${s.description}`).join("\n  ") || "없음"}
■ 특수살 [흉신]: ${sp.specialSals?.filter((s: any) => s.category === "흉신").map((s: any) => `${s.name}(${s.hanja}) — ${s.description}`).join("\n  ") || "없음"}
■ 특수살 [중성]: ${sp.specialSals?.filter((s: any) => s.category === "중성").map((s: any) => `${s.name}(${s.hanja}) — ${s.description}`).join("\n  ") || "없음"}

■ 구조 패턴: ${sp.structurePatterns?.map((p: any) => `${p.name}(${p.hanja}) — ${p.description}`).join("\n  ") || "없음"}

■ [중요] ${currentYear}년 세운 동적 신살 (올해만 작동하는 기운):
${sinsalAnalysis.dynamicSinsal?.length > 0
  ? sinsalAnalysis.dynamicSinsal.map((s: any) => `  - ${s.name}(${s.hanja}): ${s.description} [${s.foundIn}에서 발동]`).join("\n")
  : "  올해 세운에서 특별히 작동하는 동적 신살 없음"}
■ 원국+세운 중복 작동 (올해 극대화되는 기운):
${sinsalAnalysis.overlapping?.length > 0
  ? sinsalAnalysis.overlapping.map((s: any) => `  - ⚡ ${s.name}(${s.hanja}): 원국에도 있고 올해 세운에서도 작동 → 극대화!`).join("\n")
  : "  중복 작동 신살 없음"}
■ 삼재 상태: ${sinsalAnalysis.samjae ? `${sinsalAnalysis.samjae.name} — ${sinsalAnalysis.samjae.description}` : "삼재 해당 없음"}

■ [중요] ${currentYear}년 현재 활성화된 대운 무기 (Time-Unlocked Skills): ${activeDaewoonStars.length > 0
  ? activeDaewoonStars.map((s: any) => `- [${s.name}(${s.hanja})]: ${s.source}에서 들어와 지금부터 발동됨! (원래 사주엔 없었음) — ${s.description}`).join("\n  ")
  : "특이사항 없음 (현재 대운에서 새로 해금된 신살 없음)"}

■ 용신 보완법: ${sp.yongShinRemedy ? `방향: ${sp.yongShinRemedy.luckyDirection}, 색상: ${sp.yongShinRemedy.luckyColor}, 활동: ${sp.yongShinRemedy.luckyActivity}` : "없음"}

■ 대운 흐름 (10년 단위):
${sc.daeun?.slice(0, 6).map((d: any) => `  - ${d.age}세(${d.year}년): ${d.stem}${d.branch}(${d.stemHanja}${d.branchHanja})`).join("\n") || "  데이터 없음"}

■ 2026년 대운-세운 충돌 분석: ${(() => {
  const BRANCHES = ["자","축","인","묘","진","사","오","미","신","유","술","해"];
  const BRANCHES_H = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
  const CHONG: [number,number][] = [[0,6],[1,7],[2,8],[3,9],[4,10],[5,11]];
  const yr2026BranchIdx = (2026 + 8) % 12;
  if (!sc.daeun) return "데이터 없음";
  for (const dw of sc.daeun) {
    if (2026 >= dw.year && 2026 < dw.year + 10) {
      const dwBIdx = BRANCHES.indexOf(dw.branch);
      if (dwBIdx < 0) break;
      for (const [a,b] of CHONG) {
        if ((dwBIdx === a && yr2026BranchIdx === b) || (dwBIdx === b && yr2026BranchIdx === a)) {
          return `⚠️ ${dw.age}세 대운 ${dw.stemHanja}${dw.branchHanja}(${dw.stem}${dw.branch})과 2026년 세운 丙午(병오)가 ${BRANCHES_H[dwBIdx]}${BRANCHES_H[yr2026BranchIdx]}충(${dw.branch}${BRANCHES[yr2026BranchIdx]}沖)을 형성합니다. 이는 인생의 거대한 변곡점으로, 직장/거주지/인간관계에서 급격한 변화가 예상됩니다.`;
        }
      }
      return "특이사항 없음";
    }
  }
  return "특이사항 없음";
})()}

━━━━ 2. 자미두수 (紫微斗數) 원본 데이터 ━━━━
■ 명궁(命宮): ${zw.lifePalace}궁
■ 국(局): ${zw.bureau?.name} — ${zw.bureau?.desc}
■ 명궁 주성: ${zw.stars?.life?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}
■ 부처궁(配偶宮) 성진: ${zw.stars?.spouse?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}
■ 재백궁(財帛宮) 성진: ${zw.stars?.wealth?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}
■ 천이궁(遷移宮) 성진: ${zw.stars?.travel?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}
■ 해석: ${zw.interpretation}

━━━━ 3. 서양 별자리 데이터 ━━━━
■ 별자리: ${data.zodiac.sign}
■ 원소: ${data.zodiac.info.element || ""}
■ 수호성: ${data.zodiac.info.ruling || ""}
■ 특징: ${data.zodiac.info.traits?.join(", ") || data.zodiac.sign}

${loveAnalysisBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
위의 모든 데이터를 근거로 이 사람의 운명을 스토리텔링으로 풀어주세요.

[핵심] 분석의 주인은 사주팔자입니다. 서사의 70%는 사주 데이터(일간, 오행, 용신, 십성, 특수살, 대운)에 근거하세요. 자미두수(20%)는 사주 해석의 확인/보완용으로, 별자리(10%)는 성격적 뉘앙스 보조로만 사용하세요.

키워드를 나열하지 말고, 인과관계(Why → How)의 흐름으로 이야기하세요.
4단계 화술(Fact → Interpretation → Phenomenon → Advantage)을 모든 섹션에 적용하세요.
사주가 이야기를 주도하고, 자미두수/별자리가 "같은 방향을 가리키고 있다"고 확인하는 구조로 엮으세요.
절대로 사용자의 이름을 사용하지 말고, "당신"이라고만 지칭하세요.
loveAdvice는 섹션 4의 이성운 데이터를 반드시 참조하세요.

[필수 체크리스트 — 아래 항목이 하나라도 빠지면 불합격]
□ pastInference에 일간 한자(甲~癸)가 최소 3회 등장하는가?
□ pastInference에 오행 비율 수치(%)가 1회 이상 인용되었는가?
□ pastInference에 특수살이 원국의 어느 기둥(년/월/일/시)에 있는지 명시했는가?
□ currentState에 ${currentYear}년 세운 동적 신살/삼재가 반영되었는가?
□ currentState에 현재 대운 정보가 반영되었는가?
□ bottleneck에 오행 과다/부족의 구체적 수치가 인용되었는가?
□ solution의 모든 항목이 사주 데이터 근거(신살명/용신/오행)로 시작하는가?
□ solution에 용신 개운법(시간/장소/색상/음식)이 포함되었는가?
`;

  try {
    console.log("[Guardian] 1회 생성 (few-shot 강화 프롬프트) 시작...");

    const response = await getAnthropic().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      temperature: 0.85,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const rawContent = response.content[0].type === "text" ? response.content[0].text : "{}";
    const content = rawContent.replace(/```json\s*/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(content);

    if (!result.pastInference) result.pastInference = "운명 데이터 분석 중 과거 패턴을 특정할 수 없습니다.";
    if (!result.keywords || result.keywords.length === 0) result.keywords = ["분석", "진행", "연결"];
    if (!result.coherenceScore) result.coherenceScore = 85;
    if (!result.coreEnergy) result.coreEnergy = "운명의 탐구자";
    if (!result.currentState) result.currentState = "현재 상태 분석 중";
    if (!result.bottleneck) result.bottleneck = "병목 분석 중";
    if (!result.solution) result.solution = "솔루션 생성 중";
    if (!result.businessAdvice) result.businessAdvice = "재물 전략 분석 중";
    if (!result.loveAdvice) result.loveAdvice = "이성운 분석 중";
    if (!result.healthAdvice) result.healthAdvice = "건강 전략 분석 중";

    console.log(`[Guardian] 1회 생성 완료. 일치도: ${result.coherenceScore}%`);

    return result;
  } catch (e) {
    console.error("Guardian Report Generation Error:", e);
    return {
      coreEnergy: "운명의 탐구자",
      coherenceScore: 50,
      keywords: ["분석", "대기", "연결"],
      pastInference: "현재 운명 데이터 서버와 연결이 불안정하여 과거 패턴을 불러오지 못했습니다.",
      currentState: "일시적인 연결 오류가 발생했습니다.",
      bottleneck: "시스템 연결 대기 중",
      solution: "잠시 후 다시 시도해주세요.",
      businessAdvice: null,
      loveAdvice: null,
      healthAdvice: null
    };
  }
}

export async function generateYearlyFortune(data: {
  name: string;
  year: number;
  sajuChart: any;
  sajuPersonality: any;
  ziwei: any;
  zodiac: any;
  guardianReport?: {
    coreEnergy: string;
    coherenceScore: number;
    keywords: string[];
    pastInference: string | null;
    currentState: string;
    bottleneck: string;
    solution: string;
    businessAdvice: string | null;
    loveAdvice: string | null;
    healthAdvice: string | null;
  } | null;
}) {
  const sc = data.sajuChart;
  const sp = data.sajuPersonality;
  const zw = data.ziwei;

  const toneRules = `
**[톤 & 어조 규칙 - 매우 중요]**
- **균형 잡힌 분석가의 톤:** 과도하게 들뜨거나 흥분하지 마세요. "엄청난!", "놀라운!", "대박!" 같은 과장 표현 금지.
- **좋은 점과 주의할 점을 반드시 함께** 서술하세요. 모든 섹션에서 기회(+)와 리스크(-)를 균형 있게 다루세요.
- **과도한 응원/아부 금지:** 철학관 선생님처럼 담담하고 신뢰감 있게. 근거 없는 장밋빛 전망 금지.
`;

  const monthlyFlowFormat = `
**[monthlyFlow 작성 규칙]**
- 반드시 1~12월 전체 작성
- 각 월 **"O월은 OO(간지)의 기운입니다."**로 시작
- 각 월별 **최소 3문장** 이상
- 점수 0~100, 매달 장단점 균형
- **[출력 형식 (JSON)]**
{
  "summary": "300자 이상의 총평 (기회와 리스크 균형)",
  "keywords": ["키워드1", "키워드2", "키워드3"],
  "monthlyFlow": [
    {"month": 1, "score": 85, "keyword": "키워드", "summary": "1월은 ... (3문장 이상)"},
    ...12개월
  ]
}`;

  const daeunInfo = sc.daeun
    ? sc.daeun.slice(0, 6).map((d: any) => `${d.age}세(${d.year}년): ${d.stem}${d.branch}(${d.stemHanja}${d.branchHanja})`).join("\n  ")
    : "대운 데이터 없음";

  const sajuDataBlock = `
■ 사주 원국:
  - 년주: ${sc.yearPillar?.stem}${sc.yearPillar?.branch} (${sc.yearPillar?.stemHanja}${sc.yearPillar?.branchHanja})
  - 월주: ${sc.monthPillar?.stem}${sc.monthPillar?.branch} (${sc.monthPillar?.stemHanja}${sc.monthPillar?.branchHanja})
  - 일주: ${sc.dayPillar?.stem}${sc.dayPillar?.branch} (${sc.dayPillar?.stemHanja}${sc.dayPillar?.branchHanja}) ← 일간(나)
  - 시주: ${sc.hourPillar?.stem}${sc.hourPillar?.branch} (${sc.hourPillar?.stemHanja}${sc.hourPillar?.branchHanja})
■ 일간 성격: ${sp.mainTrait}
■ 일주 강약: ${sc.dayMasterStrength} (${sp.dayMasterDescription})
■ 오행 분포:
${sc.fiveElementRatios?.map((r: any) => `  - ${r.element}(${r.elementHanja}): ${r.ratio}% (가중치 ${r.weight})`).join("\n") || "  데이터 없음"}
■ 용신(用神): ${sc.yongShin?.element}(${sc.yongShin?.elementHanja}) — ${sc.yongShin?.reason}
■ 십성(十星) 배치: ${sp.tenGodProfile}
■ 특수살 [길신]: ${sp.specialSals?.filter((s: any) => s.category === "길신").map((s: any) => `${s.name}(${s.hanja})`).join(", ") || "없음"}
■ 특수살 [흉신]: ${sp.specialSals?.filter((s: any) => s.category === "흉신").map((s: any) => `${s.name}(${s.hanja})`).join(", ") || "없음"}
■ 특수살 [중성]: ${sp.specialSals?.filter((s: any) => s.category === "중성").map((s: any) => `${s.name}(${s.hanja})`).join(", ") || "없음"}
■ 구조 패턴: ${sp.structurePatterns?.map((p: any) => `${p.name}(${p.hanja})`).join(", ") || "없음"}
■ 대운 흐름 (10년 단위):
  ${daeunInfo}`;

  const ziweiDataBlock = `
■ 명궁(命宮): ${zw.lifePalace}궁
■ 국(局): ${zw.bureau?.name} — ${zw.bureau?.desc}
■ 명궁 주성: ${zw.stars?.life?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}
■ 부처궁 성진: ${zw.stars?.spouse?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}
■ 재백궁 성진: ${zw.stars?.wealth?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}
■ 천이궁 성진: ${zw.stars?.travel?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}
■ 관록궁 성진: ${zw.stars?.career?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}
■ 질액궁 성진: ${zw.stars?.health?.map((s: any) => `${s.name}(${s.nature})`).join(", ") || "없음"}`;

  const zodiacDataBlock = `
■ 별자리: ${data.zodiac.sign}
■ 원소: ${data.zodiac.info.element || ""}
■ 수호성: ${data.zodiac.info.ruling || ""}
■ 특징: ${data.zodiac.info.traits?.join(", ") || data.zodiac.sign}`;

  const sajuPrompt = `당신은 60년 경력의 정통 명리학 대가입니다. **오직 사주팔자(四柱八字) 명리학만** 사용하여 ${data.year}년(병오년) 운세를 분석하세요.
다른 체계(자미두수, 별자리)는 절대 참조하지 마세요. 순수 명리학적 관점으로만 분석합니다.
${toneRules}

[분석 방법]
1. ${data.year}년 세운(병오)이 일주(${sc.dayPillar?.stemHanja}${sc.dayPillar?.branchHanja})와 맺는 합/충/형/파/해 관계 분석
2. 대운과 세운의 상호작용 분석 (대운이 바뀌는 해인지, 현재 대운이 세운과 어떤 관계인지)
3. 용신(${sc.yongShin?.elementHanja})이 올해 힘을 받는지/극을 당하는지
4. 십성 관점에서 올해 재성/관성/식상/인성의 흐름
5. 월별 흐름은 각 월의 간지와 일주의 관계로 분석

${monthlyFlowFormat}`;

  const ziweiPrompt = `당신은 자미두수(紫微斗數) 전문 명리가입니다. **오직 자미두수 체계만** 사용하여 ${data.year}년 운세를 분석하세요.
다른 체계(사주팔자, 별자리)는 절대 참조하지 마세요. 순수 자미두수적 관점으로만 분석합니다.
${toneRules}

[분석 방법]
1. 명궁(${zw.lifePalace}궁)의 주성 배치가 ${data.year}년 유년(流年)에 미치는 영향
2. 재백궁/관록궁 성진의 올해 작용력 (사업/재물 관련)
3. 부처궁 성진의 올해 작용력 (인간관계/연애)
4. 질액궁 성진의 올해 작용력 (건강)
5. 천이궁 성진의 올해 변동 (이동/변화)
6. 월별 흐름은 유월(流月) 성진의 이동에 따라 분석 (각 궁의 성진이 순행하는 월별 변화)

${monthlyFlowFormat}`;

  const zodiacPrompt = `당신은 서양 점성술(Astrology) 전문가입니다. **오직 서양 점성술 체계만** 사용하여 ${data.year}년 운세를 분석하세요.
다른 체계(사주팔자, 자미두수)는 절대 참조하지 마세요. 순수 점성술적 관점으로만 분석합니다.
${toneRules}

[분석 방법]
1. ${data.zodiac.sign}자리의 ${data.year}년 주요 행성 트랜짓 (목성, 토성, 천왕성 등)
2. 수호성(${data.zodiac.info.ruling || ""})의 올해 위치와 영향
3. 원소(${data.zodiac.info.element || ""})와 올해 에너지의 조화/충돌
4. 월별 흐름은 태양, 달, 수성, 금성, 화성의 이동에 따른 트랜짓 분석
5. 레트로그레이드(역행) 시기의 영향도 반영

[점성술 용어 순화 규칙]
- 점성술 전문 용어(Trine, Square, Semi-sextile, Conjunction, Opposition 등)를 절대 그대로 쓰지 마세요.
- 대신 그 각도가 의미하는 **운의 흐름**으로 번역하세요: "아주 좋은 흐름", "약간 긴장된 기운", "조화로운 만남", "대립의 에너지" 등.
- "세미섹스타일", "트라인", "스퀘어" 같은 영어/외래어 용어 사용 금지.

${monthlyFlowFormat}`;

  try {
    console.log(`[Yearly] ${data.year}년 운세 GPT 1회 통합 호출 시작 (사주+자미두수+별자리+교차검증)...`);

    const gr = data.guardianReport;
    const guardianBlock = gr ? `
━━━━ [가디언 리포트 — 반드시 참고 + 원본 사주와 교차 검증] ━━━━
■ 핵심 에너지: ${gr.coreEnergy || "분석 없음"}
■ 일치도: ${gr.coherenceScore || 0}%
■ 키워드: ${(gr.keywords || []).join(", ") || "없음"}
■ 운명 추적: ${gr.pastInference || "없음"}
■ 현재 딜레마: ${gr.currentState || "없음"}
■ 결정적 병목: ${gr.bottleneck || "없음"}
■ 해결책: ${gr.solution || "없음"}
■ 재물 조언: ${gr.businessAdvice || "없음"}
■ 연애 조언: ${gr.loveAdvice || "없음"}
■ 건강 조언: ${gr.healthAdvice || "없음"}
[검증 지침] Guardian Report의 용신/오행 분석이 원본 사주와 불일치 시 원본 사주 기준으로 수정하세요.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : "";

    const consolidatedYearlySystemPrompt = `당신은 동양의 명리학(사주팔자), 동양의 자미두수(紫微斗數), 서양의 점성술(별자리) 세 체계로 ${data.year}년 연간 운세를 동시에 분석하고 교차 검증하는 '운명 데이터 융합 전문가'입니다.

${toneRules}

━━━━ [사주팔자 분석 지침] ━━━━
${sajuPrompt.split(toneRules)[1] || sajuPrompt}

━━━━ [자미두수 분석 지침] ━━━━
${ziweiPrompt.split(toneRules)[1] || ziweiPrompt}

━━━━ [별자리 분석 지침] ━━━━
${zodiacPrompt.split(toneRules)[1] || zodiacPrompt}

━━━━ [교차 검증 및 종합 원칙] ━━━━
1. 2개 이상 체계에서 공통으로 언급하는 내용만 종합 결과에 채택하세요.
2. overallSummary는 대운 흐름을 맨 앞에 배치하고 1000자 내외로 작성하세요.${gr ? "\n3. Guardian Report의 핵심 에너지와 병목/해결책을 overallSummary에 자연스럽게 녹여내세요." : ""}
4. 월별 summary는 반드시 **"O월은 OO(간지)의 기운입니다."**로 시작하고 3문장 이상 작성하세요.
5. 각 체계별 월별 점수(0~100)는 독립적으로 산정하고, 종합 monthlyFlow 점수는 3체계 평균을 사용하세요.
6. 좋은 점과 주의할 점을 반드시 함께 서술하세요. 과도한 긍정 금지.
${guardianBlock}

━━━━ [출력 형식 — 반드시 이 JSON만 응답] ━━━━
{
  "saju": {
    "summary": "사주팔자 관점 ${data.year}년 총평 (300자 이상)",
    "keywords": ["키워드1", "키워드2", "키워드3"],
    "monthlyFlow": [
      {"month": 1, "score": 0~100, "keyword": "대표키워드", "summary": "1월은 OO(간지)의 기운입니다. 3문장 이상"},
      ... (1~12월 전체)
    ]
  },
  "ziwei": {
    "summary": "자미두수 관점 ${data.year}년 총평 (300자 이상)",
    "keywords": ["키워드1", "키워드2", "키워드3"],
    "monthlyFlow": [
      {"month": 1, "score": 0~100, "keyword": "대표키워드", "summary": "1월은 OO(간지)의 기운입니다. 3문장 이상"},
      ... (1~12월 전체)
    ]
  },
  "zodiac": {
    "summary": "별자리 관점 ${data.year}년 총평 (300자 이상)",
    "keywords": ["키워드1", "키워드2", "키워드3"],
    "monthlyFlow": [
      {"month": 1, "score": 0~100, "keyword": "대표키워드", "summary": "1월은 OO(간지)의 기운입니다. 3문장 이상"},
      ... (1~12월 전체)
    ]
  },
  "overallSummary": "3체계 교차검증 기반 1000자 종합 총평",
  "coherenceScore": 70~95,
  "businessFortune": "500자 이상 재물/사업 전략",
  "loveFortune": "500자 이상 연애/인간관계 조언",
  "healthFortune": "500자 이상 건강 관리법",
  "keywords": ["공통키워드1", "공통키워드2", "공통키워드3"],${gr ? '\n  "guardianValidation": {"isConsistent": true/false, "notes": "검증 결과 요약"},' : ""}
  "monthlyFlow": [
    {"month": 1, "score": 3체계평균, "keyword": "대표키워드", "keywords": ["키1","키2","키3"], "summary": "1월은 OO(간지)의 기운입니다. 3문장 이상"},
    ... (1~12월 전체)
  ]
}`;

    const consolidatedYearlyUserPrompt = `${data.year}년 연간 운세 분석. 사용자 이름을 절대 사용하지 말고 "당신"으로만 지칭하세요.

**[사주팔자 원본 데이터]**
${sajuDataBlock}

**[자미두수 원본 데이터]**
${ziweiDataBlock}

**[별자리 데이터]**
${zodiacDataBlock}`;

    const yearlyRaw = await generateWithClaude(
      consolidatedYearlySystemPrompt,
      consolidatedYearlyUserPrompt,
      "연간운세통합",
      0.7,
      16000
    );

    const monthlyFlowSchema = z.array(z.object({
      month: z.number().int().min(1).max(12),
      score: z.number().min(0).max(100),
      keyword: z.string(),
      keywords: z.array(z.string()).optional(),
      summary: z.string(),
    }));

    const yearlyFortuneResponseSchema = z.object({
      saju: z.object({
        summary: z.string().default(""),
        keywords: z.array(z.string()).default([]),
        monthlyFlow: monthlyFlowSchema.default([]),
      }).optional(),
      ziwei: z.object({
        summary: z.string().default(""),
        keywords: z.array(z.string()).default([]),
        monthlyFlow: monthlyFlowSchema.default([]),
      }).optional(),
      zodiac: z.object({
        summary: z.string().default(""),
        keywords: z.array(z.string()).default([]),
        monthlyFlow: monthlyFlowSchema.default([]),
      }).optional(),
      overallSummary: z.string().min(1),
      coherenceScore: z.number().min(0).max(100).default(75),
      businessFortune: z.string().nullable().default(null),
      loveFortune: z.string().nullable().default(null),
      healthFortune: z.string().nullable().default(null),
      keywords: z.array(z.string()).default([]),
      guardianValidation: z.object({
        isConsistent: z.boolean(),
        notes: z.string(),
      }).optional(),
      monthlyFlow: monthlyFlowSchema.default([]),
    });

    console.log(`[Yearly] Claude 응답 길이: ${yearlyRaw.length}자`);
    console.log(`[Yearly] Claude 응답 첫 1000자:`, yearlyRaw.substring(0, 1000));
    console.log(`[Yearly] Claude 응답 마지막 500자:`, yearlyRaw.substring(yearlyRaw.length - 500));

    const rawResult = parseJson(yearlyRaw, yearlyFortuneResponseSchema);
    if (!rawResult) {
      throw new Error("연간 운세 통합 분석 파싱 실패");
    }

    const emptyMonthlyFlow = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1, score: 50, keyword: "분석", summary: "데이터 종합 중"
    }));

    const sajuParsed = rawResult.saju || { summary: "", monthlyFlow: emptyMonthlyFlow };
    const ziweiParsed = rawResult.ziwei || { summary: "", monthlyFlow: emptyMonthlyFlow };
    const zodiacParsed = rawResult.zodiac || { summary: "", monthlyFlow: emptyMonthlyFlow };

    if (rawResult.guardianValidation) {
      const gv = rawResult.guardianValidation;
      console.log(`[Yearly] Guardian 검증: ${gv.isConsistent ? "일치" : "불일치 발견"} — ${gv.notes}`);
    }
    console.log(`[Yearly] ${data.year}년 운세 Claude 통합 완료. 일치도: ${rawResult.coherenceScore}%`);

    return {
      overallSummary: rawResult.overallSummary,
      coherenceScore: rawResult.coherenceScore,
      businessFortune: rawResult.businessFortune,
      loveFortune: rawResult.loveFortune,
      healthFortune: rawResult.healthFortune,
      keywords: rawResult.keywords,
      monthlyFlow: (rawResult.monthlyFlow && rawResult.monthlyFlow.length > 0) ? rawResult.monthlyFlow : emptyMonthlyFlow,
      sajuMonthlyFlow: sajuParsed.monthlyFlow,
      sajuSummary: sajuParsed.summary,
      ziweiMonthlyFlow: ziweiParsed.monthlyFlow,
      ziweiSummary: ziweiParsed.summary,
      zodiacMonthlyFlow: zodiacParsed.monthlyFlow,
      zodiacSummary: zodiacParsed.summary,
    };
  } catch (e) {
    console.error("Yearly Fortune Generation Error:", e);
    const emptyFlow = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1, score: 50, keyword: "대기", summary: "분석 대기 중"
    }));
    return {
      overallSummary: "운세 데이터를 분석하는 중 문제가 발생했습니다.",
      coherenceScore: 50,
      businessFortune: "잠시 후 다시 시도해주세요.",
      loveFortune: "잠시 후 다시 시도해주세요.",
      healthFortune: "잠시 후 다시 시도해주세요.",
      keywords: ["분석", "대기"],
      monthlyFlow: emptyFlow,
      sajuMonthlyFlow: emptyFlow,
      sajuSummary: "분석 대기 중",
      ziweiMonthlyFlow: emptyFlow,
      ziweiSummary: "분석 대기 중",
      zodiacMonthlyFlow: emptyFlow,
      zodiacSummary: "분석 대기 중",
    };
  }
}