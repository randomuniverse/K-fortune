import { Solar } from 'lunar-javascript';

export const HEAVENLY_STEMS = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"] as const;
export const HEAVENLY_STEMS_HANJA = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;

export const EARTHLY_BRANCHES = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"] as const;
export const EARTHLY_BRANCHES_HANJA = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;

export const CHINESE_ZODIAC_ANIMALS = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"] as const;

export const FIVE_ELEMENTS = ["목", "화", "토", "금", "수"] as const;
export const FIVE_ELEMENTS_HANJA = ["木", "火", "土", "金", "水"] as const;

export type StemElement = { element: number; polarity: "양" | "음" };

const STEM_ELEMENTS: StemElement[] = [
  { element: 0, polarity: "양" }, // 갑 = 木양
  { element: 0, polarity: "음" }, // 을 = 木음
  { element: 1, polarity: "양" }, // 병 = 火양
  { element: 1, polarity: "음" }, // 정 = 火음
  { element: 2, polarity: "양" }, // 무 = 土양
  { element: 2, polarity: "음" }, // 기 = 土음
  { element: 3, polarity: "양" }, // 경 = 金양
  { element: 3, polarity: "음" }, // 신 = 金음
  { element: 4, polarity: "양" }, // 임 = 水양
  { element: 4, polarity: "음" }, // 계 = 水음
];

const BRANCH_HIDDEN_STEMS: number[][] = [
  [9],       // 자: 계
  [5, 9, 7], // 축: 기, 계, 신
  [0, 2, 4], // 인: 갑, 병, 무
  [1],       // 묘: 을
  [4, 1, 9], // 진: 무, 을, 계
  [2, 6, 4], // 사: 병, 경, 무
  [3, 5],    // 오: 정, 기
  [5, 3, 1], // 미: 기, 정, 을
  [6, 8, 4], // 신: 경, 임, 무
  [7],       // 유: 신
  [4, 7, 3], // 술: 무, 신, 정
  [8, 0],    // 해: 임, 갑
];

const HIDDEN_STEM_WEIGHTS: number[][] = [
  [1.0],           // 자
  [0.6, 0.3, 0.1], // 축
  [0.6, 0.3, 0.1], // 인
  [1.0],           // 묘
  [0.6, 0.3, 0.1], // 진
  [0.6, 0.3, 0.1], // 사
  [0.7, 0.3],      // 오
  [0.5, 0.3, 0.2], // 미
  [0.6, 0.3, 0.1], // 신
  [1.0],           // 유
  [0.5, 0.3, 0.2], // 술
  [0.7, 0.3],      // 해
];

const SOLAR_TERMS_APPROX = [
  { month: 2, day: 4 },   // 입춘 → 인
  { month: 3, day: 6 },   // 경칩 → 묘
  { month: 4, day: 5 },   // 청명 → 진
  { month: 5, day: 6 },   // 입하 → 사
  { month: 6, day: 6 },   // 망종 → 오
  { month: 7, day: 7 },   // 소서 → 미
  { month: 8, day: 8 },   // 입추 → 신
  { month: 9, day: 8 },   // 백로 → 유
  { month: 10, day: 8 },  // 한로 → 술
  { month: 11, day: 7 },  // 입동 → 해
  { month: 12, day: 7 },  // 대설 → 자
  { month: 1, day: 6 },   // 소한 → 축
];

const SEASON_ELEMENT_MAP: Record<number, number> = {
  2: 0, 3: 0, // 인묘 → 목(봄)
  4: 0, // 진 → 목(늦봄)
  5: 1, 6: 1, // 사오 → 화(여름)
  7: 2, // 미 → 토
  8: 3, 9: 3, // 신유 → 금(가을)
  10: 3, // 술 → 금
  11: 4, 0: 4, // 해자 → 수(겨울)
  1: 2, // 축 → 토
};

export interface Pillar {
  stemIndex: number;
  branchIndex: number;
  stem: string;
  stemHanja: string;
  branch: string;
  branchHanja: string;
}

export interface TenGod {
  name: string;
}

export interface SajuChart {
  yearPillar: Pillar;
  monthPillar: Pillar;
  dayPillar: Pillar;
  hourPillar: Pillar;
  chineseZodiac: string;
  chineseZodiacBranch: string;
  chineseZodiacDisplay: string;
  lunarDate: string;
  yearTenGod: TenGod;
  monthTenGod: TenGod;
  hourTenGod: TenGod;
  yearBranchTenGod: TenGod;
  monthBranchTenGod: TenGod;
  dayBranchTenGod: TenGod;
  hourBranchTenGod: TenGod;
  fiveElementRatios: { element: string; elementHanja: string; ratio: number; weight: number }[];
  dominantElement: string;
  dayMasterStrength: "극왕" | "왕" | "중화" | "약" | "극약";
  yongShin: { element: string; elementHanja: string; reason: string };
  daeun: { age: number; year: number; stem: string; stemHanja: string; branch: string; branchHanja: string }[];
  daeunStartAge: number;
}

function makePillar(stemIdx: number, branchIdx: number): Pillar {
  const si = ((stemIdx % 10) + 10) % 10;
  const bi = ((branchIdx % 12) + 12) % 12;
  return {
    stemIndex: si,
    branchIndex: bi,
    stem: HEAVENLY_STEMS[si],
    stemHanja: HEAVENLY_STEMS_HANJA[si],
    branch: EARTHLY_BRANCHES[bi],
    branchHanja: EARTHLY_BRANCHES_HANJA[bi],
  };
}

