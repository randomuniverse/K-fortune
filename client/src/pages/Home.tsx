import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Star, Sparkles, Moon } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const [telegramIdInput, setTelegramIdInput] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    let id = telegramIdInput.trim();
    if (id.startsWith("@")) {
      id = id.substring(1);
    }
    if (id) {
      setLocation(`/dashboard/${id}`);
    }
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col justify-center items-center py-12 md:py-20 relative">
        
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-3xl mx-auto space-y-6 mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary mb-4 backdrop-blur-sm">
            <Star className="w-4 h-4 fill-primary" />
            <span className="text-sm font-medium tracking-wide">매일 전해지는 우주의 인도</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-serif font-bold leading-tight">
            별들의 <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-primary to-amber-500 text-glow">
              지혜를 깨우다
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            당신만을 위한 사주와 별자리 분석 결과를 매일 텔레그램으로 보내드립니다.
            오늘의 운세, 행운의 방향, 그리고 주의해야 할 점을 확인하세요.
          </p>
        </motion.div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl px-4">
          
          {/* New User Card */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="glass-panel p-8 rounded-2xl flex flex-col items-center text-center space-y-6 group hover:border-primary/40 transition-colors"
          >
            <div className="p-4 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="text-2xl font-serif text-white mb-2">처음 오셨나요?</h3>
              <p className="text-muted-foreground text-sm">
                태어난 정보를 등록하고 개인 맞춤형 운세 서비스를 시작하세요.
              </p>
            </div>
            <Button 
              className="w-full mt-auto" 
              variant="mystical" 
              size="lg"
              onClick={() => setLocation("/register")}
            >
              여정 시작하기 <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </motion.div>

          {/* Returning User Card */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="glass-panel p-8 rounded-2xl flex flex-col items-center text-center space-y-6 group hover:border-primary/40 transition-colors"
          >
            <div className="p-4 rounded-full bg-secondary/50 group-hover:bg-secondary/70 transition-colors border border-white/10">
              <Moon className="w-8 h-8 text-amber-200" />
            </div>
            <div>
              <h3 className="text-2xl font-serif text-white mb-2">다시 오셨나요?</h3>
              <p className="text-muted-foreground text-sm">
                가입 시 사용한 텔레그램 @username을 입력하세요.
              </p>
            </div>
            <form onSubmit={handleLogin} className="w-full mt-auto flex gap-2">
              <Input 
                placeholder="@username" 
                value={telegramIdInput}
                onChange={(e) => setTelegramIdInput(e.target.value)}
                className="bg-black/20 border-white/10 focus:border-primary/50 text-white placeholder:text-white/20"
                data-testid="input-telegram-id"
              />
              <Button type="submit" variant="secondary">
                이동
              </Button>
            </form>
          </motion.div>

        </div>
        
      </div>
    </Layout>
  );
}
