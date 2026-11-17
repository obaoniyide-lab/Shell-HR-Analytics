import { useMemo } from 'react';
import type { ChartConfiguration } from 'chart.js';
import type { ScoredEmployee } from '../types/hr';
import { formatGbp, formatPct, median } from '../utils/csvParser';
import { ChartCanvas, getChartThemeTokens } from './ChartCanvas';
import { KpiStrip, type KpiMetric } from './KpiStrip';

interface OverviewViewProps {
  employees: ScoredEmployee[];
  darkMode: boolean;
}

export function OverviewView({ employees, darkMode }: OverviewViewProps) {
  const tokens = useMemo(() => getChartThemeTokens(darkMode), [darkMode]);

  const kpis: KpiMetric[] = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.attrition === 'No');
    const leavers = employees.filter((e) => e.attrition === 'Yes');
    const attritionRate = total > 0 ? (leavers.length / total) * 100 : 0;
    const avgIncome =
      total > 0
        ? employees.reduce((sum, e) => sum + e.monthlyIncomeGbp, 0) / total
        : 0;
    const medianIncome = median(employees.map((e) => e.monthlyIncomeGbp));
    const monthlyPayroll = employees.reduce(
      (sum, e) => sum + e.monthlyIncomeGbp,
      0
    );
    const activePayroll = active.reduce((sum, e) => sum + e.monthlyIncomeGbp, 0);

    return [
      {
        label: 'Headcount',
        value: total.toLocaleString('en-GB'),
        subtext: `${active.length} active · ${leavers.length} leavers`,
        tone: 'brand',
      },
      {
        label: 'Attrition Rate',
        value: formatPct(attritionRate),
        subtext: `${leavers.length} exited in slice`,
        tone: attritionRate >= 20 ? 'danger' : attritionRate >= 14 ? 'warning' : 'default',
      },
      {
        label: 'Active Employees',
        value: active.length.toLocaleString('en-GB'),
        subtext:
          total > 0
            ? `${formatPct((active.length / total) * 100)} retention`
            : 'No records',
        tone: 'positive',
      },
      {
        label: 'Average Income',
        value: formatGbp(avgIncome),
        subtext: `Median ${formatGbp(medianIncome)} / mo`,
      },
      {
        label: 'Monthly Payroll',
        value: formatGbp(monthlyPayroll, true),
        subtext: `Active payroll ${formatGbp(activePayroll, true)}`,
      },
    ];
  }, [employees]);

  // 1. Department Chart (Stacked Horizontal Bar: Active vs Attrition Yes)
  const deptConfig = useMemo<ChartConfiguration<'bar'>>(() => {
    const map = new Map<string, { active: number; left: number }>();
    employees.forEach((e) => {
      const curr = map.get(e.department) ?? { active: 0, left: 0 };
      if (e.attrition === 'Yes') curr.left++;
      else curr.active++;
      map.set(e.department, curr);
    });
    const sorted = Array.from(map.entries()).sort(
      (a, b) => b[1].active + b[1].left - (a[1].active + a[1].left)
    );

    return {
      type: 'bar',
      data: {
        labels: sorted.map(([dept]) => dept),
        datasets: [
          {
            label: 'Active',
            data: sorted.map(([, v]) => v.active),
            backgroundColor: tokens.shellYellow,
            borderRadius: 3,
          },
          {
            label: 'Attrition (Yes)',
            data: sorted.map(([, v]) => v.left),
            backgroundColor: tokens.shellOrange,
            borderRadius: 3,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: {
            stacked: true,
            grid: { color: tokens.gridColor },
            ticks: { color: tokens.mutedTextColor, precision: 0 },
          },
          y: {
            stacked: true,
            grid: { display: false },
            ticks: {
              color: tokens.textColor,
              font: { size: 11 },
            },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              afterBody: (items) => {
                const idx = items[0]?.dataIndex ?? 0;
                const entry = sorted[idx];
                if (!entry) return '';
                const tot = entry[1].active + entry[1].left;
                const rate = tot > 0 ? ((entry[1].left / tot) * 100).toFixed(1) : '0.0';
                return `Total: ${tot} · Attrition: ${rate}%`;
              },
            },
          },
        },
      },
    };
  }, [employees, tokens]);

  // 2. Location Chart (Stacked Horizontal Bar)
  const locationConfig = useMemo<ChartConfiguration<'bar'>>(() => {
    const map = new Map<string, { active: number; left: number }>();
    employees.forEach((e) => {
      const curr = map.get(e.location) ?? { active: 0, left: 0 };
      if (e.attrition === 'Yes') curr.left++;
      else curr.active++;
      map.set(e.location, curr);
    });
    const sorted = Array.from(map.entries()).sort(
      (a, b) => b[1].active + b[1].left - (a[1].active + a[1].left)
    );

    return {
      type: 'bar',
      data: {
        labels: sorted.map(([loc]) => loc),
        datasets: [
          {
            label: 'Active',
            data: sorted.map(([, v]) => v.active),
            backgroundColor: darkMode ? '#E4E4E7' : '#18181B',
            borderRadius: 3,
          },
          {
            label: 'Attrition (Yes)',
            data: sorted.map(([, v]) => v.left),
            backgroundColor: tokens.shellOrange,
            borderRadius: 3,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: {
            stacked: true,
            grid: { color: tokens.gridColor },
            ticks: { color: tokens.mutedTextColor, precision: 0 },
          },
          y: {
            stacked: true,
            grid: { display: false },
            ticks: { color: tokens.textColor, font: { size: 11 } },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              afterBody: (items) => {
                const idx = items[0]?.dataIndex ?? 0;
                const entry = sorted[idx];
                if (!entry) return '';
                const tot = entry[1].active + entry[1].left;
                const rate = tot > 0 ? ((entry[1].left / tot) * 100).toFixed(1) : '0.0';
                return `Site Total: ${tot} · Attrition: ${rate}%`;
              },
            },
          },
        },
      },
    };
  }, [employees, tokens, darkMode]);

  // 3. Gender Chart (Doughnut)
  const genderConfig = useMemo<ChartConfiguration<'doughnut'>>(() => {
    const map = new Map<string, number>();
    employees.forEach((e) => {
      map.set(e.gender, (map.get(e.gender) ?? 0) + 1);
    });
    const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    const palette = [
      tokens.shellYellow,
      darkMode ? '#F4F4F5' : '#18181B',
      tokens.shellOrange,
      tokens.shellSlate,
    ];

    return {
      type: 'doughnut',
      data: {
        labels: entries.map(([g]) => g),
        datasets: [
          {
            data: entries.map(([, count]) => count),
            backgroundColor: entries.map((_, i) => palette[i % palette.length]),
            borderColor: tokens.surfaceBorder,
            borderWidth: 2,
          },
        ],
      },
      options: {
        cutout: '64%',
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = Number(ctx.raw ?? 0);
                const tot = employees.length || 1;
                return ` ${ctx.label}: ${val} (${((val / tot) * 100).toFixed(1)}%)`;
              },
            },
          },
        },
      },
    };
  }, [employees, tokens, darkMode]);

  // 4. Employment Type Chart (Bar)
  const empTypeConfig = useMemo<ChartConfiguration<'bar'>>(() => {
    const map = new Map<string, { active: number; left: number }>();
    employees.forEach((e) => {
      const curr = map.get(e.employmentType) ?? { active: 0, left: 0 };
      if (e.attrition === 'Yes') curr.left++;
      else curr.active++;
      map.set(e.employmentType, curr);
    });
    const sorted = Array.from(map.entries()).sort(
      (a, b) => b[1].active + b[1].left - (a[1].active + a[1].left)
    );

    return {
      type: 'bar',
      data: {
        labels: sorted.map(([t]) => t),
        datasets: [
          {
            label: 'Active',
            data: sorted.map(([, v]) => v.active),
            backgroundColor: tokens.shellYellow,
            borderRadius: 4,
          },
          {
            label: 'Attrition (Yes)',
            data: sorted.map(([, v]) => v.left),
            backgroundColor: tokens.shellOrange,
            borderRadius: 4,
          },
        ],
      },
      options: {
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: tokens.textColor },
          },
          y: {
            stacked: true,
            grid: { color: tokens.gridColor },
            ticks: { color: tokens.mutedTextColor, precision: 0 },
          },
        },
      },
    };
  }, [employees, tokens]);

  // 5. Hiring Trend by Year (Bar + Line)
  const hiringTrendConfig = useMemo<ChartConfiguration<'bar' | 'line'>>(() => {
    const map = new Map<number, { total: number; left: number }>();
    employees.forEach((e) => {
      if (e.hireYear === null) return;
      const curr = map.get(e.hireYear) ?? { total: 0, left: 0 };
      curr.total++;
      if (e.attrition === 'Yes') curr.left++;
      map.set(e.hireYear, curr);
    });
    const years = Array.from(map.keys()).sort((a, b) => a - b);

    return {
      type: 'bar',
      data: {
        labels: years.map(String),
        datasets: [
          {
            type: 'bar',
            label: 'Hires Retained',
            data: years.map((yr) => {
              const v = map.get(yr)!;
              return v.total - v.left;
            }),
            backgroundColor: tokens.shellYellow,
            borderRadius: 3,
          },
          {
            type: 'bar',
            label: 'Hires Exited',
            data: years.map((yr) => map.get(yr)!.left),
            backgroundColor: tokens.shellOrange,
            borderRadius: 3,
          },
        ],
      },
      options: {
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: tokens.mutedTextColor, maxRotation: 45 },
          },
          y: {
            stacked: true,
            grid: { color: tokens.gridColor },
            ticks: { color: tokens.mutedTextColor, precision: 0 },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              afterBody: (items) => {
                const idx = items[0]?.dataIndex ?? 0;
                const yr = years[idx];
                const entry = map.get(yr);
                if (!entry) return '';
                return `Total Hires in ${yr}: ${entry.total}`;
              },
            },
          },
        },
      },
    };
  }, [employees, tokens]);

  if (employees.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-10 text-center">
        <p className="text-base font-medium text-neutral-900 dark:text-neutral-100">
          No employees match the current filters
        </p>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Adjust or reset one of the workforce filters above to restore the Overview charts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <KpiStrip metrics={kpis} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <article className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">
              Headcount & Attrition by Department
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Active workforce vs historical attrition across business functions
            </p>
          </div>
          <ChartCanvas
            config={deptConfig}
            darkMode={darkMode}
            heightClass="h-80"
            ariaLabel="Department headcount and attrition bar chart"
          />
        </article>

        <article className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">
              Workforce by UK Location
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Regional distribution across Shell UK operational hubs
            </p>
          </div>
          <ChartCanvas
            config={locationConfig}
            darkMode={darkMode}
            heightClass="h-80"
            ariaLabel="UK location headcount and attrition bar chart"
          />
        </article>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <article className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">
              Gender Distribution
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Workforce balance within filtered selection
            </p>
          </div>
          <ChartCanvas
            config={genderConfig}
            darkMode={darkMode}
            heightClass="h-64"
            ariaLabel="Gender distribution doughnut chart"
          />
        </article>

        <article className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">
              Employment Type Mix
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Full-time, part-time, and contract split
            </p>
          </div>
          <ChartCanvas
            config={empTypeConfig}
            darkMode={darkMode}
            heightClass="h-64"
            ariaLabel="Employment type distribution bar chart"
          />
        </article>

        <article className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 md:col-span-2 lg:col-span-1">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">
              Hiring Trend by Year
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Annual intake cohort retention vs exits
            </p>
          </div>
          <ChartCanvas
            config={hiringTrendConfig}
            darkMode={darkMode}
            heightClass="h-64"
            ariaLabel="Annual hiring trend bar chart"
          />
        </article>
      </div>
    </div>
  );
}
