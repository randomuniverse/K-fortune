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
    if (telegramIdInput.trim()) {
      setLocation(`/dashboard/${telegramIdInput.trim()}`);
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
            <span className="text-sm font-medium tracking-wide">Daily Cosmic Guidance</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-serif font-bold leading-tight">
            Unlock the <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-primary to-amber-500 text-glow">
              Wisdom of Stars
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Your personal Saju and Zodiac analysis delivered daily via Telegram. 
            Discover your fortune, lucky directions, and daily warnings.
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
              <h3 className="text-2xl font-serif text-white mb-2">New Traveler?</h3>
              <p className="text-muted-foreground text-sm">
                Register your birth details to begin receiving personalized daily insights.
              </p>
            </div>
            <Button 
              className="w-full mt-auto" 
              variant="mystical" 
              size="lg"
              onClick={() => setLocation("/register")}
            >
              Begin Journey <ArrowRight className="ml-2 w-4 h-4" />
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
              <h3 className="text-2xl font-serif text-white mb-2">Returning?</h3>
              <p className="text-muted-foreground text-sm">
                Enter your Telegram ID to view your dashboard and history.
              </p>
            </div>
            <form onSubmit={handleLogin} className="w-full mt-auto flex gap-2">
              <Input 
                placeholder="Telegram Username" 
                value={telegramIdInput}
                onChange={(e) => setTelegramIdInput(e.target.value)}
                className="bg-black/20 border-white/10 focus:border-primary/50 text-white placeholder:text-white/20"
              />
              <Button type="submit" variant="secondary">
                Go
              </Button>
            </form>
          </motion.div>

        </div>
        
      </div>
    </Layout>
  );
}
