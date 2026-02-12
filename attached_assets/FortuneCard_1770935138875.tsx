import { type Fortune } from "@shared/schema";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Sparkles, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { ko } from "date-fns/locale";
import { useState } from "react";

interface FortuneCardProps {
  fortune: Fortune;
  index: number;
}

// Telegram HTML 포맷을 깔끔한 텍스트로 변환
function cleanTelegramContent(content: string): {
  title: string;
  sections: { label: string; text: string }[];
} {
  // HTML 태그 제거하고 구조화
  const clean = content
    .replace(/<b>/g, "")
    .replace(/<\/b>/g, "")
    .replace(/<i>/g, "")
    .replace(/<\/i>/g, "")
    .trim();

  const lines = clean.split("\n").filter((l) => l.trim());

  let title = "";
  const sections: { label: string; text: string }[] = [];
  let currentLabel = "";
  let currentText: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // 제목줄
    if (trimmed.startsWith("[오늘의 운세]")) {
      title = trimmed.replace("[오늘의 운세] ", "");
      continue;
    }

    // 섹션 헤더 (-- 로 시작)
    if (trimmed.startsWith("--")) {
      if (currentLabel && currentText.length > 0) {
        sections.push({ label: currentLabel, text: currentText.join("\n") });
      }
      currentLabel = trimmed.replace(/^--\s*/, "").replace(/:$/, "");
      currentText = [];
      continue;
    }

    // 이름줄 스킵
    if (trimmed.includes("님") && trimmed.includes("(") && lines.indexOf(line) < 3) {
      continue;
    }

    // 내용 수집
    if (currentLabel) {
      currentText.push(trimmed);
    }
  }

  // 마지막 섹션 추가
  if (currentLabel && currentText.length > 0) {
    sections.push({ label: currentLabel, text: currentText.join("\n") });
  }

  return { title, sections };
}

export function FortuneCard({ fortune, index }: FortuneCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { title, sections } = cleanTelegramContent(fortune.content);

  // fortuneData에서 점수 추출
  let score: number | null = null;
  if (fortune.fortuneData) {
    try {
      const data = JSON.parse(fortune.fortuneData);
      score = data.combinedScore;
    } catch {}
  }

  const scoreColor =
    score !== null
      ? score >= 80
        ? "text-amber-300"
        : score >= 60
        ? "text-primary"
        : score >= 40
        ? "text-orange-400"
        : "text-red-400"
      : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="glass-panel rounded-xl relative group overflow-hidden mystical-border"
      data-testid={`card-fortune-${fortune.id}`}
    >
      {/* 헤더 (항상 보임) */}
      <div
        className="p-5 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm text-muted-foreground">
              {format(
                new Date(fortune.createdAt || new Date()),
                "yyyy년 MM월 dd일 (EEE)",
                { locale: ko }
              )}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {score !== null && (
              <span className={`text-lg font-bold ${scoreColor}`}>
                {score}점
              </span>
            )}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {/* 펼쳐진 내용 */}
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="px-5 pb-5 space-y-3 border-t border-white/5 pt-4"
        >
          {sections.map((section, i) => (
            <div key={i}>
              <p className="text-xs font-medium text-primary/80 mb-1">
                {section.label}
              </p>
              <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">
                {section.text}
              </p>
            </div>
          ))}
        </motion.div>
      )}

      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
    </motion.div>
  );
}
