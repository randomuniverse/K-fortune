import { useRoute, useLocation } from "wouter";
import { useUser, useGenerateFortune, useFortunes } from "@/hooks/use-fortune";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { FortuneCard } from "@/components/FortuneCard";
import { Loader2, Sparkles, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { getZodiacSign } from "@shared/schema";
import type { FortuneData } from "@shared/schema";
import { FortuneScoreCard } from "@/components/FortuneScoreCard";

export default function Dashboard() {
  const [match, params] = useRoute("/dashboard/:telegramId");
  const [, setLocation] = useLocation();
  const telegramId = params?.telegramId || "";
  
  const { data: user, isLoading: isUserLoading, error: userError } = useUser(telegramId);
  const { data: fortunes, isLoading: isFortunesLoading } = useFortunes(telegramId);
  const generateFortune = useGenerateFortune();
  const { toast } = useToast();

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

  if (!user || userError) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto text-center">
          <AlertCircle className="w-16 h-16 text-destructive mb-4" />
          <h2 className="text-2xl font-serif text-white mb-2">사용자를 찾을 수 없습니다</h2>
          <p className="text-muted-foreground mb-8">
            해당 ID(<span className="text-primary font-mono">{telegramId}</span>)를 가진 여행자를 별들이 찾을 수 없습니다.
          </p>
          <Button variant="outline" onClick={() => setLocation("/")} data-testid="button-go-home">홈으로 돌아가기</Button>
        </div>
      </Layout>
    );
  }

  const zodiacSign = getZodiacSign(user.birthDate);

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
      toast({
        title: "오늘의 운세는 이미 확인하셨습니다",
        description: "내일 새로운 운세를 확인해보세요.",
      });
      return;
    }
    generateFortune.mutate(telegramId, {
      onSuccess: () => {
        toast({
          title: "운세가 밝혀졌습니다",
          description: "3회 교차 검증을 거쳐 종합 운세가 도착했습니다.",
        });
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "알림",
          description: error.message,
        });
      },
    });
  };

  const infoItems = [
    `${user.birthDate} ${user.birthTime}생`,
    zodiacSign,
    user.gender === 'male' ? '양(陽)' : '음(陰)',
  ];
  if (user.mbti) infoItems.push(user.mbti);
  if (user.birthCountry) infoItems.push(`${user.birthCountry}${user.birthCity ? ` ${user.birthCity}` : ''}`);
  infoItems.push(`매일 ${user.preferredDeliveryTime} 알림`);

  return (
    <Layout telegramId={telegramId}>
      <div className="space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-3xl md:text-4xl font-serif text-white mb-1" data-testid="text-welcome">
              환영합니다, <span className="text-primary text-glow">{user.name}</span>님
            </h2>
            <p className="text-muted-foreground text-sm" data-testid="text-user-details">
              {infoItems.join(" / ")}
            </p>
          </div>
          
          <Button 
            variant="mystical" 
            size="lg" 
            onClick={handleGenerate}
            disabled={generateFortune.isPending || hasTodayFortune}
            className="w-full md:w-auto min-w-[200px]"
            data-testid="button-generate-fortune"
          >
            {generateFortune.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 교차 검증 중... (9회 분석)
              </>
            ) : hasTodayFortune ? (
              <>
                <Sparkles className="mr-2 h-5 w-5" /> 오늘의 운세 확인 완료
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" /> 오늘의 운세 보기
              </>
            )}
          </Button>
        </div>

        {todayFortuneData && (
          <FortuneScoreCard data={todayFortuneData} zodiacSign={zodiacSign} />
        )}

        <div className="grid gap-8">
          <div className="flex items-center gap-4">
             <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent flex-1" />
             <h3 className="text-xl font-serif text-primary/80 uppercase tracking-widest text-sm">운명 기록</h3>
             <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent flex-1" />
          </div>

          {isFortunesLoading ? (
             <div className="flex justify-center py-12">
               <Loader2 className="w-8 h-8 text-primary/50 animate-spin" />
             </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {fortunes && fortunes.length > 0 ? (
                  fortunes.map((fortune, idx) => (
                    <FortuneCard key={fortune.id} fortune={fortune} index={idx} />
                  ))
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    className="col-span-full py-16 text-center glass-panel rounded-xl"
                  >
                    <p className="text-muted-foreground text-lg mb-4">아직 당신의 운명이 기록되지 않았습니다.</p>
                    <Button variant="link" onClick={handleGenerate} className="text-primary" data-testid="button-first-fortune">
                      첫 번째 신탁을 받아보세요
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