function getJDN(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

function getSolarTermMonthIndex(year: number, month: number, day: number): number {
  const terms = SOLAR_TERMS_APPROX;
  let monthBranchIndex = -1;
  for (let i = 0; i < 12; i++) {
    const t = terms[i];
    const nextT = terms[(i + 1) % 12];
    const branchIdx = (i + 2) % 12; // 입춘=인(2), 경칩=묘(3), ...
    if (t.month === month && day >= t.day) {
      if (i < 11) {
        if (nextT.month === month) {
          if (day < nextT.day) { monthBranchIndex = branchIdx; break; }
        } else {
          monthBranchIndex = branchIdx; break;
        }
      } else {
        monthBranchIndex = branchIdx; break;
      }
    }
    if (t.month !== month) continue;
  }
  if (monthBranchIndex === -1) {
    for (let i = 11; i >= 0; i--) {
      const t = terms[i];
      const branchIdx = (i + 2) % 12;
      if (month > t.month || (month === t.month && day >= t.day)) {
        monthBranchIndex = branchIdx;
        break;
      }
    }
  }
  if (monthBranchIndex === -1) {
    monthBranchIndex = 1; // 축 (Jan before 소한)
  }
  return monthBranchIndex;
}

function getMonthBranchIndex(year: number, month: number, day: number): number {
  const d = new Date(year, month - 1, day);
  const dayOfYear = Math.floor((d.getTime() - new Date(year, 0, 1).getTime()) / 86400000) + 1;

  const solarTermDays = [
    4,   // Feb 4 = 입춘 → 인(2)
    35,  // Mar 6 = 경칩 → 묘(3)
    65,  // Apr 5 = 청명 → 진(4) (95th day)
    95,  // May 6 = 입하 → 사(5)
    126, // Jun 6 = 망종 → 오(6)
    157, // Jul 7 = 소서 → 미(7)
    188, // Aug 8 = 입추 → 신(8)
    220, // Sep 8 = 백로 → 유(9)
    251, // Oct 8 = 한로 → 술(10)
    281, // Nov 7 = 입동 → 해(11)
    311, // Dec 7 = 대설 → 자(0)
    341, // Jan 6 next year = 소한 → 축(1) — actually this wraps
  ];

  const termDayOfYear: { doy: number; branch: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const t = SOLAR_TERMS_APPROX[i];
    const tDate = new Date(year, t.month - 1, t.day);
    const tDoy = Math.floor((tDate.getTime() - new Date(year, 0, 1).getTime()) / 86400000) + 1;
    termDayOfYear.push({ doy: tDoy, branch: (i + 2) % 12 });
  }
  termDayOfYear.sort((a, b) => a.doy - b.doy);

  let result = 1; // default 축
  for (const t of termDayOfYear) {
    if (dayOfYear >= t.doy) {
      result = t.branch;
    } else {
      break;
    }
  }
  return result;
}

export function calculateYearPillar(year: number, month: number, day: number): Pillar {
  let adjustedYear = year;
  const febDate = new Date(year, 1, 4);
  const birthDate = new Date(year, month - 1, day);
  if (birthDate < febDate) {
    adjustedYear = year - 1;
  }
  const stemIdx = (adjustedYear - 4) % 10;
  const branchIdx = (adjustedYear - 4) % 12;
  return makePillar(stemIdx, branchIdx);
}

export function calculateMonthPillar(year: number, month: number, day: number, yearStemIdx: number): Pillar {
  const branchIdx = getMonthBranchIndex(year, month, day);

  const yearStemGroup = yearStemIdx % 5;
  const startStems = [2, 4, 6, 8, 0]; // 갑/기→병, 을/경→무, 병/신→경, 정/임→임, 무/계→갑
  const startStem = startStems[yearStemGroup];

  const monthOffset = (branchIdx - 2 + 12) % 12;
  const stemIdx = (startStem + monthOffset) % 10;

  return makePillar(stemIdx, branchIdx);
}

// ---------------------------------------------------------
// 일주 계산: (JDN + 49) % 60 으로 육십갑자 인덱스 산출
// 검증: 1975-06-10=丁亥, 2000-01-01=戊午, 1949-10-01=甲子
// ---------------------------------------------------------
export function calculateDayPillar(year: number, month: number, day: number): Pillar {
  const jdn = getJDN(year, month, day);
  const sexagenaryCycle = ((jdn + 49) % 60 + 60) % 60;
  const stemIdx = sexagenaryCycle % 10;
  const branchIdx = sexagenaryCycle % 12;
  return makePillar(stemIdx, branchIdx);
}

export function calculateHourPillar(hour: number, minute: number, dayStemIdx: number): Pillar {
  const totalMinutes = hour * 60 + minute;
  let branchIdx: number;
  if (totalMinutes >= 1380 || totalMinutes < 60) branchIdx = 0;       // 자 23:00-00:59
  else if (totalMinutes < 180) branchIdx = 1;  // 축 01:00-02:59
  else if (totalMinutes < 300) branchIdx = 2;  // 인 03:00-04:59
  else if (totalMinutes < 420) branchIdx = 3;  // 묘 05:00-06:59
  else if (totalMinutes < 540) branchIdx = 4;  // 진 07:00-08:59
  else if (totalMinutes < 660) branchIdx = 5;  // 사 09:00-10:59
  else if (totalMinutes < 780) branchIdx = 6;  // 오 11:00-12:59
  else if (totalMinutes < 900) branchIdx = 7;  // 미 13:00-14:59
  else if (totalMinutes < 1020) branchIdx = 8; // 신 15:00-16:59
  else if (totalMinutes < 1140) branchIdx = 9; // 유 17:00-18:59
  else if (totalMinutes < 1260) branchIdx = 10;// 술 19:00-20:59
  else branchIdx = 11;                         // 해 21:00-22:59

  const dayStemGroup = dayStemIdx % 5;
  const startStems = [0, 2, 4, 6, 8]; // 갑/기→갑, 을/경→병, 병/신→무, 정/임→경, 무/계→임
  const startStem = startStems[dayStemGroup];
  const stemIdx = (startStem + branchIdx) % 10;

  return makePillar(stemIdx, branchIdx);
}

export function getTenGodName(dayStemIdx: number, targetStemIdx: number): string {
  const dayEl = STEM_ELEMENTS[dayStemIdx];
  const targetEl = STEM_ELEMENTS[targetStemIdx];

  const dayE = dayEl.element;
  const targetE = targetEl.element;
  const samePolarity = dayEl.polarity === targetEl.polarity;

  const produces = (a: number) => (a + 1) % 5; // 목→화→토→금→수→목
  const controls = (a: number) => (a + 2) % 5; // 목→토, 화→금, 토→수, 금→목, 수→화

  if (dayE === targetE) {
    return samePolarity ? "비견" : "겁재";
  }
  if (produces(dayE) === targetE) {
    return samePolarity ? "식신" : "상관";
  }
  if (produces(targetE) === dayE) {
    return samePolarity ? "편인" : "정인";
  }
  if (controls(dayE) === targetE) {
    return samePolarity ? "편재" : "정재";
  }
  if (controls(targetE) === dayE) {
    return samePolarity ? "편관" : "정관";
  }
  return "비견";
}

function getBranchMainHiddenStem(branchIdx: number): number {
  return BRANCH_HIDDEN_STEMS[branchIdx][0];
}

export function calculateFiveElements(
  yearPillar: Pillar, monthPillar: Pillar, dayPillar: Pillar, hourPillar: Pillar,
  monthBranchIdx: number
): { element: string; elementHanja: string; ratio: number; weight: number }[] {
  const weights: number[] = [0, 0, 0, 0, 0];

  const addStemWeight = (stemIdx: number, w: number) => {
    weights[STEM_ELEMENTS[stemIdx].element] += w;
  };

  addStemWeight(yearPillar.stemIndex, 1.0);
  addStemWeight(monthPillar.stemIndex, 1.0);
  addStemWeight(dayPillar.stemIndex, 1.0);
  addStemWeight(hourPillar.stemIndex, 1.0);

  const pillars = [yearPillar, monthPillar, dayPillar, hourPillar];
  for (const p of pillars) {
    const hiddenStems = BRANCH_HIDDEN_STEMS[p.branchIndex];
    const hiddenWeights = HIDDEN_STEM_WEIGHTS[p.branchIndex];
    for (let j = 0; j < hiddenStems.length; j++) {
      addStemWeight(hiddenStems[j], hiddenWeights[j]);
    }
  }

  const seasonElement = SEASON_ELEMENT_MAP[monthBranchIdx] ?? 2;
  weights[seasonElement] += 0.5;

  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((w, i) => ({
    element: FIVE_ELEMENTS[i],
    elementHanja: FIVE_ELEMENTS_HANJA[i],
    ratio: total > 0 ? Math.round((w / total) * 1000) / 10 : 0,
    weight: Math.round(w * 10) / 10,
  }));
}

export function getDayMasterStrength(
  dayPillar: Pillar,
  fiveElements: { element: string; ratio: number }[],
  monthBranchIdx: number
): "극왕" | "왕" | "중화" | "약" | "극약" {
  const dayElIdx = STEM_ELEMENTS[dayPillar.stemIndex].element;
  const dayElement = FIVE_ELEMENTS[dayElIdx];
  const producesDay = FIVE_ELEMENTS[(dayElIdx + 4) % 5];

  const dayRatio = fiveElements.find(e => e.element === dayElement)?.ratio || 0;
  const supportRatio = fiveElements.find(e => e.element === producesDay)?.ratio || 0;
  let totalSupport = dayRatio + supportRatio;

  const monthMainStem = BRANCH_HIDDEN_STEMS[monthBranchIdx][0];
  const monthElIdx = STEM_ELEMENTS[monthMainStem].element;

  const controlsDay = (monthElIdx + 2) % 5 === dayElIdx;
  const dayControls = (dayElIdx + 2) % 5 === monthElIdx;
  const monthProducesDay = (monthElIdx + 1) % 5 === dayElIdx;
  const monthSameAsDay = monthElIdx === dayElIdx;

  if (controlsDay) {
    totalSupport *= 0.65;
  } else if (dayControls) {
    totalSupport *= 0.85;
  } else if (monthProducesDay || monthSameAsDay) {
    totalSupport *= 1.25;
  }

  if (totalSupport >= 55) return "극왕";
  if (totalSupport >= 42) return "왕";
  if (totalSupport >= 28) return "중화";
  if (totalSupport >= 15) return "약";
  return "극약";
}

function getJohuYongShin(
  dayElIdx: number,
  monthBranchIdx: number
): { element: string; elementHanja: string; reason: string } | null {
  const isSummer = [5, 6, 7].includes(monthBranchIdx);
  const isWinter = [11, 0, 1].includes(monthBranchIdx);

  if (!isSummer && !isWinter) return null;

  const johuMap: Record<string, { elIdx: number; reason: string }> = {
    "3_summer": { elIdx: 4, reason: "한여름에 태어난 금(金)이 불에 달궈져 있어 수(水)로 식혀야 합니다 (조후용신)." },
    "3_winter": { elIdx: 1, reason: "한겨울에 태어난 금(金)이 얼어붙어 있어 화(火)로 녹여야 합니다 (조후용신)." },
    "0_winter": { elIdx: 1, reason: "한겨울에 태어난 목(木)이 동결되어 화(火)로 따뜻하게 해야 합니다 (조후용신)." },
    "0_summer": { elIdx: 4, reason: "한여름에 태어난 목(木)이 말라 수(水)로 촉촉하게 해야 합니다 (조후용신)." },
    "1_winter": { elIdx: 0, reason: "한겨울에 태어난 화(火)가 꺼질 위험이 있어 목(木)으로 살려야 합니다 (조후용신)." },
    "1_summer": { elIdx: 4, reason: "한여름에 태어난 화(火)가 과열되어 수(水)로 조절해야 합니다 (조후용신)." },
    "4_summer": { elIdx: 3, reason: "한여름에 태어난 수(水)가 증발 위험이 있어 금(金)으로 생조해야 합니다 (조후용신)." },
    "4_winter": { elIdx: 1, reason: "한겨울에 태어난 수(水)가 얼어붙어 화(火)로 따뜻하게 해야 합니다 (조후용신)." },
    "2_summer": { elIdx: 4, reason: "한여름에 태어난 토(土)가 메말라 수(水)로 적셔야 합니다 (조후용신)." },
    "2_winter": { elIdx: 1, reason: "한겨울에 태어난 토(土)가 얼어붙어 화(火)로 따뜻하게 해야 합니다 (조후용신)." },
  };

  const season = isSummer ? "summer" : "winter";
  const key = `${dayElIdx}_${season}`;
  const johu = johuMap[key];

  if (!johu) return null;

  return {
    element: FIVE_ELEMENTS[johu.elIdx],
    elementHanja: FIVE_ELEMENTS_HANJA[johu.elIdx],
    reason: johu.reason,
  };
}

export function calculateYongShin(
  dayPillar: Pillar,
  strength: "극왕" | "왕" | "중화" | "약" | "극약",
  fiveElements: { element: string; elementHanja: string; ratio: number }[],
  monthBranchIdx: number
): { element: string; elementHanja: string; reason: string } {
  const dayElIdx = STEM_ELEMENTS[dayPillar.stemIndex].element;

  const johu = getJohuYongShin(dayElIdx, monthBranchIdx);
  if (johu) {
    return johu;
  }

  if (strength === "극왕") {
    const drainIdx = (dayElIdx + 1) % 5;
    return {
      element: FIVE_ELEMENTS[drainIdx],
      elementHanja: FIVE_ELEMENTS_HANJA[drainIdx],
      reason: `일간이 극왕하여 ${FIVE_ELEMENTS[drainIdx]}(${FIVE_ELEMENTS_HANJA[drainIdx]})으로 설기(泄氣)가 필요합니다.`,
    };
  }

  if (strength === "왕") {
    const drainIdx = (dayElIdx + 1) % 5;
    return {
      element: FIVE_ELEMENTS[drainIdx],
      elementHanja: FIVE_ELEMENTS_HANJA[drainIdx],
      reason: `일간이 왕하여 ${FIVE_ELEMENTS[drainIdx]}(${FIVE_ELEMENTS_HANJA[drainIdx]})으로 기운을 분산시킵니다.`,
    };
  }

  if (strength === "극약" || strength === "약") {
    const supportIdx = (dayElIdx + 4) % 5;
    return {
      element: FIVE_ELEMENTS[supportIdx],
      elementHanja: FIVE_ELEMENTS_HANJA[supportIdx],
      reason: `일간이 ${strength}하여 ${FIVE_ELEMENTS[supportIdx]}(${FIVE_ELEMENTS_HANJA[supportIdx]})의 생조(生助)가 필요합니다.`,
    };
  }

  const weakest = [...fiveElements].sort((a, b) => a.ratio - b.ratio)[0];
  return {
    element: weakest.element,
    elementHanja: weakest.elementHanja,
    reason: `중화 상태이나 ${weakest.element}(${weakest.elementHanja})이 부족하여 보강이 필요합니다.`,
  };
}

export function calculateDaeun(
  gender: "male" | "female",
  yearPillar: Pillar,
  monthPillar: Pillar,
  birthYear: number,
  birthMonth: number,
  birthDay: number
): { daeunList: { age: number; year: number; stem: string; stemHanja: string; branch: string; branchHanja: string }[]; startAge: number } {
  const yearStemPolarity = STEM_ELEMENTS[yearPillar.stemIndex].polarity;
  const isForward = (gender === "male" && yearStemPolarity === "양") || (gender === "female" && yearStemPolarity === "음");

  let prevTermDays = 0;
  let nextTermDays = 0;
  const birthDate = new Date(birthYear, birthMonth - 1, birthDay);

  const allTermDates: Date[] = [];
  for (let y = birthYear - 1; y <= birthYear + 1; y++) {
    for (const t of SOLAR_TERMS_APPROX) {
      allTermDates.push(new Date(y, t.month - 1, t.day));
    }
  }
  allTermDates.sort((a, b) => a.getTime() - b.getTime());

  let closestPrev = allTermDates[0];
  let closestNext = allTermDates[allTermDates.length - 1];
  for (const td of allTermDates) {
    if (td.getTime() <= birthDate.getTime()) closestPrev = td;
    if (td.getTime() > birthDate.getTime() && td.getTime() < closestNext.getTime()) closestNext = td;
  }

  prevTermDays = Math.round((birthDate.getTime() - closestPrev.getTime()) / 86400000);
  nextTermDays = Math.round((closestNext.getTime() - birthDate.getTime()) / 86400000);

  const daysToTerm = isForward ? nextTermDays : prevTermDays;
  const startAge = Math.max(1, Math.round(daysToTerm / 3));

  const daeunList: { age: number; year: number; stem: string; stemHanja: string; branch: string; branchHanja: string }[] = [];

  for (let i = 0; i < 8; i++) {
    const age = startAge + i * 10;
    const calYear = birthYear + age;
    let stemIdx: number;
    let branchIdx: number;

    if (isForward) {
      stemIdx = (monthPillar.stemIndex + 1 + i) % 10;
      branchIdx = (monthPillar.branchIndex + 1 + i) % 12;
    } else {
      stemIdx = ((monthPillar.stemIndex - 1 - i) % 10 + 10) % 10;
      branchIdx = ((monthPillar.branchIndex - 1 - i) % 12 + 12) % 12;
    }

    daeunList.push({
      age,
      year: calYear,
      stem: HEAVENLY_STEMS[stemIdx],
      stemHanja: HEAVENLY_STEMS_HANJA[stemIdx],
      branch: EARTHLY_BRANCHES[branchIdx],
      branchHanja: EARTHLY_BRANCHES_HANJA[branchIdx],
    });
  }

  return { daeunList, startAge };
}

export function getChineseZodiac(year: number): { animal: string; branchIndex: number } {
  const branchIdx = ((year - 4) % 12 + 12) % 12;
  return {
    animal: CHINESE_ZODIAC_ANIMALS[branchIdx],
    branchIndex: branchIdx,
  };
}

const STEM_COLOR_NAMES: Record<number, string> = {
  0: "푸른",   // 갑 - 木양
  1: "푸른",   // 을 - 木음
  2: "붉은",   // 병 - 火양
  3: "붉은",   // 정 - 火음
  4: "황금",   // 무 - 土양
  5: "황금",   // 기 - 土음
  6: "하얀",   // 경 - 金양
  7: "하얀",   // 신 - 金음
  8: "검은",   // 임 - 水양
  9: "검은",   // 계 - 水음
};

export function getChineseZodiacRich(yearPillar: Pillar): {
  animal: string;
  branchIndex: number;
  colorName: string;
  stemHanja: string;
  branchHanja: string;
  displayText: string;
} {
  const animal = CHINESE_ZODIAC_ANIMALS[yearPillar.branchIndex];
  const colorName = STEM_COLOR_NAMES[yearPillar.stemIndex] || "";
  return {
    animal,
    branchIndex: yearPillar.branchIndex,
    colorName,
    stemHanja: yearPillar.stemHanja,
    branchHanja: yearPillar.branchHanja,
    displayText: `${colorName} ${animal}의 해 (${yearPillar.stemHanja}${yearPillar.branchHanja})`,
  };
}

export function calculateFullSaju(
  birthDate: string,
  birthTime: string,
  gender: "male" | "female"
): SajuChart {
  const [yearStr, monthStr, dayStr] = birthDate.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const day = parseInt(dayStr);

  const [hourStr, minuteStr] = birthTime.split(":");
  const hour = parseInt(hourStr);
  const minute = parseInt(minuteStr || "0");

  const yearPillar = calculateYearPillar(year, month, day);
  const monthPillar = calculateMonthPillar(year, month, day, yearPillar.stemIndex);
  const dayPillar = calculateDayPillar(year, month, day);
  const hourPillar = calculateHourPillar(hour, minute, dayPillar.stemIndex);

  const zodiacRich = getChineseZodiacRich(yearPillar);

  let lunarDateStr = "";
  try {
    const solar = Solar.fromYmd(year, month, day);
    const lunar = solar.getLunar();
    const lunarMonth = lunar.getMonth();
    const lunarDay = lunar.getDay();
    const isLeapMonth = typeof lunar.isLeap === "function" && lunar.isLeap();
    lunarDateStr = `음력 ${isLeapMonth ? "윤" : ""}${Math.abs(lunarMonth)}월 ${lunarDay}일`;
  } catch {
    lunarDateStr = "";
  }

  const yearTenGod: TenGod = { name: getTenGodName(dayPillar.stemIndex, yearPillar.stemIndex) };
  const monthTenGod: TenGod = { name: getTenGodName(dayPillar.stemIndex, monthPillar.stemIndex) };
  const hourTenGod: TenGod = { name: getTenGodName(dayPillar.stemIndex, hourPillar.stemIndex) };

  const yearBranchTenGod: TenGod = { name: getTenGodName(dayPillar.stemIndex, getBranchMainHiddenStem(yearPillar.branchIndex)) };
  const monthBranchTenGod: TenGod = { name: getTenGodName(dayPillar.stemIndex, getBranchMainHiddenStem(monthPillar.branchIndex)) };
  const dayBranchTenGod: TenGod = { name: getTenGodName(dayPillar.stemIndex, getBranchMainHiddenStem(dayPillar.branchIndex)) };
  const hourBranchTenGod: TenGod = { name: getTenGodName(dayPillar.stemIndex, getBranchMainHiddenStem(hourPillar.branchIndex)) };

  const fiveElementRatios = calculateFiveElements(yearPillar, monthPillar, dayPillar, hourPillar, monthPillar.branchIndex);
  const dominantEl = [...fiveElementRatios].sort((a, b) => b.ratio - a.ratio)[0];
  const dayMasterStrength = getDayMasterStrength(dayPillar, fiveElementRatios, monthPillar.branchIndex);
  const yongShin = calculateYongShin(dayPillar, dayMasterStrength, fiveElementRatios, monthPillar.branchIndex);

  const { daeunList, startAge } = calculateDaeun(gender, yearPillar, monthPillar, year, month, day);

  return {
    yearPillar,
    monthPillar,
    dayPillar,
    hourPillar,
    chineseZodiac: zodiacRich.animal,
    chineseZodiacBranch: EARTHLY_BRANCHES[zodiacRich.branchIndex],
    chineseZodiacDisplay: zodiacRich.displayText,
    lunarDate: lunarDateStr,
    yearTenGod,
    monthTenGod,
    hourTenGod,
    yearBranchTenGod,
    monthBranchTenGod,
    dayBranchTenGod,
    hourBranchTenGod,
    fiveElementRatios,
    dominantElement: dominantEl.element,
    dayMasterStrength,
    yongShin,
    daeun: daeunList,
    daeunStartAge: startAge,
  };
}

// =========================================================
// 여기부터는 아까 추가 요청하신 해석 로직(괴강살, 식상생재 등)입니다.
// =========================================================

// ---- 연운 / 월운 분석 ----

export interface DaeunClash {
  daeunAge: number;
  daeunYear: number;
  daeunPillar: string;
  yearPillar: string;
  clashType: string;
  description: string;
}

export interface YearlyFortune {
  year: number;
  yearPillar: Pillar;
  yearElement: string;
  yearElementHanja: string;
  relationship: string;
  overallScore: number;
  summary: string;
  advice: string;
  luckyMonths: number[];
  cautiousMonths: number[];
  daeunClash?: DaeunClash;
}

export interface MonthlyFortune {
  month: number;
  monthPillar: Pillar;
  score: number;
  element: string;
  elementHanja: string;
  relationship: string;
  description: string;
  caution: string;
  keyword: string;
}

// 천간 관계 분석
function analyzeStemRelation(dayStemIdx: number, targetStemIdx: number): {
  relation: string;
  score: number;
  description: string;
} {
  const dayEl = STEM_ELEMENTS[dayStemIdx];
  const targetEl = STEM_ELEMENTS[targetStemIdx];
  const dayE = dayEl.element;
  const targetE = targetEl.element;
  const samePolarity = dayEl.polarity === targetEl.polarity;

  const produces = (a: number) => (a + 1) % 5;
  const controls = (a: number) => (a + 2) % 5;

  if (dayE === targetE) {
    return {
      relation: samePolarity ? "비견(比肩) - 동료운" : "겁재(劫財) - 경쟁운",
      score: samePolarity ? 65 : 50,
      description: samePolarity
        ? "같은 기운이 만나 자신감과 독립심이 강해집니다. 동료와의 협력이 좋으나 고집이 셀 수 있습니다."
        : "경쟁과 도전의 기운입니다. 재물 손실에 주의하되, 새로운 기회를 잡는 용기가 생깁니다.",
    };
  }
  if (produces(dayE) === targetE) {
    return {
      relation: samePolarity ? "식신(食神) - 창작운" : "상관(傷官) - 표현운",
      score: samePolarity ? 75 : 60,
      description: samePolarity
        ? "창의력과 표현력이 빛나는 시기입니다. 예술, 기획, 새로운 아이디어가 풍성합니다."
        : "재능이 폭발적으로 분출되나 기존 권위와 충돌할 수 있습니다. 자유로운 표현을 추구하세요.",
    };
  }
  if (produces(targetE) === dayE) {
    return {
      relation: samePolarity ? "편인(偏印) - 학문운" : "정인(正印) - 지혜운",
      score: samePolarity ? 70 : 80,
      description: samePolarity
        ? "독특한 학문과 영적 성장의 기운입니다. 비전통적 방법으로 지혜를 얻습니다."
        : "배움과 성장의 기운이 충만합니다. 귀인의 도움과 지혜로운 결정이 이어집니다.",
    };
  }
  if (controls(dayE) === targetE) {
    return {
      relation: samePolarity ? "편재(偏財) - 투자운" : "정재(正財) - 안정재물운",
      score: samePolarity ? 72 : 78,
      description: samePolarity
        ? "모험적 투자와 새로운 수입원의 기운입니다. 큰 기회가 오나 리스크 관리가 필요합니다."
        : "안정적인 재물 운입니다. 꾸준한 노력이 물질적 보상으로 돌아옵니다.",
    };
  }
  if (controls(targetE) === dayE) {
    return {
      relation: samePolarity ? "편관(偏官) - 변화운" : "정관(正官) - 승진운",
      score: samePolarity ? 55 : 73,
      description: samePolarity
        ? "압박과 도전의 기운이지만 이를 통해 강해집니다. 예상치 못한 변화에 대비하세요."
        : "질서와 승진의 기운입니다. 사회적 인정과 지위 상승의 기회가 옵니다.",
    };
  }
  return { relation: "중성", score: 60, description: "특별한 상호작용 없이 평온한 기운입니다." };
}

// 지지 관계 분석 (충/합/형/파/해)
function analyzeBranchRelation(dayBranchIdx: number, targetBranchIdx: number): {
  type: string;
  impact: number;
  description: string;
} {
  const LIUHE: [number, number][] = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];
  for (const [a, b] of LIUHE) {
    if ((dayBranchIdx === a && targetBranchIdx === b) || (dayBranchIdx === b && targetBranchIdx === a)) {
      return { type: "육합(六合)", impact: 20, description: "조화와 화합의 기운. 귀인을 만나고 일이 순조롭게 풀립니다." };
    }
  }
  const SANHE: [number, number, number][] = [[0, 4, 8], [1, 5, 9], [2, 6, 10], [3, 7, 11]];
  for (const trio of SANHE) {
    if (trio.includes(dayBranchIdx) && trio.includes(targetBranchIdx)) {
      return { type: "삼합(三合)", impact: 15, description: "삼합의 조화로운 기운. 협력과 성취의 에너지가 강합니다." };
    }
  }
  const CHONG: [number, number][] = [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]];
  for (const [a, b] of CHONG) {
    if ((dayBranchIdx === a && targetBranchIdx === b) || (dayBranchIdx === b && targetBranchIdx === a)) {
      return { type: "충(沖)", impact: -25, description: "충돌과 변동의 기운. 갈등, 이동, 변화가 생기니 신중하게 행동하세요." };
    }
  }
  const XING: [number, number][] = [[2, 5], [5, 8], [8, 2], [1, 10], [10, 7], [7, 1], [0, 3], [3, 0]];
  for (const [a, b] of XING) {
    if (dayBranchIdx === a && targetBranchIdx === b) {
      return { type: "형(刑)", impact: -15, description: "마찰과 시련의 기운. 법적 문제나 건강에 주의하고 언행을 삼가세요." };
    }
  }
  const HAI: [number, number][] = [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]];
  for (const [a, b] of HAI) {
    if ((dayBranchIdx === a && targetBranchIdx === b) || (dayBranchIdx === b && targetBranchIdx === a)) {
      return { type: "해(害)", impact: -10, description: "은근한 방해와 소인의 기운. 대인관계에서 오해가 생기기 쉽습니다." };
    }
  }
  return { type: "평(平)", impact: 0, description: "특별한 충돌이나 조화 없이 안정적입니다." };
}

