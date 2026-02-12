import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, AlertTriangle, Star, Calendar, Compass } from "lucide-react";
import type { SajuChart } from "@shared/saju";
import { calculateYearlyFortune, calculateMonthlyFortunes } from "@shared/saju";
import type { YearlyFortune, MonthlyFortune } from "@shared/saju";

interface Props {
  chart: SajuChart;
  userName: string;
}

function ScoreBar({ score, label }: { score: number; label?: string }) {
  const color =
    score >= 75 ? "bg-emerald-500" :
    score >= 60 ? "bg-primary" :
    score >= 45 ? "bg-amber-500" :
    "bg-red-500";

  const textColor =
    score >= 75 ? "text-emerald-400" :
    score >= 60 ? "text-primary" :
    score >= 45 ? "text-amber-400" :
    "text-red-400";

  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-muted-foreground w-10">{label}</span>}
      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className={`text-xs font-bold w-8 text-right ${textColor}`}>{score}</span>
    </div>
  );
}

function MonthCard({ fortune, index }: { fortune: MonthlyFortune; index: number }) {
  const isGood = fortune.score >= 70;
  const isBad = fortune.score < 45;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={`rounded-xl p-4 border ${
        isGood ? "border-emerald-500/20 bg-emerald-500/5" :
        isBad ? "border-red-500/20 bg-red-500/5" :
        "border-white/5 bg-white/[0.02]"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-white">{fortune.month}월</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground">
            {fortune.monthPillar.stemHanja}{fortune.monthPillar.branchHanja}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
            isGood ? "bg-emerald-500/20 text-emerald-400" :
            isBad ? "bg-red-500/20 text-red-400" :
            "bg-primary/20 text-primary"
          }`}>
            {fortune.keyword}
          </span>
        </div>
        <span className={`text-sm font-bold ${
          fortune.score >= 75 ? "text-emerald-400" :
          fortune.score >= 60 ? "text-primary" :
          fortune.score >= 45 ? "text-amber-400" :
          "text-red-400"
        }`}>
          {fortune.score}점
        </span>
      </div>

      <ScoreBar score={fortune.score} />

      <p className="text-xs text-white/70 leading-relaxed mt-3">
        {fortune.description}
      </p>

      {(isGood || isBad) && (
        <div className={`mt-2 flex items-start gap-1.5 text-[11px] ${
          isBad ? "text-red-400/80" : "text-emerald-400/80"
        }`}>
          {isBad ? <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> : <Star className="w-3 h-3 mt-0.5 shrink-0" />}
          <span>{fortune.caution}</span>
        </div>
      )}
    </motion.div>
  );
}

export function YearlyFortuneCard({ chart, userName }: Props) {
  const year = 2026;
  const yearlyFortune = calculateYearlyFortune(chart, year);
  const monthlyFortunes = calculateMonthlyFortunes(chart, year);

  const scoreColor =
    yearlyFortune.overallScore >= 75 ? "text-emerald-400" :
    yearlyFortune.overallScore >= 60 ? "text-primary" :
    yearlyFortune.overallScore >= 45 ? "text-amber-400" :
    "text-red-400";

  const bestMonth = [...monthlyFortunes].sort((a, b) => b.score - a.score)[0];
  const worstMonth = [...monthlyFortunes].sort((a, b) => a.score - b.score)[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* 연간 총평 */}
      <Card className="bg-white/[0.03] border-white/10 p-6">
        <div className="flex flex-col md:flex-row items-start gap-6">
          <div className="text-center md:text-left">
            <h3 className="text-xl font-serif text-white mb-1">{year}년 운세 총평</h3>
            <p className="text-xs text-muted-foreground mb-3">
              {yearlyFortune.yearPillar.stemHanja}{yearlyFortune.yearPillar.branchHanja}년 ({yearlyFortune.yearElement})
            </p>
            <div className="flex items-baseline gap-2 justify-center md:justify-start">
              <span className={`text-4xl font-bold ${scoreColor}`}>{yearlyFortune.overallScore}</span>
              <span className="text-sm text-muted-foreground">/ 100점</span>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <p className="text-sm text-white/80 leading-relaxed">{yearlyFortune.summary}</p>
            <div className="bg-white/[0.03] rounded-lg p-3">
              <p className="text-xs text-primary/80 font-medium mb-1">
                <Compass className="w-3 h-3 inline mr-1" />
                올해의 조언
              </p>
              <p className="text-sm text-white/70">{yearlyFortune.advice}</p>
            </div>
          </div>
        </div>

        {/* 핵심 요약 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <div className="bg-white/[0.03] rounded-lg p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">올해 관계</p>
            <p className="text-xs font-medium text-white">{yearlyFortune.relationship}</p>
          </div>
          <div className="bg-emerald-500/10 rounded-lg p-3 text-center">
            <p className="text-[10px] text-emerald-400/70 mb-1">
              <TrendingUp className="w-3 h-3 inline mr-0.5" /> 최고의 달
            </p>
            <p className="text-xs font-bold text-emerald-400">
              {bestMonth.month}월 ({bestMonth.score}점)
            </p>
          </div>
          <div className="bg-red-500/10 rounded-lg p-3 text-center">
            <p className="text-[10px] text-red-400/70 mb-1">
              <TrendingDown className="w-3 h-3 inline mr-0.5" /> 주의할 달
            </p>
            <p className="text-xs font-bold text-red-400">
              {worstMonth.month}월 ({worstMonth.score}점)
            </p>
          </div>
          <div className="bg-white/[0.03] rounded-lg p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">올해 오행</p>
            <p className="text-xs font-medium text-white">
              {yearlyFortune.yearElementHanja} ({yearlyFortune.yearElement})
            </p>
          </div>
        </div>
      </Card>

      {/* 월별 운세 */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-serif text-white">월별 상세 운세</h4>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {monthlyFortunes.map((mf, i) => (
            <MonthCard key={mf.month} fortune={mf} index={i} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
