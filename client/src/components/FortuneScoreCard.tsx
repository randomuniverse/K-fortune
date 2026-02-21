import { motion } from "framer-motion";
import { useState } from "react";
import { Compass, Hash, Heart, Wallet, Activity, Briefcase, Star, Link, Target, Clock, ChevronDown, ChevronUp, Zap } from "lucide-react";
import type { FortuneData } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  data: FortuneData;
  zodiacSign: string;
}

function ScoreRing({ score, size = 120, strokeWidth = 8 }: { score: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 80 ? "hsl(45, 93%, 55%)" : score >= 60 ? "hsl(45, 70%, 50%)" : score >= 40 ? "hsl(30, 60%, 50%)" : "hsl(0, 50%, 50%)";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
        <motion.circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: circumference - progress }} transition={{ duration: 1.2, ease: "easeOut" }} strokeDasharray={circumference} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span className="text-3xl font-bold text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} data-testid="text-combined-score">{score}</motion.span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

function MiniScore({ label, score }: { label: string; score: number }) {
  const barColor = score >= 70 ? "bg-primary" : score >= 50 ? "bg-amber-500" : "bg-orange-500";
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-16 text-right">{label}</span>
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div className={`h-full rounded-full ${barColor}`} initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }} />
      </div>
      <span className="text-xs font-medium text-white w-8">{score}점</span>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Compass; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
      <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm text-white/90 leading-relaxed">{value}</p>
      </div>
    </div>
  );
}

