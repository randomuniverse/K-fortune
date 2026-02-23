import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertTriangle, Star, Calendar, Compass, Loader2, Briefcase, Heart, HeartPulse, Activity, ChevronDown, ChevronUp, Sparkles, Globe, Moon } from "lucide-react";
import type { SajuChart } from "@shared/saju";
import { calculateYearlyFortune, calculateMonthlyFortunes } from "@shared/saju";
import type { YearlyFortune, MonthlyFortune } from "@shared/saju";
import type { MonthlyFlowItem, ZodiacInfo } from "@shared/schema";
import type { ZiWeiResult } from "@shared/ziwei";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useState } from "react";

interface Props {
  chart: SajuChart;
  userName: string;
  telegramId: string;
  yearlySubTab: "guardian" | "saju" | "ziwei" | "zodiac";
  ziweiData?: ZiWeiResult;
  zodiacInfo?: ZodiacInfo;
}

interface YearlyFortuneData {
  overallSummary: string;
  coherenceScore: number;
  businessFortune: string | null;
  loveFortune: string | null;
  healthFortune: string | null;
  monthlyFlow: MonthlyFlowItem[] | null;
  keywords: string[] | null;
  sajuMonthlyFlow: MonthlyFlowItem[] | null;
  sajuSummary: string | null;
  ziweiMonthlyFlow: MonthlyFlowItem[] | null;
  ziweiSummary: string | null;
  zodiacMonthlyFlow: MonthlyFlowItem[] | null;
  zodiacSummary: string | null;
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
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-bold text-white">{item.month}월</span>
              {(item.keywords && item.keywords.length > 0 ? item.keywords : [item.keyword]).map((kw, ki) => (
                <Badge key={ki} variant={ki === 0 ? (isGood ? "default" : isBad ? "destructive" : "secondary") : "secondary"} className="text-[10px]">
                  {kw}
                </Badge>
              ))}
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

function MonthlyFlowSection({ title, flow, colorClass }: { title: string; flow: MonthlyFlowItem[]; colorClass: string }) {
  const bestMonth = flow.length > 0 ? [...flow].sort((a, b) => b.score - a.score)[0] : null;
  const worstMonth = flow.length > 0 ? [...flow].sort((a, b) => a.score - b.score)[0] : null;

  if (flow.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Calendar className={`w-4 h-4 ${colorClass}`} />
        <h4 className="text-sm font-serif text-white">{title}</h4>
        {bestMonth && worstMonth && (
          <div className="flex gap-2 ml-auto">
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              <TrendingUp className="w-3 h-3 inline mr-0.5" /> {bestMonth.month}월
            </span>
            <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
              <TrendingDown className="w-3 h-3 inline mr-0.5" /> {worstMonth.month}월
            </span>
          </div>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {flow.map((item, i) => (
          <AIMonthlyFlowCard key={item.month} item={item} index={i} />
        ))}
      </div>
    </div>
  );
}

export function YearlyFortuneCard({ chart, userName, telegramId, yearlySubTab, ziweiData, zodiacInfo }: Props) {
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


  const bestMonth = [...monthlyFortunes].sort((a, b) => b.score - a.score)[0];
  const worstMonth = [...monthlyFortunes].sort((a, b) => a.score - b.score)[0];

  const aiMonthlyFlow = (aiYearly?.monthlyFlow || []) as MonthlyFlowItem[];
  const aiBestMonth = aiMonthlyFlow.length > 0 ? [...aiMonthlyFlow].sort((a, b) => b.score - a.score)[0] : null;
  const aiWorstMonth = aiMonthlyFlow.length > 0 ? [...aiMonthlyFlow].sort((a, b) => a.score - b.score)[0] : null;

  const sajuFlow = (aiYearly?.sajuMonthlyFlow || []) as MonthlyFlowItem[];
  const ziweiFlow = (aiYearly?.ziweiMonthlyFlow || []) as MonthlyFlowItem[];
  const zodiacFlow = (aiYearly?.zodiacMonthlyFlow || []) as MonthlyFlowItem[];

  const topSummaryCard = aiYearly ? (
    <Card className="bg-white/[0.03] border-white/10 p-6">
      <div className="flex flex-col md:flex-row items-start gap-6">
        <div className="text-center md:text-left">
          <h3 className="text-xl font-serif text-white mb-1">{year}년 운세 총평</h3>
          <p className="text-xs text-muted-foreground">
            {yearlyFortune.yearPillar.stemHanja}{yearlyFortune.yearPillar.branchHanja}년 ({yearlyFortune.yearElement})
          </p>
        </div>

        <div className="flex-1 space-y-3">
          {aiYearly?.keywords && aiYearly.keywords.length > 0 && (
            <div className="bg-white/[0.03] rounded-lg p-3">
              <p className="text-xs text-primary/80 font-medium mb-1">
                <Compass className="w-3 h-3 inline mr-1" />
                올해의 키워드
              </p>
              <p className="text-sm text-white/80 leading-relaxed">
                {(aiYearly.keywords as string[]).map((kw: string, i: number) => (
                  <span key={i}>
                    {kw}{i < (aiYearly.keywords as string[]).length - 1 ? " · " : ""}
                  </span>
                ))}
              </p>
            </div>
          )}
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
  ) : null;

  const generateButton = (
    <>
      {!aiYearly && !isAiLoading && (
        <Card className="bg-white/5 border-indigo-500/20 overflow-hidden relative" data-testid="yearly-ai-empty">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10" />
          <div className="p-8 md:p-12 text-center relative z-10 space-y-4">
            <Calendar className="w-14 h-14 text-indigo-300 mx-auto opacity-80" />
            <div className="space-y-2">
              <h4 className="text-2xl font-serif text-white">{year}년 붉은 말의 해</h4>
              <p className="text-sm text-white/50 max-w-md mx-auto leading-relaxed">
                {year}년 병오년(丙午年)의 기운이 {userName}님의 사주와 만나 어떤 변화를 일으킬까요?
                <br />사주 · 자미두수 · 별자리 3체계를 독립 분석 후 교차 검증합니다.
              </p>
              <p className="text-xs text-indigo-400/80 mt-3">
                <Sparkles className="w-3 h-3 inline mr-1" />
                "운명 분석" 탭에서 <span className="font-bold">가디언 리포트</span>를 생성하면 연간 운세가 자동으로 함께 생성됩니다.
              </p>
            </div>
          </div>
        </Card>
      )}
    </>
  );

  const regenerateButton = null;

  if (yearlySubTab === "guardian") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
        data-testid="yearly-fortune-card"
      >
        {topSummaryCard}
        {generateButton}

        {aiYearly && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest ml-1">3체계 교차 검증 종합</h3>
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

            <div className="space-y-4" data-testid="yearly-category-grid">
              <Card className="bg-gradient-to-r from-amber-500/10 to-transparent border-amber-500/20 p-5" data-testid="card-yearly-business">
                <div className="flex items-center gap-2 mb-3">
                  <Briefcase className="w-4 h-4 text-amber-400" />
                  <span className="text-amber-200 font-bold text-sm">사업/재물운</span>
                </div>
                <p className="text-sm text-white/80 leading-7 whitespace-pre-line">
                  {aiYearly.businessFortune || "분석 대기 중"}
                </p>
              </Card>

              <Card className="bg-gradient-to-r from-pink-500/10 to-transparent border-pink-500/20 p-5" data-testid="card-yearly-love">
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="w-4 h-4 text-pink-400" />
                  <span className="text-pink-200 font-bold text-sm">연애/인간관계운</span>
                </div>
                <p className="text-sm text-white/80 leading-7 whitespace-pre-line">
                  {aiYearly.loveFortune || "분석 대기 중"}
                </p>
              </Card>

              <Card className="bg-gradient-to-r from-cyan-500/10 to-transparent border-cyan-500/20 p-5" data-testid="card-yearly-health">
                <div className="flex items-center gap-2 mb-3">
                  <HeartPulse className="w-4 h-4 text-cyan-400" />
                  <span className="text-cyan-200 font-bold text-sm">건강/웰니스운</span>
                </div>
                <p className="text-sm text-white/80 leading-7 whitespace-pre-line">
                  {aiYearly.healthFortune || "분석 대기 중"}
                </p>
              </Card>
            </div>

            <MonthlyFlowSection
              title={`${year}년 월별 흐름 달력 (AI 교차검증)`}
              flow={aiMonthlyFlow}
              colorClass="text-indigo-400"
            />

            {regenerateButton}
          </motion.div>
        )}
      </motion.div>
    );
  }

