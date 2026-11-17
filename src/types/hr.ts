export type DashboardTab = 'overview' | 'deep-dive' | 'insights';

export type RiskTier = 'High' | 'Elevated' | 'Low';

export interface RiskFactor {
  label: string;
  points: number;
  maxPoints: number;
  detail: string;
}

export interface EmployeeRecord {
  employeeId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  gender: string;
  age: number;
  maritalStatus: string;
  department: string;
  jobTitle: string;
  jobLevel: number;
  employmentType: string;
  location: string;
  hireDate: string;
  hireYear: number | null;
  yearsAtCompany: number;
  yearsInCurrentRole: number;
  yearsSinceLastPromotion: number;
  yearsWithCurrManager: number;
  education: string;
  distanceFromHomeKm: number;
  businessTravel: string;
  monthlyIncomeGbp: number;
  attrition: 'Yes' | 'No';
}

export interface ScoredEmployee extends EmployeeRecord {
  flightRiskScore: number;
  riskTier: RiskTier;
  riskFactors: RiskFactor[];
  levelMedianIncome: number;
}

export interface FilterState {
  department: string;
  location: string;
  employmentType: string;
  gender: string;
  attrition: string;
}

export interface DatasetMeta {
  source: 'google-sheets' | 'google-sheets-api' | 'csv-upload';
  fileName?: string;
  spreadsheetId?: string;
  spreadsheetTitle?: string;
  sheetTitle?: string;
  syncedAt: string;
  rowCount: number;
}

export interface InsightFinding {
  id: string;
  category: string;
  severity: 'critical' | 'warning' | 'neutral' | 'positive';
  headline: string;
  detail: string;
  metric: string;
}

export interface RecommendedAction {
  id: string;
  priority: 'Immediate' | 'Near-Term' | 'Monitor';
  title: string;
  targetGroup: string;
  affectedCount: number;
  rationale: string;
  actionStep: string;
}
