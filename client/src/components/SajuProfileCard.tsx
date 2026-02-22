import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Flame, Droplets, Mountain, Wind, Gem, User, Sparkles, Brain, Shield, Target, Zap, Clock, MapPin, Palette, UtensilsCrossed, TrendingUp, AlertTriangle, Star, Moon, Briefcase, Wallet, Compass, Heart, Plane, Lightbulb } from "lucide-react";
import type { SajuChart } from "@shared/saju";
import type { ZodiacInfo } from "@shared/schema";
import { analyzeSajuPersonality, analyzeSinsalIntegrated } from "@shared/saju";
import { calculateZiWei, generateDestinyInsight } from "@shared/ziwei";
import type { SajuPersonality, SpecialSal, StructurePattern, YongShinRemedy, DynamicDaewoonStar, SinsalAnalysis } from "@shared/saju";
import { calculateDaewoonDynamicStars } from "@shared/saju";
import { SajuInfoCard } from "./SajuInfoCard";
import { ZodiacInfoCard } from "./ZodiacInfoCard";

interface Props {
  chart: SajuChart;
  zodiacInfo: ZodiacInfo;
  birthDate: string;
  birthTime: string;
  userName: string;
  gender?: string;
}

interface SajuProps {
  chart: SajuChart;
  birthDate: string;
  birthTime: string;
  userName: string;
}

interface ZiweiProps {
  chart: SajuChart;
  birthDate: string;
  birthTime: string;
  gender?: string;
}

interface ZodiacProps {
  zodiacInfo: ZodiacInfo;
}

const ELEMENT_ICONS: Record<string, typeof Flame> = {
  "화": Flame, "수": Droplets, "토": Mountain, "목": Wind, "금": Gem,
};
const ELEMENT_COLORS: Record<string, string> = {
  "화": "text-red-400", "수": "text-blue-400", "토": "text-amber-400", "목": "text-green-400", "금": "text-slate-300",
};
const ELEMENT_BG: Record<string, string> = {
  "화": "bg-red-500/10 border-red-500/20",
  "수": "bg-blue-500/10 border-blue-500/20",
  "토": "bg-amber-500/10 border-amber-500/20",
  "목": "bg-green-500/10 border-green-500/20",
  "금": "bg-slate-400/10 border-slate-400/20",
};

function Section({ icon: Icon, title, children, delay = 0 }: { icon: any; title: string; children: React.ReactNode; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }}>
      <Card className="bg-white/[0.03] border-white/10 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-serif text-primary">{title}</h4>
        </div>
        {children}
      </Card>
    </motion.div>
  );
}

