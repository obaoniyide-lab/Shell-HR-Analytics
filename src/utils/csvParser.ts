import type {
  EmployeeRecord,
  InsightFinding,
  RecommendedAction,
  RiskFactor,
  RiskTier,
  ScoredEmployee,
} from '../types/hr';

export const SHEET_ID = '1iXjr-yhMggqA1zczp4lMGJLCbdKxtIdHD1MC7uvDYJE';
export const SHEET_GID = '471181394';
export const GVIZ_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;

const REQUIRED_COLUMNS = [
  'EmployeeID',
  'FirstName',
  'LastName',
  'Gender',
  'Age',
  'Department',
  'JobTitle',
  'JobLevel',
  'EmploymentType',
  'Location',
  'HireDate',
  'YearsAtCompany',
  'YearsSinceLastPromotion',
  'Education',
  'BusinessTravel',
  'MonthlyIncome_GBP',
  'Attrition',
];

/**
 * RFC-4180 compliant CSV parser handling quoted fields, escaped quotes, and CRLF/LF.
 */
export function parseCsvMatrix(rawText: string): string[][] {
  const text = rawText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field.trim());
        field = '';
      } else if (char === '\r' && next === '\n') {
        row.push(field.trim());
        if (row.some((cell) => cell !== '')) {
          rows.push(row);
        }
        row = [];
        field = '';
        i++;
      } else if (char === '\n' || char === '\r') {
        row.push(field.trim());
        if (row.some((cell) => cell !== '')) {
          rows.push(row);
        }
        row = [];
        field = '';
      } else {
        field += char;
      }
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field.trim());
    if (row.some((cell) => cell !== '')) {
      rows.push(row);
    }
  }

  return rows;
}

