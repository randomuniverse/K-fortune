import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Play, Sparkles, TrendingUp, Heart, Briefcase, AlertTriangle, Lightbulb, Search, Activity } from "lucide-react";

export default function Simulator() {
  const [form, setForm] = useState({
    name: "테스트",
    birthDate: "1990-01-01",
    birthTime: "12:00",
    gender: "male"
  });
  const [resultGuardian, setResultGuardian] = useState<any>(null);
  const [resultYearly, setResultYearly] = useState<any>(null);

  const simulateGuardian = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/simulate/guardian", form);
      return res.json();
    },
    onSuccess: (data) => setResultGuardian(data)
  });

  const simulateYearly = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/simulate/yearly", form);
      return res.json();
    },
    onSuccess: (data) => setResultYearly(data)
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
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="guardian" data-testid="tab-guardian">가디언 리포트</TabsTrigger>
            <TabsTrigger value="yearly" data-testid="tab-yearly">2026년 운세</TabsTrigger>
            <TabsTrigger value="json" data-testid="tab-json">Raw JSON</TabsTrigger>
          </TabsList>

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
      </div>
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