// 2026년 각 월의 월주 계산
function getMonthlyPillarsForYear(year: number): { month: number; pillar: Pillar }[] {
  const yearPillar = calculateYearPillar(year, 6, 1);
  const result: { month: number; pillar: Pillar }[] = [];
  const monthMidDays = [
    { month: 1, day: 20 }, { month: 2, day: 15 }, { month: 3, day: 15 },
    { month: 4, day: 15 }, { month: 5, day: 15 }, { month: 6, day: 15 },
    { month: 7, day: 15 }, { month: 8, day: 15 }, { month: 9, day: 15 },
    { month: 10, day: 15 }, { month: 11, day: 15 }, { month: 12, day: 15 },
  ];
  for (const { month, day } of monthMidDays) {
    const pillar = calculateMonthPillar(year, month, day, yearPillar.stemIndex);
    result.push({ month, pillar });
  }
  return result;
}

// ---- 특수살(特殊煞) 감지 ----

export interface SpecialSal {
  name: string;
  hanja: string;
  description: string;
  personality: string;
}

function detectSpecialSal(chart: SajuChart): SpecialSal[] {
  const sals: SpecialSal[] = [];
  const daySH = chart.dayPillar.stemHanja;
  const dayBH = chart.dayPillar.branchHanja;
  const dayPillarStr = daySH + dayBH;

  // 1. 괴강살 (魁罡殺)
  const GWEGANG = ["庚辰", "庚戌", "壬辰", "壬戌", "戊戌"];
  if (GWEGANG.includes(dayPillarStr)) {
    const isGeum = daySH === "庚"; // 경금
    sals.push({
      name: "괴강살",
      hanja: "魁罡殺",
      description: isGeum
        ? `${dayPillarStr} 일주의 괴강살입니다. 평소에는 온화해 보이나, 결정적인 위기 상황이나 목표 앞에서는 폭발적인 리더십과 카리스마가 튀어나오는 '반전 매력'의 소유자입니다. 우두머리 기질이 있어 남 밑에 있기보다 주도적으로 일을 이끌어야 직성이 풀립니다.`
        : `${dayPillarStr} 일주의 괴강살입니다. 깊은 지혜와 날카로운 판단력을 겸비했습니다. 위기 상황에서 누구도 예상 못한 대담한 결단을 내리는 전략가이며, 타인을 압도하는 강한 기운이 있습니다.`,
      personality: isGeum
        ? "겉은 온화하나 속은 강철 — 위기에 빛나는 리더"
        : "깊은 물속의 칼날 — 침착하지만 치명적인 전략가",
    });
  }

  // 2. 도화살 (桃花殺) - 년지 또는 일지 기준
  const checkDohwa = (baseBranchIdx: number, targetBranchIdx: number) => {
    const map: Record<number, number> = {};
    [8, 0, 4].forEach(b => map[b] = 9); // 신자진 -> 유
    [2, 6, 10].forEach(b => map[b] = 3); // 인오술 -> 묘
    [5, 9, 1].forEach(b => map[b] = 6); // 사유축 -> 오
    [11, 3, 7].forEach(b => map[b] = 0); // 해묘미 -> 자

    return map[baseBranchIdx] === targetBranchIdx;
  };

  const branches = [
    chart.yearPillar.branchIndex,
    chart.monthPillar.branchIndex,
    chart.dayPillar.branchIndex,
    chart.hourPillar.branchIndex
  ];

  let hasDohwa = false;
  for (let i = 0; i < 4; i++) {
    if (i === 0) continue;
    if (checkDohwa(branches[0], branches[i])) hasDohwa = true;
  }
  for (let i = 0; i < 4; i++) {
    if (i === 2) continue;
    if (checkDohwa(branches[2], branches[i])) hasDohwa = true;
  }

  if (hasDohwa) {
    sals.push({
      name: "도화살",
      hanja: "桃花殺",
      description: "사람을 끌어당기는 강렬한 매력의 살입니다. 단순히 외모가 뛰어난 것을 넘어, 대중의 시선을 사로잡는 '끼'와 스타성이 있습니다. 연예, 예술, 방송 분야에서 두각을 나타냅니다.",
      personality: "치명적인 매력 — 시선을 훔치는 스타성",
    });
  }

  // 3. 화개살 (華蓋殺) - 예술과 종교, 고독
  const checkHwagae = (baseBranchIdx: number, targetBranchIdx: number) => {
    const map: Record<number, number> = {};
    [2, 6, 10].forEach(b => map[b] = 10); // 인오술 -> 술
    [8, 0, 4].forEach(b => map[b] = 4);   // 신자진 -> 진
    [5, 9, 1].forEach(b => map[b] = 1);   // 사유축 -> 축
    [11, 3, 7].forEach(b => map[b] = 7);  // 해묘미 -> 미

    return map[baseBranchIdx] === targetBranchIdx;
  };

  let hasHwagae = false;
  for (let i = 0; i < 4; i++) {
    if (checkHwagae(branches[0], branches[i])) hasHwagae = true;
  }
  for (let i = 0; i < 4; i++) {
    if (checkHwagae(branches[2], branches[i])) hasHwagae = true;
  }

  if (hasHwagae) {
    sals.push({
      name: "화개살",
      hanja: "華蓋殺",
      description: "화려함을 덮고 내면을 들여다보는 '고독한 예술가'의 별입니다. 종교, 철학, 심리학, 예술(디자인) 분야에 탁월한 재능이 있으며, 내면의 세계가 깊고 복잡합니다. 과거를 복기하거나 정신적인 가치를 추구할 때 큰 성취를 이룹니다.",
      personality: "고독한 천재 — 내면의 우주를 가진 예술가",
    });
  }

  // 4. 역마살 (驛馬殺) - 이동과 변화
  const checkYeokma = (baseBranchIdx: number, targetBranchIdx: number) => {
    const map: Record<number, number> = {};
    [2, 6, 10].forEach(b => map[b] = 8);  // 인오술 -> 신
    [8, 0, 4].forEach(b => map[b] = 2);   // 신자진 -> 인
    [5, 9, 1].forEach(b => map[b] = 11);  // 사유축 -> 해
    [11, 3, 7].forEach(b => map[b] = 5);  // 해묘미 -> 사

    return map[baseBranchIdx] === targetBranchIdx;
  };

  let hasYeokma = false;
  for (let i = 0; i < 4; i++) {
     if (i !== 0 && checkYeokma(branches[0], branches[i])) hasYeokma = true;
     if (i !== 2 && checkYeokma(branches[2], branches[i])) hasYeokma = true;
  }

  if (hasYeokma) {
    sals.push({
      name: "역마살",
      hanja: "驛馬殺",
      description: "한곳에 머물지 못하고 끊임없이 움직이는 기운입니다. 이는 불안정이 아니라 '확장'을 의미합니다. 해외, 여행, 무역, 출장 등 활동 반경을 넓힐수록 운이 트이며, 변화 없는 삶에서는 답답함을 느낍니다.",
      personality: "자유로운 영혼 — 움직여야 사는 개척자",
    });
  }

  // 5. 홍염살 (紅艶殺) - 강렬한 이성 매력 (년간 기준)
  const HONGYEOM_MAP: Record<number, number> = {
    0: 6,  // 갑 -> 오(午)
    1: 8,  // 을 -> 신(申)
    2: 2,  // 병 -> 인(寅)
    3: 7,  // 정 -> 미(未)
    4: 6,  // 무 -> 오(午)
    5: 6,  // 기 -> 오(午)
    6: 10, // 경 -> 술(戌)
    7: 9,  // 신 -> 유(酉)
    8: 0,  // 임 -> 자(子)
    9: 8,  // 계 -> 신(申)
  };
  const yearStemIdx = chart.yearPillar.stemIndex;
  const hongyeomTarget = HONGYEOM_MAP[yearStemIdx];
  const hasHongyeomYear = branches.some(b => b === hongyeomTarget);

  // 홍염살 (일간 기준) - 일간이 보는 지지
  const HONGYEOM_DAY_MAP: Record<number, number> = {
    0: 6,  // 갑 -> 오(午)
    1: 8,  // 을 -> 신(申)
    2: 2,  // 병 -> 인(寅)
    3: 7,  // 정 -> 미(未)
    4: 6,  // 무 -> 오(午)
    5: 6,  // 기 -> 오(午)
    6: 10, // 경 -> 술(戌)
    7: 9,  // 신 -> 유(酉)
    8: 0,  // 임 -> 자(子)
    9: 8,  // 계 -> 신(申)
  };
  const dayStemIdx = chart.dayPillar.stemIndex;
  const hongyeomDayTarget = HONGYEOM_DAY_MAP[dayStemIdx];
  const hasHongyeomDay = branches.some(b => b === hongyeomDayTarget);

  if (hasHongyeomYear || hasHongyeomDay) {
    sals.push({
      name: "홍염살",
      hanja: "紅艶殺",
      description: "도화살보다 깊고 강렬한 매력의 살입니다. 이성에게 강렬한 끌림을 발산하며, 뛰어난 외모나 분위기로 이목을 끌어 연애나 사교 방면에서 활발합니다. 다만 이성 관계에서 구설수나 감정적 파도에 휘말릴 수 있으니, 스스로 감정 관리를 잘하는 것이 열쇠입니다.",
      personality: "불꽃 같은 매력 — 도화보다 깊고 강렬한 이성 자석",
    });
  }

  // 6. 백호살 (白虎殺) - 강한 기운, 사고/수술/유혈 주의
  const BAEKHO_MAP: Record<number, number> = {
    0: 4,  // 갑 -> 진(辰)
    1: 5,  // 을 -> 사(巳)
    2: 6,  // 병 -> 오(午)
    3: 7,  // 정 -> 미(未)
    4: 8,  // 무 -> 신(申)
    5: 9,  // 기 -> 유(酉)
    6: 10, // 경 -> 술(戌)
    7: 11, // 신 -> 해(亥)
    8: 0,  // 임 -> 자(子)
    9: 1,  // 계 -> 축(丑)
  };
  const baekhoTarget = BAEKHO_MAP[yearStemIdx];
  const hasBaekho = branches.some(b => b === baekhoTarget);
  if (hasBaekho) {
    sals.push({
      name: "백호살",
      hanja: "白虎殺",
      description: "백호(흰 호랑이)의 강인하고 날카로운 기운을 품고 있습니다. 결단력과 추진력이 뛰어나지만, 너무 강한 에너지가 대인관계에서 충돌을 일으킬 수 있습니다. 배우자 관계에서 주도권 싸움이 생기기 쉬우며, 본인의 기운이 센 만큼 부드러운 커뮤니케이션이 중요합니다.",
      personality: "흰 호랑이의 카리스마 — 강인하지만 날카로운 기운",
    });
  }

  // 7. 양인살 (羊刃殺) - 위기에 빛나는 칼날 같은 리더십
  const YANGIN_MAP: Record<number, number> = {
    0: 3,  // 갑 -> 묘(卯) 제왕지
    2: 6,  // 병 -> 오(午) 제왕지
    4: 6,  // 무 -> 오(午) 제왕지
    6: 9,  // 경 -> 유(酉) 제왕지
    8: 0,  // 임 -> 자(子) 제왕지
  };
  let hasYangin = false;
  if (STEM_ELEMENTS[dayStemIdx].polarity === "양" && YANGIN_MAP[dayStemIdx] !== undefined) {
    hasYangin = branches.some(b => b === YANGIN_MAP[dayStemIdx]);
  }
  if (dayStemIdx === 3 && chart.monthPillar.branchIndex === 6) {
    hasYangin = true;
  }
  if (hasYangin) {
    sals.push({
      name: "양인살",
      hanja: "羊刃殺",
      description: "위기에 빛나는 칼날 같은 리더십을 가진 살입니다. 평소에는 잔잔하지만, 결정적인 순간에 폭발적인 추진력과 결단력을 발휘합니다. 군인, 경찰, 외과의, 기업가 등 강한 리더십이 필요한 분야에서 크게 빛납니다. 다만 에너지가 과도하면 주변과 충돌할 수 있으니 절제가 필요합니다.",
      personality: "위기에 빛나는 칼날 — 폭발적 리더십의 소유자",
    });
  }

  // 8. 천을귀인 (天乙貴人) - 절체절명의 순간 돕는 귀인의 기운
  const CHEON_EUL_MAP: Record<number, number[]> = {
    0: [1, 7],   // 갑 -> 축, 미
    1: [0, 8],   // 을 -> 자, 신
    2: [11, 9],  // 병 -> 해, 유
    3: [11, 9],  // 정 -> 해, 유
    4: [1, 7],   // 무 -> 축, 미
    5: [0, 8],   // 기 -> 자, 신
    6: [1, 7],   // 경 -> 축, 미 (일부 학파: 인, 오)
    7: [6, 2],   // 신 -> 오, 인
    8: [5, 3],   // 임 -> 사, 묘
    9: [5, 3],   // 계 -> 사, 묘
  };
  const cheonEulTargets = CHEON_EUL_MAP[dayStemIdx] || [];
  const hasCheonEul = branches.some(b => cheonEulTargets.includes(b));
  if (hasCheonEul) {
    sals.push({
      name: "천을귀인",
      hanja: "天乙貴人",
      description: "절체절명의 순간에 도움을 주는 귀인의 기운입니다. 하늘이 보낸 귀인이 위기 때마다 나타나 화를 복으로 바꿔주는 최고의 길신(吉神)입니다. 사회적 인맥이 넓고 어디서든 귀인을 만나는 복이 있으며, 큰 사고나 재난을 비켜가는 행운이 따릅니다.",
      personality: "귀인의 별 — 절체절명의 순간 하늘이 돕는 운명",
    });
  }

  // 9. 천덕귀인 (天德貴人) - 하늘이 내린 덕으로 재앙을 피함
  const CHEON_DEOK_MAP: Record<number, number> = {
    2: 3,   // 인월 -> 정(丁) stemIdx=3
    3: 8,   // 묘월 -> 임(壬) (신=辛 stemIdx=7 일부 학파)... 갑(甲)=0 일부학파. 정통: 신(辛)=7
    4: 8,   // 진월 -> 임(壬) stemIdx=8
    5: 7,   // 사월 -> 신(辛) stemIdx=7
    6: 0,   // 오월 -> 갑(甲) stemIdx=0... 정통법: 임(壬)=8
    7: 9,   // 미월 -> 계(癸) stemIdx=9
    8: 8,   // 신월 -> 임(壬) stemIdx=8... 일부학파: 임
    9: 2,   // 유월 -> 병(丙) stemIdx=2
    10: 0,  // 술월 -> 갑(甲) stemIdx=0
    11: 1,  // 해월 -> 을(乙) stemIdx=1
    0: 2,   // 자월 -> 병(丙) stemIdx=2
    1: 3,   // 축월 -> 정(丁) stemIdx=3
  };
  const monthBranchIdx = chart.monthPillar.branchIndex;
  const cheonDeokStemTarget = CHEON_DEOK_MAP[monthBranchIdx];
  const allStemIndices = [
    chart.yearPillar.stemIndex,
    chart.monthPillar.stemIndex,
    chart.dayPillar.stemIndex,
    chart.hourPillar.stemIndex,
  ];
  if (cheonDeokStemTarget !== undefined) {
    const hasCheonDeok = allStemIndices.some(s => s === cheonDeokStemTarget);
    if (monthBranchIdx === 6) {
      const hasCheonDeokAlt = allStemIndices.some(s => s === 8);
      if (hasCheonDeok || hasCheonDeokAlt) {
        sals.push({
          name: "천덕귀인",
          hanja: "天德貴人",
          description: "하늘이 내린 덕으로 재앙을 피하는 길신입니다. 도덕적이고 인자한 성품을 타고났으며, 남모르는 음덕(陰德)으로 흉한 일이 자연스럽게 소멸됩니다. 관재구설, 질병, 사고 등 위험에서 무사히 빠져나오는 천복이 있습니다.",
          personality: "하늘의 덕 — 재앙을 피하고 복을 부르는 천복의 기운",
        });
      }
    } else if (hasCheonDeok) {
      sals.push({
        name: "천덕귀인",
        hanja: "天德貴人",
        description: "하늘이 내린 덕으로 재앙을 피하는 길신입니다. 도덕적이고 인자한 성품을 타고났으며, 남모르는 음덕(陰德)으로 흉한 일이 자연스럽게 소멸됩니다. 관재구설, 질병, 사고 등 위험에서 무사히 빠져나오는 천복이 있습니다.",
        personality: "하늘의 덕 — 재앙을 피하고 복을 부르는 천복의 기운",
      });
    }
  }

  return sals;
}

