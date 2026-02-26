import { ScissorsIcon, CombIcon, HairDryerIcon, RazorIcon, BarberPoleIcon, MirrorIcon } from "@/components/icons/SalonIcons";

type Variant = "hero" | "subtle" | "auth";

const iconComponents = [ScissorsIcon, CombIcon, HairDryerIcon, RazorIcon, BarberPoleIcon, MirrorIcon];

interface Position {
  icon: number;
  top: string;
  left: string;
  rotate: string;
  size: string;
  opacity: string;
}

const heroPositions: Position[] = [
  { icon: 0, top: "10%", left: "5%", rotate: "-15deg", size: "w-12 h-12", opacity: "opacity-[0.08]" },
  { icon: 1, top: "20%", left: "85%", rotate: "25deg", size: "w-10 h-10", opacity: "opacity-[0.07]" },
  { icon: 2, top: "60%", left: "8%", rotate: "10deg", size: "w-14 h-14", opacity: "opacity-[0.06]" },
  { icon: 3, top: "75%", left: "90%", rotate: "-20deg", size: "w-10 h-10", opacity: "opacity-[0.08]" },
  { icon: 4, top: "40%", left: "92%", rotate: "15deg", size: "w-8 h-8", opacity: "opacity-[0.07]" },
  { icon: 5, top: "85%", left: "15%", rotate: "30deg", size: "w-8 h-8", opacity: "opacity-[0.06]" },
  { icon: 0, top: "5%", left: "45%", rotate: "45deg", size: "w-6 h-6", opacity: "opacity-[0.05]" },
  { icon: 1, top: "90%", left: "55%", rotate: "-10deg", size: "w-8 h-8", opacity: "opacity-[0.06]" },
];

const subtlePositions: Position[] = [
  { icon: 0, top: "15%", left: "5%", rotate: "-15deg", size: "w-8 h-8", opacity: "opacity-[0.05]" },
  { icon: 1, top: "50%", left: "92%", rotate: "20deg", size: "w-8 h-8", opacity: "opacity-[0.05]" },
  { icon: 4, top: "80%", left: "10%", rotate: "10deg", size: "w-6 h-6", opacity: "opacity-[0.04]" },
];

const authPositions: Position[] = [
  { icon: 0, top: "8%", left: "15%", rotate: "-15deg", size: "w-14 h-14", opacity: "opacity-20" },
  { icon: 1, top: "25%", left: "65%", rotate: "25deg", size: "w-12 h-12", opacity: "opacity-15" },
  { icon: 2, top: "45%", left: "20%", rotate: "10deg", size: "w-10 h-10", opacity: "opacity-15" },
  { icon: 4, top: "65%", left: "70%", rotate: "-20deg", size: "w-14 h-14", opacity: "opacity-20" },
  { icon: 5, top: "82%", left: "30%", rotate: "30deg", size: "w-10 h-10", opacity: "opacity-15" },
  { icon: 3, top: "15%", left: "80%", rotate: "45deg", size: "w-8 h-8", opacity: "opacity-10" },
  { icon: 0, top: "55%", left: "45%", rotate: "-30deg", size: "w-8 h-8", opacity: "opacity-10" },
  { icon: 1, top: "90%", left: "60%", rotate: "15deg", size: "w-12 h-12", opacity: "opacity-15" },
];

const positionMap: Record<Variant, Position[]> = {
  hero: heroPositions,
  subtle: subtlePositions,
  auth: authPositions,
};

export default function SalonBackground({ variant = "subtle" }: { variant?: Variant }) {
  const positions = positionMap[variant];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {positions.map((pos, i) => {
        const Icon = iconComponents[pos.icon];
        return (
          <div
            key={i}
            className={`absolute ${pos.opacity}`}
            style={{
              top: pos.top,
              left: pos.left,
              transform: `rotate(${pos.rotate})`,
            }}
          >
            <Icon className={pos.size} />
          </div>
        );
      })}
    </div>
  );
}
