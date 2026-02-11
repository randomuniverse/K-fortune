import { Card } from "@/components/ui/card";
import type { ZodiacInfo } from "@shared/schema";

interface Props {
  info: ZodiacInfo;
}

function InfoItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={`text-xs font-medium ${color || "text-white/90"}`}>{value}</span>
    </div>
  );
}

export function ZodiacInfoCard({ info }: Props) {
  const elementColors: Record<string, string> = {
    "불": "text-red-400",
    "흙": "text-amber-400",
    "공기": "text-sky-300",
    "물": "text-blue-400",
  };

  return (
    <Card className="bg-white/[0.03] border-white/10 p-5 space-y-4" data-testid="zodiac-info-card">
      <div className="text-center space-y-1">
        <h4 className="text-sm font-serif text-primary" data-testid="text-zodiac-title">별자리 정보</h4>
        <p className="text-lg font-bold text-white">{info.sign}</p>
        <p className="text-xs text-muted-foreground">{info.signEn} / {info.dateRange}</p>
      </div>

      <div className="space-y-0">
        <InfoItem label="주관 행성" value={`${info.rulingPlanet} (${info.rulingPlanetEn})`} />
        <InfoItem label="원소" value={`${info.element} (${info.elementEn})`} color={elementColors[info.element]} />
        <InfoItem label="궁합 유형" value={`${info.quality} (${info.qualityEn})`} />
        <InfoItem label="궁합 별자리" value={info.compatibleSigns.join(", ")} />
      </div>

      <div>
        <p className="text-[11px] text-muted-foreground mb-1.5">핵심 특성</p>
        <div className="flex flex-wrap gap-1.5">
          {info.traits.map(trait => (
            <span key={trait} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary/80 border border-primary/20">
              {trait}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white/[0.03] rounded-lg p-3 space-y-2">
        <p className="text-[11px] text-muted-foreground">행성 특성</p>
        <p className="text-xs text-white/80 leading-relaxed">
          {info.rulingPlanet === "수성" && `${info.rulingPlanet}(Mercury)은 소통과 지성을 관장합니다. ${info.sign}에게 빠른 사고력과 뛰어난 언어 능력을 부여하며, 정보를 분석하고 전달하는 데 탁월한 재능을 줍니다.`}
          {info.rulingPlanet === "금성" && `${info.rulingPlanet}(Venus)은 사랑과 아름다움을 관장합니다. ${info.sign}에게 조화로운 미적 감각과 풍요로운 감성을 부여합니다.`}
          {info.rulingPlanet === "화성" && `${info.rulingPlanet}(Mars)은 에너지와 행동력을 관장합니다. ${info.sign}에게 강한 추진력과 도전 정신을 부여합니다.`}
          {info.rulingPlanet === "목성" && `${info.rulingPlanet}(Jupiter)은 확장과 행운을 관장합니다. ${info.sign}에게 넓은 시야와 낙관적 기질을 부여합니다.`}
          {info.rulingPlanet === "토성" && `${info.rulingPlanet}(Saturn)은 규율과 책임을 관장합니다. ${info.sign}에게 인내심과 실용적 지혜를 부여합니다.`}
          {info.rulingPlanet === "천왕성" && `${info.rulingPlanet}(Uranus)은 혁신과 변화를 관장합니다. ${info.sign}에게 독창적 사고와 진보적 가치관을 부여합니다.`}
          {info.rulingPlanet === "해왕성" && `${info.rulingPlanet}(Neptune)은 직감과 영감을 관장합니다. ${info.sign}에게 풍부한 상상력과 공감 능력을 부여합니다.`}
          {info.rulingPlanet === "명왕성" && `${info.rulingPlanet}(Pluto)은 변환과 재생을 관장합니다. ${info.sign}에게 깊은 통찰력과 강인한 의지를 부여합니다.`}
          {info.rulingPlanet === "태양" && `${info.rulingPlanet}(Sun)은 자아와 생명력을 관장합니다. ${info.sign}에게 카리스마와 창조적 에너지를 부여합니다.`}
          {info.rulingPlanet === "달" && `${info.rulingPlanet}(Moon)은 감정과 본능을 관장합니다. ${info.sign}에게 깊은 감수성과 보호 본능을 부여합니다.`}
        </p>
      </div>
    </Card>
  );
}
