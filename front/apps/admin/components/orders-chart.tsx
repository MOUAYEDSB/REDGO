"use client";

type Point = { label: string; value: number };

export function OrdersChart({ points }: { points: Point[] }) {
  const max = Math.max(1, ...points.map((point) => point.value));
  const width = 640;
  const height = 180;
  const pad = 16;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const coords = points.map((point, index) => {
    const x = pad + (points.length <= 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
    const y = pad + innerH - (point.value / max) * innerH;
    return `${x},${y}`;
  });

  if (points.length === 0) {
    return <p className="p-6 text-sm text-[#A1A1AA]">Aucune commande sur la période sélectionnée.</p>;
  }

  return (
    <div className="p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" role="img" aria-label="Évolution des commandes">
        <polyline fill="none" stroke="#FF2638" strokeWidth="3" points={coords.join(" ")} />
        {points.map((point, index) => {
          const [x, y] = coords[index].split(",");
          return <circle key={point.label} cx={x} cy={y} r="3.5" fill="#fff" stroke="#FF2638" strokeWidth="2" />;
        })}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-[#71717A]">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}