export function SajuDeepAnalysis({ chart, birthDate, birthTime, userName }: SajuProps) {
  const personality = analyzeSajuPersonality(chart);
  const dayElement = ["목", "화", "토", "금", "수"][[0, 0, 1, 1, 2, 2, 3, 3, 4, 4][chart.dayPillar.stemIndex]];
  const ElIcon = ELEMENT_ICONS[dayElement] || Sparkles;
  const elColor = ELEMENT_COLORS[dayElement] || "text-primary";
  const elBg = ELEMENT_BG[dayElement] || "bg-white/5 border-white/10";

  return (
    <div className="space-y-4">
      <SajuInfoCard chart={chart} birthDate={birthDate} birthTime={birthTime} userName={userName} />

      <Section icon={Shield} title="용신(用神)과 개운법" delay={0.05}>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className={`rounded-lg p-3 border ${ELEMENT_BG[chart.yongShin.element] || "bg-white/5 border-white/10"}`}>
            <p className="text-[10px] text-muted-foreground mb-1">용신 (보호 기운)</p>
            <p className={`text-sm font-bold ${ELEMENT_COLORS[chart.yongShin.element] || "text-white"}`}>
              {chart.yongShin.elementHanja} ({chart.yongShin.element})
            </p>
          </div>
          <div className="bg-white/[0.03] rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground mb-1">일간 강약</p>
            <p className="text-sm font-bold text-white">{chart.dayMasterStrength}</p>
          </div>
        </div>
        <p className="text-xs text-white/60 leading-relaxed mb-3">{chart.yongShin.reason}</p>
        
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/[0.03] rounded p-2 text-xs text-white/70"><span className="text-primary/70 mr-1">시간:</span> {personality.yongShinRemedy.luckyTime}</div>
            <div className="bg-white/[0.03] rounded p-2 text-xs text-white/70"><span className="text-primary/70 mr-1">장소:</span> {personality.yongShinRemedy.luckyPlace}</div>
            <div className="bg-white/[0.03] rounded p-2 text-xs text-white/70"><span className="text-primary/70 mr-1">색상:</span> {personality.yongShinRemedy.luckyColor}</div>
            <div className="bg-white/[0.03] rounded p-2 text-xs text-white/70"><span className="text-primary/70 mr-1">음식:</span> {personality.yongShinRemedy.luckyFood}</div>
          </div>
          <div className="bg-red-500/5 border border-red-500/10 rounded p-3">
            <p className="text-xs text-white/60">
              <span className="text-red-400 font-bold mr-1">주의:</span>
              {personality.yongShinRemedy.avoidElementHanja}({personality.yongShinRemedy.avoidElement})의 과한 기운을 피하세요.
            </p>
          </div>
        </div>
      </Section>

      <Section icon={User} title="일간(日干)으로 본 나의 본성" delay={0.1}>
        <div className={`rounded-xl p-4 border ${elBg}`}>
          <div className="flex items-center gap-3 mb-2">
            <ElIcon className={`w-6 h-6 ${elColor}`} />
            <div>
              <p className="text-sm font-bold text-white">{chart.dayPillar.stemHanja} ({chart.dayPillar.stem})</p>
              <p className={`text-xs ${elColor}`}>{personality.mainTrait}</p>
            </div>
          </div>
          <p className="text-sm text-white/80 leading-relaxed">{personality.elementPersonality}</p>
        </div>
        <p className="text-sm text-white/70 leading-relaxed">{personality.dayMasterDescription}</p>
      </Section>

      {personality.specialSals.length > 0 && (() => {
        const sinsalData: SinsalAnalysis = analyzeSinsalIntegrated(chart, new Date().getFullYear());
        const overlappingNames = new Set(sinsalData.overlapping.map(o => o.name));
        return (
          <>
            <Section icon={Zap} title={`원국 신살(原局神煞) — 타고난 기운 (${personality.specialSals.length}개)`} delay={0.15}>
              <div className="space-y-4">
                {(() => {
                  const gilSals = personality.specialSals.filter((s: any) => s.category === "길신");
                  const hyungSals = personality.specialSals.filter((s: any) => s.category === "흉신");
                  const neutralSals = personality.specialSals.filter((s: any) => s.category === "중성" || !s.category);
                  const categoryConfig = {
                    길신: { label: "길신(吉神) — 하늘이 준 축복", sals: gilSals, gradient: "from-emerald-500/10 to-teal-500/10", border: "border-emerald-500/20", iconColor: "text-emerald-400", textColor: "text-emerald-300", subColor: "text-emerald-200/70", badge: "bg-emerald-500/20 text-emerald-300" },
                    흉신: { label: "흉신(凶神) — 시련 속 성장의 열쇠", sals: hyungSals, gradient: "from-red-500/10 to-orange-500/10", border: "border-red-500/20", iconColor: "text-red-400", textColor: "text-red-300", subColor: "text-red-200/70", badge: "bg-red-500/20 text-red-300" },
                    중성: { label: "중성(中性) — 양면의 가능성", sals: neutralSals, gradient: "from-amber-500/10 to-yellow-500/10", border: "border-amber-500/20", iconColor: "text-amber-400", textColor: "text-amber-300", subColor: "text-amber-200/70", badge: "bg-amber-500/20 text-amber-300" },
                  };
                  return Object.entries(categoryConfig).map(([key, cfg]) => {
                    if (cfg.sals.length === 0) return null;
                    return (
                      <div key={key} className="space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                          <span className="text-[10px] text-white/30">{cfg.sals.length}개</span>
                        </div>
                        {cfg.sals.map((sal: any, i: number) => (
                          <div key={i} className={`bg-gradient-to-r ${cfg.gradient} border ${cfg.border} rounded-xl p-4 ${overlappingNames.has(sal.name) ? 'ring-1 ring-yellow-400/40' : ''}`}>
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Zap className={`w-4 h-4 ${cfg.iconColor}`} />
                              <span className={`text-sm font-bold ${cfg.textColor}`}>{sal.name} ({sal.hanja})</span>
                              {sal.foundIn && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/40">{sal.foundIn}</span>}
                              {overlappingNames.has(sal.name) && <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-bold">올해 극대화</span>}
                            </div>
                            <p className={`text-xs ${cfg.subColor} mb-2 font-medium`}>{sal.personality}</p>
                            <p className="text-xs text-white/70 leading-relaxed">{sal.description}</p>
                          </div>
                        ))}
                      </div>
                    );
                  });
                })()}
              </div>
            </Section>
            {sinsalData.dynamicSinsal.length > 0 && (
              <Section icon={Sparkles} title={`${sinsalData.year}년 세운 신살(歲運神煞) — 올해의 기운 (${sinsalData.dynamicSinsal.length}개)`} delay={0.17}>
                <div className="space-y-2">
                  {sinsalData.dynamicSinsal.map((sal, i) => {
                    const color = sal.category === '길신' ? 'text-emerald-300' : sal.category === '흉신' ? 'text-red-300' : 'text-amber-300';
                    const bg = sal.category === '길신' ? 'from-emerald-500/5 to-teal-500/5 border-emerald-500/15' : sal.category === '흉신' ? 'from-red-500/5 to-orange-500/5 border-red-500/15' : 'from-amber-500/5 to-yellow-500/5 border-amber-500/15';
                    const isOverlap = overlappingNames.has(sal.name);
                    return (
                      <div key={i} className={`bg-gradient-to-r ${bg} border rounded-xl p-4 ${isOverlap ? 'ring-1 ring-yellow-400/40' : ''}`}>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Sparkles className={`w-4 h-4 ${sal.category === '길신' ? 'text-emerald-400' : sal.category === '흉신' ? 'text-red-400' : 'text-amber-400'}`} />
                          <span className={`text-sm font-bold ${color}`}>{sal.name} ({sal.hanja})</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-200">{sal.foundIn}</span>
                          {isOverlap && <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-bold">원국과 겹침</span>}
                        </div>
                        <p className="text-xs text-white/70 leading-relaxed">{sal.description}</p>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}
            {sinsalData.samjae && (
              <Section icon={AlertTriangle} title={`${sinsalData.year}년 삼재(三災) 경고`} delay={0.19}>
                <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-bold text-red-300">{sinsalData.samjae.name}</span>
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed">{sinsalData.samjae.description}</p>
                  <p className="text-xs text-red-200/60 mt-2 font-medium">{sinsalData.samjae.personality}</p>
                </div>
              </Section>
            )}
          </>
        );
      })()}

      {(() => {
        const currentYear = new Date().getFullYear();
        const dynamicStars = calculateDaewoonDynamicStars(chart, currentYear);
        if (dynamicStars.length === 0) return null;
        const staticSalNames = personality.specialSals.map(s => s.name);
        return (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.4 }}>
            <Card className="relative overflow-visible border-0 p-0" data-testid="section-active-buffs">
              <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-r from-violet-500/40 via-fuchsia-500/40 to-amber-500/40 animate-pulse" style={{ animationDuration: "3s" }} />
              <div className="relative bg-[hsl(270,30%,8%)] rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-fuchsia-400" />
                  <h4 className="text-sm font-serif text-fuchsia-300" data-testid="text-dynamic-stars-title">현재 대운에서 발동 중인 힘 (Level Up!)</h4>
                </div>
                <div className="space-y-3">
                  {dynamicStars.map((star, i) => {
                    const isDouble = staticSalNames.includes(star.name);
                    return (
                      <div key={i} className="relative bg-gradient-to-r from-violet-500/15 to-fuchsia-500/15 border border-violet-400/25 rounded-xl p-4" data-testid={`card-dynamic-star-${i}`}>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Zap className="w-4 h-4 text-violet-300" />
                          <span className="text-sm font-bold text-violet-200" data-testid={`text-dynamic-star-name-${i}`}>{star.name} ({star.hanja})</span>
                          {isDouble && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold whitespace-nowrap" data-testid={`badge-double-${i}`}>x2 이중 활성화</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 whitespace-nowrap" data-testid={`badge-source-${i}`}>{star.source} 한정</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap" data-testid={`badge-active-${i}`}>발동 중</span>
                        </div>
                        <p className="text-xs text-white/70 leading-relaxed" data-testid={`text-dynamic-star-desc-${i}`}>{star.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })()}

      <Section icon={Sparkles} title="하늘이 부여한 재능 & 구조" delay={0.2}>
        <p className="text-sm text-white/80 leading-relaxed mb-3">{personality.heavenlyGift}</p>
        <div className="bg-white/[0.03] rounded-lg p-3 mb-4">
          <p className="text-xs text-primary/70 font-medium mb-1">적성 분야</p>
          <p className="text-sm text-white/70">{personality.talent}</p>
        </div>
        {personality.structurePatterns.map((pattern, i) => (
          <div key={i} className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl p-4 mt-2">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-emerald-300">{pattern.name} ({pattern.hanja})</span>
            </div>
            <p className="text-xs text-emerald-200/70 mb-2 font-medium">{pattern.businessTrait}</p>
            <p className="text-xs text-white/70 leading-relaxed">{pattern.description}</p>
          </div>
        ))}
      </Section>
    </div>
  );
}

export function ZiweiDeepAnalysis({ chart, birthDate, birthTime, gender = "male" }: ZiweiProps) {
  const [year, month, day] = birthDate.split('-').map(Number);
  const hour = parseInt(birthTime.split(':')[0]);
  const safeGender = (gender === "female" || gender === "여" || gender === "woman") ? "female" : "male";
  
  const ziwei = calculateZiWei(year, month, day, hour, safeGender);
  const destinyInsight = generateDestinyInsight(ziwei, chart);

  const renderStars = (stars: any[], title: string, icon: any, colorClass: string, context: "personality" | "loveStyle" | "wealthStyle" | "socialStyle") => (
    <div className={`bg-gradient-to-r ${colorClass} border border-white/5 rounded-xl p-5 mb-4`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-sm font-bold text-white">{title}</span>
      </div>
      {stars.length > 0 ? (
        <div className="space-y-4">
          {stars.map((star: any, i: number) => (
            <div key={i} className="relative">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-base font-bold text-white">{star.name.split('(')[0]}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">{star.keyword}</span>
              </div>
              <p className="text-xs text-white/80 leading-relaxed bg-black/20 p-3 rounded-lg">
                {star[context]}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-white/50">이 궁에는 주성(Major Star)이 없습니다. (대궁의 영향을 받습니다)</p>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <Section icon={Lightbulb} title="운명적 통찰 (Insight)" delay={0}>
        <div className="bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-white/10 rounded-xl p-5">
          <p className="text-sm text-white/90 leading-loose whitespace-pre-line font-medium">
            {destinyInsight}
          </p>
        </div>
      </Section>

      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 flex items-start gap-3">
        <Compass className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs text-indigo-300 font-bold mb-1">나의 그릇: {ziwei.bureau.name}</p>
          <p className="text-xs text-white/70 leading-relaxed">{ziwei.bureau.desc}</p>
        </div>
      </div>

      <Section icon={Star} title="자미두수 4대 핵심 궁(宮)" delay={0.1}>
        {renderStars(ziwei.stars.life, "명궁(命宮) - 나의 본질", <User className="w-4 h-4 text-purple-400"/>, "from-purple-900/30 to-indigo-900/30", "personality")}
        {renderStars(ziwei.stars.spouse, "부부궁(夫婦宮) - 연애와 배우자", <Heart className="w-4 h-4 text-pink-400"/>, "from-pink-900/30 to-rose-900/30", "loveStyle")}
        {renderStars(ziwei.stars.wealth, "재백궁(財帛宮) - 재물 스타일", <Wallet className="w-4 h-4 text-amber-400"/>, "from-amber-900/30 to-orange-900/30", "wealthStyle")}
        {renderStars(ziwei.stars.travel, "천이궁(遷移宮) - 대외 관계", <Plane className="w-4 h-4 text-blue-400"/>, "from-blue-900/30 to-cyan-900/30", "socialStyle")}
      </Section>
    </div>
  );
}

export function ZodiacDeepAnalysis({ zodiacInfo }: ZodiacProps) {
  return (
    <div className="space-y-4">
      <ZodiacInfoCard info={zodiacInfo} />
      
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 text-center">
        <p className="text-xs text-muted-foreground">
          별자리는 당신이 태어난 순간 태양의 위치를 기준으로 합니다. <br/>
          자미두수(동양)와 별자리(서양)가 공통적으로 가리키는 키워드에 주목하세요.
        </p>
      </div>
    </div>
  );
}

export function SajuProfileCard(props: Props) {
  return <SajuDeepAnalysis {...props} />;
}
