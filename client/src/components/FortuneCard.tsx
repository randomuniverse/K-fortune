import { type Fortune } from "@shared/schema";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Sparkles, Calendar } from "lucide-react";
import { ko } from "date-fns/locale";

interface FortuneCardProps {
  fortune: Fortune;
  index: number;
}

export function FortuneCard({ fortune, index }: FortuneCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className="glass-panel rounded-xl p-6 relative group overflow-hidden mystical-border"
      data-testid={`card-fortune-${fortune.id}`}
    >
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <Sparkles className="w-24 h-24 text-primary" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4 text-muted-foreground text-sm">
          <Calendar className="w-4 h-4 text-primary" />
          <span>{format(new Date(fortune.createdAt || new Date()), "yyyy년 MM월 dd일 a h:mm", { locale: ko })}</span>
        </div>
        
        <div className="prose prose-invert prose-p:text-lg prose-p:leading-relaxed text-foreground/90 max-w-none">
          <p className="whitespace-pre-line font-medium">{fortune.content}</p>
        </div>
      </div>

      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
    </motion.div>
  );
}
