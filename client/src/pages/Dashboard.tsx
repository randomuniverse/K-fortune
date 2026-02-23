import { useRoute, useLocation, Link } from "wouter";
import { useUser, useGenerateFortune, useFortunes, useSajuAnalysis } from "@/hooks/use-fortune";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FortuneCard } from "@/components/FortuneCard";
import { Loader2, Sparkles, AlertCircle, Send, Sun, CalendarDays, Compass, Star, Moon, User, LayoutDashboard, MessageCircle, ExternalLink, ArrowLeft, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { getZodiacSign, getZodiacInfo } from "@shared/schema";
import type { FortuneData } from "@shared/schema";
import { FortuneScoreCard } from "@/components/FortuneScoreCard";
import { YearlyFortuneCard } from "@/components/YearlyFortuneCard";
import { SajuDeepAnalysis, ZiweiDeepAnalysis, ZodiacDeepAnalysis } from "@/components/SajuProfileCard";
import { GuardianReport } from "@/components/GuardianReport";

type MainTabId = "today" | "yearly" | "destiny";
type DestinyTabId = "summary" | "saju" | "ziwei" | "zodiac";
type YearlyTabId = "guardian" | "saju" | "ziwei" | "zodiac";

const MAIN_TABS: { id: MainTabId; label: string; icon: any }[] = [
  { id: "today", label: "오늘의 운세", icon: Sun },
  { id: "yearly", label: "2026년 총평", icon: CalendarDays },
  { id: "destiny", label: "운명 종합 분석", icon: Sparkles },
];

const YEARLY_TABS: { id: YearlyTabId; label: string; icon: any }[] = [
  { id: "guardian", label: "가디언 총평", icon: LayoutDashboard },
  { id: "saju", label: "사주 총평", icon: Compass },
  { id: "ziwei", label: "자미두수 총평", icon: Star },
  { id: "zodiac", label: "별자리 총평", icon: Moon },
];

const DESTINY_TABS: { id: DestinyTabId; label: string; icon: any }[] = [
  { id: "summary", label: "가디언 리포트", icon: LayoutDashboard },
  { id: "saju", label: "사주팔자", icon: Compass },
  { id: "ziwei", label: "자미두수", icon: Star },
  { id: "zodiac", label: "별자리 정보", icon: Moon },
];

const FORTUNES_PER_PAGE = 6;

export default function Dashboard() {
  const [match, params] = useRoute("/dashboard/:telegramId");
  const [, setLocation] = useLocation();
  const telegramId = params?.telegramId || "";

  const isFromAdmin = typeof window !== "undefined" && window.location.search.includes("from=admin");

  const { data: user, isLoading: isUserLoading, error: userError } = useUser(telegramId);
  const { data: fortunes } = useFortunes(telegramId);
  const { data: sajuData } = useSajuAnalysis(telegramId);
  const generateFortune = useGenerateFortune();
  const { toast } = useToast();
  
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTabId>("today");
  const [yearlySubTab, setYearlySubTab] = useState<YearlyTabId>("guardian");
  const [destinySubTab, setDestinySubTab] = useState<DestinyTabId>("summary");
  const [fortunesShown, setFortunesShown] = useState(FORTUNES_PER_PAGE);

  useEffect(() => {
    if (user) {
      try {
        localStorage.setItem("celestial_fortune_last_user", JSON.stringify({
          telegramId: user.telegramId,
          name: user.name,
        }));
      } catch {}
    }
  }, [user]);

  if (isUserLoading) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground animate-pulse">우주의 신탁을 듣는 중...</p>
        </div>
      </Layout>
    );
  }

  if (user && user.telegramId !== telegramId && user.linkToken !== telegramId) {
    setLocation(`/dashboard/${user.linkToken || user.telegramId}`, { replace: true });
    return null;
  }

  if (!user || userError) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto text-center">
          <AlertCircle className="w-16 h-16 text-destructive mb-4" />
          <h2 className="text-2xl font-serif text-white mb-2">사용자를 찾을 수 없습니다</h2>
          <p className="text-muted-foreground mb-8">
            해당 ID(<span className="text-primary font-mono">{telegramId}</span>)를 가진 여행자를 별들이 찾을 수 없습니다.
          </p>
          <Button variant="outline" onClick={() => setLocation("/")}>홈으로 돌아가기</Button>
        </div>
      </Layout>
    );
  }

  const zodiacSign = getZodiacSign(user.birthDate);
  const zodiacInfo = getZodiacInfo(user.birthDate);

  const hasTodayFortune = fortunes?.some((f) => {
    const fortuneDate = new Date(f.createdAt!);
    const toKSTDate = (d: Date) => {
      const utc = d.getTime() + d.getTimezoneOffset() * 60000;
      return new Date(utc + 9 * 3600000).toDateString();
    };
    return toKSTDate(fortuneDate) === toKSTDate(new Date());
  });

  const todayFortune = fortunes?.find((f) => {
    const fortuneDate = new Date(f.createdAt!);
    const toKSTDate = (d: Date) => {
      const utc = d.getTime() + d.getTimezoneOffset() * 60000;
      return new Date(utc + 9 * 3600000).toDateString();
    };
    return toKSTDate(fortuneDate) === toKSTDate(new Date());
  });

  let todayFortuneData: FortuneData | null = null;
  if (todayFortune?.fortuneData) {
    try { todayFortuneData = JSON.parse(todayFortune.fortuneData); } catch {}
  }

  const handleGenerate = () => {
    if (hasTodayFortune) {
      toast({ title: "오늘의 운세는 이미 확인하셨습니다", description: "내일 새로운 운세를 확인해보세요." });
      return;
    }
    generateFortune.mutate(telegramId, {
      onSuccess: () => toast({ title: "운세가 밝혀졌습니다", description: "3회 교차 검증을 거쳐 종합 운세가 도착했습니다." }),
      onError: (error) => toast({ variant: "destructive", title: "알림", description: error.message }),
    });
  };

  const chineseZodiacAnimal = sajuData?.sajuChart?.chineseZodiacDisplay || (sajuData?.sajuChart?.chineseZodiac ? `${sajuData.sajuChart.chineseZodiac}띠` : "");
  const infoItems = [
    `${user.birthDate} ${user.birthTime}생`,
    zodiacSign,
    chineseZodiacAnimal,
    user.gender === "male" ? "남(陽)" : "여(陰)",
  ].filter(Boolean);
  if (user.mbti) infoItems.push(user.mbti);
  if (user.birthCountry) infoItems.push(`${user.birthCountry}${user.birthCity ? ` ${user.birthCity}` : ""}`);

  const pastFortunes = fortunes?.filter((f) => !todayFortune || f.id !== todayFortune.id) || [];
  const visibleFortunes = pastFortunes.slice(0, fortunesShown);
  const hasMoreFortunes = pastFortunes.length > fortunesShown;

  return (
    <Layout telegramId={telegramId}>
      <div className="space-y-6">
        {isFromAdmin && (
          <div className="flex items-center gap-2 pb-2 border-b border-purple-800/30">
            <Link href="/admin">
              <Button
                variant="ghost"
                size="sm"
                className="text-purple-400 hover:text-purple-200 gap-2"
                data-testid="button-back-to-admin"
              >
                <ArrowLeft className="w-4 h-4" />
                <Users className="w-4 h-4" />
                회원 리스트
              </Button>
            </Link>
            <span className="text-purple-600 text-xs">관리자 모드</span>
          </div>
        )}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl md:text-4xl font-serif text-white mb-1">
              환영합니다, <span className="text-primary text-glow">{user.name}</span>님
            </h2>
            <p className="text-muted-foreground text-sm">{infoItems.join(" / ")}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="mystical"
              size="lg"
              onClick={handleGenerate}
              disabled={generateFortune.isPending || hasTodayFortune}
              className="w-full md:w-auto min-w-[200px]"
              data-testid="button-generate-fortune"
            >
              {generateFortune.isPending ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> 교차 검증 중... (9회 분석)</>
              ) : hasTodayFortune ? (
                <><Sparkles className="mr-2 h-5 w-5" /> 오늘의 운세 확인 완료</>
              ) : (
                <><Sparkles className="mr-2 h-5 w-5" /> 오늘의 운세 보기</>
              )}
            </Button>
            {hasTodayFortune && user.telegramChatId && (
              <Button
                variant="outline"
                size="lg"
                onClick={async () => {
                  setIsSendingTelegram(true);
                  try {
                    const res = await fetch(`/api/telegram/test-send/${telegramId}`, { method: "POST" });
                    const data = await res.json();
                    if (res.ok) toast({ title: "전송 완료", description: data.message });
                    else toast({ variant: "destructive", title: "전송 실패", description: data.message });
                  } catch (err) {
                    toast({ variant: "destructive", title: "오류", description: "전송 중 오류가 발생했습니다." });
                  } finally {
                    setIsSendingTelegram(false);
                  }
                }}
                disabled={isSendingTelegram}
                className="w-full md:w-auto"
                data-testid="button-send-telegram"
              >
                {isSendingTelegram ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 전송 중...</> : <><Send className="mr-2 h-4 w-4" /> 텔레그램 전송</>}
              </Button>
            )}
          </div>
        </div>

        {!user.telegramChatId && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20"
            data-testid="banner-telegram-connect"
          >
            <MessageCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-amber-200 font-medium">텔레그램 알림을 받으려면 아래 버튼을 눌러주세요</p>
              <p className="text-xs text-amber-200/60 mt-0.5">
                버튼을 누르면 텔레그램이 열리고, 시작 버튼만 누르면 자동으로 연결됩니다.
              </p>
            </div>
            <a
              href={`https://t.me/ricky_lucky_guardian_bot?start=${user.linkToken || user.telegramId}`}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-telegram-deeplink"
            >
              <Button variant="outline" className="border-amber-500/30 text-amber-200 shrink-0 whitespace-nowrap">
                <ExternalLink className="mr-2 h-4 w-4" />
                텔레그램 연결하기
              </Button>
            </a>
          </motion.div>
        )}

        <div className="flex gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/5">
          {MAIN_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`tab-${tab.id}`}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-primary/20 text-primary border border-primary/30 shadow-lg shadow-primary/10"
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-primary" : ""}`} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden text-xs">{tab.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        <div className="min-h-[400px]">
          {activeTab === "today" && (
            <motion.div
              key="today"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {todayFortuneData && <FortuneScoreCard data={todayFortuneData} zodiacSign={zodiacSign} />}
              {!todayFortuneData && !generateFortune.isPending && (
                <div className="py-16 text-center glass-panel rounded-xl">
                  <Sparkles className="w-12 h-12 text-primary/30 mx-auto mb-4" />
                  <p className="text-muted-foreground text-lg mb-4">아직 오늘의 운세가 없습니다.</p>
                  <Button variant="mystical" onClick={handleGenerate} disabled={generateFortune.isPending} data-testid="button-generate-fortune-empty">
                    <Sparkles className="mr-2 h-4 w-4" /> 오늘의 운세 보기
                  </Button>
                </div>
              )}
              {pastFortunes.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent flex-1" />
                    <h3 className="text-xl font-serif text-primary/80 uppercase tracking-widest text-sm">운명 기록</h3>
                    <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent flex-1" />
                  </div>
                  <div className="space-y-3">
                    {visibleFortunes.map((fortune, idx) => <FortuneCard key={fortune.id} fortune={fortune} index={idx} />)}
                  </div>
                  {hasMoreFortunes && (
                    <div className="text-center pt-2">
                      <Button variant="outline" size="sm" onClick={() => setFortunesShown(prev => prev + FORTUNES_PER_PAGE)} className="text-muted-foreground" data-testid="button-load-more">
                        이전 운세 더 보기 ({pastFortunes.length - fortunesShown}개 남음)
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "yearly" && (
            <motion.div
              key="yearly"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
                {YEARLY_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = yearlySubTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setYearlySubTab(tab.id)}
                      data-testid={`subtab-yearly-${tab.id}`}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                        isActive
                          ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                          : "bg-white/5 text-muted-foreground border-white/5 hover:bg-white/10"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {!sajuData?.sajuChart ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-primary/50 animate-spin" /></div>
              ) : (
                <div className="min-h-[300px]">
                  <YearlyFortuneCard chart={sajuData.sajuChart} userName={user.name} telegramId={telegramId} yearlySubTab={yearlySubTab} ziweiData={sajuData.ziweiData} zodiacInfo={sajuData.zodiacInfo} />
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "destiny" && (
            <motion.div
              key="destiny"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
                {DESTINY_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = destinySubTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setDestinySubTab(tab.id)}
                      data-testid={`subtab-${tab.id}`}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                        isActive
                          ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                          : "bg-white/5 text-muted-foreground border-white/5 hover:bg-white/10"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {!sajuData?.sajuChart ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-primary/50 animate-spin" /></div>
              ) : (
                <div className="min-h-[300px]">
                  {destinySubTab === "summary" && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <GuardianReport telegramId={telegramId} userName={user.name} />
                    </motion.div>
                  )}

                  {destinySubTab === "saju" && (
                    <SajuDeepAnalysis 
                      chart={sajuData.sajuChart} 
                      birthDate={user.birthDate} 
                      birthTime={user.birthTime} 
                      userName={user.name}
                      gender={user.gender}
                    />
                  )}

                  {destinySubTab === "ziwei" && (
                    <ZiweiDeepAnalysis 
                      chart={sajuData.sajuChart} 
                      birthDate={user.birthDate} 
                      birthTime={user.birthTime} 
                      gender={user.gender} 
                    />
                  )}

                  {destinySubTab === "zodiac" && (
                    <ZodiacDeepAnalysis zodiacInfo={zodiacInfo} />
                  )}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </Layout>
  );
}
