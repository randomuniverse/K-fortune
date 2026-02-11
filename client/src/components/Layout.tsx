import { StarField } from "./StarField";
import { Sparkles, Settings } from "lucide-react";
import { Link } from "wouter";

interface LayoutProps {
  children: React.ReactNode;
  telegramId?: string;
}

export function Layout({ children, telegramId }: LayoutProps) {
  return (
    <div className="min-h-screen text-foreground relative overflow-hidden flex flex-col">
      <StarField />
      
      <header className="w-full py-6 px-4 border-b border-white/5 bg-background/50 backdrop-blur-sm z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="p-2 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors">
              <Sparkles className="w-6 h-6 text-primary animate-pulse" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary via-amber-200 to-primary text-glow">
              천상의 운세
            </h1>
          </Link>
          {telegramId && (
            <nav>
              <Link href={`/settings/${telegramId}`} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors" data-testid="link-settings">
                <Settings className="w-4 h-4" />
                설정
              </Link>
            </nav>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 md:py-12 flex flex-col relative z-10">
        {children}
      </main>

      <footer className="py-8 text-center text-muted-foreground text-sm border-t border-white/5 bg-background/50 backdrop-blur-sm">
        <p>© {new Date().getFullYear()} 천상의 운세. 당신의 운명이 기다립니다.</p>
      </footer>
    </div>
  );
}
