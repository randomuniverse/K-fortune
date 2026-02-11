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

export function calculateDayPillar(year: number, month: number, day: number): Pillar {
  const jdn = getJDN(year, month, day);
  const stemIdx = ((jdn - 1) % 10 + 10) % 10;
  const branchIdx = ((jdn + 1) % 12 + 12) % 12;
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
  fiveElements: { element: string; ratio: number }[]
): "극왕" | "왕" | "중화" | "약" | "극약" {
  const dayElement = FIVE_ELEMENTS[STEM_ELEMENTS[dayPillar.stemIndex].element];
  const producesDay = FIVE_ELEMENTS[(STEM_ELEMENTS[dayPillar.stemIndex].element + 4) % 5];

  const dayRatio = fiveElements.find(e => e.element === dayElement)?.ratio || 0;
  const supportRatio = fiveElements.find(e => e.element === producesDay)?.ratio || 0;
  const totalSupport = dayRatio + supportRatio;

  if (totalSupport >= 60) return "극왕";
  if (totalSupport >= 45) return "왕";
  if (totalSupport >= 30) return "중화";
  if (totalSupport >= 15) return "약";
  return "극약";
}

export function calculateYongShin(
  dayPillar: Pillar,
  strength: "극왕" | "왕" | "중화" | "약" | "극약",
  fiveElements: { element: string; elementHanja: string; ratio: number }[]
): { element: string; elementHanja: string; reason: string } {
  const dayElIdx = STEM_ELEMENTS[dayPillar.stemIndex].element;

  if (strength === "극왕") {
    const drainIdx = (dayElIdx + 1) % 5;
    const controlIdx = (dayElIdx + 3) % 5;
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

  const zodiac = getChineseZodiac(year);

  const yearTenGod: TenGod = { name: getTenGodName(dayPillar.stemIndex, yearPillar.stemIndex) };
  const monthTenGod: TenGod = { name: getTenGodName(dayPillar.stemIndex, monthPillar.stemIndex) };
  const hourTenGod: TenGod = { name: getTenGodName(dayPillar.stemIndex, hourPillar.stemIndex) };

  const yearBranchTenGod: TenGod = { name: getTenGodName(dayPillar.stemIndex, getBranchMainHiddenStem(yearPillar.branchIndex)) };
  const monthBranchTenGod: TenGod = { name: getTenGodName(dayPillar.stemIndex, getBranchMainHiddenStem(monthPillar.branchIndex)) };
  const dayBranchTenGod: TenGod = { name: getTenGodName(dayPillar.stemIndex, getBranchMainHiddenStem(dayPillar.branchIndex)) };
  const hourBranchTenGod: TenGod = { name: getTenGodName(dayPillar.stemIndex, getBranchMainHiddenStem(hourPillar.branchIndex)) };

  const fiveElementRatios = calculateFiveElements(yearPillar, monthPillar, dayPillar, hourPillar, monthPillar.branchIndex);
  const dominantEl = [...fiveElementRatios].sort((a, b) => b.ratio - a.ratio)[0];
  const dayMasterStrength = getDayMasterStrength(dayPillar, fiveElementRatios);
  const yongShin = calculateYongShin(dayPillar, dayMasterStrength, fiveElementRatios);

  const { daeunList, startAge } = calculateDaeun(gender, yearPillar, monthPillar, year, month, day);

  return {
    yearPillar,
    monthPillar,
    dayPillar,
    hourPillar,
    chineseZodiac: zodiac.animal,
    chineseZodiacBranch: EARTHLY_BRANCHES[zodiac.branchIndex],
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
