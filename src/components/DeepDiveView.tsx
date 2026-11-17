import { useMemo, useState } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import type { ScoredEmployee } from '../types/hr';
import {
  formatGbp,
  formatPct,
  formatTravelLabel,
  median,
} from '../utils/csvParser';
import { ChartCanvas, getChartThemeTokens } from './ChartCanvas';
import { KpiStrip, type KpiMetric } from './KpiStrip';

interface DeepDiveViewProps {
  employees: ScoredEmployee[];
  darkMode: boolean;
}

type SortKey =
  | 'employeeId'
  | 'fullName'
  | 'department'
  | 'jobLevel'
  | 'location'
  | 'yearsAtCompany'
  | 'yearsSinceLastPromotion'
  | 'monthlyIncomeGbp'
  | 'attrition'
  | 'flightRiskScore';

const PAGE_SIZE = 15;

export function DeepDiveView({ employees, darkMode }: DeepDiveViewProps) {
  const tokens = useMemo(() => getChartThemeTokens(darkMode), [darkMode]);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('flightRiskScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const kpis: KpiMetric[] = useMemo(() => {
    const total = employees.length;
    const avgTenure =
      total > 0
        ? employees.reduce((s, e) => s + e.yearsAtCompany, 0) / total
        : 0;
    const medianTenure = median(employees.map((e) => e.yearsAtCompany));
    const femaleCount = employees.filter((e) => e.gender === 'Female').length;
    const femaleShare = total > 0 ? (femaleCount / total) * 100 : 0;
    const nonFullTime = employees.filter(
      (e) => e.employmentType !== 'Full-Time'
    ).length;
    const nonFullTimeShare = total > 0 ? (nonFullTime / total) * 100 : 0;
    const avgPromoGap =
      total > 0
        ? employees.reduce((s, e) => s + e.yearsSinceLastPromotion, 0) / total
        : 0;
    const active = employees.filter((e) => e.attrition === 'No');
    const highRiskActive = active.filter((e) => e.riskTier === 'High').length;

    return [
      {
        label: 'Average Tenure',
        value: `${avgTenure.toFixed(1)} yrs`,
        subtext: `Median ${medianTenure.toFixed(1)} yrs at Shell`,
        tone: 'brand',
      },
      {
        label: 'Female Share',
        value: formatPct(femaleShare),
        subtext: `${femaleCount} of ${total} staff`,
      },
      {
        label: 'Non-Full-Time Share',
        value: formatPct(nonFullTimeShare),
        subtext: `${nonFullTime} part-time / contract`,
      },
      {
        label: 'Years Since Promotion',
        value: `${avgPromoGap.toFixed(1)} yrs`,
        subtext: `${employees.filter((e) => e.yearsSinceLastPromotion >= 4).length} at 4+ yrs`,
        tone: avgPromoGap >= 3.5 ? 'warning' : 'default',
      },
      {
        label: 'High Flight-Risk',
        value: highRiskActive.toLocaleString('en-GB'),
        subtext:
          active.length > 0
            ? `${formatPct((highRiskActive / active.length) * 100)} of active staff`
            : 'No active staff in slice',
        tone: highRiskActive > 0 ? 'danger' : 'positive',
      },
    ];
  }, [employees]);

  // 1. Age Bands & Attrition
  const ageConfig = useMemo<ChartConfiguration<'bar' | 'line'>>(() => {
    const bands = [
      { label: '<25', min: 0, max: 24 },
      { label: '25–34', min: 25, max: 34 },
      { label: '35–44', min: 35, max: 44 },
      { label: '45–54', min: 45, max: 54 },
      { label: '55+', min: 55, max: 120 },
    ];
    const counts = bands.map((b) => {
      const subset = employees.filter((e) => e.age >= b.min && e.age <= b.max);
      const left = subset.filter((e) => e.attrition === 'Yes').length;
      const rate = subset.length > 0 ? (left / subset.length) * 100 : 0;
      return { total: subset.length, left, rate };
    });

    return {
      type: 'bar',
      data: {
        labels: bands.map((b) => b.label),
        datasets: [
          {
            type: 'bar',
            label: 'Headcount',
            data: counts.map((c) => c.total),
            backgroundColor: tokens.shellYellow,
            borderRadius: 4,
            yAxisID: 'y',
          },
          {
            type: 'line',
            label: 'Attrition Rate %',
            data: counts.map((c) => Number(c.rate.toFixed(1))),
            borderColor: tokens.shellOrange,
            backgroundColor: tokens.shellOrange,
            borderWidth: 2.5,
            pointRadius: 4,
            tension: 0.2,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: tokens.textColor },
          },
          y: {
            position: 'left',
            grid: { color: tokens.gridColor },
            ticks: { color: tokens.mutedTextColor, precision: 0 },
          },
          y1: {
            position: 'right',
            min: 0,
            max: 100,
            grid: { drawOnChartArea: false },
            ticks: {
              color: tokens.shellOrange,
              callback: (v) => `${v}%`,
            },
          },
        },
      },
    };
  }, [employees, tokens]);

  // 2. Tenure Bands & Attrition
  const tenureConfig = useMemo<ChartConfiguration<'bar' | 'line'>>(() => {
    const bands = [
      { label: '0–2 yrs', min: 0, max: 2 },
      { label: '3–5 yrs', min: 3, max: 5 },
      { label: '6–10 yrs', min: 6, max: 10 },
      { label: '11–15 yrs', min: 11, max: 15 },
      { label: '16+ yrs', min: 16, max: 100 },
    ];
    const counts = bands.map((b) => {
      const subset = employees.filter(
        (e) => e.yearsAtCompany >= b.min && e.yearsAtCompany <= b.max
      );
      const left = subset.filter((e) => e.attrition === 'Yes').length;
      const rate = subset.length > 0 ? (left / subset.length) * 100 : 0;
      return { total: subset.length, left, rate };
    });

    return {
      type: 'bar',
      data: {
        labels: bands.map((b) => b.label),
        datasets: [
          {
            type: 'bar',
            label: 'Headcount',
            data: counts.map((c) => c.total),
            backgroundColor: darkMode ? '#E4E4E7' : '#18181B',
            borderRadius: 4,
            yAxisID: 'y',
          },
          {
            type: 'line',
            label: 'Attrition Rate %',
            data: counts.map((c) => Number(c.rate.toFixed(1))),
            borderColor: tokens.shellOrange,
            backgroundColor: tokens.shellOrange,
            borderWidth: 2.5,
            pointRadius: 4,
            tension: 0.2,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: tokens.textColor },
          },
          y: {
            position: 'left',
            grid: { color: tokens.gridColor },
            ticks: { color: tokens.mutedTextColor, precision: 0 },
          },
          y1: {
            position: 'right',
            min: 0,
            max: 100,
            grid: { drawOnChartArea: false },
            ticks: {
              color: tokens.shellOrange,
              callback: (v) => `${v}%`,
            },
          },
        },
      },
    };
  }, [employees, tokens, darkMode]);

  // 3. Avg Monthly Income by Job Level
  const incomeByLevelConfig = useMemo<ChartConfiguration<'bar'>>(() => {
    const levels = Array.from(new Set(employees.map((e) => e.jobLevel))).sort(
      (a, b) => a - b
    );
    const avgs = levels.map((lvl) => {
      const sub = employees.filter((e) => e.jobLevel === lvl);
      return sub.length > 0
        ? sub.reduce((s, e) => s + e.monthlyIncomeGbp, 0) / sub.length
        : 0;
    });

    return {
      type: 'bar',
      data: {
        labels: levels.map((l) => `Level ${l}`),
        datasets: [
          {
            label: 'Avg Monthly Income (£)',
            data: avgs.map((v) => Math.round(v)),
            backgroundColor: tokens.shellYellow,
            borderRadius: 4,
          },
        ],
      },
      options: {
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: tokens.textColor },
          },
          y: {
            grid: { color: tokens.gridColor },
            ticks: {
              color: tokens.mutedTextColor,
              callback: (v) => `£${Number(v).toLocaleString('en-GB')}`,
            },
          },
        },
      },
    };
  }, [employees, tokens]);

  // 4. Avg Monthly Income by Department
  const incomeByDeptConfig = useMemo<ChartConfiguration<'bar'>>(() => {
    const map = new Map<string, { sum: number; count: number }>();
    employees.forEach((e) => {
      const curr = map.get(e.department) ?? { sum: 0, count: 0 };
      curr.sum += e.monthlyIncomeGbp;
      curr.count++;
      map.set(e.department, curr);
    });
    const sorted = Array.from(map.entries())
      .map(([dept, v]) => ({ dept, avg: v.sum / v.count }))
      .sort((a, b) => b.avg - a.avg);

    return {
      type: 'bar',
      data: {
        labels: sorted.map((d) => d.dept),
        datasets: [
          {
            label: 'Avg Monthly Income (£)',
            data: sorted.map((d) => Math.round(d.avg)),
            backgroundColor: tokens.shellOrange,
            borderRadius: 3,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: {
            grid: { color: tokens.gridColor },
            ticks: {
              color: tokens.mutedTextColor,
              callback: (v) => `£${Number(v).toLocaleString('en-GB')}`,
            },
          },
          y: {
            grid: { display: false },
            ticks: { color: tokens.textColor, font: { size: 11 } },
          },
        },
      },
    };
  }, [employees, tokens]);

  // 5. Education Breakdown
  const educationConfig = useMemo<ChartConfiguration<'bar'>>(() => {
    const order = [
      'Below College',
      'College',
      "Bachelor's",
      "Master's",
      'Doctorate',
    ];
    const present = new Set(employees.map((e) => e.education));
    const labels = [
      ...order.filter((o) => present.has(o)),
      ...Array.from(present).filter((p) => !order.includes(p)),
    ];

    const activeData = labels.map(
      (ed) =>
        employees.filter((e) => e.education === ed && e.attrition === 'No')
          .length
    );
    const leftData = labels.map(
      (ed) =>
        employees.filter((e) => e.education === ed && e.attrition === 'Yes')
          .length
    );

    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Active',
            data: activeData,
            backgroundColor: tokens.shellYellow,
            borderRadius: 3,
          },
          {
            label: 'Attrition (Yes)',
            data: leftData,
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
            ticks: { color: tokens.textColor, font: { size: 11 } },
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

  // 6. Business Travel Breakdown
  const travelConfig = useMemo<ChartConfiguration<'bar'>>(() => {
    const order = ['Non-Travel', 'Travel_Rarely', 'Travel_Frequently'];
    const present = new Set(employees.map((e) => e.businessTravel));
    const labels = [
      ...order.filter((o) => present.has(o)),
      ...Array.from(present).filter((p) => !order.includes(p)),
    ];

    const activeData = labels.map(
      (tr) =>
        employees.filter(
          (e) => e.businessTravel === tr && e.attrition === 'No'
        ).length
    );
    const leftData = labels.map(
      (tr) =>
        employees.filter(
          (e) => e.businessTravel === tr && e.attrition === 'Yes'
        ).length
    );

    return {
      type: 'bar',
      data: {
        labels: labels.map(formatTravelLabel),
        datasets: [
          {
            label: 'Active',
            data: activeData,
            backgroundColor: darkMode ? '#E4E4E7' : '#18181B',
            borderRadius: 3,
          },
          {
            label: 'Attrition (Yes)',
            data: leftData,
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
  }, [employees, tokens, darkMode]);

  // 7. Income vs Tenure Scatter Plot
  const scatterConfig = useMemo<ChartConfiguration<'scatter'>>(() => {
    const activePts = employees
      .filter((e) => e.attrition === 'No')
      .map((e) => ({
        x: e.yearsAtCompany,
        y: e.monthlyIncomeGbp,
        emp: e,
      }));
    const leftPts = employees
      .filter((e) => e.attrition === 'Yes')
      .map((e) => ({
        x: e.yearsAtCompany,
        y: e.monthlyIncomeGbp,
        emp: e,
      }));

    return {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Active',
            data: activePts,
            backgroundColor: 'rgba(255, 200, 0, 0.85)',
            borderColor: darkMode ? '#FFC800' : '#A16207',
            borderWidth: 1,
            pointRadius: 4.5,
            pointHoverRadius: 6.5,
          },
          {
            label: 'Attrition (Yes)',
            data: leftPts,
            backgroundColor: 'rgba(245, 130, 32, 0.9)',
            borderColor: '#9A3412',
            borderWidth: 1,
            pointRadius: 5,
            pointHoverRadius: 7,
          },
        ],
      },
      options: {
        scales: {
          x: {
            title: {
              display: true,
              text: 'Years at Company',
              color: tokens.mutedTextColor,
              font: { size: 11 },
            },
            grid: { color: tokens.gridColor },
            ticks: { color: tokens.mutedTextColor },
          },
          y: {
            title: {
              display: true,
              text: 'Monthly Income (£)',
              color: tokens.mutedTextColor,
              font: { size: 11 },
            },
            grid: { color: tokens.gridColor },
            ticks: {
              color: tokens.mutedTextColor,
              callback: (v) => `£${Number(v).toLocaleString('en-GB')}`,
            },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const raw = ctx.raw as { emp?: ScoredEmployee };
                const emp = raw?.emp;
                if (!emp) return '';
                return `${emp.fullName} (${emp.department}) · ${emp.yearsAtCompany} yrs · ${formatGbp(emp.monthlyIncomeGbp)}`;
              },
            },
          },
        },
      },
    };
  }, [employees, tokens, darkMode]);

  // Search + Sort Employee Table
  const tableRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const searched = q
      ? employees.filter(
          (e) =>
            e.employeeId.toLowerCase().includes(q) ||
            e.fullName.toLowerCase().includes(q) ||
            e.jobTitle.toLowerCase().includes(q) ||
            e.department.toLowerCase().includes(q) ||
            e.location.toLowerCase().includes(q)
        )
      : employees;

    const sorted = [...searched].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      let cmp = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        cmp = valA - valB;
      } else {
        cmp = String(valA).localeCompare(String(valB));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [employees, searchQuery, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return tableRows.slice(start, start + PAGE_SIZE);
  }, [tableRows, safePage]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(
        key === 'fullName' || key === 'department' || key === 'location'
          ? 'asc'
          : 'desc'
      );
    }
    setPage(1);
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" aria-hidden="true" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-[#D96B0C] dark:text-[#FFC800]" aria-hidden="true" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-[#D96B0C] dark:text-[#FFC800]" aria-hidden="true" />
    );
  };

  if (employees.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-10 text-center">
        <p className="text-base font-medium text-neutral-900 dark:text-neutral-100">
          No employees match the current filters
        </p>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Reset or widen your filters to explore Deep Dive cohorts and employee records.
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
              Age Bands & Attrition Rate
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Workforce volume alongside age-group exit percentage
            </p>
          </div>
          <ChartCanvas
            config={ageConfig}
            darkMode={darkMode}
            heightClass="h-72"
            ariaLabel="Age bands and attrition rate chart"
          />
        </article>

        <article className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">
              Tenure Bands & Attrition Rate
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Years at Shell vs historical attrition percentage
            </p>
          </div>
          <ChartCanvas
            config={tenureConfig}
            darkMode={darkMode}
            heightClass="h-72"
            ariaLabel="Tenure bands and attrition rate chart"
          />
        </article>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <article className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">
              Average Monthly Income by Job Level
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Pay progression across Shell UK job levels 1 to 5
            </p>
          </div>
          <ChartCanvas
            config={incomeByLevelConfig}
            darkMode={darkMode}
            heightClass="h-72"
            ariaLabel="Average monthly income by job level bar chart"
          />
        </article>

        <article className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">
              Average Monthly Income by Department
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Mean monthly GBP compensation per function
            </p>
          </div>
          <ChartCanvas
            config={incomeByDeptConfig}
            darkMode={darkMode}
            heightClass="h-72"
            ariaLabel="Average monthly income by department bar chart"
          />
        </article>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <article className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">
              Education Profile
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Qualification levels split by retention status
            </p>
          </div>
          <ChartCanvas
            config={educationConfig}
            darkMode={darkMode}
            heightClass="h-64"
            ariaLabel="Education breakdown bar chart"
          />
        </article>

        <article className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">
              Business Travel & Attrition
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Travel cadence vs active and exited headcount
            </p>
          </div>
          <ChartCanvas
            config={travelConfig}
            darkMode={darkMode}
            heightClass="h-64"
            ariaLabel="Business travel and attrition bar chart"
          />
        </article>

        <article className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">
              Income vs Tenure Scatter
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Monthly GBP pay against years at Shell
            </p>
          </div>
          <ChartCanvas
            config={scatterConfig}
            darkMode={darkMode}
            heightClass="h-64"
            ariaLabel="Monthly income versus tenure scatter plot"
          />
        </article>
      </div>

      {/* Searchable, Sortable Employee Table */}
      <section className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">
              Employee Directory
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
              {tableRows.length} matching records · Click any column header to sort
            </p>
          </div>

          <div className="relative w-full sm:w-80">
            <Search
              className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search ID, name, role, site..."
              aria-label="Search employees"
              className="w-full h-10 pl-9 pr-3 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC800]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/60 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('employeeId')}
                    className="inline-flex items-center gap-1 hover:text-neutral-950 dark:hover:text-neutral-100 cursor-pointer"
                  >
                    ID {renderSortIcon('employeeId')}
                  </button>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('fullName')}
                    className="inline-flex items-center gap-1 hover:text-neutral-950 dark:hover:text-neutral-100 cursor-pointer"
                  >
                    Employee {renderSortIcon('fullName')}
                  </button>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('department')}
                    className="inline-flex items-center gap-1 hover:text-neutral-950 dark:hover:text-neutral-100 cursor-pointer"
                  >
                    Department {renderSortIcon('department')}
                  </button>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('location')}
                    className="inline-flex items-center gap-1 hover:text-neutral-950 dark:hover:text-neutral-100 cursor-pointer"
                  >
                    Location {renderSortIcon('location')}
                  </button>
                </th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('jobLevel')}
                    className="inline-flex items-center gap-1 hover:text-neutral-950 dark:hover:text-neutral-100 cursor-pointer"
                  >
                    Lvl {renderSortIcon('jobLevel')}
                  </button>
                </th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('yearsAtCompany')}
                    className="inline-flex items-center gap-1 hover:text-neutral-950 dark:hover:text-neutral-100 cursor-pointer"
                  >
                    Tenure {renderSortIcon('yearsAtCompany')}
                  </button>
                </th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('yearsSinceLastPromotion')}
                    className="inline-flex items-center gap-1 hover:text-neutral-950 dark:hover:text-neutral-100 cursor-pointer"
                  >
                    Promo Lag {renderSortIcon('yearsSinceLastPromotion')}
                  </button>
                </th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('monthlyIncomeGbp')}
                    className="inline-flex items-center gap-1 hover:text-neutral-950 dark:hover:text-neutral-100 cursor-pointer"
                  >
                    Monthly Pay {renderSortIcon('monthlyIncomeGbp')}
                  </button>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('attrition')}
                    className="inline-flex items-center gap-1 hover:text-neutral-950 dark:hover:text-neutral-100 cursor-pointer"
                  >
                    Attrition {renderSortIcon('attrition')}
                  </button>
                </th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('flightRiskScore')}
                    className="inline-flex items-center gap-1 hover:text-neutral-950 dark:hover:text-neutral-100 cursor-pointer"
                  >
                    Risk Score {renderSortIcon('flightRiskScore')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {pagedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="py-8 px-4 text-center text-sm text-neutral-500 dark:text-neutral-400"
                  >
                    No employees match "{searchQuery}".
                  </td>
                </tr>
              ) : (
                pagedRows.map((emp) => {
                  const riskTextClass =
                    emp.riskTier === 'High'
                      ? 'text-red-600 dark:text-red-400 font-semibold'
                      : emp.riskTier === 'Elevated'
                        ? 'text-[#D96B0C] dark:text-[#F58220] font-medium'
                        : 'text-neutral-600 dark:text-neutral-400';

                  return (
                    <tr
                      key={emp.employeeId}
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-mono text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                        {emp.employeeId}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-neutral-950 dark:text-neutral-100 whitespace-nowrap">
                          {emp.fullName}
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                          {emp.jobTitle} · {emp.employmentType}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                        {emp.department}
                      </td>
                      <td className="py-2.5 px-4 text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                        {emp.location}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-xs tabular-nums">
                        L{emp.jobLevel}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                        {emp.yearsAtCompany} yrs
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                        {emp.yearsSinceLastPromotion} yrs
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-xs font-medium tabular-nums whitespace-nowrap">
                        {formatGbp(emp.monthlyIncomeGbp)}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap text-xs">
                        <span
                          className={
                            emp.attrition === 'Yes'
                              ? 'font-medium text-red-600 dark:text-red-400'
                              : 'text-neutral-600 dark:text-neutral-400'
                          }
                        >
                          {emp.attrition === 'Yes' ? 'Exited' : 'Active'}
                        </span>
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-mono text-xs tabular-nums whitespace-nowrap ${riskTextClass}`}
                      >
                        {emp.flightRiskScore}/100 ({emp.riskTier})
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <span className="font-mono tabular-nums">
            Page {safePage} of {totalPages} ({tableRows.length} rows)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
