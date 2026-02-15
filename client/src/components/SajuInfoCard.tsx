import { Card } from "@/components/ui/card";
import type { SajuChart } from "@shared/saju";

interface Props {
  chart: SajuChart;
  birthDate: string;
  birthTime: string;
  userName: string;
}

function PillarCell({ label, stemHanja, branchHanja, tenGodTop, tenGodBottom, isDay }: {
  label: string;
  stemHanja: string;
  branchHanja: string;
  tenGodTop: string;
  tenGodBottom: string;
  isDay?: boolean;
}) {
  const stemColors: Record<string, string> = {
    "甲": "bg-green-600/80", "乙": "bg-green-500/70",
    "丙": "bg-red-500/80", "丁": "bg-red-400/70",
    "戊": "bg-amber-600/80", "己": "bg-amber-500/70",
    "庚": "bg-slate-400/80", "辛": "bg-slate-300/70",
    "壬": "bg-blue-600/80", "癸": "bg-blue-400/70",
  };
  const branchColors: Record<string, string> = {
    "子": "bg-blue-500/70", "丑": "bg-amber-600/70",
    "寅": "bg-green-600/70", "卯": "bg-green-500/70",
    "辰": "bg-amber-500/70", "巳": "bg-red-500/70",
    "午": "bg-red-400/70", "未": "bg-amber-400/70",
    "申": "bg-slate-400/70", "酉": "bg-slate-300/70",
    "戌": "bg-amber-700/70", "亥": "bg-blue-400/70",
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
      <span className="text-[10px] text-muted-foreground/70">{tenGodTop}</span>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold ${stemColors[stemHanja] || "bg-gray-500/70"} ${isDay ? "ring-2 ring-primary/50" : ""}`}>
        {stemHanja}
      </div>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold ${branchColors[branchHanja] || "bg-gray-500/70"}`}>
        {branchHanja}
      </div>
      <span className="text-[10px] text-muted-foreground/70">{tenGodBottom}</span>
    </div>
  );
}

export function SajuInfoCard({ chart, birthDate, birthTime, userName }: Props) {
  const [yearStr] = birthDate.split("-");
  const birthYear = parseInt(yearStr);

  const elementColors: Record<string, string> = {
    "목": "text-green-400",
    "화": "text-red-400",
    "토": "text-amber-400",
    "금": "text-slate-300",
    "수": "text-blue-400",
  };

  const topElements = chart.fiveElementRatios
    .filter(e => e.ratio > 0)
    .sort((a, b) => b.ratio - a.ratio);

  const dayElementName = ["목", "화", "토", "금", "수"][
    [0, 1, 2, 3, 4].find(i => {
      const stems = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
      const elMap = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
      return elMap[stems.indexOf(chart.dayPillar.stem)] === i;
    }) ?? 0
  ];

  return (
    <Card className="bg-white/[0.03] border-white/10 p-5 space-y-4" data-testid="saju-info-card">
      <div className="text-center space-y-1">
        <h4 className="text-sm font-serif text-primary" data-testid="text-saju-title">사주 팔자</h4>
        <p className="text-xs text-muted-foreground">
          양력 {(() => { const [y, m, d] = birthDate.split("-"); return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`; })()} {birthTime}생
          {" · "}{chart.chineseZodiac}띠 ({chart.chineseZodiacBranch})
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex justify-center gap-5 py-3 px-4 rounded-xl bg-white/[0.02] border border-white/5 md:shrink-0">
          <PillarCell
            label="時" stemHanja={chart.hourPillar.stemHanja} branchHanja={chart.hourPillar.branchHanja}
            tenGodTop={chart.hourTenGod.name} tenGodBottom={chart.hourBranchTenGod.name}
          />
          <PillarCell
            label="日" stemHanja={chart.dayPillar.stemHanja} branchHanja={chart.dayPillar.branchHanja}
            tenGodTop="일간" tenGodBottom={chart.dayBranchTenGod.name} isDay
          />
          <PillarCell
            label="月" stemHanja={chart.monthPillar.stemHanja} branchHanja={chart.monthPillar.branchHanja}
            tenGodTop={chart.monthTenGod.name} tenGodBottom={chart.monthBranchTenGod.name}
          />
          <PillarCell
            label="年" stemHanja={chart.yearPillar.stemHanja} branchHanja={chart.yearPillar.branchHanja}
            tenGodTop={chart.yearTenGod.name} tenGodBottom={chart.yearBranchTenGod.name}
          />
        </div>

        <div className="flex-1 space-y-3">
          <div>
            <h5 className="text-xs font-medium text-muted-foreground mb-2">오행 분포</h5>
            <div className="space-y-1.5">
              {topElements.map(e => (
                <div key={e.element} className="flex items-center gap-2">
                  <span className={`text-xs w-8 font-medium ${elementColors[e.element] || "text-white"}`}>
                    {e.elementHanja} {e.element}
                  </span>
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        e.element === "목" ? "bg-green-500" :
                        e.element === "화" ? "bg-red-500" :
                        e.element === "토" ? "bg-amber-500" :
                        e.element === "금" ? "bg-slate-400" :
                        "bg-blue-500"
                      }`}
                      style={{ width: `${e.ratio}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground w-12 text-right">{e.ratio}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 bg-white/[0.03] rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground mb-0.5">일간 강약</p>
              <p className="text-sm font-medium text-white" data-testid="text-day-master-strength">{chart.dayMasterStrength}</p>
            </div>
            <div className="flex-1 bg-white/[0.03] rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground mb-0.5">용신</p>
              <p className={`text-sm font-medium ${elementColors[chart.yongShin.element] || "text-white"}`} data-testid="text-yongshin">
                {chart.yongShin.elementHanja} {chart.yongShin.element}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h5 className="text-xs font-medium text-muted-foreground mb-2">대운 주기</h5>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {chart.daeun.map(d => {
            const isCurrent = d.year <= new Date().getFullYear() && d.year + 10 > new Date().getFullYear();
            return (
              <div key={d.age} className={`text-center ${isCurrent ? "text-primary" : "text-muted-foreground"}`}>
                <p className="text-[10px]">{d.year}</p>
                <p className={`text-xs font-medium ${isCurrent ? "text-primary font-bold" : ""}`}>{d.age}세</p>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
