import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  LogOut,
  Moon,
  RefreshCw,
  Send,
  Sun,
  Upload,
} from 'lucide-react';
import { DeepDiveView } from './components/DeepDiveView';
import { FilterBar } from './components/FilterBar';
import {
  ConfirmSheetExportModal,
  GoogleSheetsPickerModal,
} from './components/GoogleSheetsModal';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { InsightsView } from './components/InsightsView';
import { OverviewView } from './components/OverviewView';
import {
  exportWatchlistToSheet,
  getSpreadsheetMetadata,
  readSheetAsEmployeeRecords,
  WorkspaceAuthError,
} from './services/googleSheetsApi';
import {
  clearAccessToken,
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from './services/googleWorkspaceAuth';
import type {
  DashboardTab,
  DatasetMeta,
  FilterState,
  ScoredEmployee,
} from './types/hr';
import {
  fetchGoogleSheetCsv,
  parseEmployeeCsv,
  scoreEmployees,
  SHEET_GID,
  SHEET_ID,
} from './utils/csvParser';

const INITIAL_FILTERS: FilterState = {
  department: 'All',
  location: 'All',
  employmentType: 'All',
  gender: 'All',
  attrition: 'All',
};

const WATCHLIST_TAB_TITLE = 'Flight Risk Watchlist';

function ShellMark() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="w-7 h-7 shrink-0"
      aria-hidden="true"
    >
      <path
        d="M16 4C9.5 4 4.5 9.2 4.5 15.8c0 3.7 1.6 6.8 4.4 8.9l2.4 2.8h9.4l2.4-2.8c2.8-2.1 4.4-5.2 4.4-8.9C27.5 9.2 22.5 4 16 4z"
        fill="#FFC800"
        stroke="#F58220"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M16 6.5v17M11.2 8.2l2.9 15.3M20.8 8.2l-2.9 15.3M7.5 12l4.7 11.5M24.5 12l-4.7 11.5"
        stroke="#09090B"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = window.localStorage.getItem('shell-pa-theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return false;
  });

  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [employees, setEmployees] = useState<ScoredEmployee[]>([]);
  const [meta, setMeta] = useState<DatasetMeta | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

  // Google Workspace OAuth & Sheets API state
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [activeSpreadsheetId, setActiveSpreadsheetId] = useState<string>(SHEET_ID);
  const [activeSpreadsheetTitle, setActiveSpreadsheetTitle] = useState<string>(
    'Shell UK Workforce Dataset'
  );
  const [activeSheetTitle, setActiveSheetTitle] = useState<string>('');
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);
  const [confirmExportOpen, setConfirmExportOpen] = useState<boolean>(false);
  const [exportingSheet, setExportingSheet] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      window.localStorage.setItem('shell-pa-theme', 'dark');
    } else {
      root.classList.remove('dark');
      window.localStorage.setItem('shell-pa-theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser, token) => {
        setUser(authedUser);
        setAccessToken(token);
        setNeedsAuth(false);
      },
      () => {
        setAccessToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const loadViaSheetsApi = useCallback(
    async (
      spreadsheetId: string,
      spreadsheetTitleOverride?: string,
      sheetTitleOverride?: string,
      tokenOverride?: string
    ) => {
      const token = tokenOverride ?? (await getAccessToken());
      if (!token) {
        setNeedsAuth(true);
        throw new WorkspaceAuthError(
          'Sign in with Google to connect directly via the Google Sheets API.'
        );
      }

      const sheetMeta = await getSpreadsheetMetadata(spreadsheetId, token);
      if (sheetMeta.sheets.length === 0) {
        throw new Error('The selected Google Spreadsheet has no worksheet tabs.');
      }

      let targetTab = sheetTitleOverride;
      if (!targetTab && spreadsheetId === SHEET_ID) {
        const gidNum = Number.parseInt(SHEET_GID, 10);
        targetTab = sheetMeta.sheets.find((s) => s.sheetId === gidNum)?.title;
      }
      if (!targetTab) {
        targetTab = sheetMeta.sheets[0].title;
      }

      const records = await readSheetAsEmployeeRecords(
        spreadsheetId,
        targetTab,
        token
      );
      const scored = scoreEmployees(records);

      setActiveSpreadsheetId(sheetMeta.spreadsheetId);
      setActiveSpreadsheetTitle(spreadsheetTitleOverride ?? sheetMeta.title);
      setActiveSheetTitle(targetTab);
      setEmployees(scored);
      setFilters(INITIAL_FILTERS);
      setMeta({
        source: 'google-sheets-api',
        spreadsheetId: sheetMeta.spreadsheetId,
        spreadsheetTitle: spreadsheetTitleOverride ?? sheetMeta.title,
        sheetTitle: targetTab,
        syncedAt: new Date().toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        rowCount: scored.length,
      });
    },
    []
  );

  const syncFromGoogleSheet = useCallback(async () => {
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const token = await getAccessToken();
      if (token) {
        await loadViaSheetsApi(
          activeSpreadsheetId,
          activeSpreadsheetTitle,
          activeSheetTitle || undefined,
          token
        );
      } else {
        const records = await fetchGoogleSheetCsv();
        const scored = scoreEmployees(records);
        setEmployees(scored);
        setMeta({
          source: 'google-sheets',
          syncedAt: new Date().toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          rowCount: scored.length,
        });
      }
    } catch (err) {
      if (err instanceof WorkspaceAuthError) {
        clearAccessToken();
        setAccessToken(null);
        setNeedsAuth(true);
      }
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to load data from Google Sheets.';
      setError(msg);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [
    activeSheetTitle,
    activeSpreadsheetId,
    activeSpreadsheetTitle,
    loadViaSheetsApi,
  ]);

  useEffect(() => {
    void syncFromGoogleSheet();
  }, [syncFromGoogleSheet]);

  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    setError(null);
    setNotice(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        setNeedsAuth(false);
        setSyncing(true);
        await loadViaSheetsApi(
          activeSpreadsheetId,
          activeSpreadsheetTitle,
          activeSheetTitle || undefined,
          result.accessToken
        );
        setNotice(
          `Connected to Google Sheets as ${result.user.email ?? result.user.displayName ?? 'Workspace user'}.`
        );
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Google sign-in was canceled or failed.';
      setError(msg);
    } finally {
      setIsLoggingIn(false);
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setNeedsAuth(true);
    setNotice('Signed out of Google Workspace.');
  };

  const handleCsvUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setNotice(null);
    try {
      const text = await file.text();
      const records = parseEmployeeCsv(text);
      const scored = scoreEmployees(records);
      setEmployees(scored);
      setFilters(INITIAL_FILTERS);
      setMeta({
        source: 'csv-upload',
        fileName: file.name,
        syncedAt: new Date().toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        rowCount: scored.length,
      });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to parse the uploaded CSV file.';
      setError(`CSV upload failed: ${msg}`);
    } finally {
      event.target.value = '';
    }
  };

  const filterOptions = useMemo(() => {
    const departments = Array.from(
      new Set(employees.map((e) => e.department))
    ).sort();
    const locations = Array.from(
      new Set(employees.map((e) => e.location))
    ).sort();
    const employmentTypes = Array.from(
      new Set(employees.map((e) => e.employmentType))
    ).sort();
    const genders = Array.from(new Set(employees.map((e) => e.gender))).sort();
    return { departments, locations, employmentTypes, genders };
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (
        filters.department !== 'All' &&
        emp.department !== filters.department
      ) {
        return false;
      }
      if (filters.location !== 'All' && emp.location !== filters.location) {
        return false;
      }
      if (
        filters.employmentType !== 'All' &&
        emp.employmentType !== filters.employmentType
      ) {
        return false;
      }
      if (filters.gender !== 'All' && emp.gender !== filters.gender) {
        return false;
      }
      if (filters.attrition !== 'All' && emp.attrition !== filters.attrition) {
        return false;
      }
      return true;
    });
  }, [employees, filters]);

  const topWatchlist = useMemo(() => {
    return filteredEmployees
      .filter((e) => e.attrition === 'No')
      .sort(
        (a, b) =>
          b.flightRiskScore - a.flightRiskScore ||
          b.yearsSinceLastPromotion - a.yearsSinceLastPromotion
      )
      .slice(0, 10);
  }, [filteredEmployees]);

  const handleConfirmExportWatchlist = async () => {
    const token = accessToken ?? (await getAccessToken());
    if (!token) {
      setConfirmExportOpen(false);
      setNeedsAuth(true);
      setError('Sign in with Google to export the watchlist to Google Sheets.');
      return;
    }

    setExportingSheet(true);
    setError(null);
    try {
      const res = await exportWatchlistToSheet(
        activeSpreadsheetId,
        WATCHLIST_TAB_TITLE,
        topWatchlist,
        token
      );
      setConfirmExportOpen(false);
      setNotice(
        `Exported ${res.rowsWritten} flight-risk watchlist rows to "${activeSpreadsheetTitle}" (${res.updatedRange}).`
      );
    } catch (err) {
      if (err instanceof WorkspaceAuthError) {
        clearAccessToken();
        setAccessToken(null);
        setNeedsAuth(true);
      }
      setConfirmExportOpen(false);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to export watchlist to Google Sheets.'
      );
    } finally {
      setExportingSheet(false);
    }
  };

  const tabs: { id: DashboardTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'deep-dive', label: 'Deep Dive' },
    { id: 'insights', label: 'Insights' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50 transition-colors">
      {/* Top Bar Contract: 3 zones (Brand wordmark | Nav links | Primary action) */}
      <header className="sticky top-0 z-30 h-14 border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xs">
        <div className="max-w-[1440px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4 sm:gap-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('overview');
            }}
            className="inline-flex items-center gap-2.5 text-base sm:text-lg font-bold tracking-tight text-neutral-950 dark:text-neutral-50 whitespace-nowrap shrink-0"
          >
            <ShellMark />
            <span>Shell People Analytics</span>
          </a>

          <nav
            aria-label="Primary dashboard views"
            className="hidden md:flex items-center gap-7 h-full"
          >
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative h-full inline-flex items-center text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC800] ${
                    active
                      ? 'text-neutral-950 dark:text-neutral-50'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                  }`}
                >
                  {tab.label}
                  {active && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#FFC800]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => void syncFromGoogleSheet()}
              disabled={syncing}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-[#FFC800] hover:bg-[#f0bc00] active:bg-[#e5b300] text-neutral-950 text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F58220]"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{syncing ? 'Syncing...' : 'Sync Sheet'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-5">
        {/* Workspace Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50 text-balance">
              Shell UK Workforce Intelligence
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
              {meta ? (
                <>
                  <span>{meta.rowCount} employees loaded</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Source:{' '}
                    {meta.source === 'google-sheets-api'
                      ? `${meta.spreadsheetTitle ?? 'Google Sheet'} (${meta.sheetTitle ?? 'Sheet'})`
                      : meta.source === 'google-sheets'
                        ? 'Google Sheets (public CSV)'
                        : `Uploaded CSV (${meta.fileName ?? 'local file'})`}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Synced {meta.syncedAt}</span>
                </>
              ) : (
                <span>Connecting to Shell UK Google Sheets dataset</span>
              )}
              {!needsAuth && user?.email && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-neutral-700 dark:text-neutral-300">
                    Google: {user.email}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {needsAuth || !accessToken ? (
              <GoogleSignInButton
                onClick={() => void handleGoogleSignIn()}
                loading={isLoggingIn}
              />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-800 dark:text-neutral-200 whitespace-nowrap shrink-0 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC800]"
                >
                  <FileSpreadsheet
                    className="w-3.5 h-3.5 text-[#F58220]"
                    aria-hidden="true"
                  />
                  <span>Browse Sheets</span>
                </button>

                <button
                  type="button"
                  disabled={topWatchlist.length === 0}
                  onClick={() => setConfirmExportOpen(true)}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-800 dark:text-neutral-200 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC800]"
                >
                  <Send
                    className="w-3.5 h-3.5 text-[#D96B0C] dark:text-[#FFC800]"
                    aria-hidden="true"
                  />
                  <span>Export Watchlist</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  aria-label="Sign out of Google Workspace"
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-600 dark:text-neutral-300 whitespace-nowrap shrink-0 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC800]"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Sign out</span>
                </button>
              </>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvUpload}
              className="hidden"
              aria-label="Upload CSV fallback file"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-800 dark:text-neutral-200 whitespace-nowrap shrink-0 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC800]"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Upload CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setDarkMode((prev) => !prev)}
              aria-label={
                darkMode ? 'Switch to light theme' : 'Switch to dark theme'
              }
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-800 dark:text-neutral-200 whitespace-nowrap shrink-0 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC800]"
            >
              {darkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-[#FFC800]" aria-hidden="true" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mobile View Switcher (visible below md breakpoint) */}
        <div
          role="tablist"
          aria-label="Dashboard view selector"
          className="flex md:hidden items-center gap-1 p-1 rounded-lg bg-neutral-200/70 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-[#FFC800] shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Workspace Notice Banner */}
        {notice && (
          <div
            role="status"
            className="rounded-lg border border-emerald-300 dark:border-emerald-900/70 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 flex items-center justify-between gap-3 text-xs text-emerald-900 dark:text-emerald-200"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2
                className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0"
                aria-hidden="true"
              />
              <span>{notice}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Error Alert Banner */}
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-300 dark:border-red-900/70 bg-red-50 dark:bg-red-950/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-semibold text-red-900 dark:text-red-200">
                  Unable to load Google Sheets dataset
                </p>
                <p className="text-xs text-red-800 dark:text-red-300 mt-0.5 leading-relaxed">
                  {error}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {(needsAuth || !accessToken) && (
                <GoogleSignInButton
                  onClick={() => void handleGoogleSignIn()}
                  loading={isLoggingIn}
                />
              )}
              <button
                type="button"
                onClick={() => void syncFromGoogleSheet()}
                className="h-9 px-3.5 rounded-md bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-medium whitespace-nowrap cursor-pointer"
              >
                Retry Sync
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-9 px-3.5 rounded-md border border-red-300 dark:border-red-800 bg-white dark:bg-neutral-900 text-red-900 dark:text-red-200 text-xs font-medium whitespace-nowrap cursor-pointer"
              >
                Upload CSV
              </button>
            </div>
          </div>
        )}

        {/* Loading Skeleton vs Active Dashboard */}
        {loading && employees.length === 0 ? (
          <div className="space-y-5" aria-busy="true" aria-label="Loading workforce data">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-28 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 animate-pulse p-5"
                />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 animate-pulse" />
              <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 animate-pulse" />
            </div>
          </div>
        ) : employees.length > 0 ? (
          <>
            <FilterBar
              filters={filters}
              onChange={setFilters}
              onReset={() => setFilters(INITIAL_FILTERS)}
              options={filterOptions}
              filteredCount={filteredEmployees.length}
              totalCount={employees.length}
            />

            {activeTab === 'overview' && (
              <OverviewView employees={filteredEmployees} darkMode={darkMode} />
            )}
            {activeTab === 'deep-dive' && (
              <DeepDiveView employees={filteredEmployees} darkMode={darkMode} />
            )}
            {activeTab === 'insights' && (
              <InsightsView employees={filteredEmployees} />
            )}
          </>
        ) : null}
      </main>

      <GoogleSheetsPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        accessToken={accessToken}
        currentSpreadsheetId={activeSpreadsheetId}
        currentSheetTitle={activeSheetTitle}
        onSelectSheet={async (id, title, tab) => {
          await loadViaSheetsApi(id, title, tab);
          setNotice(`Loaded "${tab}" from "${title}".`);
        }}
        onRequireReauth={() => {
          setPickerOpen(false);
          clearAccessToken();
          setAccessToken(null);
          setNeedsAuth(true);
          setError('Your Google Workspace session expired. Please sign in again.');
        }}
      />

      <ConfirmSheetExportModal
        open={confirmExportOpen}
        onCancel={() => setConfirmExportOpen(false)}
        onConfirm={handleConfirmExportWatchlist}
        spreadsheetTitle={activeSpreadsheetTitle}
        targetTabTitle={WATCHLIST_TAB_TITLE}
        rowCount={topWatchlist.length}
        exporting={exportingSheet}
      />
    </div>
  );
}
