export interface KpiMetric {
  label: string;
  value: string;
  subtext: string;
  tone?: 'default' | 'brand' | 'warning' | 'danger' | 'positive';
}

interface KpiStripProps {
  metrics: KpiMetric[];
}

export function KpiStrip({ metrics }: KpiStripProps) {
  return (
    <section
      aria-label="Key workforce metrics"
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4"
    >
      {metrics.map((metric) => {
        const valueColor =
          metric.tone === 'danger'
            ? 'text-red-600 dark:text-red-400'
            : metric.tone === 'warning'
              ? 'text-[#D96B0C] dark:text-[#F58220]'
              : metric.tone === 'positive'
                ? 'text-emerald-700 dark:text-emerald-400'
                : metric.tone === 'brand'
                  ? 'text-neutral-950 dark:text-[#FFC800]'
                  : 'text-neutral-950 dark:text-neutral-50';

        return (
          <div
            key={metric.label}
            className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 sm:p-5 flex flex-col justify-between gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {metric.label}
              </span>
              {metric.tone === 'brand' && (
                <span
                  className="inline-block h-1.5 w-4 rounded-xs bg-[#FFC800]"
                  aria-hidden="true"
                />
              )}
              {metric.tone === 'warning' && (
                <span
                  className="inline-block h-1.5 w-4 rounded-xs bg-[#F58220]"
                  aria-hidden="true"
                />
              )}
            </div>
            <div
              className={`font-mono text-2xl sm:text-[26px] font-semibold tracking-tight tabular-nums leading-none ${valueColor}`}
            >
              {metric.value}
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums truncate">
              {metric.subtext}
            </p>
          </div>
        );
      })}
    </section>
  );
}
