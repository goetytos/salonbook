"use client";

interface BarChartProps {
  data: { label: string; value: number }[];
  maxHeight?: number;
  color?: string;
  ariaLabel?: string;
}

export default function BarChart({
  data,
  maxHeight = 160,
  color = "bg-primary-500",
  ariaLabel = "Bar chart",
}: BarChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-dark-400 text-center py-8" role="status">No data available</p>;
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <figure>
      <figcaption className="sr-only">{ariaLabel}</figcaption>
      <div className="flex items-end gap-1" style={{ height: maxHeight }} aria-hidden="true">
        {data.map((item, i) => {
          const height = (item.value / maxValue) * maxHeight;
          return (
            <div
              key={`${item.label}-${i}`}
              className="flex-1 flex flex-col items-center justify-end group"
              style={{ height: maxHeight }}
            >
              <div className="opacity-0 group-hover:opacity-100 transition text-xs text-dark-600 font-medium mb-1">
                {item.value}
              </div>
              <div
                className={`w-full ${color} rounded-t transition-all motion-reduce:transition-none`}
                style={{ height: Math.max(height, 2) }}
              />
              <div className="text-xs text-dark-400 mt-1 truncate w-full text-center">
                {item.label}
              </div>
            </div>
          );
        })}
      </div>
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Label</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={`${item.label}-${index}`}>
              <th scope="row">{item.label}</th>
              <td>{item.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
