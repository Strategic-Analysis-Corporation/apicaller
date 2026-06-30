"use client";

import { useState, useMemo, Fragment } from "react";
import { PLATFORMS, resolveParamDefault } from "@/lib/platforms";
import { Tab } from "@/lib/types";
import PlatformSelector from "@/components/PlatformSelector";
import CallSelector from "@/components/CallSelector";
import ParamForm from "@/components/ParamForm";
import ResultTabs from "@/components/ResultTabs";
import JsonView from "@/components/JsonView";
import TableView from "@/components/TableView";
import ChartView from "@/components/ChartView";
import ExportButtons from "@/components/ExportButtons";
import IssueReportButton from "@/components/IssueReportButton";
import {
  isFiscalStandardizedFinancialsWorkbook,
  type FiscalStandardizedFinancialsWorkbook,
} from "@/lib/fiscal";
import {
  QUOTEMEDIA_ENHANCED_FINANCIALS_BUNDLE_TYPE,
  QUOTEMEDIA_ENHANCED_REPORT_TYPES,
  hasQuoteMediaEnhancedReports,
  isQuoteMediaEnhancedFinancialsBundle,
  type QuoteMediaEnhancedFinancialsBundle,
  type QuoteMediaEnhancedFinancialsSection,
} from "@/lib/quotemedia";

interface PartialFailure {
  ticker: string;
  error: string;
}

type ViewMode = "json" | "table" | "chart";

function extractPartialFailures(data: unknown): PartialFailure[] {
  if (!data || typeof data !== "object") return [];
  const failed = (data as { failed?: unknown }).failed;
  if (!Array.isArray(failed)) return [];
  return failed.filter(
    (item): item is PartialFailure =>
      !!item &&
      typeof item === "object" &&
      typeof (item as PartialFailure).ticker === "string" &&
      typeof (item as PartialFailure).error === "string"
  );
}

function formatFailures(failures: PartialFailure[]): string {
  return failures.map((f) => `${f.ticker} (${f.error})`).join(", ");
}

function getResponseErrorMessage(data: unknown, httpStatus: number): string {
  const responseData =
    data && typeof data === "object"
      ? (data as {
          error?: string;
          results?: { errors?: { message?: string }[] };
        })
      : null;
  const failures = extractPartialFailures(data);
  const baseMsg =
    responseData?.error ||
    responseData?.results?.errors?.[0]?.message ||
    `API returned ${httpStatus}`;
  const failureMsg = failures.length > 0 ? formatFailures(failures) : "";

  return failureMsg && !baseMsg.includes(failureMsg)
    ? `${baseMsg}: ${failureMsg}`
    : baseMsg;
}

