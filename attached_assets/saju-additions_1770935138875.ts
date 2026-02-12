// ============================================
// 이 파일의 내용을 기존 shared/saju.ts 맨 아래에 추가하세요
// ============================================

// ---- 연운 / 월운 분석 ----

export interface YearlyFortune {
  year: number;
  yearPillar: Pillar;
  yearElement: string;
  yearElementHanja: string;
  relationship: string; // 일주와의 관계
  overallScore: number; // 0-100
  summary: string;
  advice: string;
  luckyMonths: number[];
  cautiousMonths: number[];
}

export interface MonthlyFortune {
  month: number; // 1-12
  monthPillar: Pillar;
  score: number; // 0-100
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
  impact: number; // -30 ~ +30 score modifier
  description: string;
} {
  // 육합 (六合) - 매우 길
  const LIUHE: [number, number][] = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];
  for (const [a, b] of LIUHE) {
    if ((dayBranchIdx === a && targetBranchIdx === b) || (dayBranchIdx === b && targetBranchIdx === a)) {
      return { type: "육합(六合)", impact: 20, description: "조화와 화합의 기운. 귀인을 만나고 일이 순조롭게 풀립니다." };
    }
  }

  // 삼합 (三合) - 길
  const SANHE: [number, number, number][] = [[0, 4, 8], [1, 5, 9], [2, 6, 10], [3, 7, 11]];
  for (const trio of SANHE) {
    if (trio.includes(dayBranchIdx) && trio.includes(targetBranchIdx)) {
      return { type: "삼합(三合)", impact: 15, description: "삼합의 조화로운 기운. 협력과 성취의 에너지가 강합니다." };
    }
  }

  // 육충 (六沖) - 흉
  const CHONG: [number, number][] = [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]];
  for (const [a, b] of CHONG) {
    if ((dayBranchIdx === a && targetBranchIdx === b) || (dayBranchIdx === b && targetBranchIdx === a)) {
      return { type: "충(沖)", impact: -25, description: "충돌과 변동의 기운. 갈등, 이동, 변화가 생기니 신중하게 행동하세요." };
    }
  }

  // 형 (刑) - 소흉
  const XING: [number, number][] = [[2, 5], [5, 8], [8, 2], [1, 10], [10, 7], [7, 1], [0, 3], [3, 0]];
  for (const [a, b] of XING) {
    if (dayBranchIdx === a && targetBranchIdx === b) {
      return { type: "형(刑)", impact: -15, description: "마찰과 시련의 기운. 법적 문제나 건강에 주의하고 언행을 삼가세요." };
    }
  }

  // 해 (害) - 소흉
  const HAI: [number, number][] = [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]];
  for (const [a, b] of HAI) {
    if ((dayBranchIdx === a && targetBranchIdx === b) || (dayBranchIdx === b && targetBranchIdx === a)) {
      return { type: "해(害)", impact: -10, description: "은근한 방해와 소인의 기운. 대인관계에서 오해가 생기기 쉽습니다." };
    }
  }

  return { type: "평(平)", impact: 0, description: "특별한 충돌이나 조화 없이 안정적입니다." };
}

// 2026년 각 월의 월주 계산 (절기 기준)
function getMonthlyPillarsForYear(year: number): { month: number; pillar: Pillar }[] {
  const yearPillar = calculateYearPillar(year, 6, 1); // 연중 안전 날짜로 계산
  const result: { month: number; pillar: Pillar }[] = [];

  // 각 월 중간일로 월주 계산
  const monthMidDays = [
    { month: 1, day: 20 },
    { month: 2, day: 15 },
    { month: 3, day: 15 },
    { month: 4, day: 15 },
    { month: 5, day: 15 },
    { month: 6, day: 15 },
    { month: 7, day: 15 },
    { month: 8, day: 15 },
    { month: 9, day: 15 },
    { month: 10, day: 15 },
    { month: 11, day: 15 },
    { month: 12, day: 15 },
  ];

  for (const { month, day } of monthMidDays) {
    const pillar = calculateMonthPillar(year, month, day, yearPillar.stemIndex);
    result.push({ month, pillar });
  }

  return result;
}

// 성격 분석용 십성 해석
export interface SajuPersonality {
  mainTrait: string;
  subTraits: string[];
  talent: string;
  heavenlyGift: string;
  weakPoint: string;
  elementPersonality: string;
  dayMasterDescription: string;
  tenGodProfile: string;
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
  if (hasShikShin) subTraits.push("식신 — 풍요로운 감성과 표현력, 미식가적 감각");
  if (hasSangGwan) subTraits.push("상관 — 창조적 재능과 기존 틀을 깨는 혁신력");
  if (hasJeongGwan) subTraits.push("정관 — 사회적 책임감과 조직 내 리더십");
  if (hasPyeonGwan) subTraits.push("편관 — 강한 추진력과 위기 대응 능력");
  if (hasJeongIn) subTraits.push("정인 — 학문적 깊이와 지혜로운 판단력");
  if (hasPyeonIn) subTraits.push("편인 — 독창적 사고와 영적 통찰력");
  if (hasJeongJae) subTraits.push("정재 — 안정적 재물 관리와 성실한 축적 능력");
  if (hasPyeonJae) subTraits.push("편재 — 사업적 감각과 투자 안목");
  if (hasBiGyeon) subTraits.push("비견 — 독립심과 자주적 리더십");
  if (hasGeobJae) subTraits.push("겁재 — 경쟁에서 이기는 승부사 기질");

