import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Flame, Droplets, Mountain, Wind, Gem, User, Sparkles, Brain, Shield, Target } from "lucide-react";
import type { SajuChart } from "@shared/saju";
import type { ZodiacInfo } from "@shared/schema";
import { analyzeSajuPersonality } from "@shared/saju";
import type { SajuPersonality } from "@shared/saju";
import { SajuInfoCard } from "./SajuInfoCard";
import { ZodiacInfoCard } from "./ZodiacInfoCard";

interface Props {
  chart: SajuChart;
  zodiacInfo: ZodiacInfo;
  birthDate: string;
  birthTime: string;
  userName: string;
}

const ELEMENT_ICONS: Record<string, typeof Flame> = {
  "화": Flame,
  "수": Droplets,
  "토": Mountain,
  "목": Wind,
  "금": Gem,
};

const ELEMENT_COLORS: Record<string, string> = {
  "화": "text-red-400",
  "수": "text-blue-400",
  "토": "text-amber-400",
  "목": "text-green-400",
  "금": "text-slate-300",
};

const ELEMENT_BG: Record<string, string> = {
  "화": "bg-red-500/10 border-red-500/20",
  "수": "bg-blue-500/10 border-blue-500/20",
  "토": "bg-amber-500/10 border-amber-500/20",
  "목": "bg-green-500/10 border-green-500/20",
  "금": "bg-slate-400/10 border-slate-400/20",
};

function Section({ icon: Icon, title, children, delay = 0 }: {
  icon: typeof Flame;
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
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

export function SajuProfileCard({ chart, zodiacInfo, birthDate, birthTime, userName }: Props) {
  const personality = analyzeSajuPersonality(chart);
  const dayElement = ["목", "화", "토", "금", "수"][
    [0, 0, 1, 1, 2, 2, 3, 3, 4, 4][chart.dayPillar.stemIndex]
  ];
  const ElIcon = ELEMENT_ICONS[dayElement] || Sparkles;
  const elColor = ELEMENT_COLORS[dayElement] || "text-primary";
  const elBg = ELEMENT_BG[dayElement] || "bg-white/5 border-white/10";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {/* 핵심 성격 요약 */}
      <Section icon={User} title="일간(日干)으로 본 나의 본성" delay={0}>
        <div className={`rounded-xl p-4 border ${elBg}`}>
          <div className="flex items-center gap-3 mb-2">
            <ElIcon className={`w-6 h-6 ${elColor}`} />
            <div>
              <p className="text-sm font-bold text-white">
                {chart.dayPillar.stemHanja} ({chart.dayPillar.stem})
              </p>
              <p className={`text-xs ${elColor}`}>{personality.mainTrait}</p>
            </div>
          </div>
          <p className="text-sm text-white/80 leading-relaxed">{personality.elementPersonality}</p>
        </div>
        <p className="text-sm text-white/70 leading-relaxed">{personality.dayMasterDescription}</p>
      </Section>

      {/* 하늘이 준 재능 */}
      <Section icon={Sparkles} title="하늘이 부여한 재능" delay={0.1}>
        <p className="text-sm text-white/80 leading-relaxed">{personality.heavenlyGift}</p>
        <div className="bg-white/[0.03] rounded-lg p-3 mt-2">
          <p className="text-xs text-primary/70 font-medium mb-1">적성 분야</p>
          <p className="text-sm text-white/70">{personality.talent}</p>
        </div>
      </Section>

      {/* 십성 프로필 */}
      <Section icon={Brain} title="십성(十星)으로 본 운명 구조" delay={0.15}>
        <p className="text-sm text-white/70 leading-relaxed">{personality.tenGodProfile}</p>
        {personality.subTraits.length > 0 && (
          <div className="space-y-2 mt-2">
            {personality.subTraits.map((trait, i) => (
              <div key={i} className="flex items-start gap-2">
                <Target className="w-3 h-3 text-primary/60 mt-1 shrink-0" />
                <p className="text-xs text-white/60">{trait}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 용신과 약점 */}
      <Section icon={Shield} title="용신(用神)과 보완점" delay={0.2}>
        <div className="grid grid-cols-2 gap-3">
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
        <p className="text-xs text-white/60 leading-relaxed">{chart.yongShin.reason}</p>
        <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3 mt-1">
          <p className="text-[10px] text-red-400/70 font-medium mb-1">주의할 점</p>
          <p className="text-xs text-white/60 leading-relaxed">{personality.weakPoint}</p>
        </div>
      </Section>

      {/* 기존 사주/별자리 카드 */}
      <div className="grid gap-4 md:grid-cols-2">
        <SajuInfoCard
          chart={chart}
          birthDate={birthDate}
          birthTime={birthTime}
          userName={userName}
        />
        <ZodiacInfoCard info={zodiacInfo} />
      </div>
    </motion.div>
  );
}
