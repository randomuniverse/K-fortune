import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Lock, Unlock, AlertTriangle, Activity, Search, BrainCircuit } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export interface GuardianReportData {
  coreEnergy: string;
  coherenceScore: number;
  keywords: string[];
  pastInference: string;
  currentState: string;
  bottleneck: string;
  solution: string;
}

export function GuardianReport({ telegramId, userName }: { telegramId: string; userName: string }) {
  const { data: report, isLoading } = useQuery<GuardianReportData>({
    queryKey: ['/api/guardian-report', telegramId],
    queryFn: async () => {
      const res = await fetch(`/api/guardian-report/${telegramId}`);
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
    staleTime: Infinity,
  });

  const generateReport = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/fortunes/guardian-report", { telegramId });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/guardian-report', telegramId], data);
    },
  });

  if (isLoading) {
    return (
      <Card className="bg-white/[0.03] border-white/10 p-8 text-center space-y-6" data-testid="guardian-report-loading">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
        <p className="text-sm text-white/60">저장된 가디언 리포트를 불러오는 중...</p>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card className="bg-white/[0.03] border-white/10 p-8 text-center space-y-6" data-testid="guardian-report-empty">
        <div className="mx-auto w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-indigo-400" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-serif text-white" data-testid="text-guardian-title">운명 종합 가디언 리포트</h3>
          <p className="text-sm text-white/60 max-w-sm mx-auto leading-relaxed">
            사주, 자미두수, 별자리가 가리키는 당신의 <span className="text-indigo-400 font-bold">운명적 본질(Master ID)</span>을 분석하고,<br />
            현재 당신을 가로막는 <span className="text-red-400 font-bold">병목(Bottleneck)</span>과 <span className="text-emerald-400 font-bold">과학적 해결책</span>을 제시합니다.
          </p>
        </div>
        <Button
          size="lg"
          variant="mystical"
          onClick={() => generateReport.mutate()}
          disabled={generateReport.isPending}
          className="min-w-[200px]"
          data-testid="button-generate-guardian"
        >
          {generateReport.isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 가디언이 당신의 기록을 추적 중...</>
          ) : (
            <><BrainCircuit className="mr-2 h-4 w-4" /> 가디언 리포트 확인하기</>
          )}
        </Button>
      </Card>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6" data-testid="guardian-report-result">

      <div className="text-center mb-8">
        <div className="flex flex-wrap justify-center items-center gap-2 mb-3">
          <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold">
            MASTER ARCHETYPE
          </span>
          <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs font-bold flex items-center gap-1" data-testid="text-coherence-score">
            <Activity className="w-3 h-3" /> 데이터 일치도 {report.coherenceScore}%
          </span>
        </div>
        <h2 className="text-2xl md:text-3xl font-serif text-white font-bold leading-tight mb-4" data-testid="text-core-energy">
          &ldquo;{report.coreEnergy}&rdquo;
        </h2>
        <div className="flex flex-wrap justify-center gap-2" data-testid="keywords-container">
          {report.keywords.map((kw, i) => (
            <span key={i} className="text-[10px] text-white/50 bg-white/5 px-2 py-1 rounded-md border border-white/5">
              #{kw}
            </span>
          ))}
        </div>
      </div>

      <Card className="bg-gradient-to-br from-violet-500/10 to-transparent border-violet-500/20 p-6" data-testid="card-past-inference">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-violet-500/20 rounded-lg shrink-0">
            <Search className="w-6 h-6 text-violet-400" />
          </div>
          <div className="space-y-2">
            <h4 className="text-lg font-bold text-violet-200">운명의 추적 (Past Inference)</h4>
            <p className="text-sm text-white/80 leading-loose whitespace-pre-line italic">
              &ldquo;{report.pastInference}&rdquo;
            </p>
          </div>
        </div>
      </Card>

      <Card className="bg-gradient-to-br from-white/[0.05] to-transparent border-white/10 p-6" data-testid="card-current-state">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-500/20 rounded-lg shrink-0">
            <Lock className="w-6 h-6 text-blue-400" />
          </div>
          <div className="space-y-2">
            <h4 className="text-lg font-bold text-white">현재 당신의 딜레마 (Paradox)</h4>
            <p className="text-sm text-white/80 leading-loose whitespace-pre-line">
              {report.currentState}
            </p>
          </div>
        </div>
      </Card>

      <Card className="bg-gradient-to-br from-red-500/10 to-transparent border-red-500/20 p-6" data-testid="card-bottleneck">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-red-500/20 rounded-lg shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <div className="space-y-2">
            <h4 className="text-lg font-bold text-red-200">The Bottleneck (결정적 병목)</h4>
            <p className="text-sm text-white/80 leading-loose">
              {report.bottleneck}
            </p>
          </div>
        </div>
      </Card>

      <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20 p-6 relative overflow-hidden" data-testid="card-solution">
        <div className="absolute top-0 right-0 p-32 bg-emerald-500/10 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />
        <div className="flex items-start gap-4 relative z-10">
          <div className="p-3 bg-emerald-500/20 rounded-lg shrink-0">
            <Unlock className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="space-y-2">
            <h4 className="text-lg font-bold text-emerald-200">Guardian's Solution (Action)</h4>
            <p className="text-sm text-white/90 leading-loose whitespace-pre-line font-medium">
              {report.solution}
            </p>
          </div>
        </div>
      </Card>

      <div className="text-center pt-4">
        <p className="text-xs text-white/30 mb-2">
          * 이 리포트는 당신의 고유한 운명(Master ID)으로 저장되었습니다.
        </p>
      </div>
    </motion.div>
  );
}
