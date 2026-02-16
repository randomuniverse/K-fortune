import { useState, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Play, Sparkles, TrendingUp, Heart, Briefcase, AlertTriangle, Lightbulb, Search, Activity, Star, Sun, Archive, Trash2, Eye } from "lucide-react";

interface ArchiveEntry {
  id: string;
  timestamp: string;
  form: { name: string; birthDate: string; birthTime: string; gender: string };
  type: "guardian" | "yearly";
  result: any;
}

const ARCHIVE_KEY = "simulator_archive";

function loadArchive(): ArchiveEntry[] {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveArchive(entries: ArchiveEntry[]) {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(entries));
}

export default function Simulator() {
  const [form, setForm] = useState({
    name: "테스트",
    birthDate: "1990-01-01",
    birthTime: "12:00",
    gender: "male"
  });
  const [resultGuardian, setResultGuardian] = useState<any>(null);
  const [resultYearly, setResultYearly] = useState<any>(null);
  const [archive, setArchive] = useState<ArchiveEntry[]>([]);

  useEffect(() => { setArchive(loadArchive()); }, []);

  const addToArchive = useCallback((type: "guardian" | "yearly", formData: any, result: any) => {
    const entry: ArchiveEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleString("ko-KR"),
      form: { ...formData },
      type,
      result,
    };
    const updated = [entry, ...loadArchive()].slice(0, 50);
    saveArchive(updated);
    setArchive(updated);
  }, []);

  const deleteFromArchive = useCallback((id: string) => {
    const updated = loadArchive().filter(e => e.id !== id);
    saveArchive(updated);
    setArchive(updated);
  }, []);

  const loadFromArchive = useCallback((entry: ArchiveEntry) => {
    setForm(entry.form);
    if (entry.type === "guardian") {
      setResultGuardian(entry.result);
    } else {
      setResultYearly(entry.result);
    }
    if (entry.result?.sajuChart) {
      setResultGuardian((prev: any) => prev?.sajuChart ? prev : { ...prev, sajuChart: entry.result.sajuChart, sajuPersonality: entry.result.sajuPersonality, ziwei: entry.result.ziwei, zodiac: entry.result.zodiac });
    }
  }, []);

  const simulateGuardian = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/simulate/guardian", form);
      return res.json();
    },
    onSuccess: (data) => {
      setResultGuardian(data);
      addToArchive("guardian", form, data);
    }
  });

  const simulateYearly = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/simulate/yearly", form);
      return res.json();
    },
    onSuccess: (data) => {
      setResultYearly(data);
      addToArchive("yearly", form, data);
    }
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8" data-testid="page-simulator">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <Sparkles className="w-7 h-7 text-indigo-400" />
          <h1 className="text-2xl md:text-3xl font-bold text-indigo-400" data-testid="text-simulator-title">운명 시뮬레이터</h1>
          <span className="text-xs text-white/30 bg-white/5 px-2 py-1 rounded">Admin Mode</span>
        </div>

        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-white/70">이름 (식별용)</Label>
              <Input
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                className="bg-black/20 border-white/10"
                data-testid="input-name"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">성별</Label>
              <Select value={form.gender} onValueChange={v => setForm({...form, gender: v})}>
                <SelectTrigger className="bg-black/20 border-white/10" data-testid="select-gender">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">남성</SelectItem>
                  <SelectItem value="female">여성</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">생년월일</Label>
              <Input
                type="date"
                value={form.birthDate}
                onChange={e => setForm({...form, birthDate: e.target.value})}
                className="bg-black/20 border-white/10"
                data-testid="input-birthdate"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">태어난 시간</Label>
              <Input
                type="time"
                value={form.birthTime}
                onChange={e => setForm({...form, birthTime: e.target.value})}
                className="bg-black/20 border-white/10"
                data-testid="input-birthtime"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            onClick={() => simulateGuardian.mutate()}
            disabled={simulateGuardian.isPending}
            className="flex-1 bg-indigo-600"
            data-testid="button-simulate-guardian"
          >
            {simulateGuardian.isPending ? <Loader2 className="animate-spin mr-2 w-4 h-4"/> : <Play className="mr-2 w-4 h-4"/>}
            가디언 리포트 생성
          </Button>
          <Button
            onClick={() => simulateYearly.mutate()}
            disabled={simulateYearly.isPending}
            className="flex-1 bg-violet-600"
            data-testid="button-simulate-yearly"
          >
            {simulateYearly.isPending ? <Loader2 className="animate-spin mr-2 w-4 h-4"/> : <Play className="mr-2 w-4 h-4"/>}
            2026년 운세 생성
          </Button>
        </div>

        {simulateGuardian.isPending && (
          <div className="text-center py-8 text-indigo-300/60 text-sm animate-pulse" data-testid="text-guardian-loading">
            가디언 리포트를 생성 중입니다... (약 30~60초 소요)
          </div>
        )}
        {simulateYearly.isPending && (
          <div className="text-center py-8 text-violet-300/60 text-sm animate-pulse" data-testid="text-yearly-loading">
            2026년 운세를 생성 중입니다... (약 30~60초 소요)
          </div>
        )}

        <Tabs defaultValue="guardian" className="w-full">
          <TabsList className="bg-white/5 border border-white/10 flex-wrap gap-1">
            <TabsTrigger value="saju" data-testid="tab-saju">사주팔자</TabsTrigger>
            <TabsTrigger value="ziwei" data-testid="tab-ziwei">자미두수</TabsTrigger>
            <TabsTrigger value="guardian" data-testid="tab-guardian">가디언 리포트</TabsTrigger>
            <TabsTrigger value="yearly" data-testid="tab-yearly">2026년 운세</TabsTrigger>
            <TabsTrigger value="json" data-testid="tab-json">Raw JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="saju">
            {(resultGuardian?.sajuChart || resultYearly?.sajuChart) ? (
              <SajuDisplay
                chart={resultGuardian?.sajuChart || resultYearly?.sajuChart}
                personality={resultGuardian?.sajuPersonality || resultYearly?.sajuPersonality}
              />
            ) : (
              <div className="text-center p-10 text-white/20" data-testid="text-saju-empty">
                시뮬레이션을 실행하면 사주팔자 분석 결과가 표시됩니다.
              </div>
            )}
          </TabsContent>

          <TabsContent value="ziwei">
            {(resultGuardian?.ziwei || resultYearly?.ziwei) ? (
              <ZiweiDisplay ziwei={resultGuardian?.ziwei || resultYearly?.ziwei} />
            ) : (
              <div className="text-center p-10 text-white/20" data-testid="text-ziwei-empty">
                시뮬레이션을 실행하면 자미두수 분석 결과가 표시됩니다.
              </div>
            )}
          </TabsContent>

          <TabsContent value="guardian">
            {resultGuardian ? (
              <div className="space-y-4" data-testid="result-guardian">
                <div className="text-center py-4">
                  <h2 className="text-xl font-bold text-indigo-300" data-testid="text-core-energy">"{resultGuardian.coreEnergy}"</h2>
                  {resultGuardian.keywords && (
                    <div className="flex flex-wrap justify-center gap-2 mt-2">
                      {resultGuardian.keywords.map((kw: string, i: number) => (
                        <span key={i} className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded">#{kw}</span>
                      ))}
                    </div>
                  )}
                  {resultGuardian.coherenceScore && (
                    <span className="text-xs text-white/30 mt-2 inline-block">일치도: {resultGuardian.coherenceScore}%</span>
                  )}
                </div>

                <GuardianSection icon={Search} title="운명의 추적" color="indigo" content={resultGuardian.pastInference} />
                <GuardianSection icon={TrendingUp} title="현재의 딜레마" color="blue" content={resultGuardian.currentState} />
                <GuardianSection icon={AlertTriangle} title="결정적 병목" color="amber" content={resultGuardian.bottleneck} />
                <GuardianSection icon={Lightbulb} title="가디언의 처방" color="emerald" content={resultGuardian.solution} />
                <GuardianSection icon={Briefcase} title="재물/비즈니스" color="yellow" content={resultGuardian.businessAdvice} />
                <GuardianSection icon={Heart} title="연애/인간관계" color="pink" content={resultGuardian.loveAdvice} />
                <GuardianSection icon={Activity} title="건강/컨디션" color="teal" content={resultGuardian.healthAdvice} />
              </div>
            ) : (
              <div className="text-center p-10 text-white/20" data-testid="text-guardian-empty">
                가디언 리포트 생성 버튼을 눌러 결과를 확인하세요.
              </div>
            )}
          </TabsContent>

          <TabsContent value="yearly">
            {resultYearly ? (
              <div className="space-y-4" data-testid="result-yearly">
                {resultYearly.keywords && (
                  <div className="flex flex-wrap justify-center gap-2 py-2">
                    {resultYearly.keywords.map((kw: string, i: number) => (
                      <span key={i} className="text-xs bg-violet-500/20 text-violet-300 px-2 py-1 rounded">#{kw}</span>
                    ))}
                  </div>
                )}

                <Card className="bg-violet-500/10 border-violet-500/20">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-bold text-violet-300 mb-2">총평</h3>
                    <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">{resultYearly.overallSummary}</p>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-amber-500/10 border-amber-500/20">
                    <CardContent className="p-4">
                      <h3 className="text-sm font-bold text-amber-300 mb-2">사업운</h3>
                      <p className="text-xs text-white/70 leading-relaxed whitespace-pre-line">{resultYearly.businessFortune}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-pink-500/10 border-pink-500/20">
                    <CardContent className="p-4">
                      <h3 className="text-sm font-bold text-pink-300 mb-2">연애운</h3>
                      <p className="text-xs text-white/70 leading-relaxed whitespace-pre-line">{resultYearly.loveFortune}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-teal-500/10 border-teal-500/20">
                    <CardContent className="p-4">
                      <h3 className="text-sm font-bold text-teal-300 mb-2">건강운</h3>
                      <p className="text-xs text-white/70 leading-relaxed whitespace-pre-line">{resultYearly.healthFortune}</p>
                    </CardContent>
                  </Card>
                </div>

                {resultYearly.monthlyFlow && (
                  <div>
                    <h3 className="text-sm font-bold text-white/60 mb-3">월별 흐름</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {resultYearly.monthlyFlow.map((m: any) => (
                        <Card key={m.month} className="bg-white/[0.03] border-white/5">
                          <CardContent className="p-3">
                            <span className="text-indigo-400 font-bold text-xs">{m.month}월</span>
                            <p className="text-[11px] text-white/50 mt-1 line-clamp-3">{m.summary}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center p-10 text-white/20" data-testid="text-yearly-empty">
                2026년 운세 생성 버튼을 눌러 결과를 확인하세요.
              </div>
            )}
          </TabsContent>

          <TabsContent value="json">
            <pre className="bg-black/50 border border-white/10 p-4 rounded text-xs overflow-auto max-h-[600px] text-green-400" data-testid="result-json">
              {resultGuardian || resultYearly
                ? JSON.stringify(resultGuardian || resultYearly, null, 2)
                : "// 아직 결과가 없습니다."}
            </pre>
          </TabsContent>
        </Tabs>

        {archive.length > 0 && (
          <div className="mt-8" data-testid="section-archive">
            <div className="flex items-center gap-2 mb-4">
              <Archive className="w-5 h-5 text-white/40" />
              <h2 className="text-lg font-bold text-white/60">기록 보관함</h2>
              <span className="text-[10px] text-white/20 bg-white/5 px-2 py-0.5 rounded">{archive.length}건</span>
            </div>
            <div className="space-y-2">
              {archive.map(entry => (
                <Card key={entry.id} className="bg-white/[0.03] border-white/5">
                  <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${entry.type === "guardian" ? "bg-indigo-500/20 text-indigo-300" : "bg-violet-500/20 text-violet-300"}`}>
                        {entry.type === "guardian" ? "가디언" : "운세"}
                      </span>
                      <span className="text-sm text-white/80 font-bold truncate">{entry.form.name}</span>
                      <span className="text-[11px] text-white/40">{entry.form.birthDate} {entry.form.birthTime}</span>
                      <span className="text-[10px] text-white/30">{entry.form.gender === "male" ? "남" : "여"}</span>
                      <span className="text-[10px] text-white/20">{entry.timestamp}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => loadFromArchive(entry)}
                        data-testid={`button-load-${entry.id}`}
                      >
                        <Eye className="w-4 h-4 text-white/40" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteFromArchive(entry.id)}
                        data-testid={`button-delete-${entry.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-400/40" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SajuDisplay({ chart, personality }: { chart: any; personality: any }) {
  if (!chart) return null;

  const yp = chart.yearPillar || {};
  const mp = chart.monthPillar || {};
  const dp = chart.dayPillar || {};
  const hp = chart.hourPillar || {};
  const pillars = [
    { label: "년주", stem: yp.stem || chart.yearStem, branch: yp.branch || chart.yearBranch, stemHanja: yp.stemHanja, branchHanja: yp.branchHanja },
    { label: "월주", stem: mp.stem || chart.monthStem, branch: mp.branch || chart.monthBranch, stemHanja: mp.stemHanja, branchHanja: mp.branchHanja },
    { label: "일주", stem: dp.stem || chart.dayStem, branch: dp.branch || chart.dayBranch, stemHanja: dp.stemHanja, branchHanja: dp.branchHanja },
    { label: "시주", stem: hp.stem || chart.hourStem, branch: hp.branch || chart.hourBranch, stemHanja: hp.stemHanja, branchHanja: hp.branchHanja },
  ];

  const tenGods = [
    { label: "년간", god: chart.yearTenGod?.name },
    { label: "월간", god: chart.monthTenGod?.name },
    { label: "일간", god: "본인" },
    { label: "시간", god: chart.hourTenGod?.name },
    { label: "년지", god: chart.yearBranchTenGod?.name },
    { label: "월지", god: chart.monthBranchTenGod?.name },
    { label: "일지", god: chart.dayBranchTenGod?.name },
    { label: "시지", god: chart.hourBranchTenGod?.name },
  ].filter(t => t.god);

  const fiveElements = chart.fiveElementRatios || chart.fiveElementRatio;

  return (
    <div className="space-y-4" data-testid="result-saju">
      <div className="flex items-center gap-2 mb-2">
        <Star className="w-5 h-5 text-amber-400" />
        <h2 className="text-lg font-bold text-amber-300">사주팔자 (四柱八字)</h2>
      </div>

      <Card className="bg-amber-500/10 border-amber-500/20">
        <CardContent className="p-4">
          <h3 className="text-sm font-bold text-amber-300 mb-3">사주 원국</h3>
          <div className="grid grid-cols-4 gap-2 text-center">
            {pillars.map(p => (
              <div key={p.label} className="space-y-1">
                <div className="text-[10px] text-white/40">{p.label}</div>
                <div className="text-lg font-bold text-amber-200">{p.stem}</div>
                <div className="text-[10px] text-white/30">{p.stemHanja || ""}</div>
                <div className="text-lg font-bold text-amber-400">{p.branch}</div>
                <div className="text-[10px] text-white/30">{p.branchHanja || ""}</div>
              </div>
            ))}
          </div>
          {chart.chineseZodiac && (
            <div className="text-center mt-3 text-xs text-white/40">띠: {chart.chineseZodiac} ({chart.chineseZodiacBranch})</div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-amber-500/5 border-amber-500/15">
        <CardContent className="p-4">
          <h3 className="text-sm font-bold text-amber-300 mb-2">일주 분석</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-white/40">일간: </span><span className="text-white/80">{dp.stem}{dp.stemHanja ? ` (${dp.stemHanja})` : ""}</span></div>
            {chart.dominantElement && <div><span className="text-white/40">주 오행: </span><span className="text-white/80">{chart.dominantElement}</span></div>}
            {chart.dayMasterStrength && <div><span className="text-white/40">강약: </span><span className="text-white/80">{chart.dayMasterStrength}</span></div>}
            {chart.yongShin && <div><span className="text-white/40">용신: </span><span className="text-white/80">{chart.yongShin.element} ({chart.yongShin.elementHanja})</span></div>}
          </div>
          {chart.yongShin?.reason && (
            <p className="text-[11px] text-white/50 mt-2">{chart.yongShin.reason}</p>
          )}
        </CardContent>
      </Card>

      {fiveElements && (
        <Card className="bg-amber-500/5 border-amber-500/15">
          <CardContent className="p-4">
            <h3 className="text-sm font-bold text-amber-300 mb-2">오행 비율</h3>
            <div className="grid grid-cols-5 gap-2 text-center text-xs">
              {(Array.isArray(fiveElements) ? fiveElements : Object.entries(fiveElements).map(([k, v]) => ({element: k, ratio: v}))).map((el: any) => (
                <div key={el.element}>
                  <div className="text-white/40">{el.element}{el.elementHanja ? ` (${el.elementHanja})` : ""}</div>
                  <div className="text-amber-200 font-bold">{typeof el.ratio === 'number' ? `${el.ratio.toFixed(1)}%` : el.ratio}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tenGods.length > 0 && (
        <Card className="bg-amber-500/5 border-amber-500/15">
          <CardContent className="p-4">
            <h3 className="text-sm font-bold text-amber-300 mb-2">십신 (十神)</h3>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {tenGods.map(t => (
                <div key={t.label}>
                  <div className="text-white/40">{t.label}</div>
                  <div className="text-amber-200">{t.god}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {chart.daeun && chart.daeun.length > 0 && (
        <Card className="bg-amber-500/5 border-amber-500/15">
          <CardContent className="p-4">
            <h3 className="text-sm font-bold text-amber-300 mb-2">대운 흐름 (시작 나이: {chart.daeunStartAge}세)</h3>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 text-xs">
              {chart.daeun.map((d: any, i: number) => (
                <div key={i} className="text-center bg-black/20 rounded p-2">
                  <div className="text-white/40">{d.age}세 ({d.year})</div>
                  <div className="text-amber-200 font-bold">{d.stem}{d.branch}</div>
                  <div className="text-[10px] text-white/25">{d.stemHanja}{d.branchHanja}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {personality && (
        <Card className="bg-amber-500/5 border-amber-500/15">
          <CardContent className="p-4">
            <h3 className="text-sm font-bold text-amber-300 mb-3">성격 분석</h3>
            {typeof personality === 'object' ? (
              <div className="space-y-3 text-xs">
                {personality.mainTrait && <div><span className="text-white/40">주요 기질: </span><span className="text-white/80">{personality.mainTrait}</span></div>}
                {personality.elementPersonality && <p className="text-white/70 leading-relaxed">{personality.elementPersonality}</p>}
                {personality.dayMasterDescription && <p className="text-white/60 leading-relaxed">{personality.dayMasterDescription}</p>}
                {personality.heavenlyGift && <div className="bg-amber-500/10 rounded p-2 mt-1"><span className="text-amber-300 text-[11px]">{personality.heavenlyGift}</span></div>}
                {personality.talent && <div><span className="text-white/40">재능: </span><span className="text-white/70">{personality.talent}</span></div>}
                {personality.weakPoint && <div><span className="text-white/40">약점: </span><span className="text-white/70">{personality.weakPoint}</span></div>}
                {personality.subTraits && personality.subTraits.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {personality.subTraits.map((t: string, i: number) => (
                      <span key={i} className="text-[11px] bg-amber-500/15 text-amber-300/80 px-2 py-0.5 rounded">{t}</span>
                    ))}
                  </div>
                )}
                {personality.specialSals && personality.specialSals.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <div className="text-white/40 text-[11px] font-bold">특수 신살</div>
                    {personality.specialSals.map((s: any, i: number) => (
                      <div key={i} className="bg-black/20 rounded p-2">
                        <div className="text-amber-300 text-[11px] font-bold">{s.name} ({s.hanja})</div>
                        <div className="text-white/50 text-[10px] mt-0.5">{s.personality}</div>
                        <div className="text-white/40 text-[10px] mt-0.5">{s.description}</div>
                      </div>
                    ))}
                  </div>
                )}
                {personality.structurePatterns && personality.structurePatterns.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <div className="text-white/40 text-[11px] font-bold">구조 패턴</div>
                    {personality.structurePatterns.map((p: any, i: number) => (
                      <div key={i} className="bg-black/20 rounded p-2">
                        <div className="text-amber-300 text-[11px] font-bold">{p.name} ({p.hanja})</div>
                        {p.businessTrait && <div className="text-amber-200/60 text-[10px] mt-0.5">{p.businessTrait}</div>}
                        <div className="text-white/40 text-[10px] mt-0.5">{p.description}</div>
                      </div>
                    ))}
                  </div>
                )}
                {personality.yongShinRemedy && (
                  <div className="mt-2 bg-amber-500/10 rounded p-3 space-y-1">
                    <div className="text-amber-300 text-[11px] font-bold">용신 처방 ({personality.yongShinRemedy.element} {personality.yongShinRemedy.elementHanja})</div>
                    <div className="text-[10px] text-white/60">{personality.yongShinRemedy.summary}</div>
                    {personality.yongShinRemedy.luckyColor && <div className="text-[10px] text-white/50">색상: {personality.yongShinRemedy.luckyColor}</div>}
                    {personality.yongShinRemedy.luckyDirection && <div className="text-[10px] text-white/50">방위: {personality.yongShinRemedy.luckyDirection}</div>}
                    {personality.yongShinRemedy.luckyFood && <div className="text-[10px] text-white/50">음식: {personality.yongShinRemedy.luckyFood}</div>}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-white/70 leading-relaxed whitespace-pre-line">{personality}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ZiweiDisplay({ ziwei }: { ziwei: any }) {
  if (!ziwei) return null;

  const palaceLabels: Record<string, string> = {
    life: "명궁", spouse: "부처궁", wealth: "재백궁", travel: "천이궁",
    health: "질액궁", career: "관록궁", friends: "교우궁", property: "전택궁",
    children: "자녀궁", parents: "부모궁", fortune: "복덕궁", siblings: "형제궁",
  };

  const stars = ziwei.stars || {};

  return (
    <div className="space-y-4" data-testid="result-ziwei">
      <div className="flex items-center gap-2 mb-2">
        <Sun className="w-5 h-5 text-purple-400" />
        <h2 className="text-lg font-bold text-purple-300">자미두수 (紫微斗數)</h2>
      </div>

      <Card className="bg-purple-500/10 border-purple-500/20">
        <CardContent className="p-4">
          <h3 className="text-sm font-bold text-purple-300 mb-2">기본 정보</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {ziwei.lifePalace && <div><span className="text-white/40">명궁 위치: </span><span className="text-white/80">{ziwei.lifePalace}</span></div>}
            {ziwei.bureau && (
              <div className="col-span-2">
                <span className="text-white/40">국: </span>
                <span className="text-white/80">{typeof ziwei.bureau === 'object' ? `${ziwei.bureau.name}` : ziwei.bureau}</span>
              </div>
            )}
            {ziwei.bureau?.desc && <div className="col-span-2 text-white/50 text-[11px]">{ziwei.bureau.desc}</div>}
          </div>
        </CardContent>
      </Card>

      {ziwei.interpretation && (
        <Card className="bg-purple-500/10 border-purple-500/20">
          <CardContent className="p-4">
            <h3 className="text-sm font-bold text-purple-300 mb-2">종합 해석</h3>
            <p className="text-xs text-white/70 leading-relaxed">{ziwei.interpretation}</p>
          </CardContent>
        </Card>
      )}

      {Object.keys(stars).length > 0 && (
        <Card className="bg-purple-500/10 border-purple-500/20">
          <CardContent className="p-4">
            <h3 className="text-sm font-bold text-purple-300 mb-3">궁별 주요 성수</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(stars).map(([palaceKey, starList]: [string, any]) => (
                <div key={palaceKey} className="bg-black/20 rounded p-3">
                  <div className="text-xs font-bold text-purple-300 mb-2">{palaceLabels[palaceKey] || palaceKey}</div>
                  {(Array.isArray(starList) ? starList : []).map((star: any, j: number) => (
                    <div key={j} className="mb-2 last:mb-0">
                      <div className="text-[11px] text-purple-200 font-bold">{star.name}</div>
                      {star.keyword && <div className="text-[10px] text-white/40">{star.keyword}</div>}
                      {star.personality && <div className="text-[10px] text-white/50 mt-0.5">{star.personality}</div>}
                      {star.wealthStyle && <div className="text-[10px] text-white/40 mt-0.5">재물: {star.wealthStyle}</div>}
                      {star.loveStyle && <div className="text-[10px] text-white/40 mt-0.5">연애: {star.loveStyle}</div>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!Object.keys(stars).length && (
        <Card className="bg-purple-500/5 border-purple-500/15">
          <CardContent className="p-4">
            <h3 className="text-sm font-bold text-purple-300 mb-2">자미두수 원국 데이터</h3>
            <pre className="text-[11px] text-white/60 overflow-auto max-h-96 whitespace-pre-wrap">{JSON.stringify(ziwei, null, 2)}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function GuardianSection({ icon: Icon, title, color, content }: {
  icon: any;
  title: string;
  color: string;
  content?: string | null;
}) {
  if (!content) return null;

  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-500/10 border-indigo-500/20 text-indigo-300",
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-300",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-300",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
    yellow: "bg-yellow-500/10 border-yellow-500/20 text-yellow-300",
    pink: "bg-pink-500/10 border-pink-500/20 text-pink-300",
    teal: "bg-teal-500/10 border-teal-500/20 text-teal-300",
  };

  const classes = colorMap[color] || colorMap.indigo;
  const [bg, border, text] = classes.split(" ");

  return (
    <Card className={`${bg} ${border}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`w-4 h-4 ${text}`} />
          <h3 className={`text-sm font-bold ${text}`}>{title}</h3>
        </div>
        <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">{content}</p>
      </CardContent>
    </Card>
  );
}
