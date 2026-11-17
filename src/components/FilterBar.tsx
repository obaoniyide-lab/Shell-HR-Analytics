import { RotateCcw } from 'lucide-react';
import type { FilterState } from '../types/hr';

interface FilterBarProps {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onReset: () => void;
  options: {
    departments: string[];
    locations: string[];
    employmentTypes: string[];
    genders: string[];
  };
  filteredCount: number;
  totalCount: number;
}

export function FilterBar({
  filters,
  onChange,
  onReset,
  options,
  filteredCount,
  totalCount,
}: FilterBarProps) {
  const hasActiveFilters =
    filters.department !== 'All' ||
    filters.location !== 'All' ||
    filters.employmentType !== 'All' ||
    filters.gender !== 'All' ||
    filters.attrition !== 'All';

  const selectClass =
    'w-full h-10 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC800] transition-colors';

  const labelClass =
    'block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1';

  return (
    <section
      aria-label="Workforce filters"
      className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <div>
          <label htmlFor="filter-department" className={labelClass}>
            Department
          </label>
          <select
            id="filter-department"
            value={filters.department}
            onChange={(e) =>
              onChange({ ...filters, department: e.target.value })
            }
            className={selectClass}
          >
            <option value="All">All Departments</option>
            {options.departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-location" className={labelClass}>
            Location
          </label>
          <select
            id="filter-location"
            value={filters.location}
            onChange={(e) => onChange({ ...filters, location: e.target.value })}
            className={selectClass}
          >
            <option value="All">All UK Sites</option>
            {options.locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-employment-type" className={labelClass}>
            Employment Type
          </label>
          <select
            id="filter-employment-type"
            value={filters.employmentType}
            onChange={(e) =>
              onChange({ ...filters, employmentType: e.target.value })
            }
            className={selectClass}
          >
            <option value="All">All Types</option>
            {options.employmentTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-gender" className={labelClass}>
            Gender
          </label>
          <select
            id="filter-gender"
            value={filters.gender}
            onChange={(e) => onChange({ ...filters, gender: e.target.value })}
            className={selectClass}
          >
            <option value="All">All Genders</option>
            {options.genders.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-attrition" className={labelClass}>
            Attrition Status
          </label>
          <select
            id="filter-attrition"
            value={filters.attrition}
            onChange={(e) =>
              onChange({ ...filters, attrition: e.target.value })
            }
            className={selectClass}
          >
            <option value="All">All Staff</option>
            <option value="No">Active Only (No)</option>
            <option value="Yes">Leavers Only (Yes)</option>
          </select>
        </div>

        <div className="flex items-center justify-between lg:justify-end gap-3 h-10">
          <span className="font-mono text-xs text-neutral-600 dark:text-neutral-300 tabular-nums whitespace-nowrap">
            {filteredCount} / {totalCount} staff
          </span>
          <button
            type="button"
            onClick={onReset}
            disabled={!hasActiveFilters}
            className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC800] ${
              hasActiveFilters
                ? 'border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer'
                : 'border-neutral-200 dark:border-neutral-800 bg-transparent text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Reset
          </button>
        </div>
      </div>
    </section>
  );
}
