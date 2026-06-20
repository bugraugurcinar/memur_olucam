/** Seviye ilerlemesini gösteren dairesel halka (amber rol rengi). Sunum bileşeni. */
export function LevelRing({
  level,
  progress,
  size = 46,
  stroke = 4,
}: {
  level: number;
  progress: number;
  size?: number;
  stroke?: number;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const offset = circumference * (1 - clamped);
  const center = size / 2;

  return (
    <span className="level-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          className="level-ring__track"
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          className="level-ring__fill"
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <strong className="level-ring__label">{level}</strong>
    </span>
  );
}
