import type { EmployeeRecord, ScoredEmployee } from '../types/hr';
import {
  formatGbp,
  formatTravelLabel,
  parseEmployeeMatrix,
} from '../utils/csvParser';

export interface DriveSpreadsheetItem {
  id: string;
  name: string;
  modifiedTime?: string;
}

export interface SheetTabMeta {
  sheetId: number;
  title: string;
  rowCount?: number;
  columnCount?: number;
}

export interface SpreadsheetMeta {
  spreadsheetId: string;
  title: string;
  sheets: SheetTabMeta[];
}

export class WorkspaceAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceAuthError';
  }
}

async function handleApiResponse(res: Response, context: string) {
  if (res.status === 401 || res.status === 403) {
    const body = await res.json().catch(() => ({}));
    const msg =
      body?.error?.message ||
      `Google Workspace permission denied or session expired while ${context}.`;
    throw new WorkspaceAuthError(msg);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg =
      body?.error?.message || `HTTP ${res.status} while ${context}.`;
    throw new Error(msg);
  }
  return res.json();
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch) return urlMatch[1];
  return trimmed;
}

export async function listUserSpreadsheets(
  accessToken: string
): Promise<DriveSpreadsheetItem[]> {
  const query = encodeURIComponent(
    "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
  );
  const fields = encodeURIComponent('files(id,name,modifiedTime)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime%20desc&pageSize=30&fields=${fields}&supportsAllDrives=true&includeItemsFromAllDrives=true`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await handleApiResponse(res, 'listing Google Sheets in Drive');
  return Array.isArray(data.files) ? data.files : [];
}

export async function getSpreadsheetMetadata(
  spreadsheetId: string,
  accessToken: string
): Promise<SpreadsheetMeta> {
  const fields = encodeURIComponent(
    'spreadsheetId,properties.title,sheets(properties(sheetId,title,gridProperties))'
  );
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}?fields=${fields}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await handleApiResponse(res, 'reading spreadsheet metadata');

  const sheets: SheetTabMeta[] = Array.isArray(data.sheets)
    ? data.sheets.map(
        (s: {
          properties?: {
            sheetId?: number;
            title?: string;
            gridProperties?: { rowCount?: number; columnCount?: number };
          };
        }) => ({
          sheetId: s.properties?.sheetId ?? 0,
          title: s.properties?.title ?? 'Untitled',
          rowCount: s.properties?.gridProperties?.rowCount,
          columnCount: s.properties?.gridProperties?.columnCount,
        })
      )
    : [];

  return {
    spreadsheetId: data.spreadsheetId ?? spreadsheetId,
    title: data.properties?.title ?? 'Google Spreadsheet',
    sheets,
  };
}

export async function readSheetAsEmployeeRecords(
  spreadsheetId: string,
  sheetTitle: string,
  accessToken: string
): Promise<EmployeeRecord[]> {
  const safeRange = `'${sheetTitle.replace(/'/g, "''")}'`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(safeRange)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await handleApiResponse(
    res,
    `reading tab "${sheetTitle}" from Google Sheets`
  );

  const values: string[][] = Array.isArray(data.values) ? data.values : [];
  return parseEmployeeMatrix(values);
}

export async function exportWatchlistToSheet(
  spreadsheetId: string,
  targetTabTitle: string,
  watchlist: ScoredEmployee[],
  accessToken: string
): Promise<{ updatedRange: string; rowsWritten: number }> {
  const meta = await getSpreadsheetMetadata(spreadsheetId, accessToken);
  const existingTab = meta.sheets.find((s) => s.title === targetTabTitle);

  if (!existingTab) {
    const batchRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: targetTabTitle,
                },
              },
            },
          ],
        }),
      }
    );
    await handleApiResponse(
      batchRes,
      `creating "${targetTabTitle}" tab in Google Sheets`
    );
  } else {
    const clearRange = `'${targetTabTitle.replace(/'/g, "''")}'!A1:Z500`;
    const clearRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/${encodeURIComponent(clearRange)}:clear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    await handleApiResponse(
      clearRes,
      `clearing existing "${targetTabTitle}" rows`
    );
  }

  const headerRow = [
    'Rank',
    'EmployeeID',
    'Name',
    'JobTitle',
    'Department',
    'Location',
    'JobLevel',
    'TenureYears',
    'YearsSincePromotion',
    'BusinessTravel',
    'MonthlyIncome_GBP',
    'FlightRiskScore',
    'RiskTier',
    'TopRiskDrivers',
    'ExportedAt',
  ];

  const timestamp = new Date().toISOString();
  const rows = watchlist.map((emp, idx) => [
    String(idx + 1),
    emp.employeeId,
    emp.fullName,
    emp.jobTitle,
    emp.department,
    emp.location,
    `L${emp.jobLevel}`,
    String(emp.yearsAtCompany),
    String(emp.yearsSinceLastPromotion),
    formatTravelLabel(emp.businessTravel),
    formatGbp(emp.monthlyIncomeGbp),
    String(emp.flightRiskScore),
    emp.riskTier,
    emp.riskFactors
      .slice(0, 3)
      .map((f) => `${f.detail} (+${f.points})`)
      .join('; '),
    timestamp,
  ]);

  const values = [headerRow, ...rows];
  const writeRange = `'${targetTabTitle.replace(/'/g, "''")}'!A1`;
  const putRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: writeRange,
        majorDimension: 'ROWS',
        values,
      }),
    }
  );

  const result = await handleApiResponse(
    putRes,
    `writing flight-risk watchlist to "${targetTabTitle}"`
  );

  return {
    updatedRange: result.updatedRange ?? writeRange,
    rowsWritten: rows.length,
  };
}
