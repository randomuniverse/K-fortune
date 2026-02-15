import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertTriangle, Star, Calendar, Compass, Loader2, Briefcase, Heart, HeartPulse, Activity, BrainCircuit, ChevronDown, ChevronUp } from "lucide-react";
import type { SajuChart } from "@shared/saju";
import { calculateYearlyFortune, calculateMonthlyFortunes } from "@shared/saju";
import type { YearlyFortune, MonthlyFortune } from "@shared/saju";
import type { MonthlyFlowItem } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";

interface Props {
  chart: SajuChart;
  userName: string;
  telegramId: string;
}

interface YearlyFortuneData {
  overallSummary: string;
  coherenceScore: number;
  businessFortune: string | null;
  loveFortune: string | null;
  healthFortune: string | null;
  monthlyFlow: MonthlyFlowItem[] | null;
  keywords: string[] | null;
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
      data-testid={`card-month-${fortune.month}`}
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-1">
        <div className="flex items-center gap-2 flex-wrap">
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

function AIMonthlyFlowCard({ item, index }: { item: MonthlyFlowItem; index: number }) {
  const isGood = item.score >= 70;
  const isBad = item.score < 45;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      data-testid={`card-ai-month-${item.month}`}
    >
      <Card className={`border ${
        isGood ? "border-emerald-500/20 bg-emerald-500/5" :
        isBad ? "border-red-500/20 bg-red-500/5" :
        "border-white/5 bg-white/[0.02]"
      }`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white">{item.month}월</span>
              <Badge variant={isGood ? "default" : isBad ? "destructive" : "secondary"} className="text-[10px]">
                {item.keyword}
              </Badge>
            </div>
            <Badge variant={
              item.score >= 75 ? "default" :
              item.score >= 45 ? "secondary" :
              "destructive"
            } className="text-xs">
              {item.score}점
            </Badge>
          </div>
          <ScoreBar score={item.score} />
          <p className="text-sm text-white/80 leading-relaxed mt-3">{item.summary}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function YearlyFortuneCard({ chart, userName, telegramId }: Props) {
  const year = 2026;
  const yearlyFortune = calculateYearlyFortune(chart, year);
  const monthlyFortunes = calculateMonthlyFortunes(chart, year);
  const [showSajuMonthly, setShowSajuMonthly] = useState(false);

  const { data: aiYearly, isLoading: isAiLoading } = useQuery<YearlyFortuneData | null>({
    queryKey: ['/api/yearly-fortune', telegramId, year],
    queryFn: async () => {
      const res = await fetch(`/api/yearly-fortune/${telegramId}/${year}`);
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
    staleTime: Infinity,
  });

  const generateYearly = useMutation({
    mutationFn: async (regenerate: boolean) => {
      const res = await apiRequest("POST", "/api/fortunes/yearly", { telegramId, year, regenerate });
      return res.json();
    },
    onSuccess: (data: YearlyFortuneData) => {
      queryClient.setQueryData(['/api/yearly-fortune', telegramId, year], data);
    },
  });

  const scoreColor =
    yearlyFortune.overallScore >= 75 ? "text-emerald-400" :
    yearlyFortune.overallScore >= 60 ? "text-primary" :
    yearlyFortune.overallScore >= 45 ? "text-amber-400" :
    "text-red-400";

  const bestMonth = [...monthlyFortunes].sort((a, b) => b.score - a.score)[0];
  const worstMonth = [...monthlyFortunes].sort((a, b) => a.score - b.score)[0];

  const aiMonthlyFlow = (aiYearly?.monthlyFlow || []) as MonthlyFlowItem[];
  const aiBestMonth = aiMonthlyFlow.length > 0 ? [...aiMonthlyFlow].sort((a, b) => b.score - a.score)[0] : null;
  const aiWorstMonth = aiMonthlyFlow.length > 0 ? [...aiMonthlyFlow].sort((a, b) => a.score - b.score)[0] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
      data-testid="yearly-fortune-card"
    >
      <Card className="bg-white/[0.03] border-white/10 p-6">
        <div className="flex flex-col md:flex-row items-start gap-6">
          <div className="text-center md:text-left">
            <h3 className="text-xl font-serif text-white mb-1">{year}년 운세 총평</h3>
            <p className="text-xs text-muted-foreground mb-3">
              {yearlyFortune.yearPillar.stemHanja}{yearlyFortune.yearPillar.branchHanja}년 ({yearlyFortune.yearElement})
            </p>
            <div className="flex items-baseline gap-2 justify-center md:justify-start">
              <span className={`text-4xl font-bold ${scoreColor}`} data-testid="text-yearly-score">{yearlyFortune.overallScore}</span>
              <span className="text-sm text-muted-foreground">/ 100점</span>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <p className="text-sm text-white/80 leading-relaxed">
              {aiYearly?.overallSummary
                ? aiYearly.overallSummary.slice(0, 200) + (aiYearly.overallSummary.length > 200 ? "..." : "")
                : yearlyFortune.summary}
            </p>
            <div className="bg-white/[0.03] rounded-lg p-3">
              <p className="text-xs text-primary/80 font-medium mb-1">
                <Compass className="w-3 h-3 inline mr-1" />
                올해의 조언
              </p>
              <p className="text-sm text-white/70">{yearlyFortune.advice}</p>
            </div>
          </div>
        </div>

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
              {aiBestMonth ? `${aiBestMonth.month}월 (${aiBestMonth.score}점)` : `${bestMonth.month}월 (${bestMonth.score}점)`}
            </p>
          </div>
          <div className="bg-red-500/10 rounded-lg p-3 text-center">
            <p className="text-[10px] text-red-400/70 mb-1">
              <TrendingDown className="w-3 h-3 inline mr-0.5" /> 주의할 달
            </p>
            <p className="text-xs font-bold text-red-400">
              {aiWorstMonth ? `${aiWorstMonth.month}월 (${aiWorstMonth.score}점)` : `${worstMonth.month}월 (${worstMonth.score}점)`}
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

      {generateYearly.isPending && (
        <Card className="bg-white/[0.03] border-white/10 p-8 text-center space-y-4" data-testid="yearly-ai-loading">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
          <p className="text-sm text-white/60">AI가 3회 교차 검증으로 {year}년을 분석 중...</p>
        </Card>
      )}

      {!aiYearly && !generateYearly.isPending && !isAiLoading && (
        <Card className="bg-white/5 border-indigo-500/20 overflow-hidden relative" data-testid="yearly-ai-empty">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10" />
          <div className="p-8 md:p-12 text-center relative z-10 space-y-4">
            <Calendar className="w-14 h-14 text-indigo-300 mx-auto opacity-80" />
            <div className="space-y-2">
              <h4 className="text-2xl font-serif text-white">{year}년 붉은 말의 해</h4>
              <p className="text-sm text-white/50 max-w-md mx-auto leading-relaxed">
                {year}년 병오년(丙午年)의 기운이 {userName}님의 사주와 만나 어떤 변화를 일으킬까요?
                <br />사주 + 자미두수 + 별자리를 3회 교차 검증하여 사업운, 연애운, 건강운, 월별 흐름까지 분석합니다.
              </p>
            </div>
            <Button
              variant="mystical"
              size="lg"
              onClick={() => generateYearly.mutate(false)}
              disabled={generateYearly.isPending}
              className="min-w-[200px] shadow-lg shadow-indigo-500/20"
              data-testid="button-generate-yearly"
            >
              <BrainCircuit className="mr-2 h-5 w-5" /> {year}년 AI 심층 분석 시작
            </Button>
          </div>
        </Card>
      )}

      {aiYearly && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest ml-1">AI 심층 분석</h3>
            <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50 text-[10px] font-bold flex items-center gap-1">
              <Activity className="w-3 h-3" /> 일치도 {aiYearly.coherenceScore}%
            </span>
          </div>

          <Card className="bg-white/[0.03] border-white/10 p-5" data-testid="card-ai-overall">
            <p className="text-sm text-white/80 leading-relaxed">{aiYearly.overallSummary}</p>
            {aiYearly.keywords && aiYearly.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {aiYearly.keywords.map((kw, i) => (
                  <span key={i} className="text-[10px] text-white/50 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                    #{kw}
                  </span>
                ))}
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="yearly-category-grid">
            <Card className="bg-gradient-to-b from-amber-500/10 to-transparent border-amber-500/20 p-5" data-testid="card-yearly-business">
              <div className="flex items-center gap-2 mb-3">
                <Briefcase className="w-4 h-4 text-amber-400" />
                <span className="text-amber-200 font-bold text-sm">사업/재물운</span>
              </div>
              <p className="text-sm text-white/80 leading-7 whitespace-pre-line">
                {aiYearly.businessFortune || "분석 대기 중"}
              </p>
            </Card>

            <Card className="bg-gradient-to-b from-pink-500/10 to-transparent border-pink-500/20 p-5" data-testid="card-yearly-love">
              <div className="flex items-center gap-2 mb-3">
                <Heart className="w-4 h-4 text-pink-400" />
                <span className="text-pink-200 font-bold text-sm">연애/인간관계운</span>
              </div>
              <p className="text-sm text-white/80 leading-7 whitespace-pre-line">
                {aiYearly.loveFortune || "분석 대기 중"}
              </p>
            </Card>

            <Card className="bg-gradient-to-b from-cyan-500/10 to-transparent border-cyan-500/20 p-5" data-testid="card-yearly-health">
              <div className="flex items-center gap-2 mb-3">
                <HeartPulse className="w-4 h-4 text-cyan-400" />
                <span className="text-cyan-200 font-bold text-sm">건강/웰니스운</span>
              </div>
              <p className="text-sm text-white/80 leading-7 whitespace-pre-line">
                {aiYearly.healthFortune || "분석 대기 중"}
              </p>
            </Card>
          </div>

          {aiMonthlyFlow.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <h4 className="text-sm font-serif text-white">AI 월별 흐름 (교차 검증)</h4>
                {aiBestMonth && aiWorstMonth && (
                  <div className="flex gap-2 ml-auto">
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <TrendingUp className="w-3 h-3 inline mr-0.5" /> {aiBestMonth.month}월
                    </span>
                    <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                      <TrendingDown className="w-3 h-3 inline mr-0.5" /> {aiWorstMonth.month}월
                    </span>
                  </div>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {aiMonthlyFlow.map((item, i) => (
                  <AIMonthlyFlowCard key={item.month} item={item} index={i} />
                ))}
              </div>
            </div>
          )}

          <div className="text-center pt-2">
            <Button
              variant="mystical"
              onClick={() => generateYearly.mutate(true)}
              disabled={generateYearly.isPending}
              data-testid="button-regenerate-yearly"
            >
              <BrainCircuit className="mr-2 h-4 w-4" /> AI 분석 다시 생성
            </Button>
          </div>
        </motion.div>
      )}

      <div>
        <button
          onClick={() => setShowSajuMonthly(!showSajuMonthly)}
          className="flex items-center gap-2 mb-4 text-sm text-white/50 hover:text-white/70 transition-colors"
          data-testid="button-toggle-saju-monthly"
        >
          <Calendar className="w-4 h-4 text-primary" />
          <span className="font-serif">사주 기반 월별 상세 운세</span>
          {showSajuMonthly ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showSajuMonthly && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"
          >
            {monthlyFortunes.map((mf, i) => (
              <MonthCard key={mf.month} fortune={mf} index={i} />
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