// ---- 간여지동 (干與支同) 판단 ----
const BRANCH_MAIN_ELEMENTS = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
// 자=水, 축=土, 인=木, 묘=木, 진=土, 사=火, 오=火, 미=土, 신=金, 유=金, 술=土, 해=水

export function checkGanYeoJiDong(chart: SajuChart): boolean {
  const dayStemElement = STEM_ELEMENTS[chart.dayPillar.stemIndex].element;
  const dayBranchElement = BRANCH_MAIN_ELEMENTS[chart.dayPillar.branchIndex];
  return dayStemElement === dayBranchElement;
}

// ---- 식상생재 등 구조 패턴 감지 ----

export interface StructurePattern {
  name: string;
  hanja: string;
  description: string;
  businessTrait: string;
}

function detectStructurePatterns(chart: SajuChart): StructurePattern[] {
  const patterns: StructurePattern[] = [];
  const tenGods = [
    chart.yearTenGod.name,
    chart.monthTenGod.name,
    chart.hourTenGod.name,
  ];
  // 지지 십성도 포함
  const allTenGods = [
    ...tenGods,
    chart.yearBranchTenGod.name,
    chart.monthBranchTenGod.name,
    chart.dayBranchTenGod.name,
    chart.hourBranchTenGod.name,
  ];

  const hasShikShin = allTenGods.includes("식신");
  const hasSangGwan = allTenGods.includes("상관");
  const hasShikSang = hasShikShin || hasSangGwan;

  const hasJeongJae = allTenGods.includes("정재");
  const hasPyeonJae = allTenGods.includes("편재");
  const hasJaeSung = hasJeongJae || hasPyeonJae;

  const hasJeongGwan = allTenGods.includes("정관");
  const hasPyeonGwan = allTenGods.includes("편관");
  const hasGwanSung = hasJeongGwan || hasPyeonGwan;

  const hasJeongIn = allTenGods.includes("정인");
  const hasPyeonIn = allTenGods.includes("편인");
  const hasInSung = hasJeongIn || hasPyeonIn;

  // 식상생재 (食傷生財): 식상 + 재성 동시 존재
  if (hasShikSang && hasJaeSung) {
    patterns.push({
      name: "식상생재",
      hanja: "食傷生財",
      description: "식상(食傷)의 창의적 에너지가 재성(財星)으로 흘러가는 구조입니다. 단순히 성실함으로 승부하는 게 아니라, 남다른 말솜씨, 아이디어, 기획력(식상)을 통해 부(財)를 창출하는 사업가적 기질이 탁월합니다. 콘텐츠, 디자인, 마케팅, 브랜딩처럼 '창작물이 곧 돈이 되는' 분야에서 크게 성공할 수 있습니다.",
      businessTrait: "아이디어와 표현력으로 부를 창출하는 크리에이터형 사업가",
    });
  }

  // 관인상생 (官印相生): 관성 + 인성 동시 존재
  if (hasGwanSung && hasInSung) {
    patterns.push({
      name: "관인상생",
      hanja: "官印相生",
      description: "관성(官星)의 사회적 지위와 인성(印星)의 학문적 깊이가 상생하는 구조입니다. 조직 내에서 인정받으며 승진하는 엘리트형이며, 전문 지식을 바탕으로 권위를 세울 수 있습니다.",
      businessTrait: "지식과 권위로 인정받는 전문가형 리더",
    });
  }

  // 상관견관 (傷官見官): 상관 + 정관 충돌
  if (hasSangGwan && hasJeongGwan) {
    patterns.push({
      name: "상관견관",
      hanja: "傷官見官",
      description: "상관(傷官)의 자유로운 표현력과 정관(正官)의 규율이 충돌하는 구조입니다. 기존 체제에 대한 반항심과 혁신적 사고가 강하며, 이 에너지를 잘 다스리면 기존 질서를 깨는 파괴적 혁신가가 될 수 있습니다.",
      businessTrait: "기존 틀을 깨는 혁신적 파괴자 — 스타트업 기질",
    });
  }

  // 재다신약 (財多身弱): 재성 많은데 신약
  if (hasJaeSung && (chart.dayMasterStrength === "약" || chart.dayMasterStrength === "극약")) {
    const jaeCount = allTenGods.filter(t => t === "정재" || t === "편재").length;
    if (jaeCount >= 2) {
      patterns.push({
        name: "재다신약",
        hanja: "財多身弱",
        description: "재물의 기운은 강하나 몸(일간)이 약한 구조입니다. 돈을 벌 기회는 많지만 체력과 에너지 관리가 핵심입니다. 용신의 기운을 강화하고 비겁(동료/파트너)의 도움을 받으면 큰 부를 감당할 수 있습니다.",
        businessTrait: "기회는 넘치나 선택과 집중이 필요한 타입 — 파트너십이 성공 열쇠",
      });
    }
  }

  // 삼합(三合) 감지 - 지지 4개 중 삼합 완성 여부
  const branchSet = new Set([
    chart.yearPillar.branchIndex,
    chart.monthPillar.branchIndex,
    chart.dayPillar.branchIndex,
    chart.hourPillar.branchIndex,
  ]);
  const SAMHAP_GROUPS: { branches: [number, number, number]; element: string; name: string; desc: string }[] = [
    { branches: [8, 0, 4], element: "수국", name: "신자진 삼합 수국", desc: "물의 기운이 하나로 모여 지혜와 유연함이 인생의 거대한 뿌리가 되는 구조입니다. 깊은 통찰력과 적응력으로 어떤 환경에서도 길을 찾습니다." },
    { branches: [2, 6, 10], element: "화국", name: "인오술 삼합 화국", desc: "불의 기운이 하나로 모여 열정과 에너지가 인생을 관통하는 구조입니다. 강렬한 추진력과 카리스마로 주변을 밝히며 이끕니다." },
    { branches: [11, 3, 7], element: "목국", name: "해묘미 삼합 목국", desc: "나무의 기운이 하나로 모여 배움과 사상이 인생의 거대한 뿌리가 되는 구조입니다. 성장, 교육, 창작의 에너지가 넘치며 사상가적 기질이 있습니다." },
    { branches: [5, 9, 1], element: "금국", name: "사유축 삼합 금국", desc: "금속의 기운이 하나로 모여 결단력과 의리가 인생의 중심축이 되는 구조입니다. 날카로운 판단력과 정의감으로 조직의 핵심이 됩니다." },
  ];
  for (const group of SAMHAP_GROUPS) {
    const [a, b, c] = group.branches;
    if (branchSet.has(a) && branchSet.has(b) && branchSet.has(c)) {
      patterns.push({
        name: group.name,
        hanja: "三合",
        description: group.desc,
        businessTrait: `삼합 ${group.element}의 조화로운 에너지가 모든 분야에서 시너지를 만듭니다`,
      });
    }
  }

  // 무재(無財) 사주 감지 - 오행 분포에서 재성 오행이 0%인 경우
  const dayElIdx = STEM_ELEMENTS[chart.dayPillar.stemIndex].element;
  const wealthElIdx = (dayElIdx + 2) % 5;
  const wealthRatio = chart.fiveElementRatios.find(r => {
    const elIdx = FIVE_ELEMENTS.indexOf(r.element as typeof FIVE_ELEMENTS[number]);
    return elIdx === wealthElIdx;
  });
  if (wealthRatio && wealthRatio.weight === 0) {
    const wealthElName = FIVE_ELEMENTS[wealthElIdx];
    const wealthElHanja = FIVE_ELEMENTS_HANJA[wealthElIdx];
    patterns.push({
      name: "무재 사주",
      hanja: "無財",
      description: `오행에서 재성(${wealthElHanja}/${wealthElName})의 기운이 전혀 없는 구조입니다. 역설적으로 돈을 쫓지 않을 때 돈이 따르는 운명이며, 물질보다 정신적 가치나 자기 분야의 전문성을 추구할 때 결과적으로 큰 부가 따라옵니다. 무재 사주는 사업가보다 전문가, 예술가, 학자에게 더 강한 성취를 가져다줍니다.`,
      businessTrait: "돈을 쫓지 않을 때 돈이 따르는 구조 — 전문성 기반의 성공",
    });
  }

  return patterns;
}