export function FortuneScoreCard({ data, zodiacSign }: Props) {
  const [showSajuDetail, setShowSajuDetail] = useState(false);
  const [showZodiacDetail, setShowZodiacDetail] = useState(false);

  const deltaText = data.scoreDelta !== undefined && data.scoreDelta !== null
    ? data.scoreDelta > 0 ? `▲ +${data.scoreDelta}` : data.scoreDelta < 0 ? `▼ ${data.scoreDelta}` : "→ 변동없음"
    : null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-4" data-testid="fortune-score-card">

      {data.oracleLine && (
        <Card className="bg-gradient-to-r from-primary/10 via-transparent to-primary/5 border-primary/20 p-6 text-center">
          <p className="text-base md:text-lg text-white/90 font-serif italic leading-relaxed" data-testid="text-oracle-line">"{data.oracleLine}"</p>
        </Card>
      )}

      <Card className="bg-white/[0.03] border-white/10 p-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <ScoreRing score={data.combinedScore} />
          <div className="flex-1 w-full space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-lg font-serif text-white">종합 운세 점수</h3>
              <span className="text-xs text-muted-foreground font-normal">
                {(() => { const now = new Date(); const utc = now.getTime() + now.getTimezoneOffset() * 60000; const kst = new Date(utc + 9 * 3600000); return `${kst.getMonth() + 1}월${kst.getDate()}일`; })()}
              </span>
              {deltaText && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${(data.scoreDelta || 0) > 0 ? "bg-emerald-500/20 text-emerald-400" : (data.scoreDelta || 0) < 0 ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white/50"}`} data-testid="text-score-delta">{deltaText}</span>
              )}
            </div>
            <MiniScore label="사주팔자" score={data.sajuScore} />
            <MiniScore label="별자리" score={data.zodiacScore} />
            <MiniScore label="자미두수" score={data.ziweiScore || 0} />
          </div>
        </div>

        {data.coherenceScore != null && (
          <div className="mt-5 bg-white/[0.03] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-xs font-serif text-primary">동서양 교차 검증</span>
              <span className={`ml-auto text-sm font-bold ${data.coherenceScore >= 80 ? "text-emerald-400" : data.coherenceScore >= 60 ? "text-primary" : "text-amber-400"}`} data-testid="text-coherence-score">일치도 {data.coherenceScore}%</span>
            </div>
            {data.coreMessage && <p className="text-sm text-white/90 leading-relaxed font-medium" data-testid="text-core-message">{data.coreMessage}</p>}
            {data.commonKeywords && data.commonKeywords.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Link className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                {data.commonKeywords.map((kw, i) => (<Badge key={i} variant="secondary" className="text-xs" data-testid={`badge-keyword-${i}`}>{kw}</Badge>))}
              </div>
            )}
          </div>
        )}

        {data.todayPrescription && (
          <div className="mt-4 bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
            <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-primary font-medium mb-1">오늘의 처방</p>
              <p className="text-sm text-white/90 leading-relaxed" data-testid="text-prescription">{data.todayPrescription}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <div className="bg-white/[0.03] rounded-xl p-3 flex items-center gap-2">
            <Compass className="w-4 h-4 text-primary shrink-0" />
            <div><p className="text-[10px] text-muted-foreground">방향</p><p className="text-xs font-medium text-white" data-testid="text-direction">{data.sajuDirection}</p></div>
          </div>
          <div className="bg-white/[0.03] rounded-xl p-3 flex items-center gap-2">
            <Hash className="w-4 h-4 text-primary shrink-0" />
            <div><p className="text-[10px] text-muted-foreground">숫자</p><p className="text-xs font-medium text-white" data-testid="text-lucky-numbers">{data.luckyNumbers.join(", ")}</p></div>
          </div>
          {data.luckyColor && (
            <div className="bg-white/[0.03] rounded-xl p-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-primary shrink-0" />
              <div><p className="text-[10px] text-muted-foreground">색상</p><p className="text-xs font-medium text-white" data-testid="text-lucky-color">{data.luckyColor}</p></div>
            </div>
          )}
          {data.luckyTime && (
            <div className="bg-white/[0.03] rounded-xl p-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary shrink-0" />
              <div><p className="text-[10px] text-muted-foreground">시간</p><p className="text-xs font-medium text-white" data-testid="text-lucky-time">{data.luckyTime}</p></div>
            </div>
          )}
        </div>
      </Card>

      {data.timeGuide && (
        <Card className="bg-white/[0.03] border-white/10 p-5">
          <h4 className="text-xs font-serif text-primary mb-4 flex items-center gap-2"><Clock className="w-4 h-4" /> 시간대별 운세 흐름</h4>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "morning" as const, label: "오전", sub: "06~12시", td: data.timeGuide.morning },
              { key: "afternoon" as const, label: "오후", sub: "12~18시", td: data.timeGuide.afternoon },
              { key: "evening" as const, label: "저녁", sub: "18~24시", td: data.timeGuide.evening },
            ].map(({ key, label, sub, td }) => (
              <div key={key} className={`rounded-xl p-3 text-center border ${td.score >= 70 ? "border-emerald-500/20 bg-emerald-500/5" : td.score < 45 ? "border-red-500/20 bg-red-500/5" : "border-white/5 bg-white/[0.02]"}`} data-testid={`time-guide-${key}`}>
                <p className="text-xs font-medium text-white">{label}</p>
                <p className="text-[10px] text-muted-foreground">{sub}</p>
                <p className={`text-lg font-bold mt-1 ${td.score >= 70 ? "text-emerald-400" : td.score < 45 ? "text-red-400" : "text-primary"}`}>{td.score}</p>
                <p className="text-[10px] text-white/60 mt-1 leading-snug">{td.message}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {data.sajuInsight && (
        <Card className="bg-white/[0.03] border-white/10 p-5">
          <div className="flex items-start gap-3">
            <Star className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div><h4 className="text-xs font-serif text-amber-400 mb-1">오늘의 사주 인사이트</h4><p className="text-sm text-white/80 leading-relaxed" data-testid="text-saju-insight">{data.sajuInsight}</p></div>
          </div>
        </Card>
      )}

      {data.ziweiMessage && (
        <Card className="bg-white/[0.03] border-white/10 p-5">
          <h4 className="text-xs font-serif text-purple-400 mb-2">자미두수 메시지</h4>
          <p className="text-sm text-white/80 leading-relaxed" data-testid="text-ziwei-message">{data.ziweiMessage}</p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-white/[0.03] border-white/10">
          <button className="w-full p-5 flex items-center justify-between text-left" onClick={() => setShowSajuDetail(!showSajuDetail)} data-testid="button-toggle-saju">
            <h4 className="text-sm font-serif text-primary">사주팔자 운세</h4>
            {showSajuDetail ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showSajuDetail && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 pb-5 space-y-1 border-t border-white/5 pt-3">
              <p className="text-sm text-white/80 leading-relaxed mb-3">{data.sajuSummary}</p>
              <InfoRow icon={Star} label="조심할 점" value={data.sajuCaution} />
              <InfoRow icon={Star} label="특이사항" value={data.sajuSpecial} />
            </motion.div>
          )}
        </Card>

        <Card className="bg-white/[0.03] border-white/10">
          <button className="w-full p-5 flex items-center justify-between text-left" onClick={() => setShowZodiacDetail(!showZodiacDetail)} data-testid="button-toggle-zodiac">
            <h4 className="text-sm font-serif text-primary">별자리 운세 ({zodiacSign})</h4>
            {showZodiacDetail ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showZodiacDetail && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 pb-5 space-y-1 border-t border-white/5 pt-3">
              <p className="text-sm text-white/80 leading-relaxed mb-3">{data.zodiacSummary}</p>
              <InfoRow icon={Heart} label="연애운" value={data.zodiacLove} />
              <InfoRow icon={Wallet} label="재물운" value={data.zodiacMoney} />
              <InfoRow icon={Activity} label="건강운" value={data.zodiacHealth} />
              <InfoRow icon={Briefcase} label="직장운" value={data.zodiacWork} />
            </motion.div>
          )}
        </Card>
      </div>
    </motion.div>
  );
}
