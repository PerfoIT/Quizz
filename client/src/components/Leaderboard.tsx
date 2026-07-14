import type { LeaderboardEntry } from "../lib/types";

type Props = {
  entries: LeaderboardEntry[];
  compact?: boolean;
  maxEntries?: number;
};

export function Leaderboard({ entries, compact = false, maxEntries }: Props) {
  if (entries.length === 0) {
    return <div className="rounded-lg border border-white/10 bg-white/5 p-5 text-slate-300">Aucun participant pour le moment.</div>;
  }

  const visibleEntries = entries.slice(0, maxEntries ?? (compact ? 5 : entries.length));

  return (
    <div className="space-y-3">
      {visibleEntries.map((entry) => (
        <div
          key={`${entry.rank}-${entry.name}`}
          className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-white/10 font-bold text-perfo-cyan">
              {entry.rank}
            </div>
            <div className="font-semibold">{entry.name}</div>
          </div>
          <div className="font-mono text-lg font-bold">{entry.score}</div>
        </div>
      ))}
    </div>
  );
}