// ---- 용신 개운법 (用神 開運法) ----

export interface YongShinRemedy {
  element: string;
  elementHanja: string;
  luckyTime: string;
  luckyPlace: string;
  luckyDirection: string;
  luckyColor: string;
  luckyActivity: string;
  luckyFood: string;
  avoidElement: string;
  avoidElementHanja: string;
  summary: string;
}

function getYongShinRemedy(yongShin: { element: string; elementHanja: string }): YongShinRemedy {
  const remedies: Record<string, Omit<YongShinRemedy, 'element' | 'elementHanja' | 'avoidElement' | 'avoidElementHanja' | 'summary'>> = {
    "수": {
      luckyTime: "밤 시간대(해시 21:00~, 자시 23:00~, 축시 01:00~)에 활동할 때 에너지가 상승합니다.",
      luckyPlace: "물가(바다, 강, 호수, 수영장), 해외, 북쪽 방향의 도시나 장소가 행운을 가져옵니다.",
      luckyDirection: "북(北)",
      luckyColor: "검정, 남색, 짙은 파랑 계열의 의상이나 소품이 기운을 보강합니다.",
      luckyActivity: "밤에 작업하거나 해외와 연결된 일을 할 때 성과가 좋습니다. 수영, 온천, 여행, 무역, 외국어 공부가 도움됩니다.",
      luckyFood: "해산물, 국/탕류, 미역/다시마 등 해조류, 검은콩, 흑미가 수(水)의 기운을 보강합니다.",
    },
    "목": {
      luckyTime: "이른 아침(인시 03:00~, 묘시 05:00~)에 활동을 시작하면 에너지가 상승합니다.",
      luckyPlace: "숲, 공원, 식물원, 산, 동쪽 방향의 도시나 장소가 행운을 가져옵니다.",
      luckyDirection: "동(東)",
      luckyColor: "초록, 청록, 연두 계열의 의상이나 소품이 기운을 보강합니다.",
      luckyActivity: "아침 산책, 독서, 교육/강의, 새로운 프로젝트 시작, 식물 가꾸기가 도움됩니다.",
      luckyFood: "녹색 채소, 과일, 신맛 나는 음식, 나물류가 목(木)의 기운을 보강합니다.",
    },
    "화": {
      luckyTime: "한낮(사시 09:00~, 오시 11:00~)에 중요한 미팅이나 결정을 하면 좋습니다.",
      luckyPlace: "따뜻한 지역, 남쪽 방향, 밝은 조명의 공간, 무대/공연장이 행운을 가져옵니다.",
      luckyDirection: "남(南)",
      luckyColor: "빨강, 주황, 보라, 자주 계열의 의상이나 소품이 기운을 보강합니다.",
      luckyActivity: "대중 앞에 서는 일, 프레젠테이션, 네트워킹, 열정적 운동(런닝, 복싱)이 도움됩니다.",
      luckyFood: "쓴맛 음식, 초콜릿, 커피, 빨간 과일(석류, 딸기), 양고기가 화(火)의 기운을 보강합니다.",
    },
    "토": {
      luckyTime: "환절기와 사계절의 전환점(각 계절 마지막 18일)이 중요한 전환의 시기입니다.",
      luckyPlace: "넓은 평야, 도심 중심부, 고향, 중앙 위치의 장소가 행운을 가져옵니다.",
      luckyDirection: "중앙 또는 고향 방향",
      luckyColor: "노랑, 황토색, 베이지, 갈색 계열의 의상이나 소품이 기운을 보강합니다.",
      luckyActivity: "부동산 관련 활동, 중재/조정 역할, 안정적 루틴 확립, 도자기/요리가 도움됩니다.",
      luckyFood: "단맛 음식, 고구마, 감자, 곡류, 꿀, 대추가 토(土)의 기운을 보강합니다.",
    },
    "금": {
      luckyTime: "오후~저녁(신시 15:00~, 유시 17:00~)에 중요한 결정이나 마무리 작업을 하면 좋습니다.",
      luckyPlace: "고층 빌딩, 금융가, 서쪽 방향, 금속/돌이 많은 공간이 행운을 가져옵니다.",
      luckyDirection: "서(西)",
      luckyColor: "흰색, 은색, 금색, 회색 계열의 의상이나 소품이 기운을 보강합니다.",
      luckyActivity: "정리/정돈, 결단이 필요한 일, 투자 판단, 무술/근력 운동이 도움됩니다.",
      luckyFood: "매운맛 음식, 생강, 마늘, 무, 배, 흰쌀밥이 금(金)의 기운을 보강합니다.",
    },
  };

  const avoidMap: Record<string, { element: string; hanja: string }> = {
    "수": { element: "토", hanja: "土" }, // 토극수
    "목": { element: "금", hanja: "金" }, // 금극목
    "화": { element: "수", hanja: "水" }, // 수극화
    "토": { element: "목", hanja: "木" }, // 목극토
    "금": { element: "화", hanja: "火" }, // 화극금
  };

  const r = remedies[yongShin.element] || remedies["수"];
  const avoid = avoidMap[yongShin.element] || { element: "토", hanja: "土" };

  return {
    element: yongShin.element,
    elementHanja: yongShin.elementHanja,
    ...r,
    avoidElement: avoid.element,
    avoidElementHanja: avoid.hanja,
    summary: `용신 ${yongShin.elementHanja}(${yongShin.element})의 기운을 의식적으로 가까이 하세요. ` +
      `행운의 방향은 ${r.luckyDirection}, 행운의 시간대는 ${r.luckyTime.split("에")[0]}입니다. ` +
      `${avoid.hanja}(${avoid.element})의 과한 기운은 피하는 것이 좋습니다.`,
  };
}

