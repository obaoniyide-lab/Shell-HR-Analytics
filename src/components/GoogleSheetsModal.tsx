import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  FileSpreadsheet,
  FolderSearch,
  Loader2,
  X,
} from 'lucide-react';
import {
  extractSpreadsheetId,
  getSpreadsheetMetadata,
  listUserSpreadsheets,
  WorkspaceAuthError,
  type DriveSpreadsheetItem,
  type SpreadsheetMeta,
} from '../services/googleSheetsApi';
import { SHEET_ID } from '../utils/csvParser';

interface GoogleSheetsPickerModalProps {
  open: boolean;
  onClose: () => void;
  accessToken: string | null;
  currentSpreadsheetId: string;
  currentSheetTitle?: string;
  onSelectSheet: (
    spreadsheetId: string,
    spreadsheetTitle: string,
    sheetTitle: string
  ) => Promise<void>;
  onRequireReauth: () => void;
}

export function GoogleSheetsPickerModal({
  open,
  onClose,
  accessToken,
  currentSpreadsheetId,
  currentSheetTitle,
  onSelectSheet,
  onRequireReauth,
}: GoogleSheetsPickerModalProps) {
  const [driveFiles, setDriveFiles] = useState<DriveSpreadsheetItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [urlInput, setUrlInput] = useState(currentSpreadsheetId);
  const [selectedMeta, setSelectedMeta] = useState<SpreadsheetMeta | null>(null);
  const [loadingTabs, setLoadingTabs] = useState(false);
  const [chosenTab, setChosenTab] = useState<string>(currentSheetTitle ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadMetadataForId = async (id: string, token: string) => {
    setLoadingTabs(true);
    setModalError(null);
    try {
      const meta = await getSpreadsheetMetadata(id, token);
      setSelectedMeta(meta);
      if (meta.sheets.length > 0) {
        const match =
          meta.sheets.find((s) => s.title === currentSheetTitle) ??
          meta.sheets[0];
        setChosenTab(match.title);
      } else {
        setChosenTab('');
      }
    } catch (err) {
      if (err instanceof WorkspaceAuthError) {
        onRequireReauth();
        return;
      }
      setSelectedMeta(null);
      setModalError(
        err instanceof Error ? err.message : 'Unable to inspect spreadsheet tabs.'
      );
    } finally {
      setLoadingTabs(false);
    }
  };

  useEffect(() => {
    if (!open || !accessToken) return;
    let active = true;
    setModalError(null);
    setLoadingFiles(true);

    listUserSpreadsheets(accessToken)
      .then((files) => {
        if (!active) return;
        setDriveFiles(files);
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof WorkspaceAuthError) {
          onRequireReauth();
          return;
        }
        setModalError(
          err instanceof Error
            ? err.message
            : 'Unable to list spreadsheets from Google Drive.'
        );
      })
      .finally(() => {
        if (active) setLoadingFiles(false);
      });

    void loadMetadataForId(currentSpreadsheetId || SHEET_ID, accessToken);

    return () => {
      active = false;
    };
  }, [open, accessToken]);

  if (!open) return null;

  const handleInspectUrl = () => {
    if (!accessToken) {
      onRequireReauth();
      return;
    }
    const id = extractSpreadsheetId(urlInput);
    if (!id) {
      setModalError('Enter a valid Google Sheets URL or Spreadsheet ID.');
      return;
    }
    void loadMetadataForId(id, accessToken);
  };

  const handleConfirmLoad = async () => {
    if (!selectedMeta || !chosenTab) return;
    setSubmitting(true);
    setModalError(null);
    try {
      await onSelectSheet(
        selectedMeta.spreadsheetId,
        selectedMeta.title,
        chosenTab
      );
      onClose();
    } catch (err) {
      setModalError(
        err instanceof Error
          ? err.message
          : 'Failed to load data from selected sheet tab.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheets-picker-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
    >
      <div className="w-full max-w-2xl rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-[#F58220]" aria-hidden="true" />
            <h2
              id="sheets-picker-title"
              className="text-base font-semibold text-neutral-950 dark:text-neutral-50"
            >
              Connect Google Spreadsheet
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Google Sheets picker"
            className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {modalError && (
            <div
              role="alert"
              className="rounded-md border border-red-300 dark:border-red-900/70 bg-red-50 dark:bg-red-950/40 p-3 flex items-start gap-2.5 text-xs text-red-800 dark:text-red-200"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              <span>{modalError}</span>
            </div>
          )}

          {/* Direct Spreadsheet ID / URL */}
          <div>
            <label
              htmlFor="sheet-url-input"
              className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5"
            >
              Spreadsheet URL or ID
            </label>
            <div className="flex gap-2">
              <input
                id="sheet-url-input"
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste Google Sheets URL or Spreadsheet ID..."
                className="flex-1 h-10 px-3 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm font-mono text-neutral-900 dark:text-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC800]"
              />
              <button
                type="button"
                onClick={handleInspectUrl}
                disabled={loadingTabs}
                className="h-10 px-4 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-medium text-neutral-900 dark:text-neutral-100 whitespace-nowrap cursor-pointer"
              >
                {loadingTabs ? 'Inspecting...' : 'Inspect'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setUrlInput(SHEET_ID);
                  if (accessToken) {
                    void loadMetadataForId(SHEET_ID, accessToken);
                  }
                }}
                className="h-10 px-3 rounded-md border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 whitespace-nowrap cursor-pointer"
              >
                Shell UK Default
              </button>
            </div>
          </div>

          {/* Recent Spreadsheets from Drive */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                <FolderSearch className="w-3.5 h-3.5" aria-hidden="true" />
                Your Google Drive Spreadsheets
              </span>
              {loadingFiles && (
                <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading Drive...
                </span>
              )}
            </div>

            <div className="rounded-md border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800 max-h-44 overflow-y-auto">
              {!loadingFiles && driveFiles.length === 0 ? (
                <div className="p-4 text-xs text-neutral-500 dark:text-neutral-400">
                  No spreadsheets found in your Drive list. You can paste any shared Google Sheets URL or ID above.
                </div>
              ) : (
                driveFiles.map((file) => {
                  const isSelected = selectedMeta?.spreadsheetId === file.id;
                  return (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => {
                        setUrlInput(file.id);
                        if (accessToken) {
                          void loadMetadataForId(file.id, accessToken);
                        }
                      }}
                      className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#FFC800]/15 dark:bg-[#FFC800]/10 text-neutral-950 dark:text-neutral-50'
                          : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60 text-neutral-800 dark:text-neutral-200'
                      }`}
                    >
                      <span className="font-medium truncate">{file.name}</span>
                      <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400 shrink-0 tabular-nums">
                        {file.modifiedTime
                          ? new Date(file.modifiedTime).toLocaleDateString('en-GB')
                          : file.id.slice(0, 8)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Sheet Tab Selection (from metadata, never hardcoded) */}
          {selectedMeta && (
            <div className="rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  {selectedMeta.title}
                </span>
                <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                  {selectedMeta.sheets.length} tab(s)
                </span>
              </div>

              <div>
                <label
                  htmlFor="sheet-tab-select"
                  className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1"
                >
                  Select worksheet tab to load
                </label>
                <select
                  id="sheet-tab-select"
                  value={chosenTab}
                  onChange={(e) => setChosenTab(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC800]"
                >
                  {selectedMeta.sheets.map((tab) => (
                    <option key={tab.sheetId} value={tab.title}>
                      {tab.title}
                      {tab.rowCount ? ` (${tab.rowCount} rows)` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-2.5 bg-neutral-50 dark:bg-neutral-950">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-md border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedMeta || !chosenTab || submitting}
            onClick={() => void handleConfirmLoad()}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-[#FFC800] hover:bg-[#f0bc00] text-neutral-950 text-xs font-semibold disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                Load Sheet Data
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ConfirmSheetExportModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  spreadsheetTitle: string;
  targetTabTitle: string;
  rowCount: number;
  exporting: boolean;
}

export function ConfirmSheetExportModal({
  open,
  onCancel,
  onConfirm,
  spreadsheetTitle,
  targetTabTitle,
  rowCount,
  exporting,
}: ConfirmSheetExportModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-export-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <h2
            id="confirm-export-title"
            className="text-base font-semibold text-neutral-950 dark:text-neutral-50"
          >
            Confirm Google Sheet Update
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={exporting}
            aria-label="Cancel export"
            className="p-1 rounded-md text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3 text-sm text-neutral-700 dark:text-neutral-300">
          <p className="leading-relaxed">
            This will write <span className="font-mono font-semibold">{rowCount}</span>{' '}
            flight-risk watchlist rows into your Google Spreadsheet and overwrite any existing rows in that tab:
          </p>
          <div className="rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-3 text-xs space-y-1">
            <div>
              <span className="text-neutral-500 dark:text-neutral-400">Spreadsheet:</span>{' '}
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {spreadsheetTitle}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 dark:text-neutral-400">Target Tab:</span>{' '}
              <span className="font-mono font-medium text-neutral-900 dark:text-neutral-100">
                {targetTabTitle}
              </span>
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-2.5 bg-neutral-50 dark:bg-neutral-950">
          <button
            type="button"
            onClick={onCancel}
            disabled={exporting}
            className="h-9 px-4 rounded-md border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-[#F58220] hover:bg-[#e07316] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
          >
            {exporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Updating Sheet...
              </>
            ) : (
              'Confirm Update'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
