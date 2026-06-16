import type {CheckinRow} from '@/lib/db/repositories/checkins';

export type CheckinWeeklySummary = {
  days_with_checkin: number;
  avg_energy: number | null;
  avg_mood: number | null;
  avg_focus: number | null;
  avg_momentum: number | null;
  low_energy_days: number;
  negative_mood_days: number;
  top_tags: string[];
  energy_by_day: Array<{date: string; energy: number | null; mood: number | null; tag: string | null}>;
};

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export function summarizeCheckinsForWeek(rows: CheckinRow[]): CheckinWeeklySummary | null {
  if (rows.length === 0) return null;

  const energies = rows.map((r) => r.energy_score).filter((v): v is number => v != null);
  const moods = rows.map((r) => r.state_score).filter((v): v is number => v != null);
  const focuses = rows.map((r) => r.focus_score).filter((v): v is number => v != null);
  const momenta = rows.map((r) => r.momentum).filter((v): v is number => v != null);

  const tagCounts = new Map<string, number>();
  for (const row of rows) {
    if (row.primary_tag?.trim()) {
      const tag = row.primary_tag.trim();
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const top_tags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);

  const energy_by_day = rows.map((r) => ({
    date: r.date,
    energy: r.energy_score,
    mood: r.state_score,
    tag: r.primary_tag?.trim() || null,
  }));

  return {
    days_with_checkin: rows.length,
    avg_energy: avg(energies),
    avg_mood: avg(moods),
    avg_focus: avg(focuses),
    avg_momentum: avg(momenta),
    low_energy_days: energies.filter((e) => e <= 3).length,
    negative_mood_days: moods.filter((m) => m <= 4).length,
    top_tags,
    energy_by_day,
  };
}
