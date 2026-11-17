import { useMemo } from 'react';
import { AlertTriangle, ArrowUpRight, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import type { ScoredEmployee } from '../types/hr';
import {
  formatGbp,
  formatTravelLabel,
  generateInsights,
  generateRecommendedActions,
} from '../utils/csvParser';

interface InsightsViewProps {
  employees: ScoredEmployee[];
}

const SCORING_RULES = [
  {
    factor: 'Promotion Stagnation',
    weight: '25 pts max',
    criteria: '≥5 yrs since promotion (+25) · 3–4 yrs (+15) · 2 yrs (+8)',
  },
  {
    factor: 'Business Travel Intensity',
    weight: '20 pts max',
    criteria: 'Travel Frequently (+20) · Travel Rarely (+8) · Non-Travel (0)',
  },
  {
    factor: 'Commute Distance',
    weight: '15 pts max',
    criteria: '≥30 km from site (+15) · 15–29 km (+8)',
  },
  {
    factor: 'Early / Transition Tenure',
    weight: '15 pts max',
    criteria: '≤2 yrs at Shell (+15) · 3–5 yrs (+8)',
  },
  {
    factor: 'Manager & Role Continuity',
    weight: '15 pts max',
    criteria: '≤1 yr with current manager (+10) · ≥5 yrs in current role (+5)',
  },
  {
    factor: 'Pay vs Job Level Median',
    weight: '10 pts max',
    criteria: '>10% below Level peer median (+10) · Below Level median (+5)',
  },
];

export function InsightsView({ employees }: InsightsViewProps) {
  const insights = useMemo(() => generateInsights(employees), [employees]);
  const actions = useMemo(
    () => generateRecommendedActions(employees),
    [employees]
  );

  // Top-10 Active Flight-Risk Watchlist
  const watchlist = useMemo(() => {
    return employees
      .filter((e) => e.attrition === 'No')
      .sort(
        (a, b) =>
          b.flightRiskScore - a.flightRiskScore ||
          b.yearsSinceLastPromotion - a.yearsSinceLastPromotion
      )
      .slice(0, 10);
  }, [employees]);

  if (employees.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-10 text-center">
        <p className="text-base font-medium text-neutral-900 dark:text-neutral-100">
          No employees match the current filters
        </p>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Reset or adjust the filters above to generate live insights and the flight-risk watchlist.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Auto-generated findings */}
      <section aria-label="Automated workforce findings">
        <div className="mb-3 flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
          <h2 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
            Automated Workforce Findings
          </h2>
          <span className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
            Computed dynamically across {employees.length} filtered records
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {insights.map((item) => {
            const Icon =
              item.severity === 'critical'
                ? ShieldAlert
                : item.severity === 'warning'
                  ? AlertTriangle
                  : item.severity === 'positive'
                    ? CheckCircle2
                    : Info;

            const iconColor =
              item.severity === 'critical'
                ? 'text-red-600 dark:text-red-400'
                : item.severity === 'warning'
                  ? 'text-[#D96B0C] dark:text-[#F58220]'
                  : item.severity === 'positive'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-neutral-500 dark:text-neutral-400';

            return (
              <article
                key={item.id}
                className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <Icon className={`w-3.5 h-3.5 ${iconColor}`} aria-hidden="true" />
                      {item.category}
                    </span>
                    <span className="font-mono tabular-nums font-medium text-neutral-800 dark:text-neutral-200">
                      {item.metric}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 leading-snug">
                    {item.headline}
                  </h3>
                  <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                    {item.detail}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Top-10 Flight-Risk Watchlist & Transparent Scoring Rule */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        <section
          aria-label="Top 10 flight risk watchlist"
          className="xl:col-span-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden"
        >
          <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">
                Top-10 Active Flight-Risk Watchlist
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Active employees ranked by composite retention risk score (0–100)
              </p>
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 font-mono tabular-nums">
              High ≥60 · Elevated 40–59 · Low &lt;40
            </div>
          </div>

          {watchlist.length === 0 ? (
            <div className="p-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
              No active employees in the current filter selection. Switch Attrition filter to All Staff or Active Only to view the retention watchlist.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/60 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    <th className="py-2.5 px-4">#</th>
                    <th className="py-2.5 px-4">Employee</th>
                    <th className="py-2.5 px-4">Department & Site</th>
                    <th className="py-2.5 px-4 text-right">Pay / Lvl</th>
                    <th className="py-2.5 px-4">Primary Risk Drivers</th>
                    <th className="py-2.5 px-4 text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {watchlist.map((emp, idx) => {
                    const tierColor =
                      emp.riskTier === 'High'
                        ? 'text-red-600 dark:text-red-400'
                        : emp.riskTier === 'Elevated'
                          ? 'text-[#D96B0C] dark:text-[#F58220]'
                          : 'text-neutral-600 dark:text-neutral-400';

                    return (
                      <tr
                        key={emp.employeeId}
                        className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
                          {String(idx + 1).padStart(2, '0')}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-neutral-950 dark:text-neutral-100 whitespace-nowrap">
                            {emp.fullName}
                          </div>
                          <div className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                            {emp.employeeId} · {emp.jobTitle}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-xs font-medium text-neutral-800 dark:text-neutral-200 whitespace-nowrap">
                            {emp.department}
                          </div>
                          <div className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                            {emp.location} · {formatTravelLabel(emp.businessTravel)}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                          <div className="text-neutral-900 dark:text-neutral-100">
                            {formatGbp(emp.monthlyIncomeGbp)}
                          </div>
                          <div className="text-neutral-500 dark:text-neutral-400">
                            L{emp.jobLevel} · {emp.yearsAtCompany}y
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-neutral-600 dark:text-neutral-300 max-w-xs">
                          {emp.riskFactors
                            .slice(0, 3)
                            .map((f) => `${f.detail} (+${f.points})`)
                            .join(' · ')}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums whitespace-nowrap ${tierColor}`}
                        >
                          {emp.flightRiskScore}/100
                          <div className="text-[11px] font-normal">
                            {emp.riskTier}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Transparent Scoring Rule */}
        <aside
          aria-label="Flight-risk scoring methodology"
          className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5"
        >
          <div className="mb-4">
            <h2 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">
              Transparent Scoring Rule
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Additive 100-point rubric computed deterministically per employee record
            </p>
          </div>

          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {SCORING_RULES.map((rule) => (
              <div key={rule.factor} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    {rule.factor}
                  </span>
                  <span className="font-mono text-xs font-medium text-[#D96B0C] dark:text-[#FFC800] tabular-nums">
                    {rule.weight}
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {rule.criteria}
                </p>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Recommended Actions */}
      <section aria-label="Recommended HR actions">
        <div className="mb-3 flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
          <h2 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
            Recommended Retention Actions
          </h2>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            Targeted interventions prioritized by active cohort exposure
          </span>
        </div>

        {actions.length === 0 ? (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 text-sm text-neutral-500 dark:text-neutral-400">
            No active retention actions required for the selected filter slice.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {actions.map((action) => {
              const priorityStyle =
                action.priority === 'Immediate'
                  ? 'text-red-600 dark:text-red-400'
                  : action.priority === 'Near-Term'
                    ? 'text-[#D96B0C] dark:text-[#F58220]'
                    : 'text-neutral-600 dark:text-neutral-400';

              return (
                <article
                  key={action.id}
                  className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className={`font-semibold ${priorityStyle}`}>
                        {action.priority} Priority
                      </span>
                      <span className="font-mono text-neutral-500 dark:text-neutral-400 tabular-nums">
                        {action.affectedCount} active staff
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 flex items-start gap-1.5">
                      <span>{action.title}</span>
                      <ArrowUpRight
                        className="w-4 h-4 shrink-0 text-[#F58220] mt-0.5"
                        aria-hidden="true"
                      />
                    </h3>
                    <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Target: {action.targetGroup}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                      {action.rationale}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed">
                    <span className="font-semibold">Next step:</span>{' '}
                    {action.actionStep}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