  let weakPoint = "";
  if (chart.dayMasterStrength === "극왕" || chart.dayMasterStrength === "왕") {
    weakPoint = "자기 주장이 강해 타인의 의견을 경시하거나, 고집으로 인해 기회를 놓칠 수 있습니다. 용신(" + chart.yongShin.elementHanja + ")의 기운을 의식적으로 취하면 균형을 찾을 수 있습니다.";
  } else if (chart.dayMasterStrength === "극약" || chart.dayMasterStrength === "약") {
    weakPoint = "자신감이 부족하거나 우유부단해질 수 있습니다. 용신(" + chart.yongShin.elementHanja + ")의 기운을 강화하는 환경과 사람을 가까이 하면 힘을 얻습니다.";
  } else {
    weakPoint = "중화 상태로 큰 약점은 없으나, 가장 부족한 오행(" + chart.yongShin.elementHanja + ")의 기운이 필요할 때 흔들릴 수 있습니다.";
  }

  const tenGodProfile = `천간에 ${tenGods.join(", ")}이(가) 배치되어 있습니다. ` +
    (hasShikShin || hasSangGwan ? "식상(食傷)의 기운이 있어 창작과 표현에 뛰어납니다. " : "") +
    (hasJeongGwan || hasPyeonGwan ? "관성(官星)의 기운이 있어 사회적 성취와 지위 상승의 운이 있습니다. " : "") +
    (hasJeongIn || hasPyeonIn ? "인성(印星)의 기운이 있어 학문과 지혜가 뒷받침됩니다. " : "") +
    (hasJeongJae || hasPyeonJae ? "재성(財星)의 기운이 있어 재물을 모으고 관리하는 능력이 있습니다. " : "");

  return {
    mainTrait: dayStemInfo.trait,
    subTraits,
    talent: heavenlyGift,
    heavenlyGift: `${FIVE_ELEMENTS_HANJA[dayElIdx]}(${FIVE_ELEMENTS[dayElIdx]})의 기운을 타고난 당신은 ${dayStemInfo.trait.split("—")[1]?.trim() || "독특한 재능"}을 하늘로부터 부여받았습니다.`,
    weakPoint,
    elementPersonality: dayStemInfo.description,
    dayMasterDescription: `일간 강약이 "${chart.dayMasterStrength}"으로, ${
      chart.dayMasterStrength === "극왕" ? "매우 강한 자아와 추진력을 가지고 있습니다. 주변을 이끄는 힘이 넘치지만 에너지를 분산시키는 것이 중요합니다." :
      chart.dayMasterStrength === "왕" ? "강한 자아와 자신감이 있습니다. 목표를 향한 실행력이 뛰어나며 주도적으로 일을 이끕니다." :
      chart.dayMasterStrength === "중화" ? "균형잡힌 상태로 유연하게 대처하는 능력이 있습니다. 상황에 따라 강하게도 부드럽게도 대응할 수 있습니다." :
      chart.dayMasterStrength === "약" ? "부드럽고 수용적인 성격으로, 주변의 도움을 잘 받아들이며 협력에 능합니다." :
      "매우 유연하고 적응력이 뛰어나며, 환경의 영향을 크게 받습니다. 좋은 환경에서 크게 빛납니다."
    }`,
    tenGodProfile,
  };
}

// 연운 계산
export function calculateYearlyFortune(chart: SajuChart, year: number): YearlyFortune {
  const yearPillar = calculateYearPillar(year, 6, 1);
  const stemRelation = analyzeStemRelation(chart.dayPillar.stemIndex, yearPillar.stemIndex);
  const branchRelation = analyzeBranchRelation(chart.dayPillar.branchIndex, yearPillar.branchIndex);

  const baseScore = stemRelation.score + branchRelation.impact;
  const overallScore = Math.max(20, Math.min(95, baseScore));

  // 용신과의 관계
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

  // 월별 운세 계산하여 좋은 달/나쁜 달 추출
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

  return {
    year,
    yearPillar,
    yearElement: FIVE_ELEMENTS[yearElIdx],
    yearElementHanja: FIVE_ELEMENTS_HANJA[yearElIdx],
    relationship: stemRelation.relation,
    overallScore,
    summary,
    advice,
    luckyMonths,
    cautiousMonths,
  };
}

// 월운 계산
export function calculateMonthlyFortunes(chart: SajuChart, year: number): MonthlyFortune[] {
  const monthlyPillars = getMonthlyPillarsForYear(year);
  const MONTH_NAMES = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

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
      month,
      monthPillar: pillar,
      score,
      element: FIVE_ELEMENTS[elIdx],
      elementHanja: FIVE_ELEMENTS_HANJA[elIdx],
      relationship: stemRelation.relation,
      description,
      caution,
      keyword: KEYWORDS[keywordIdx],
    };
  });
}