function EnhancedFinancialsBundleNotice({
  bundle,
}: {
  bundle: QuoteMediaEnhancedFinancialsBundle;
}) {
  return (
    <div className="rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
      <div className="flex flex-wrap gap-2">
        {bundle.sections.map((section) => {
          const hasReports = hasQuoteMediaEnhancedReports(section.data);
          const text =
            section.status === "fulfilled" && hasReports
              ? `${section.label}: ready`
              : `${section.label}: ${section.error || "no reports returned"}`;
          const className =
            section.status === "fulfilled" && hasReports
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : section.status === "failed"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-amber-200 bg-amber-50 text-amber-800";

          return (
            <span
              key={section.reportType}
              className={`rounded border px-2 py-1 ${className}`}
            >
              {text}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function FiscalWorkbookNotice({
  bundle,
}: {
  bundle: FiscalStandardizedFinancialsWorkbook;
}) {
  return (
    <div className="rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
      <div className="flex flex-wrap gap-2">
        {bundle.sections.map((section) => {
          const className =
            section.status === "fulfilled"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800";
          const text =
            section.status === "fulfilled"
              ? `${section.label}: ready`
              : `${section.label}: ${section.error || "failed"}`;

          return (
            <span
              key={section.statementType}
              className={`rounded border px-2 py-1 ${className}`}
            >
              {text}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function tabHasChart(tab: Tab | undefined): boolean {
  const d = tab?.data;
  return !!(d && typeof d === "object" && (d as { chartData?: unknown }).chartData);
}

function ViewModeControls({
  tab,
  viewMode,
  onChange,
}: {
  tab: Tab | undefined;
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="flex gap-2">
      {tabHasChart(tab) && (
        <button
          onClick={() => onChange("chart")}
          className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
            viewMode === "chart"
              ? "bg-blue-100 text-blue-700"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Chart
        </button>
      )}
      <button
        onClick={() => onChange("json")}
        className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
          viewMode === "json"
            ? "bg-blue-100 text-blue-700"
            : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        JSON
      </button>
      <button
        onClick={() => onChange("table")}
        className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
          viewMode === "table"
            ? "bg-blue-100 text-blue-700"
            : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        Table
      </button>
    </div>
  );
}

function TabContent({
  tab,
  viewMode,
  onViewModeChange,
}: {
  tab: Tab;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}) {
  const failures = extractPartialFailures(tab.data);
  const enhancedBundle = isQuoteMediaEnhancedFinancialsBundle(tab.data)
    ? tab.data
    : null;
  const fiscalWorkbook = isFiscalStandardizedFinancialsWorkbook(tab.data)
    ? tab.data
    : null;

  if (tab.loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm">Fetching data...</span>
        </div>
      </div>
    );
  }

  if (tab.error && viewMode !== "json") {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-5">
          <div className="flex items-start gap-3">
            <span className="text-red-500 text-lg mt-0.5">!</span>
            <div className="flex-1">
              <p className="font-semibold text-red-800">Request Failed</p>
              <p className="text-sm text-red-700 mt-1">{tab.error}</p>
            </div>
            {tab.httpStatus && (
              <span className="shrink-0 px-2 py-1 bg-red-100 text-red-700 text-xs font-mono rounded">
                HTTP {tab.httpStatus}
              </span>
            )}
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
          <p className="font-semibold text-gray-800 text-sm mb-3">Diagnostics</p>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <span className="text-gray-500">Platform</span>
            <span className="font-mono text-gray-900">{tab.platform}</span>
            <span className="text-gray-500">Call</span>
            <span className="font-mono text-gray-900">{tab.callName}</span>
            <span className="text-gray-500">Call ID</span>
            <span className="font-mono text-gray-900">{tab.callId}</span>
            {Object.entries(tab.params).map(([k, v]) => (
              <Fragment key={k}>
                <span className="text-gray-500">{k}</span>
                <span className="font-mono text-gray-900">
                  {v || <span className="text-gray-400">(empty)</span>}
                </span>
              </Fragment>
            ))}
          </div>
          {tab.data != null && (
            <div className="mt-4">
              <button
                onClick={() => onViewModeChange("json")}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                View raw API response
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (viewMode === "json") {
    return <JsonView data={tab.data} />;
  }

  if (viewMode === "chart") {
    return (
      <ChartView
        data={tab.data}
        filename={`${tab.platform}_${tab.callName}_${new Date().toISOString().split("T")[0]}`}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {failures.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Partial data returned:{" "}
          {failures.map((f) => `${f.ticker} (${f.error})`).join(", ")}
        </div>
      )}
      {enhancedBundle && (
        <EnhancedFinancialsBundleNotice bundle={enhancedBundle} />
      )}
      {fiscalWorkbook && <FiscalWorkbookNotice bundle={fiscalWorkbook} />}
      <TableView data={tab.data} />
    </div>
  );
}

export default function Home() {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [splitTabId, setSplitTabId] = useState<string | null>(null);
  const [splitViewMode, setSplitViewMode] = useState<ViewMode>("table");

  const platform = useMemo(
    () => PLATFORMS.find((p) => p.name === selectedPlatform),
    [selectedPlatform]
  );

  const selectedCall = useMemo(
    () => platform?.calls.find((c) => c.id === selectedCallId),
    [platform, selectedCallId]
  );

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId),
    [tabs, activeTabId]
  );

  const splitTab = useMemo(
    () => tabs.find((t) => t.id === splitTabId),
    [tabs, splitTabId]
  );

  const anyLoading = tabs.some((t) => t.loading);

  const handleSelectPlatform = (name: string) => {
    setSelectedPlatform(name);
    setSelectedCallId(null);
    setParamValues({});
  };

  const handleSelectCall = (id: string) => {
    setSelectedCallId(id);
    const call = platform?.calls.find((c) => c.id === id);
    if (call) {
      const defaults: Record<string, string> = {};
      call.params.forEach((param) => {
        defaults[param.key] = resolveParamDefault(param.default);
      });
      setParamValues(defaults);
    }
  };

  const handleParamChange = (key: string, value: string) => {
    setParamValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleFetchData = async () => {
    if (!selectedPlatform || !selectedCallId || !selectedCall) return;

    const tabId = Date.now().toString();
    const firstParamKey = selectedCall.params[0]?.key;
    const firstParamValue = paramValues[firstParamKey];
    const tabLabel = firstParamValue
      ? `${firstParamValue} – ${selectedCall.name}`
      : selectedCall.name;

    const reqParams = { ...paramValues };
    const newTab: Tab = {
      id: tabId,
      label: tabLabel,
      data: null,
      platform: selectedPlatform,
      callName: selectedCall.name,
      callId: selectedCallId,
      params: reqParams,
      loading: true,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(tabId);

    try {
      const response = await fetch("/api/fetch-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformId: selectedPlatform,
          callId: selectedCallId,
          params: reqParams,
        }),
      });

      const data = await response.json();
      const httpStatus = response.status;

      if (!response.ok) {
        const apiMsg = getResponseErrorMessage(data, httpStatus);
        setTabs((prev) =>
          prev.map((t) =>
            t.id === tabId
              ? { ...t, data, error: apiMsg, loading: false, httpStatus }
              : t
          )
        );
        return;
      }

      // Check if the API returned an error inside a 200 response
      const inlineError = data?.results?.errors?.[0]?.message;
      if (inlineError) {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === tabId
              ? { ...t, data, error: inlineError, loading: false, httpStatus }
              : t
          )
        );
        return;
      }

      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId ? { ...t, data, loading: false, httpStatus } : t
        )
      );

      if (data && typeof data === "object" && (data as { chartData?: unknown }).chartData) {
        setViewMode("chart");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? { ...t, error: errorMessage, loading: false }
            : t
        )
      );
    }
  };

  const handleFetchAllEnhancedFinancials = async () => {
    if (
      selectedPlatform !== "QuoteMedia" ||
      selectedCallId !== "qm_enhanced_financials" ||
      !selectedCall
    ) {
      return;
    }

    const symbol = paramValues.symbol?.trim();
    if (!symbol) {
      const tabId = Date.now().toString();
      setTabs((prev) => [
        ...prev,
        {
          id: tabId,
          label: "Enhanced Financials A/Q/H",
          data: null,
          platform: selectedPlatform,
          callName: "Enhanced Financials A/Q/H",
          callId: "qm_enhanced_financials_bundle",
          params: { ...paramValues },
          error: "Missing required param: symbol",
          loading: false,
          httpStatus: 400,
        },
      ]);
      setActiveTabId(tabId);
      return;
    }

    const tabId = Date.now().toString();
    const baseParams = {
      ...paramValues,
      symbol,
      number_of_reports: paramValues.number_of_reports || "300",
    };

    setTabs((prev) => [
      ...prev,
      {
        id: tabId,
        label: `${symbol} – Enhanced Financials A/Q/H`,
        data: null,
        platform: selectedPlatform,
        callName: "Enhanced Financials A/Q/H",
        callId: "qm_enhanced_financials_bundle",
        params: baseParams,
        loading: true,
      },
    ]);
    setActiveTabId(tabId);
    setViewMode("table");

    const sections = await Promise.all(
      QUOTEMEDIA_ENHANCED_REPORT_TYPES.map(async ({ code, label }) => {
        const reqParams = { ...baseParams, report_type: code };

        try {
          const response = await fetch("/api/fetch-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              platformId: selectedPlatform,
              callId: "qm_enhanced_financials",
              params: reqParams,
            }),
          });

          const data = await response.json();
          const httpStatus = response.status;
          const inlineError = data?.results?.errors?.[0]?.message;
          const error = !response.ok
            ? getResponseErrorMessage(data, httpStatus)
            : inlineError;

          if (error) {
            return {
              reportType: code,
              label,
              status: code === "H" ? "skipped" : "failed",
              data,
              params: reqParams,
              error,
              httpStatus,
            } satisfies QuoteMediaEnhancedFinancialsSection;
          }

          if (!hasQuoteMediaEnhancedReports(data)) {
            return {
              reportType: code,
              label,
              status: "skipped",
              data,
              params: reqParams,
              error: `No ${label.toLowerCase()} reports returned`,
              httpStatus,
            } satisfies QuoteMediaEnhancedFinancialsSection;
          }

          return {
            reportType: code,
            label,
            status: "fulfilled",
            data,
            params: reqParams,
            httpStatus,
          } satisfies QuoteMediaEnhancedFinancialsSection;
        } catch (error) {
          return {
            reportType: code,
            label,
            status: code === "H" ? "skipped" : "failed",
            data: null,
            params: reqParams,
            error: error instanceof Error ? error.message : "Unknown error",
          } satisfies QuoteMediaEnhancedFinancialsSection;
        }
      })
    );

    const bundle: QuoteMediaEnhancedFinancialsBundle = {
      type: QUOTEMEDIA_ENHANCED_FINANCIALS_BUNDLE_TYPE,
      symbol,
      sections,
    };
    const successfulSections = sections.filter(
      (section) =>
        section.status === "fulfilled" &&
        hasQuoteMediaEnhancedReports(section.data)
    );
    const failedSections = sections.filter(
      (section) => section.status === "failed"
    );
    const topLevelError =
      successfulSections.length === 0 && failedSections.length > 0
        ? `Enhanced Financials A/Q/H failed: ${failedSections
            .map((section) => `${section.label} (${section.error})`)
            .join(", ")}`
        : undefined;

    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId
          ? {
              ...t,
              data: bundle,
              error: topLevelError,
              loading: false,
              httpStatus:
                topLevelError && failedSections[0]?.httpStatus
                  ? failedSections[0].httpStatus
                  : 200,
            }
          : t
      )
    );
  };

  const handleSelectTab = (id: string) => {
    setActiveTabId(id);
    const tab = tabs.find((t) => t.id === id);
    if (tabHasChart(tab)) setViewMode("chart");
    else if (viewMode === "chart") setViewMode("table");

    if (splitTabId === id) {
      const replacement = tabs.find((t) => t.id !== id);
      setSplitTabId(replacement?.id || null);
      setSplitViewMode(tabHasChart(replacement) ? "chart" : "table");
    }
  };

  const handleCloseTab = (id: string) => {
    const remaining = tabs.filter((t) => t.id !== id);
    setTabs((prev) => prev.filter((t) => t.id !== id));
    if (activeTabId === id) {
      const nextActiveId = remaining[remaining.length - 1]?.id || null;
      setActiveTabId(nextActiveId);
      if (nextActiveId && splitTabId === nextActiveId) {
        setSplitTabId(null);
      }
    }
    if (splitTabId === id) {
      setSplitTabId(null);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 border-b border-gray-200 bg-white flex items-center px-6 z-50">
        <h1 className="text-xl font-semibold text-gray-900">API Explorer</h1>
        <span className="ml-auto text-sm text-gray-500">v1.1.2</span>
      </header>

      {/* Left Sidebar */}
      <aside className="fixed top-16 left-0 bottom-0 w-80 border-r border-gray-200 bg-white overflow-y-auto p-6 pb-24 flex flex-col gap-6">
        {/* Platform Selector */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Platform</h2>
          <PlatformSelector
            platforms={PLATFORMS}
            selected={selectedPlatform}
            onSelect={handleSelectPlatform}
          />
        </div>

        {/* Call Selector */}
        {platform && (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Call</h2>
            <CallSelector
              calls={platform.calls}
              selected={selectedCallId}
              onSelect={handleSelectCall}
            />
          </div>
        )}

        {/* Parameters */}
        {selectedCall && (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Parameters
            </h2>
            {selectedCall.desc && (
              <p className="text-xs text-gray-600 mb-3">{selectedCall.desc}</p>
            )}
            <ParamForm
              params={selectedCall.params}
              values={paramValues}
              onChange={handleParamChange}
              onSubmit={handleFetchData}
              loading={anyLoading}
            />
            {selectedCallId === "qm_enhanced_financials" && (
              <button
                type="button"
                onClick={handleFetchAllEnhancedFinancials}
                disabled={anyLoading}
                className="w-full mt-3 bg-white border border-blue-200 text-blue-700 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed transition-colors"
              >
                Fetch A/Q/H
              </button>
            )}
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="fixed top-16 left-80 right-0 bottom-0 flex flex-col bg-gray-50 overflow-hidden">
        {/* Result Tabs */}
        {tabs.length > 0 ? (
          <>
            <ResultTabs
              tabs={tabs}
              activeTabId={activeTabId}
              onSelectTab={handleSelectTab}
              onCloseTab={handleCloseTab}
            />

            {/* View Toggle & Export */}
            <div className="border-b border-gray-200 bg-white px-6 py-3 flex flex-wrap items-center gap-3">
              <ViewModeControls
                tab={activeTab}
                viewMode={viewMode}
                onChange={setViewMode}
              />
              {activeTab && (
                <>
                  <ExportButtons
                    data={activeTab.data}
                    filename={`${activeTab.platform}_${activeTab.callName}_${new Date().toISOString().split("T")[0]}`}
                  />
                  <IssueReportButton tab={activeTab} />
                </>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (splitTabId) {
                      setSplitTabId(null);
                    } else {
                      const candidate = tabs.find((t) => t.id !== activeTabId);
                      setSplitTabId(candidate?.id || null);
                      setSplitViewMode(tabHasChart(candidate) ? "chart" : "table");
                    }
                  }}
                  disabled={tabs.length < 2}
                  className="px-3 py-1 text-sm font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {splitTabId ? "Exit Split" : "Split View"}
                </button>
                {splitTabId && (
                  <select
                    value={splitTabId}
                    onChange={(event) => {
                      const nextTab = tabs.find((t) => t.id === event.target.value);
                      setSplitTabId(event.target.value);
                      setSplitViewMode(tabHasChart(nextTab) ? "chart" : "table");
                    }}
                    className="max-w-64 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {tabs
                      .filter((tab) => tab.id !== activeTabId)
                      .map((tab) => (
                        <option key={tab.id} value={tab.id}>
                          {tab.label}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-6">
              {activeTab ? (
                splitTab ? (
                  <div className="grid min-h-full grid-cols-1 gap-6 xl:grid-cols-2">
                    <div className="min-w-0">
                      <TabContent
                        tab={activeTab}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                      />
                    </div>
                    <div className="min-w-0 border-t border-gray-200 pt-4 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          Compare
                        </span>
                        <ViewModeControls
                          tab={splitTab}
                          viewMode={splitViewMode}
                          onChange={setSplitViewMode}
                        />
                        <ExportButtons
                          data={splitTab.data}
                          filename={`${splitTab.platform}_${splitTab.callName}_${new Date().toISOString().split("T")[0]}`}
                        />
                        <IssueReportButton tab={splitTab} />
                      </div>
                      <TabContent
                        tab={splitTab}
                        viewMode={splitViewMode}
                        onViewModeChange={setSplitViewMode}
                      />
                    </div>
                  </div>
                ) : (
                  <TabContent
                    tab={activeTab}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                  />
                )
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <p>Select a platform and API call to get started</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