// ---- 성격 분석 (강화 버전) ----

export interface SajuPersonality {
  mainTrait: string;
  subTraits: string[];
  talent: string;
  heavenlyGift: string;
  weakPoint: string;
  elementPersonality: string;
  dayMasterDescription: string;
  tenGodProfile: string;
  specialSals: SpecialSal[];
  structurePatterns: StructurePattern[];
  yongShinRemedy: YongShinRemedy;
}

const DAY_STEM_PERSONALITY: Record<string, { trait: string; description: string }> = {
  "갑": { trait: "큰 나무의 기운 — 리더십, 곧은 성품, 개척정신", description: "갑목(甲木) 일간은 큰 나무와 같아 곧고 정직하며 리더십이 강합니다. 새로운 길을 개척하는 선구자적 기질이 있으며, 한번 뿌리를 내리면 흔들림 없이 성장합니다." },
  "을": { trait: "덩굴의 기운 — 유연함, 적응력, 부드러운 설득력", description: "을목(乙木) 일간은 덩굴이나 꽃과 같아 유연하고 적응력이 뛰어납니다. 부드러운 외면 안에 강한 생명력을 품고 있으며, 사람들의 마음을 자연스럽게 사로잡습니다." },
  "병": { trait: "태양의 기운 — 열정, 카리스마, 밝은 에너지", description: "병화(丙火) 일간은 태양과 같아 뜨겁고 밝으며 주변을 환하게 비춥니다. 강한 카리스마로 사람들을 끌어당기며, 정열적이고 낙관적인 성격입니다." },
  "정": { trait: "촛불의 기운 — 섬세함, 따뜻함, 집중력", description: "정화(丁火) 일간은 촛불이나 별빛과 같아 은은하면서도 깊은 빛을 발합니다. 섬세하고 따뜻한 감성의 소유자로, 한 가지에 깊이 몰입하는 집중력이 뛰어납니다." },
  "무": { trait: "큰 산의 기운 — 안정감, 포용력, 신뢰", description: "무토(戊土) 일간은 큰 산과 같아 묵직하고 안정적입니다. 넓은 포용력으로 주변 사람들에게 신뢰를 주며, 중심을 잡아주는 역할을 합니다." },
  "기": { trait: "옥토의 기운 — 실용성, 양육, 세심함", description: "기토(己土) 일간은 비옥한 밭과 같아 만물을 키워내는 양육의 기운이 있습니다. 실용적이고 세심하며, 조용히 가치를 만들어내는 능력이 탁월합니다." },
  "경": { trait: "강철의 기운 — 결단력, 의리, 정의감", description: "경금(庚金) 일간은 강철이나 바위와 같아 단단하고 결단력이 강합니다. 의리를 중시하며 정의로운 성격으로, 어려운 상황에서도 굽히지 않는 강인함이 있습니다." },
  "신": { trait: "보석의 기운 — 정밀함, 미적감각, 완벽주의", description: "신금(辛金) 일간은 보석이나 바늘과 같아 정밀하고 예리합니다. 뛰어난 미적 감각과 완벽주의적 성향이 있으며, 섬세한 분야에서 두각을 나타냅니다." },
  "임": { trait: "바다의 기운 — 지혜, 포용, 무한한 가능성", description: "임수(壬水) 일간은 바다나 큰 강과 같아 넓고 깊은 지혜를 품고 있습니다. 어디든 흘러가는 적응력과 모든 것을 품는 포용력이 있으며, 무한한 가능성을 가진 사람입니다." },
  "계": { trait: "이슬의 기운 — 직감, 영감, 맑은 감수성", description: "계수(癸水) 일간은 이슬이나 안개와 같아 맑고 순수한 감수성의 소유자입니다. 뛰어난 직감과 영감으로 보이지 않는 것을 감지하며, 영적인 깊이가 있습니다." },
};

