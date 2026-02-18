"use client";

interface BarChartProps {
  data: { label: string; value: number }[];
  maxHeight?: number;
  color?: string;
}

export default function BarChart({
  data,
  maxHeight = 160,
  color = "bg-primary-500",
}: BarChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-dark-400 text-center py-8">No data available</p>;
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex items-end gap-1" style={{ height: maxHeight }}>
      {data.map((item, i) => {
        const height = (item.value / maxValue) * maxHeight;
        return (
          <div
            key={i}
            className="flex-1 flex flex-col items-center justify-end group"
            style={{ height: maxHeight }}
          >
            {/* Value tooltip on hover */}
            <div className="opacity-0 group-hover:opacity-100 transition text-xs text-dark-600 font-medium mb-1">
              {item.value}
            </div>
            {/* Bar */}
            <div
              className={`w-full ${color} rounded-t transition-all`}
              style={{ height: Math.max(height, 2) }}
            />
            {/* Label */}
            <div className="text-[10px] text-dark-400 mt-1 truncate w-full text-center">
              {item.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
