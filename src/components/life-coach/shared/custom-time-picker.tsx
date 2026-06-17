'use client';

import {useTranslations} from 'next-intl';

/**
 * Friendly visual time picker that avoids the inconsistent native <input type="time">
 * experience across browsers. Stores/returns a 24-hour "HH:MM" string so it stays
 * compatible with everything that consumed the old native input.
 */
export function CustomTimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const t = useTranslations('healthWizard');

  const [hourStr = '', minuteStr = ''] = value.split(':');
  const hour24 = hourStr === '' ? null : Number(hourStr);
  const minute = minuteStr === '' ? 0 : Number(minuteStr);

  const period: 'am' | 'pm' = hour24 === null ? 'am' : hour24 >= 12 ? 'pm' : 'am';
  const hour12 = hour24 === null ? 9 : hour24 % 12 === 0 ? 12 : hour24 % 12;

  function emit(nextHour12: number, nextMinute: number, nextPeriod: 'am' | 'pm') {
    let h = nextHour12 % 12;
    if (nextPeriod === 'pm') h += 12;
    onChange(`${String(h).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-2xl border border-[color:var(--color-border)] fill-1 p-1.5">
        <select
          className="focus-ring rounded-xl bg-transparent px-3 py-2 text-lg font-bold txt-strong outline-none [&>option]:bg-[#0b1220]"
          value={hour12}
          onChange={(e) => emit(Number(e.target.value), minute, period)}
          aria-label={t('pickerHour')}
        >
          {Array.from({length: 12}, (_, i) => i + 1).map((h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, '0')}
            </option>
          ))}
        </select>
        <span className="text-lg font-black txt-muted">:</span>
        <select
          className="focus-ring rounded-xl bg-transparent px-3 py-2 text-lg font-bold txt-strong outline-none [&>option]:bg-[#0b1220]"
          value={minute}
          onChange={(e) => emit(hour12, Number(e.target.value), period)}
          aria-label={t('pickerMinute')}
        >
          {Array.from({length: 12}, (_, i) => i * 5).map((m) => (
            <option key={m} value={m}>
              {String(m).padStart(2, '0')}
            </option>
          ))}
        </select>
      </div>

      <div className="inline-flex rounded-2xl border border-[color:var(--color-border)] fill-1 p-1">
        {(['am', 'pm'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => emit(hour12, minute, p)}
            aria-pressed={period === p}
            className={`focus-ring rounded-xl px-4 py-2 text-sm font-bold transition ${
              period === p ? 'bg-[var(--blue)] text-white' : 'txt-soft hover:txt-strong'
            }`}
          >
            {t(`picker_${p}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