const ELEMENT_TALENT: Record<number, string> = {
  0: "목(木) — 창의적 기획, 교육, 성장 산업, 문학/예술, 패션, 건축 분야에 천부적 재능",
  1: "화(火) — 마케팅, 엔터테인먼트, 기술/IT, 리더십, 무대/방송, 외교 분야에 천부적 재능",
  2: "토(土) — 부동산, 경영관리, 컨설팅, 농업, 중재/협상, 안정적 사업 분야에 천부적 재능",
  3: "금(金) — 금융, 법률, 정밀기술, 의료, 군/경찰, 보석/귀금속 분야에 천부적 재능",
  4: "수(水) — 연구/학문, 철학, 무역/물류, 여행/관광, 영적/심리 분야에 천부적 재능",
};

export function analyzeSajuPersonality(chart: SajuChart): SajuPersonality {
  const dayStem = chart.dayPillar.stem;
  const dayStemInfo = DAY_STEM_PERSONALITY[dayStem] || { trait: "", description: "" };
  const dayElIdx = STEM_ELEMENTS[chart.dayPillar.stemIndex].element;

  // 특수살 감지
  const specialSals = detectSpecialSal(chart);
  // 구조 패턴 감지
  const structurePatterns = detectStructurePatterns(chart);
  // 용신 개운법
  const yongShinRemedy = getYongShinRemedy(chart.yongShin);

  // 십성 프로필 조합
  const tenGods = [
    chart.yearTenGod.name,
    chart.monthTenGod.name,
    chart.hourTenGod.name,
  ];

  const hasShikShin = tenGods.includes("식신");
  const hasSangGwan = tenGods.includes("상관");
  const hasJeongGwan = tenGods.includes("정관");
  const hasPyeonGwan = tenGods.includes("편관");
  const hasJeongIn = tenGods.includes("정인");
  const hasPyeonIn = tenGods.includes("편인");
  const hasJeongJae = tenGods.includes("정재");
  const hasPyeonJae = tenGods.includes("편재");
  const hasBiGyeon = tenGods.includes("비견");
  const hasGeobJae = tenGods.includes("겁재");

  let heavenlyGift = ELEMENT_TALENT[dayElIdx] || "";

  const subTraits: string[] = [];
  if (hasShikShin) subTraits.push("식신(食神) — 풍요로운 감성과 표현력, 미식가적 감각");
  if (hasSangGwan) subTraits.push("상관(傷官) — 창조적 재능과 기존 틀을 깨는 혁신력");
  if (hasJeongGwan) subTraits.push("정관(正官) — 사회적 책임감과 조직 내 리더십");
  if (hasPyeonGwan) subTraits.push("편관(偏官) — 강한 추진력과 위기 대응 능력");
  if (hasJeongIn) subTraits.push("정인(正印) — 학문적 깊이와 지혜로운 판단력");
  if (hasPyeonIn) subTraits.push("편인(偏印) — 독창적 사고와 영적 통찰력");
  if (hasJeongJae) subTraits.push("정재(正財) — 안정적 재물 관리와 성실한 축적 능력");
  if (hasPyeonJae) subTraits.push("편재(偏財) — 사업적 감각과 투자 안목");
  if (hasBiGyeon) subTraits.push("비견(比肩) — 독립심과 자주적 리더십");
  if (hasGeobJae) subTraits.push("겁재(劫財) — 경쟁에서 이기는 승부사 기질");

  // 괴강살이 있으면 일간 해석에 반영
  const hasGwegang = specialSals.some(s => s.name === "괴강살");

  let weakPoint = "";
  if (chart.dayMasterStrength === "극왕" || chart.dayMasterStrength === "왕") {
    weakPoint = "자기 주장이 강해 타인의 의견을 경시하거나, 고집으로 인해 기회를 놓칠 수 있습니다. 용신(" + chart.yongShin.elementHanja + ")의 기운을 의식적으로 취하면 균형을 찾을 수 있습니다.";
  } else if (chart.dayMasterStrength === "극약" || chart.dayMasterStrength === "약") {
    if (hasGwegang) {
      weakPoint = "일간이 신약(身弱)하여 평소에는 우유부단해 보일 수 있으나, 괴강살의 잠재된 폭발력이 있어 결정적 순간에는 놀라운 결단력을 발휘합니다. 용신(" + chart.yongShin.elementHanja + ")의 기운을 강화하면 이 잠재력을 더 자주 발현할 수 있습니다.";
    } else {
      weakPoint = "자신감이 부족하거나 우유부단해질 수 있습니다. 용신(" + chart.yongShin.elementHanja + ")의 기운을 강화하는 환경과 사람을 가까이 하면 힘을 얻습니다.";
    }
  } else {
    weakPoint = "중화 상태로 큰 약점은 없으나, 가장 부족한 오행(" + chart.yongShin.elementHanja + ")의 기운이 필요할 때 흔들릴 수 있습니다.";
  }

  const tenGodProfile = `천간에 ${tenGods.join(", ")}이(가) 배치되어 있습니다. ` +
    (hasShikShin || hasSangGwan ? "식상(食傷)의 기운이 있어 창작과 표현에 뛰어납니다. " : "") +
    (hasJeongGwan || hasPyeonGwan ? "관성(官星)의 기운이 있어 사회적 성취와 지위 상승의 운이 있습니다. " : "") +
    (hasJeongIn || hasPyeonIn ? "인성(印星)의 기운이 있어 학문과 지혜가 뒷받침됩니다. " : "") +
    (hasJeongJae || hasPyeonJae ? "재성(財星)의 기운이 있어 재물을 모으고 관리하는 능력이 있습니다. " : "");

  // 괴강살 + 신약 조합 특별 해석
  let dayMasterDesc = "";
  if (hasGwegang && (chart.dayMasterStrength === "약" || chart.dayMasterStrength === "극약")) {
    dayMasterDesc = `일간 강약이 "${chart.dayMasterStrength}"이지만 괴강살(魁罡殺)을 가지고 있어, 평소에는 부드럽고 유연하지만 결정적인 위기 상황이나 목표 앞에서는 폭발적인 리더십과 카리스마가 튀어나오는 반전 매력의 소유자입니다. 겉으로는 온화하고 수용적이나, 내면에는 강철 같은 의지가 잠들어 있습니다.`;
  } else if (hasGwegang) {
    dayMasterDesc = `일간 강약이 "${chart.dayMasterStrength}"이며 괴강살(魁罡殺)까지 갖추어, 강력한 리더십과 결단력이 일상에서도 자연스럽게 발현됩니다. 카리스마와 추진력이 넘치지만, 주변과의 조화를 의식하면 더 큰 성과를 이룹니다.`;
  } else {
    dayMasterDesc = `일간 강약이 "${chart.dayMasterStrength}"으로, ${
      chart.dayMasterStrength === "극왕" ? "매우 강한 자아와 추진력을 가지고 있습니다. 주변을 이끄는 힘이 넘치지만 에너지를 분산시키는 것이 중요합니다." :
      chart.dayMasterStrength === "왕" ? "강한 자아와 자신감이 있습니다. 목표를 향한 실행력이 뛰어나며 주도적으로 일을 이끕니다." :
      chart.dayMasterStrength === "중화" ? "균형잡힌 상태로 유연하게 대처하는 능력이 있습니다. 상황에 따라 강하게도 부드럽게도 대응할 수 있습니다." :
      chart.dayMasterStrength === "약" ? "부드럽고 수용적인 성격으로, 주변의 도움을 잘 받아들이며 협력에 능합니다." :
      "매우 유연하고 적응력이 뛰어나며, 환경의 영향을 크게 받습니다. 좋은 환경에서 크게 빛납니다."
    }`;
  }

  return {
    mainTrait: dayStemInfo.trait,
    subTraits,
    talent: heavenlyGift,
    heavenlyGift: `${FIVE_ELEMENTS_HANJA[dayElIdx]}(${FIVE_ELEMENTS[dayElIdx]})의 기운을 타고난 당신은 ${dayStemInfo.trait.split("—")[1]?.trim() || "독특한 재능"}을 하늘로부터 부여받았습니다.`,
    weakPoint,
    elementPersonality: dayStemInfo.description,
    dayMasterDescription: dayMasterDesc,
    tenGodProfile,
    specialSals,
    structurePatterns,
    yongShinRemedy,
  };
}

