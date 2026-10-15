export function StatBar({ label, value, hidden }: { label: string; value: number; hidden?: boolean }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span>{label}</span>
        <span>{hidden ? '???' : `${Math.round(value)}%`}</span>
      </div>
      <div className="h-2 bg-stone-200 rounded">
        <div
          className="h-full bg-stone-800 rounded"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}