  if (yearlySubTab === "saju") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
        data-testid="yearly-saju-tab"
      >
        {topSummaryCard}
        {generateButton}

        {aiYearly && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest ml-1">사주팔자 독립 분석</h3>
            </div>

            {aiYearly.sajuSummary && (
              <Card className="bg-white/[0.03] border-white/10 p-5" data-testid="card-saju-summary">
                <p className="text-sm text-white/80 leading-relaxed">{aiYearly.sajuSummary}</p>
              </Card>
            )}

            <MonthlyFlowSection
              title={`${year}년 사주 월별 흐름 달력`}
              flow={sajuFlow}
              colorClass="text-amber-400"
            />
          </motion.div>
        )}

        <div>
          <button
            onClick={() => setShowSajuMonthly(!showSajuMonthly)}
            className="flex items-center gap-2 mb-4 text-sm text-white/50 hover:text-white/70 transition-colors"
            data-testid="button-toggle-saju-monthly"
          >
            <Calendar className="w-4 h-4 text-primary" />
            <span className="font-serif">사주 기반 월별 상세 운세 (로직 계산)</span>
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

  if (yearlySubTab === "ziwei") {
    const lifeStars = ziweiData?.stars?.life || [];
    const spouseStars = ziweiData?.stars?.spouse || [];
    const wealthStars = ziweiData?.stars?.wealth || [];
    const travelStars = ziweiData?.stars?.travel || [];
    const mainStar = lifeStars[0];

    const ziweiSummaryCard = ziweiData && (
      <Card className="bg-white/[0.03] border-white/10 p-6" data-testid="card-ziwei-profile">
        <div className="flex flex-col md:flex-row items-start gap-6">
          <div className="text-center md:text-left">
            <h3 className="text-xl font-serif text-white mb-1">{year}년 자미두수 총평</h3>
            <p className="text-xs text-muted-foreground mb-3">
              명궁(命宮): {ziweiData.lifePalace}궁 · {ziweiData.bureau?.name || ""}
            </p>
            {mainStar && (
              <div className="flex items-baseline gap-2 justify-center md:justify-start">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <span className="text-lg font-bold text-purple-300" data-testid="text-ziwei-main-star">{mainStar.name}</span>
              </div>
            )}
          </div>

          <div className="flex-1 space-y-3">
            <div className="bg-white/[0.03] rounded-lg p-3">
              <p className="text-xs text-purple-400/80 font-medium mb-1">
                <Star className="w-3 h-3 inline mr-1" />
                명궁 해석
              </p>
              <p className="text-sm text-white/80 leading-relaxed">
                {ziweiData.interpretation || "명궁 해석 데이터를 불러오는 중입니다."}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <div className="bg-white/[0.03] rounded-lg p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">국(局)</p>
            <p className="text-xs font-medium text-white">{ziweiData.bureau?.name || "정보 없음"}</p>
          </div>
          <div className="bg-purple-500/10 rounded-lg p-3 text-center">
            <p className="text-[10px] text-purple-400/70 mb-1">
              <Heart className="w-3 h-3 inline mr-0.5" /> 부처궁
            </p>
            <p className="text-xs font-bold text-purple-300">
              {spouseStars.length > 0 ? spouseStars.map(s => s.name.replace(/성.*/, "")).join(" · ") : "주성 없음"}
            </p>
          </div>
          <div className="bg-amber-500/10 rounded-lg p-3 text-center">
            <p className="text-[10px] text-amber-400/70 mb-1">
              <Briefcase className="w-3 h-3 inline mr-0.5" /> 재백궁
            </p>
            <p className="text-xs font-bold text-amber-300">
              {wealthStars.length > 0 ? wealthStars.map(s => s.name.replace(/성.*/, "")).join(" · ") : "주성 없음"}
            </p>
          </div>
          <div className="bg-cyan-500/10 rounded-lg p-3 text-center">
            <p className="text-[10px] text-cyan-400/70 mb-1">
              <Compass className="w-3 h-3 inline mr-0.5" /> 천이궁
            </p>
            <p className="text-xs font-bold text-cyan-300">
              {travelStars.length > 0 ? travelStars.map(s => s.name.replace(/성.*/, "")).join(" · ") : "주성 없음"}
            </p>
          </div>
        </div>

        {mainStar && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="bg-white/[0.03] rounded-lg p-4">
              <p className="text-xs text-pink-400/80 font-medium mb-2">
                <Heart className="w-3 h-3 inline mr-1" /> 연애/인간관계 성향
              </p>
              <p className="text-sm text-white/70 leading-relaxed">{mainStar.loveStyle}</p>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-4">
              <p className="text-xs text-amber-400/80 font-medium mb-2">
                <Briefcase className="w-3 h-3 inline mr-1" /> 재물/사업 성향
              </p>
              <p className="text-sm text-white/70 leading-relaxed">{mainStar.wealthStyle}</p>
            </div>
          </div>
        )}
      </Card>
    );

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
        data-testid="yearly-ziwei-tab"
      >
        {ziweiSummaryCard}
        {generateButton}

        {aiYearly && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest ml-1">자미두수 AI 독립 분석</h3>
            </div>

            {aiYearly.ziweiSummary && (
              <Card className="bg-white/[0.03] border-white/10 p-5" data-testid="card-ziwei-ai-summary">
                <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">{aiYearly.ziweiSummary}</p>
              </Card>
            )}

            {ziweiFlow.length > 0 ? (
              <MonthlyFlowSection
                title={`${year}년 자미두수 월별 흐름 달력`}
                flow={ziweiFlow}
                colorClass="text-purple-400"
              />
            ) : (
              <Card className="bg-white/[0.03] border-white/10 p-6 text-center">
                <p className="text-sm text-muted-foreground mb-3">자미두수 독립 월별 달력 데이터가 없습니다.</p>
                <p className="text-xs text-white/40">"운명 분석" 탭에서 가디언 리포트를 재생성하면 각 체계별 독립 달력이 포함됩니다.</p>
              </Card>
            )}
          </motion.div>
        )}

        {!aiYearly && !isAiLoading && (
          <Card className="bg-white/[0.03] border-white/10 p-8 text-center">
            <p className="text-sm text-muted-foreground">"운명 분석" 탭에서 가디언 리포트를 먼저 생성해주세요.</p>
          </Card>
        )}
      </motion.div>
    );
  }

  if (yearlySubTab === "zodiac") {
    const zodiacSummaryCard = zodiacInfo && (
      <Card className="bg-white/[0.03] border-white/10 p-6" data-testid="card-zodiac-profile">
        <div className="flex flex-col md:flex-row items-start gap-6">
          <div className="text-center md:text-left">
            <h3 className="text-xl font-serif text-white mb-1">{year}년 별자리 총평</h3>
            <p className="text-xs text-muted-foreground mb-3">
              {zodiacInfo.sign} ({zodiacInfo.signEn}) · {zodiacInfo.dateRange}
            </p>
            <div className="flex items-baseline gap-2 justify-center md:justify-start">
              <Globe className="w-5 h-5 text-blue-400" />
              <span className="text-lg font-bold text-blue-300" data-testid="text-zodiac-sign">{zodiacInfo.sign}</span>
              <span className="text-sm text-white/50">{zodiacInfo.symbol}</span>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <div className="bg-white/[0.03] rounded-lg p-3">
              <p className="text-xs text-blue-400/80 font-medium mb-1">
                <Sparkles className="w-3 h-3 inline mr-1" />
                핵심 특성
              </p>
              <p className="text-sm text-white/80 leading-relaxed">
                {zodiacInfo.traits?.join(" · ") || zodiacInfo.sign}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <div className="bg-white/[0.03] rounded-lg p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">원소</p>
            <p className="text-xs font-medium text-white">{zodiacInfo.element} ({zodiacInfo.elementEn})</p>
          </div>
          <div className="bg-blue-500/10 rounded-lg p-3 text-center">
            <p className="text-[10px] text-blue-400/70 mb-1">
              <Moon className="w-3 h-3 inline mr-0.5" /> 수호성
            </p>
            <p className="text-xs font-bold text-blue-300">
              {zodiacInfo.rulingPlanet} ({zodiacInfo.rulingPlanetEn})
            </p>
          </div>
          <div className="bg-pink-500/10 rounded-lg p-3 text-center">
            <p className="text-[10px] text-pink-400/70 mb-1">
              <Heart className="w-3 h-3 inline mr-0.5" /> 궁합 별자리
            </p>
            <p className="text-xs font-bold text-pink-300">
              {zodiacInfo.compatibleSigns?.join(" · ") || "정보 없음"}
            </p>
          </div>
          <div className="bg-white/[0.03] rounded-lg p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">궁 유형</p>
            <p className="text-xs font-medium text-white">
              {zodiacInfo.quality} ({zodiacInfo.qualityEn})
            </p>
          </div>
        </div>

        <div className="bg-white/[0.03] rounded-lg p-4 mt-6">
          <p className="text-xs text-blue-400/80 font-medium mb-2">
            <Globe className="w-3 h-3 inline mr-1" /> {year}년 {zodiacInfo.sign} 핵심 기운 변화
          </p>
          <p className="text-sm text-white/70 leading-relaxed">
            {year}년 병오년(丙午年)의 화(火) 에너지가 {zodiacInfo.element} 원소의 {zodiacInfo.sign}에 미치는 영향을 분석합니다.
            수호성 {zodiacInfo.rulingPlanet}의 움직임과 {zodiacInfo.element} 원소의 조화가 올해의 핵심 변화를 이끕니다.
            {zodiacInfo.element === "불" ? " 같은 불의 에너지가 만나 열정과 추진력이 극대화되지만, 과열에 주의가 필요합니다." :
             zodiacInfo.element === "흙" ? " 불의 에너지가 대지를 달구어 새로운 가능성을 싹틔우는 해입니다." :
             zodiacInfo.element === "공기" ? " 불의 에너지가 공기를 뜨겁게 달구어 변화와 소통이 활발해지는 해입니다." :
             zodiacInfo.element === "물" ? " 불과 물의 대립으로 감정적 변동이 크지만, 균형을 찾으면 큰 성장의 기회가 됩니다." :
             " 올해의 에너지 변화에 주목하세요."}
          </p>
        </div>
      </Card>
    );

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
        data-testid="yearly-zodiac-tab"
      >
        {zodiacSummaryCard}
        {generateButton}

        {aiYearly && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest ml-1">별자리 AI 독립 분석</h3>
            </div>

            {aiYearly.zodiacSummary && (
              <Card className="bg-white/[0.03] border-white/10 p-5" data-testid="card-zodiac-ai-summary">
                <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">{aiYearly.zodiacSummary}</p>
              </Card>
            )}

            {zodiacFlow.length > 0 ? (
              <MonthlyFlowSection
                title={`${year}년 별자리 월별 흐름 달력`}
                flow={zodiacFlow}
                colorClass="text-blue-400"
              />
            ) : (
              <Card className="bg-white/[0.03] border-white/10 p-6 text-center">
                <p className="text-sm text-muted-foreground mb-3">별자리 독립 월별 달력 데이터가 없습니다.</p>
                <p className="text-xs text-white/40">"운명 분석" 탭에서 가디언 리포트를 재생성하면 각 체계별 독립 달력이 포함됩니다.</p>
              </Card>
            )}
          </motion.div>
        )}

        {!aiYearly && !isAiLoading && (
          <Card className="bg-white/[0.03] border-white/10 p-8 text-center">
            <p className="text-sm text-muted-foreground">"운명 분석" 탭에서 가디언 리포트를 먼저 생성해주세요.</p>
          </Card>
        )}
      </motion.div>
    );
  }

  return null;
}