function parseCurrency(raw: string): number {
  const cleaned = raw.replace(/[^0-9.-]/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseNumber(raw: string, fallback = 0): number {
  const parsed = Number.parseFloat(raw.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseHireYear(raw: string): number | null {
  if (!raw) return null;
  const slashParts = raw.split('/');
  if (slashParts.length === 3) {
    const yr = Number.parseInt(slashParts[2], 10);
    if (yr >= 1950 && yr <= 2100) return yr;
  }
  const isoMatch = raw.match(/^(\d{4})-\d{2}-\d{2}/);
  if (isoMatch) {
    const yr = Number.parseInt(isoMatch[1], 10);
    if (yr >= 1950 && yr <= 2100) return yr;
  }
  const dt = new Date(raw);
  if (!Number.isNaN(dt.getTime())) {
    return dt.getFullYear();
  }
  return null;
}

export function parseEmployeeMatrix(matrix: string[][]): EmployeeRecord[] {
  if (matrix.length < 2) {
    throw new Error('The spreadsheet contains no employee rows below the header.');
  }

  const headers = matrix[0].map((h) => String(h ?? '').trim());
  const headerIndex = new Map<string, number>();
  headers.forEach((h, idx) => {
    headerIndex.set(h.toLowerCase(), idx);
  });

  const missing = REQUIRED_COLUMNS.filter(
    (col) => !headerIndex.has(col.toLowerCase())
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing expected column(s): ${missing.join(', ')}. Please verify this is the Shell UK People dataset.`
    );
  }

  const getVal = (row: string[], col: string): string => {
    const idx = headerIndex.get(col.toLowerCase());
    return idx !== undefined ? String(row[idx] ?? '').trim() : '';
  };

  const records: EmployeeRecord[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i];
    const employeeId = getVal(row, 'EmployeeID');
    if (!employeeId) continue;

    const firstName = getVal(row, 'FirstName');
    const lastName = getVal(row, 'LastName');
    const attritionRaw = getVal(row, 'Attrition').toLowerCase();

    records.push({
      employeeId,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim() || employeeId,
      gender: getVal(row, 'Gender') || 'Unspecified',
      age: parseNumber(getVal(row, 'Age'), 0),
      maritalStatus: getVal(row, 'MaritalStatus') || 'Unspecified',
      department: getVal(row, 'Department') || 'Unassigned',
      jobTitle: getVal(row, 'JobTitle') || 'Unspecified',
      jobLevel: Math.max(1, Math.round(parseNumber(getVal(row, 'JobLevel'), 1))),
      employmentType: getVal(row, 'EmploymentType') || 'Full-Time',
      location: getVal(row, 'Location') || 'Unspecified',
      hireDate: getVal(row, 'HireDate'),
      hireYear: parseHireYear(getVal(row, 'HireDate')),
      yearsAtCompany: parseNumber(getVal(row, 'YearsAtCompany'), 0),
      yearsInCurrentRole: parseNumber(getVal(row, 'YearsInCurrentRole'), 0),
      yearsSinceLastPromotion: parseNumber(getVal(row, 'YearsSinceLastPromotion'), 0),
      yearsWithCurrManager: parseNumber(getVal(row, 'YearsWithCurrManager'), 0),
      education: getVal(row, 'Education') || 'Unspecified',
      distanceFromHomeKm: parseNumber(getVal(row, 'DistanceFromHome_km'), 0),
      businessTravel: getVal(row, 'BusinessTravel') || 'Non-Travel',
      monthlyIncomeGbp: parseCurrency(getVal(row, 'MonthlyIncome_GBP')),
      attrition: attritionRaw === 'yes' ? 'Yes' : 'No',
    });
  }

  if (records.length === 0) {
    throw new Error('No valid employee records could be parsed from the spreadsheet.');
  }

  return records;
}

export function parseEmployeeCsv(csvText: string): EmployeeRecord[] {
  const trimmed = csvText.trim();
  if (!trimmed) {
    throw new Error('The CSV response is empty.');
  }

  if (
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<HTML')
  ) {
    throw new Error(
      'Google Sheets returned an HTML login or permission page instead of CSV data. Sign in with Google to access private sheets, or use Upload CSV.'
    );
  }

  const matrix = parseCsvMatrix(trimmed);
  return parseEmployeeMatrix(matrix);
}

export async function fetchGoogleSheetCsv(): Promise<EmployeeRecord[]> {
  let response: Response;
  try {
    response = await fetch(GVIZ_CSV_URL, {
      method: 'GET',
      cache: 'no-store',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    throw new Error(
      `Unable to reach Google Sheets (${message}). Check your internet connection or use Upload CSV.`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Google Sheets returned HTTP ${response.status} (${response.statusText || 'Request failed'}). Verify sheet permissions or use Upload CSV.`
    );
  }

  const text = await response.text();
  return parseEmployeeCsv(text);
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Transparent, additive 0-100 Flight-Risk Scoring Model:
 * 1. Promotion stagnation (0-25 pts)
 * 2. Business travel intensity (0-20 pts)
 * 3. Commute distance (0-15 pts)
 * 4. Early / transition tenure (0-15 pts)
 * 5. Manager / role continuity (0-15 pts)
 * 6. Pay vs Job Level peer median (0-10 pts)
 */
export function scoreEmployees(records: EmployeeRecord[]): ScoredEmployee[] {
  const incomesByLevel = new Map<number, number[]>();
  records.forEach((emp) => {
    const arr = incomesByLevel.get(emp.jobLevel) ?? [];
    arr.push(emp.monthlyIncomeGbp);
    incomesByLevel.set(emp.jobLevel, arr);
  });

  const medianByLevel = new Map<number, number>();
  incomesByLevel.forEach((vals, lvl) => {
    medianByLevel.set(lvl, median(vals));
  });

  return records.map((emp) => {
    const levelMedian = medianByLevel.get(emp.jobLevel) ?? emp.monthlyIncomeGbp;
    const factors: RiskFactor[] = [];

    // 1. Promotion stagnation (max 25)
    if (emp.yearsSinceLastPromotion >= 5) {
      factors.push({
        label: 'Promotion lag',
        points: 25,
        maxPoints: 25,
        detail: `${emp.yearsSinceLastPromotion} yrs since last promotion`,
      });
    } else if (emp.yearsSinceLastPromotion >= 3) {
      factors.push({
        label: 'Promotion lag',
        points: 15,
        maxPoints: 25,
        detail: `${emp.yearsSinceLastPromotion} yrs since last promotion`,
      });
    } else if (emp.yearsSinceLastPromotion === 2) {
      factors.push({
        label: 'Promotion lag',
        points: 8,
        maxPoints: 25,
        detail: '2 yrs since last promotion',
      });
    }

    // 2. Business travel intensity (max 20)
    if (emp.businessTravel === 'Travel_Frequently') {
      factors.push({
        label: 'Frequent travel',
        points: 20,
        maxPoints: 20,
        detail: 'Frequent business travel',
      });
    } else if (emp.businessTravel === 'Travel_Rarely') {
      factors.push({
        label: 'Occasional travel',
        points: 8,
        maxPoints: 20,
        detail: 'Rare business travel',
      });
    }

    // 3. Commute distance (max 15)
    if (emp.distanceFromHomeKm >= 30) {
      factors.push({
        label: 'Long commute',
        points: 15,
        maxPoints: 15,
        detail: `${emp.distanceFromHomeKm} km commute`,
      });
    } else if (emp.distanceFromHomeKm >= 15) {
      factors.push({
        label: 'Moderate commute',
        points: 8,
        maxPoints: 15,
        detail: `${emp.distanceFromHomeKm} km commute`,
      });
    }

    // 4. Early / transition tenure (max 15)
    if (emp.yearsAtCompany <= 2) {
      factors.push({
        label: 'Early tenure',
        points: 15,
        maxPoints: 15,
        detail: `${emp.yearsAtCompany} yr${emp.yearsAtCompany === 1 ? '' : 's'} at Shell`,
      });
    } else if (emp.yearsAtCompany <= 5) {
      factors.push({
        label: 'Mid-early tenure',
        points: 8,
        maxPoints: 15,
        detail: `${emp.yearsAtCompany} yrs at Shell`,
      });
    }

    // 5. Manager / role continuity (max 15)
    let continuityPts = 0;
    const continuityDetails: string[] = [];
    if (emp.yearsWithCurrManager <= 1) {
      continuityPts += 10;
      continuityDetails.push(`${emp.yearsWithCurrManager} yr with manager`);
    }
    if (emp.yearsInCurrentRole >= 5) {
      continuityPts += 5;
      continuityDetails.push(`${emp.yearsInCurrentRole} yrs in role`);
    }
    if (continuityPts > 0) {
      factors.push({
        label: 'Role/manager signal',
        points: continuityPts,
        maxPoints: 15,
        detail: continuityDetails.join(' · '),
      });
    }

    // 6. Pay vs Level Peer Median (max 10)
    if (levelMedian > 0 && emp.monthlyIncomeGbp < levelMedian * 0.9) {
      factors.push({
        label: 'Below peer pay',
        points: 10,
        maxPoints: 10,
        detail: `${formatGbp(emp.monthlyIncomeGbp)} vs L${emp.jobLevel} median ${formatGbp(levelMedian)}`,
      });
    } else if (levelMedian > 0 && emp.monthlyIncomeGbp < levelMedian) {
      factors.push({
        label: 'Slightly below median',
        points: 5,
        maxPoints: 10,
        detail: `${formatGbp(emp.monthlyIncomeGbp)} vs L${emp.jobLevel} median ${formatGbp(levelMedian)}`,
      });
    }

    const totalScore = Math.min(
      100,
      factors.reduce((sum, f) => sum + f.points, 0)
    );

    let riskTier: RiskTier = 'Low';
    if (totalScore >= 60) riskTier = 'High';
    else if (totalScore >= 40) riskTier = 'Elevated';

    return {
      ...emp,
      flightRiskScore: totalScore,
      riskTier,
      riskFactors: factors.sort((a, b) => b.points - a.points),
      levelMedianIncome: levelMedian,
    };
  });
}

export function formatGbp(amount: number, compact = false): string {
  if (compact && Math.abs(amount) >= 1_000_000) {
    return `£${(amount / 1_000_000).toFixed(2)}m`;
  }
  if (compact && Math.abs(amount) >= 100_000) {
    return `£${(amount / 1_000).toFixed(1)}k`;
  }
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatTravelLabel(raw: string): string {
  return raw.replace(/_/g, ' ');
}

export function generateInsights(filtered: ScoredEmployee[]): InsightFinding[] {
  if (filtered.length === 0) {
    return [];
  }

  const findings: InsightFinding[] = [];
  const total = filtered.length;
  const leavers = filtered.filter((e) => e.attrition === 'Yes');
  const active = filtered.filter((e) => e.attrition === 'No');
  const overallAttritionRate = (leavers.length / total) * 100;

  // 1. Department attrition hotspot
  const deptGroups = new Map<string, { total: number; left: number }>();
  filtered.forEach((e) => {
    const g = deptGroups.get(e.department) ?? { total: 0, left: 0 };
    g.total++;
    if (e.attrition === 'Yes') g.left++;
    deptGroups.set(e.department, g);
  });

  const deptRates = Array.from(deptGroups.entries())
    .filter(([, g]) => g.total >= 3)
    .map(([dept, g]) => ({
      dept,
      total: g.total,
      left: g.left,
      rate: (g.left / g.total) * 100,
    }))
    .sort((a, b) => b.rate - a.rate || b.left - a.left);

  if (deptRates.length > 1) {
    const topDept = deptRates[0];
    const diff = topDept.rate - overallAttritionRate;
    findings.push({
      id: 'dept-hotspot',
      category: 'Department Attrition',
      severity: topDept.rate >= 22 ? 'critical' : topDept.rate > overallAttritionRate + 4 ? 'warning' : 'neutral',
      headline: `${topDept.dept} leads attrition at ${formatPct(topDept.rate)}`,
      detail: `${topDept.left} of ${topDept.total} employees in ${topDept.dept} left, ${diff >= 0 ? '+' : ''}${diff.toFixed(1)} pp vs the ${formatPct(overallAttritionRate)} slice average.`,
      metric: `${topDept.left}/${topDept.total} leavers`,
    });
  } else if (deptRates.length === 1) {
    const only = deptRates[0];
    findings.push({
      id: 'dept-single',
      category: 'Department Focus',
      severity: only.rate >= 22 ? 'critical' : only.rate >= 15 ? 'warning' : 'positive',
      headline: `${only.dept} attrition stands at ${formatPct(only.rate)}`,
      detail: `${only.left} leavers recorded across ${only.total} employees in this filtered department view.`,
      metric: `${only.left} leavers`,
    });
  }

  // 2. UK Location variance
  const locGroups = new Map<string, { total: number; left: number }>();
  filtered.forEach((e) => {
    const g = locGroups.get(e.location) ?? { total: 0, left: 0 };
    g.total++;
    if (e.attrition === 'Yes') g.left++;
    locGroups.set(e.location, g);
  });
  const locRates = Array.from(locGroups.entries())
    .filter(([, g]) => g.total >= 3)
    .map(([loc, g]) => ({
      loc,
      total: g.total,
      left: g.left,
      rate: (g.left / g.total) * 100,
    }))
    .sort((a, b) => b.rate - a.rate || b.left - a.left);

  if (locRates.length > 1) {
    const topLoc = locRates[0];
    const lowLoc = locRates[locRates.length - 1];
    findings.push({
      id: 'location-spread',
      category: 'UK Site Spread',
      severity: topLoc.rate - lowLoc.rate >= 12 ? 'warning' : 'neutral',
      headline: `${topLoc.loc} shows highest site attrition (${formatPct(topLoc.rate)})`,
      detail: `Turnover in ${topLoc.loc} (${topLoc.left}/${topLoc.total}) outpaces ${lowLoc.loc} (${formatPct(lowLoc.rate)}, ${lowLoc.left}/${lowLoc.total}).`,
      metric: `${(topLoc.rate - lowLoc.rate).toFixed(1)} pp gap`,
    });
  }

  // 3. Travel intensity impact
  const freqTravel = filtered.filter((e) => e.businessTravel === 'Travel_Frequently');
  const otherTravel = filtered.filter((e) => e.businessTravel !== 'Travel_Frequently');
  if (freqTravel.length >= 3 && otherTravel.length >= 3) {
    const freqAttr = (freqTravel.filter((e) => e.attrition === 'Yes').length / freqTravel.length) * 100;
    const otherAttr = (otherTravel.filter((e) => e.attrition === 'Yes').length / otherTravel.length) * 100;
    findings.push({
      id: 'travel-impact',
      category: 'Travel & Burnout',
      severity: freqAttr > otherAttr + 5 ? 'warning' : 'neutral',
      headline:
        freqAttr > otherAttr
          ? `Frequent travellers exit at ${formatPct(freqAttr)} vs ${formatPct(otherAttr)}`
          : `Frequent travel shows contained attrition at ${formatPct(freqAttr)}`,
      detail: `${freqTravel.length} employees travel frequently (${formatPct((freqTravel.length / total) * 100)} of slice), making travel workload a key retention lever.`,
      metric: `${freqTravel.length} staff`,
    });
  }

  // 4. Promotion stagnation signal
  const stagnant = filtered.filter((e) => e.yearsSinceLastPromotion >= 4);
  if (stagnant.length > 0) {
    const stagnantAttr = (stagnant.filter((e) => e.attrition === 'Yes').length / stagnant.length) * 100;
    const activeStagnant = stagnant.filter((e) => e.attrition === 'No').length;
    findings.push({
      id: 'promo-stagnation',
      category: 'Career Progression',
      severity: stagnantAttr >= 20 || activeStagnant >= 15 ? 'warning' : 'neutral',
      headline: `${stagnant.length} employees have gone 4+ years without promotion`,
      detail: `This cohort has a ${formatPct(stagnantAttr)} historical attrition rate; ${activeStagnant} active employees remain in this bracket today.`,
      metric: `${activeStagnant} active`,
    });
  }

  // 5. High flight-risk concentration among active employees
  const highRiskActive = active.filter((e) => e.riskTier === 'High');
  const elevatedRiskActive = active.filter((e) => e.riskTier === 'Elevated');
  if (active.length > 0) {
    const highRiskPct = (highRiskActive.length / active.length) * 100;
    const payrollAtRisk = highRiskActive.reduce((s, e) => s + e.monthlyIncomeGbp, 0);
    findings.push({
      id: 'flight-risk-exposure',
      category: 'Retention Exposure',
      severity: highRiskPct >= 15 ? 'critical' : highRiskActive.length > 0 ? 'warning' : 'positive',
      headline: `${highRiskActive.length} active employees score High flight risk (${formatPct(highRiskPct)})`,
      detail: `Combined with ${elevatedRiskActive.length} Elevated-risk staff, High-risk talent represents ${formatGbp(payrollAtRisk)}/mo in monthly payroll.`,
      metric: `${formatGbp(payrollAtRisk, true)}/mo`,
    });
  }

  // 6. Gender pay & representation parity
  const females = filtered.filter((e) => e.gender === 'Female');
  const males = filtered.filter((e) => e.gender === 'Male');
  if (females.length >= 2 && males.length >= 2) {
    const femAvg = females.reduce((s, e) => s + e.monthlyIncomeGbp, 0) / females.length;
    const maleAvg = males.reduce((s, e) => s + e.monthlyIncomeGbp, 0) / males.length;
    const gapPct = maleAvg > 0 ? ((maleAvg - femAvg) / maleAvg) * 100 : 0;
    findings.push({
      id: 'gender-parity',
      category: 'Gender Representation & Pay',
      severity: Math.abs(gapPct) >= 8 ? 'warning' : 'positive',
      headline: `Female share is ${formatPct((females.length / total) * 100)} (${females.length} of ${total})`,
      detail: `Mean monthly income is ${formatGbp(femAvg)} for women vs ${formatGbp(maleAvg)} for men (${gapPct >= 0 ? `${gapPct.toFixed(1)}% below` : `${Math.abs(gapPct).toFixed(1)}% above`} male mean).`,
      metric: `${gapPct >= 0 ? '-' : '+'}${Math.abs(gapPct).toFixed(1)}% pay diff`,
    });
  }

  return findings;
}

export function generateRecommendedActions(
  filtered: ScoredEmployee[]
): RecommendedAction[] {
  const active = filtered.filter((e) => e.attrition === 'No');
  if (active.length === 0) return [];

  const actions: RecommendedAction[] = [];

  // 1. High flight-risk retention interviews
  const highRisk = active
    .filter((e) => e.riskTier === 'High')
    .sort((a, b) => b.flightRiskScore - a.flightRiskScore);

  if (highRisk.length > 0) {
    const topDeptMap = new Map<string, number>();
    highRisk.forEach((e) =>
      topDeptMap.set(e.department, (topDeptMap.get(e.department) ?? 0) + 1)
    );
    const topDept = Array.from(topDeptMap.entries()).sort((a, b) => b[1] - a[1])[0];
    actions.push({
      id: 'stay-interviews',
      priority: 'Immediate',
      title: 'Conduct structured stay interviews for High-risk talent',
      targetGroup: `${highRisk.length} High-risk active staff (led by ${topDept[0]})`,
      affectedCount: highRisk.length,
      rationale: `${highRisk.length} active employees score 60+ on the flight-risk index, concentrated in ${topDept[0]} (${topDept[1]} staff).`,
      actionStep:
        'Schedule People Partner + Line Manager 1:1 retention conversations within 14 days covering role scope, workload, and career trajectory.',
    });
  }

  // 2. Promotion & career-path calibration
  const promoStuck = active.filter((e) => e.yearsSinceLastPromotion >= 4);
  if (promoStuck.length > 0) {
    actions.push({
      id: 'promo-calibration',
      priority: promoStuck.length >= 15 ? 'Immediate' : 'Near-Term',
      title: 'Run mid-cycle promotion & lateral mobility review',
      targetGroup: `Active staff with 4+ years since last promotion`,
      affectedCount: promoStuck.length,
      rationale: `${promoStuck.length} active employees have not progressed in 4+ years, the single largest weighted driver (25 pts) in the risk model.`,
      actionStep:
        'Audit promotion readiness in upcoming talent calibration; offer stretch assignments or lateral UK site rotations where level headcount is capped.',
    });
  }

  // 3. Pay equity & below-median peer alignment
  const underpaidActive = active.filter(
    (e) => e.levelMedianIncome > 0 && e.monthlyIncomeGbp < e.levelMedianIncome * 0.9
  );
  if (underpaidActive.length > 0) {
    const avgGap =
      underpaidActive.reduce(
        (s, e) => s + (e.levelMedianIncome - e.monthlyIncomeGbp),
        0
      ) / underpaidActive.length;
    actions.push({
      id: 'comp-benchmarking',
      priority: underpaidActive.length >= 10 ? 'Immediate' : 'Near-Term',
      title: 'Targeted pay band compression check',
      targetGroup: `Active staff >10% below Job Level peer median`,
      affectedCount: underpaidActive.length,
      rationale: `${underpaidActive.length} active employees sit more than 10% below their Job Level median (avg gap ${formatGbp(avgGap)}/mo).`,
      actionStep:
        'Prioritise off-cycle market adjustments or retention bonuses for high performers in this cohort before annual review.',
    });
  }

  // 4. Frequent travel & long-commute hybrid flexibility
  const strainedCommuteTravel = active.filter(
    (e) =>
      e.businessTravel === 'Travel_Frequently' && e.distanceFromHomeKm >= 20
  );
  if (strainedCommuteTravel.length > 0) {
    actions.push({
      id: 'travel-flex',
      priority: 'Near-Term',
      title: 'Rebalance travel load and hybrid site attendance',
      targetGroup: `Frequent travellers commuting 20+ km`,
      affectedCount: strainedCommuteTravel.length,
      rationale: `${strainedCommuteTravel.length} active employees combine frequent business travel with commutes of 20 km or more.`,
      actionStep:
        'Introduce quarterly travel caps and remote-first anchor days at UK hubs (London, Aberdeen, Southampton) to reduce burnout.',
    });
  }

  // 5. Early tenure & manager change check-ins
  const earlyOrNewMgr = active.filter(
    (e) => e.yearsAtCompany <= 2 || e.yearsWithCurrManager <= 1
  );
  if (earlyOrNewMgr.length > 0) {
    actions.push({
      id: 'onboarding-mgr-sync',
      priority: 'Monitor',
      title: 'Strengthen 90-day onboarding & manager-transition check-ins',
      targetGroup: `Staff with ≤2 yrs tenure or ≤1 yr with current manager`,
      affectedCount: earlyOrNewMgr.length,
      rationale: `${earlyOrNewMgr.length} active employees are in early tenure or adapting to a recent manager transition.`,
      actionStep:
        'Deploy automated 6-month pulse surveys and pair new hires with peer buddies across UK sites.',
    });
  }

  return actions;
}
