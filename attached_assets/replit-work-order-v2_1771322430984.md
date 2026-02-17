# 🔧 작업 지시서 v2: Master Archetype 엔진 대수술
# 3회 교차검증 → 1회 생성 + Few-shot 문체 주입

## 📍 대상 파일
`server/fortune-engine.ts`

## 📍 변경 요약
- **Line 458~869**: `generateGuardianReport` 함수 전체를 아래 코드로 교체
- 기존: GPT 3회 병렬 + 1회 종합 = 4회 API 호출
- 변경: GPT 1회 호출 (강화된 프롬프트 + few-shot) = 1회 API 호출
- 비용 75% 절감 + 문체 품질 대폭 향상

## ⚠️ 주의사항
- `generateGuardianReport` 함수만 교체. 다른 함수(generateFortuneForUser, generateYearlyFortune 등)는 건드리지 마세요.
- `GuardianReport` interface (Line 449~456)는 유지하세요.
- import 문은 변경 불필요.

---

## 교체할 코드

Line 458의 `export async function generateGuardianReport` 부터 Line 869의 닫는 `}` 까지를 아래 코드로 통째로 교체하세요:

```typescript
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

  // ================================================================
  // 1회 생성 시스템 프롬프트 (few-shot 문체 예시 내장)
  // ================================================================
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
[문체 시범 — 반드시 이 톤과 깊이를 따르세요]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

아래는 丁火 일간/삼합목국/양인살·화개살·홍염살/무재 사주인 특정 사용자의 완벽한 작성 예시입니다.
이 톤, 리듬, 깊이를 학습하되, 새로운 사용자에게는 그 사용자의 데이터에 맞는 새로운 이야기를 쓰세요. 절대 아래 내용을 복사하지 마세요.

--- pastInference 예시 ---
당신의 사주를 펼치면 정화(丁火)가 두 개, 한여름 午월에 앉아 있습니다. 촛불이 두 자루 나란히 타오르고 있는 형상입니다. 그런데 이 촛불이 보통 촛불이 아닙니다.

발밑을 보면, 亥·卯·未 — 세 개의 지지가 손을 잡고 하나의 거대한 숲을 이루고 있습니다. 삼합 목국. 나무가 끊임없이 불을 먹여 키우는 구조입니다. 배우면 배울수록, 탐구하면 탐구할수록 당신이라는 불꽃은 더 커집니다. 꺼질 수가 없는 구조로 태어난 겁니다.

그 위에 壬水 정관이 월간에서 내려다보고 있습니다. 한여름의 뜨거운 불에 시원한 비 한 줄기. 이 물이 없었다면 당신은 진작에 스스로를 태워버렸을 겁니다. 이 壬水가 당신에게 사회적 체면, 절제, 그리고 '아직은 아니다'라고 말해주는 이성의 목소리 역할을 해왔습니다.

자미두수로 올라가면, 명궁에 태양성이 앉아 있습니다. 사주에서 촛불인 사람이, 자미두수에서는 태양을 품고 태어난 겁니다. 이건 우연이 아닙니다. 촛불의 섬세함과 태양의 야망이 한 몸에 공존하고 있다는 뜻입니다. 그런데 동시에 — 촛불은 가까이서 비춰야 따뜻하고, 태양은 멀리서 봐야 견딜 수 있습니다. 이 거리감의 모순이 당신 인생 전체를 관통합니다.

서양 별자리는 쌍둥이자리, 주관 행성 수성(Mercury). 사주의 정화가 집중력이라면, 쌍둥이자리의 수성은 확산력입니다. 한 가지에 깊이 빠지면서도 동시에 열 가지가 궁금한 사람. 이 조합이 당신을 '한 우물만 파는 장인'이 아니라 여러 우물의 물맥이 어디서 만나는지 아는 사람으로 만들었습니다.

그리고 양인살이 월지에 칼을 꽂고 앉아 있습니다. 평소에는 보이지 않습니다. 부드럽고, 따뜻하고, 잘 웃는 사람으로 보입니다. 그런데 위기가 오면 — 그 칼이 뽑힙니다. 눈빛이 달라지고, 판단이 빨라지고, 주저하던 사람이 갑자기 전장의 장수가 됩니다. 천을귀인이 일지에 있으니, 그 위기의 순간마다 반드시 누군가가 손을 내밀어줍니다. 천덕귀인이 월간에 있으니, 치명적인 재앙은 번번이 빗겨갑니다.

마지막으로, 화개살과 홍염살이 시주에 나란히 앉아 있습니다. 고독한 예술가의 영혼과, 사람을 불꽃처럼 끌어당기는 매력이 같은 자리에 있는 겁니다. 혼자 있어야 충전되는데, 혼자 두면 사람들이 찾아옵니다. 숨으려 하는데 빛이 새어나옵니다. 이것이 당신의 운명적 구조입니다.
--- pastInference 예시 끝 ---

--- currentState 예시 ---
이런 기운을 가진 사람이 겪는 가장 큰 고통은 '선택'입니다.

촛불은 한 곳을 비춰야 밝습니다. 그런데 태양성은 세상 전체를 비추고 싶어합니다. 쌍둥이자리의 수성은 끊임없이 새로운 것을 속삭입니다. 삼합 목국이 만들어내는 지적 호기심은 바닥을 모릅니다. 그래서 에너지가 여러 방면으로 확산될 때, 정작 집중력을 잃지 않기 위해 스스로와 싸우고 있을 겁니다.

주변은 당신에게 기대합니다. 태양성의 리더십, 양인살의 결단력, 도화살(지금 대운에서 발동 중인)의 매력 — 사람들은 당신이 앞에 서기를 원합니다. 그런데 화개살은 문을 닫고 혼자 작업하고 싶어합니다. 주변의 기대와 내면의 고독 사이에서 '이 길이 맞나?'를 반복하고 있을 겁니다.

자미두수에서 재백궁에 천량성이 앉아 있습니다. 감찰과 원칙의 별입니다. 돈이 들어와도 먼저 '이게 맞는 돈인가'를 따지는 구조입니다. 사주에서 재성(금)이 아예 없는 구조와 정확히 겹칩니다. 돈을 쫓으면 오히려 멀어지고, 자기 분야의 깊이를 쫓으면 돈이 따라오는 운명. 그런데 현실은 당장 돈이 필요한 순간들이 있고, 그때마다 자존심과 현실 사이에서 마찰이 생깁니다.
--- currentState 예시 끝 ---

--- bottleneck 예시 ---
당신의 가장 큰 병목은 한 문장으로 압축됩니다: "과열된 열정과 고독한 내면의 충돌."

화개살과 홍염살이 같은 자리에 있다는 건, 내면의 예술적 고독과 외부를 향한 강렬한 매력이 서로 에너지를 뺏고 있다는 뜻입니다.

사주의 화(火)가 41.2%로 극왕합니다. 여기에 51세 대운 丙子가 시작되면서 丙(양화)이 또 들어왔습니다. 불 위에 불을 얹은 형국입니다. 2026년 세운 丙午까지 겹치면서, 지금 당신의 에너지는 문자 그대로 끓고 있습니다.

이 에너지가 한 방향으로 모이면 — 폭발적인 성취가 옵니다. 이 에너지가 흩어지면 — 당신이 할 수 있는 일에 대한 자신감이 오히려 무너집니다. '나는 이만큼 할 수 있는 사람인데, 왜 결과가 이것밖에 안 되지?' 이 간극이 자존감을 갉아먹습니다.

타인의 의견을 배제하고, 홀로 모든 것을 해결하려는 경향도 병목입니다. 사주에 비겁(丁)이 강하고 양인살까지 있으니, '내가 하면 된다'는 자기 확신이 강합니다. 하지만 재성이 없는 사주에서 혼자 부를 감당하는 건 구조적으로 어렵습니다. 칼은 당신이 쥐되, 칼집은 누군가에게 맡겨야 합니다.
--- bottleneck 예시 끝 ---

--- solution 예시 ---
첫째 — 불을 끄지 마십시오. 방향만 잡으십시오.
지금 당신 안의 에너지는 과한 게 아니라 방향이 없는 겁니다. 극왕한 화가 2026년 丙午 세운과 만나 최고조에 달하고 있는데, 이 에너지를 억누르면 병이 됩니다. 대신 한 가지 프로젝트를 '올해의 전장'으로 선언하십시오. 양인살은 전장이 있어야 칼이 빛나는 구조입니다. 전장이 없으면 칼끝이 자기 자신을 향합니다.

둘째 — 돈을 쫓지 마십시오. 이름을 쫓으십시오.
무재 사주의 부는 전문성과 명성에서 옵니다. 자미두수 재백궁의 천량성도 같은 말을 하고 있습니다. 당신의 금맥은 '이 분야에서 이 사람'이라는 인식입니다. 사주의 관인상생 구조(壬水→乙木→丁火)가 정확히 이것을 지원합니다 — 사회적 인정이 학문적 깊이를 키우고, 그 깊이가 당신의 존재 자체를 키우는 회로. 마케팅, 엔터테인먼트, 기술/IT, 브랜딩 — 이 네 영역 중 하나에서 당신의 이름이 곧 브랜드가 되는 구조를 만드십시오.

셋째 — 고독의 시간을 죄책감 없이 지키십시오.
화개살이 시주에 있다는 건, 인생 후반부로 갈수록 내면 탐구의 시간이 더 필요해진다는 뜻입니다. 이건 게으름이 아니라 충전입니다. 밖에서 태양처럼 비추고 돌아와서, 문을 닫고 촛불처럼 자기 안을 비추는 시간. 이 리듬이 깨지면 창의력이 마릅니다. 최소 하루 2시간, 누구의 기대에도 응하지 않는 시간을 확보하십시오.

넷째 — 지금 발동한 도화살을 전략적으로 쓰십시오.
51세 대운 丙子에서 도화살이 처음 켜졌습니다. 사주 원국에는 없던 매력의 기운이 외부에서 들어온 겁니다. 이건 10년간 지속됩니다. 대중 앞에 나서기에 지금보다 좋은 타이밍은 없습니다. 브랜드 론칭, 콘텐츠 발행, 퍼블릭 이미지 구축 — 미루고 있던 것이 있다면 지금이 천문학적으로 가장 정확한 시점입니다.

다섯째 — 칼집이 되어줄 파트너를 찾으십시오.
재성이 없는 사주에서 큰 부를 감당하려면 비겁(같은 화 기운)의 도움이 필요합니다. 동업자, 공동 창업자, 혹은 실무를 함께 짊어질 파트너. 천을귀인이 일지에 있으니 진심으로 찾으면 반드시 나타납니다. 다만 자미두수 천이궁의 거문성이 경고합니다 — 구설수에 오르기 쉬우니 파트너를 고를 때 말이 많은 사람보다 묵묵히 실행하는 사람을 고르십시오.

여섯째 — 용신 수(水)의 기운을 생활에 심으십시오.
극왕한 화를 다스리는 유일한 처방입니다. 시간: 밤 9시 이후(해시~자시)에 중요한 사고와 작업을 배치하십시오. 장소: 물가, 바다, 강, 호수. 북쪽 방향의 도시나 해외가 행운을 가져옵니다. 색상: 검정, 남색, 짙은 파랑을 일상에 두십시오. 음식: 해산물, 해조류, 검은콩, 흑미. 주의: 토(土)의 과한 기운을 피하십시오.
--- solution 예시 끝 ---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[작성 원칙]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**원칙 1: 키워드 스티치 금지**
"결단력이 있고 호기심이 있어..." 식의 키워드 병렬 연결 금지. 인과관계(Causality)로 서술: "A라는 기운이 B를 만나니 C라는 현상이 일어나는 겁니다"

**원칙 2: 4단계 화술**
1. Fact → 2. Interpretation (비유) → 3. Phenomenon (소름 돋는 일상 디테일) → 4. Advantage (이득 전략)

**원칙 3: 세 시스템 수렴형 서사**
사주/자미두수/별자리를 분리 나열하지 말고, "사주에서 이렇게 나왔는데 자미두수에서도 같은 이야기를 하고 별자리까지 확인"하는 수렴의 전율을 전달.

**원칙 4: 모든 특수살 빠짐없이 언급** — 각 살을 쉬운 비유로 설명 후 살 간 화학적 결합 분석.

**원칙 5: 특수 구조 정밀 분석**
- 양인살+천을귀인: "칼을 쥔 귀족"
- 삼합: 어떤 오행 합국인지, 십성 중 무엇인지 → 인생의 주무기
- 무재 구조: "돈을 쫓지 않을 때 돈이 따르는 역설"
- 홍염살+화개살: "숨으려 하는데 빛이 새어나오는" 이중 구조

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
${sc.fiveElementRatios?.map((r: any) => `  - ${r.element}(${r.elementHanja}): ${r.ratio}% (가중치 ${r.weight})`).join("\\n") || "  데이터 없음"}
■ 지배 오행: ${sc.dominantElement}

■ 용신(用神): ${sc.yongShin?.element}(${sc.yongShin?.elementHanja}) — ${sc.yongShin?.reason}

■ 십성(十星) 배치: ${sp.tenGodProfile}
■ 부특성: ${sp.subTraits?.join(", ") || "없음"}

■ 천부적 재능: ${sp.talent}
■ 하늘이 준 선물: ${sp.heavenlyGift}
■ 약점: ${sp.weakPoint}

■ 특수살: ${sp.specialSals?.map((s: any) => `${s.name}(${s.hanja}) — ${s.description}`).join("\\n  ") || "없음"}

■ 구조 패턴: ${sp.structurePatterns?.map((p: any) => `${p.name}(${p.hanja}) — ${p.description}`).join("\\n  ") || "없음"}

■ [중요] ${currentYear}년 현재 활성화된 대운 무기 (Time-Unlocked Skills): ${activeDaewoonStars.length > 0
  ? activeDaewoonStars.map((s: any) => `- [${s.name}(${s.hanja})]: ${s.source}에서 들어와 지금부터 발동됨! (원래 사주엔 없었음) — ${s.description}`).join("\\n  ")
  : "특이사항 없음 (현재 대운에서 새로 해금된 신살 없음)"}

■ 용신 보완법: ${sp.yongShinRemedy ? `방향: ${sp.yongShinRemedy.luckyDirection}, 색상: ${sp.yongShinRemedy.luckyColor}, 활동: ${sp.yongShinRemedy.luckyActivity}` : "없음"}

■ 대운 흐름 (10년 단위):
${sc.daeun?.slice(0, 6).map((d: any) => `  - ${d.age}세(${d.year}년): ${d.stem}${d.branch}(${d.stemHanja}${d.branchHanja})`).join("\\n") || "  데이터 없음"}

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
          return \`⚠️ \${dw.age}세 대운 \${dw.stemHanja}\${dw.branchHanja}(\${dw.stem}\${dw.branch})과 2026년 세운 丙午(병오)가 \${BRANCHES_H[dwBIdx]}\${BRANCHES_H[yr2026BranchIdx]}충(\${dw.branch}\${BRANCHES[yr2026BranchIdx]}沖)을 형성합니다. 이는 인생의 거대한 변곡점으로, 직장/거주지/인간관계에서 급격한 변화가 예상됩니다.\`;
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
키워드를 나열하지 말고, 인과관계(Why → How)의 흐름으로 이야기하세요.
4단계 화술(Fact → Interpretation → Phenomenon → Advantage)을 모든 섹션에 적용하세요.
사주/자미두수/별자리를 분리 나열하지 말고 하나의 서사로 엮으세요.
절대로 사용자의 이름을 사용하지 말고, "당신"이라고만 지칭하세요.
loveAdvice는 섹션 4의 이성운 데이터를 반드시 참조하세요.
`;

  try {
    console.log("[Guardian] 1회 생성 (few-shot 강화 프롬프트) 시작...");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.75,
      max_tokens: 8000,
    });

    const content = response.choices[0].message.content || "{}";
    const result = JSON.parse(content);

    // 필드 검증 및 폴백
    if (!result.pastInference) result.pastInference = "운명 데이터 분석 중 과거 패턴을 특정할 수 없습니다.";
    if (!result.keywords || result.keywords.length === 0) result.keywords = ["분석", "진행", "연결"];
    if (!result.coherenceScore) result.coherenceScore = 85;
    if (!result.coreEnergy) result.coreEnergy = "운명의 탐구자";
    if (!result.currentState) result.currentState = "현재 상태 분석 중";
    if (!result.bottleneck) result.bottleneck = "병목 분석 중";
    if (!result.solution) result.solution = "솔루션 생성 중";

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
```

---

## ✅ 변경 전후 비교

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| API 호출 수 | 4회 (3 병렬 + 1 종합) | 1회 |
| 예상 비용 | ~$0.20/회 | ~$0.05/회 |
| Temperature | 개별 0.85, 종합 0.3 | 단일 0.75 |
| max_tokens | 미지정 | 8000 (긴 출력 보장) |
| Few-shot 예시 | 없음 | pastInference/currentState/bottleneck/solution 전문 포함 |
| 문체 일관성 | 4번 거치며 평균화 | 한 호흡으로 생성 |

## ✅ 검증 체크리스트

테스트 후 확인할 것:
1. pastInference가 1000자 이상인가?
2. 사주→자미두수→별자리가 하나의 서사로 엮여있는가? (분리 나열 아닌지)
3. "~경향이 있습니다", "~할 수 있습니다" 같은 약한 표현이 없는가?
4. solution이 "첫째/둘째/..." 번호 항목 구조인가?
5. coreEnergy가 역설/대비 구조의 7~15자 은유인가?
6. 키워드 나열("결단력, 창의성, 리더십") 없이 인과관계 서사로 되어있는가?