// ---- 연운 계산 ----

export function calculateYearlyFortune(chart: SajuChart, year: number): YearlyFortune {
  const yearPillar = calculateYearPillar(year, 6, 1);
  const stemRelation = analyzeStemRelation(chart.dayPillar.stemIndex, yearPillar.stemIndex);
  const branchRelation = analyzeBranchRelation(chart.dayPillar.branchIndex, yearPillar.branchIndex);

  const baseScore = stemRelation.score + branchRelation.impact;
  const overallScore = Math.max(20, Math.min(95, baseScore));

  const yearElIdx = STEM_ELEMENTS[yearPillar.stemIndex].element;
  const yongShinElIdx = FIVE_ELEMENTS.indexOf(chart.yongShin.element as typeof FIVE_ELEMENTS[number]);
  const yongShinBonus = yearElIdx === yongShinElIdx ? " 특히 올해는 용신의 기운이 함께하여 운이 더욱 상승합니다." : "";

  const summary = `${year}년은 ${yearPillar.stemHanja}${yearPillar.branchHanja}(${yearPillar.stem}${yearPillar.branch})년으로, ` +
    `당신의 일주 ${chart.dayPillar.stemHanja}${chart.dayPillar.branchHanja}와 ${stemRelation.relation}의 관계입니다. ` +
    `지지는 ${branchRelation.type}으로 ${branchRelation.description}` + yongShinBonus;

  const advice = overallScore >= 70
    ? "전반적으로 좋은 기운이 흐르는 해입니다. 적극적으로 도전하고 새로운 기회를 잡으세요."
    : overallScore >= 50
    ? "평탄한 가운데 기복이 있는 해입니다. 무리하지 말고 꾸준히 기반을 다지세요."
    : "시련과 변화의 해이지만, 이를 통해 한 단계 성장할 수 있습니다. 건강과 인간관계에 신경 쓰세요.";

  const monthlyPillars = getMonthlyPillarsForYear(year);
  const luckyMonths: number[] = [];
  const cautiousMonths: number[] = [];
  for (const { month, pillar } of monthlyPillars) {
    const mStem = analyzeStemRelation(chart.dayPillar.stemIndex, pillar.stemIndex);
    const mBranch = analyzeBranchRelation(chart.dayPillar.branchIndex, pillar.branchIndex);
    const mScore = mStem.score + mBranch.impact;
    if (mScore >= 75) luckyMonths.push(month);
    if (mScore <= 45) cautiousMonths.push(month);
  }

  // 대운-세운 충돌 감지
  let daeunClash: DaeunClash | undefined;
  for (const dw of chart.daeun) {
    if (year >= dw.year && year < dw.year + 10) {
      const dwBranchIdx = EARTHLY_BRANCHES.indexOf(dw.branch as typeof EARTHLY_BRANCHES[number]);
      const yearBranchIdx = yearPillar.branchIndex;
      if (dwBranchIdx >= 0) {
        const CHONG_PAIRS: [number, number][] = [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]];
        for (const [a, b] of CHONG_PAIRS) {
          if ((dwBranchIdx === a && yearBranchIdx === b) || (dwBranchIdx === b && yearBranchIdx === a)) {
            const dwBranchH = EARTHLY_BRANCHES_HANJA[dwBranchIdx];
            const yrBranchH = yearPillar.branchHanja;
            const clashName = `${dwBranchH}${yrBranchH}충(${dw.branch}${yearPillar.branch}沖)`;
            daeunClash = {
              daeunAge: dw.age,
              daeunYear: dw.year,
              daeunPillar: `${dw.stemHanja}${dw.branchHanja}(${dw.stem}${dw.branch})`,
              yearPillar: `${yearPillar.stemHanja}${yearPillar.branchHanja}(${yearPillar.stem}${yearPillar.branch})`,
              clashType: clashName,
              description: `${dw.age}세 대운 ${dw.stemHanja}${dw.branchHanja}과 ${year}년 세운 ${yearPillar.stemHanja}${yearPillar.branchHanja}이 ${clashName}을 형성합니다. 대운과 세운의 충돌은 삶의 큰 전환점을 의미합니다. 직장, 거주지, 인간관계에서 급격한 변화가 올 수 있으니 미리 대비하고 유연하게 대응하는 것이 중요합니다.`,
            };
            break;
          }
        }
      }
      break;
    }
  }

  return {
    year, yearPillar,
    yearElement: FIVE_ELEMENTS[yearElIdx],
    yearElementHanja: FIVE_ELEMENTS_HANJA[yearElIdx],
    relationship: stemRelation.relation,
    overallScore, summary, advice, luckyMonths, cautiousMonths,
    daeunClash,
  };
}

// ---- 월운 계산 ----

export function calculateMonthlyFortunes(chart: SajuChart, year: number): MonthlyFortune[] {
  const monthlyPillars = getMonthlyPillarsForYear(year);
  const KEYWORDS = [
    "시작", "인내", "성장", "변화", "도약", "열정", "수확", "정리",
    "확장", "집중", "성찰", "완성", "기회", "안정", "돌파", "균형",
  ];

  return monthlyPillars.map(({ month, pillar }) => {
    const stemRelation = analyzeStemRelation(chart.dayPillar.stemIndex, pillar.stemIndex);
    const branchRelation = analyzeBranchRelation(chart.dayPillar.branchIndex, pillar.branchIndex);
    const rawScore = stemRelation.score + branchRelation.impact;
    const score = Math.max(20, Math.min(95, rawScore));
    const elIdx = STEM_ELEMENTS[pillar.stemIndex].element;

    const description = `${month}월은 ${pillar.stemHanja}${pillar.branchHanja}(${pillar.stem}${pillar.branch})의 기운입니다. ` +
      stemRelation.description +
      (branchRelation.type !== "평(平)" ? ` 지지에서 ${branchRelation.type}이(가) 작용하여 ${branchRelation.description}` : "");

    const caution = score < 50
      ? "이 달은 무리한 일을 삼가고 건강과 안전에 주의하세요. 중요한 결정은 미루는 것이 좋습니다."
      : score < 65
      ? "큰 문제는 없으나 소소한 마찰에 주의하세요. 감정적 대응을 피하고 이성적으로 판단하세요."
      : "좋은 흐름을 유지하되 교만하지 말고 꾸준히 노력하세요.";

    const keywordIdx = ((pillar.stemIndex + pillar.branchIndex + month) % KEYWORDS.length);

    return {
      month, monthPillar: pillar, score,
      element: FIVE_ELEMENTS[elIdx],
      elementHanja: FIVE_ELEMENTS_HANJA[elIdx],
      relationship: stemRelation.relation, description, caution,
      keyword: KEYWORDS[keywordIdx],
    };
  });
}