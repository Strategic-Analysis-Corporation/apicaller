"use client";

import { useEffect, useState } from "react";
import { ParamDef } from "../lib/types";
import { EXCHANGE_OPTIONS, resolveParamDefault } from "../lib/platforms";

interface ParamFormProps {
  params: ParamDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

interface RatioOption {
  ratioId: string;
  description: string;
}

const TICKER_PRESETS = [
  { label: "Indexes", value: "SPY, QQQ, IWM" },
  { label: "Megacap Tech", value: "AAPL, MSFT, NVDA, GOOGL, AMZN, META" },
  { label: "Defense", value: "ITA, RTX, LMT, NOC, GD" },
  { label: "Banks", value: "JPM, BAC, WFC, C, GS, MS" },
];

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d;
}

export default function ParamForm({
  params,
  values,
  onChange,
  onSubmit,
  loading,
}: ParamFormProps) {
  const [ratioOptions, setRatioOptions] = useState<RatioOption[]>([]);
  const [ratioLoading, setRatioLoading] = useState(false);

  useEffect(() => {
    const loadRatios = async () => {
      try {
        setRatioLoading(true);
        const response = await fetch("/data/fiscal_ratios.json");
        if (response.ok) {
          const data = await response.json();
          setRatioOptions(data);
        }
      } catch (error) {
        console.error("Failed to load fiscal ratios:", error);
      } finally {
        setRatioLoading(false);
      }
    };

    const hasRatioParam = params.some((p) => p.type === "searchable_ratio");
    if (hasRatioParam) {
      loadRatios();
    }
  }, [params]);

  const renderField = (param: ParamDef) => {
    const value = values[param.key] || "";
    const placeholderText = resolveParamDefault(param.default);

    if (param.type === "combo") {
      return (
        <select
          value={value}
          onChange={(e) => onChange(param.key, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">-- Select --</option>
          {param.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    if (param.type === "searchable_exchange") {
      return (
        <select
          value={value}
          onChange={(e) => onChange(param.key, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">-- Select --</option>
          {EXCHANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (param.type === "searchable_ratio") {
      const dataListId = `ratios-${param.key}`;
      return (
        <div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(param.key, e.target.value)}
            list={dataListId}
            placeholder="Enter or select a ratio"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <datalist id={dataListId}>
            {ratioOptions.map((opt) => (
              <option key={opt.ratioId} value={opt.ratioId}>
                {opt.ratioId} — {opt.description}
              </option>
            ))}
          </datalist>
          {ratioLoading && (
            <p className="mt-1 text-xs text-gray-500">Loading ratios...</p>
          )}
        </div>
      );
    }

    if (param.type === "ticker_list") {
      return (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(param.key, e.target.value)}
            placeholder={placeholderText}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="flex flex-wrap gap-1.5">
            {TICKER_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => onChange(param.key, preset.value)}
                className="px-2.5 py-1 rounded border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (param.key === "start_date") {
      const end = values.end_date
        ? new Date(`${values.end_date}T00:00:00Z`)
        : new Date();
      const shortcuts = [
        { label: "1M", value: isoDate(addMonths(end, -1)) },
        { label: "3M", value: isoDate(addMonths(end, -3)) },
        { label: "6M", value: isoDate(addMonths(end, -6)) },
        {
          label: "YTD",
          value: `${end.getUTCFullYear()}-01-01`,
        },
        { label: "1Y", value: isoDate(addYears(end, -1)) },
        { label: "3Y", value: isoDate(addYears(end, -3)) },
        { label: "5Y", value: isoDate(addYears(end, -5)) },
      ];

      return (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(param.key, e.target.value)}
            placeholder={placeholderText}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="flex flex-wrap gap-1.5">
            {shortcuts.map((shortcut) => (
              <button
                key={shortcut.label}
                type="button"
                onClick={() => onChange(param.key, shortcut.value)}
                className="px-2.5 py-1 rounded border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                {shortcut.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (param.key === "end_date") {
      return (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(param.key, e.target.value)}
            placeholder={placeholderText}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onChange(param.key, isoDate(new Date()))}
              className="px-2.5 py-1 rounded border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Today
            </button>
          </div>
        </div>
      );
    }

    if (param.key === "end_year") {
      const currentYear = new Date().getUTCFullYear();
      // Only step relative to the typed value when it's a full 4-digit year;
      // otherwise (blank/partial/non-numeric) anchor the stepper to the current year.
      const baseYear = /^\d{4}$/.test(value.trim())
        ? Number.parseInt(value, 10)
        : currentYear;
      const yearButtons = [
        { label: "−", ariaLabel: "Previous year", value: String(baseYear - 1) },
        { label: "This year", ariaLabel: "This year", value: String(currentYear) },
        { label: "+", ariaLabel: "Next year", value: String(baseYear + 1) },
      ];
      return (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(param.key, e.target.value)}
            placeholder={placeholderText}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="flex flex-wrap gap-1.5">
            {yearButtons.map((b) => (
              <button
                key={b.label}
                type="button"
                aria-label={b.ariaLabel}
                onClick={() => onChange(param.key, b.value)}
                className="px-2.5 py-1 rounded border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Default: text entry
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(param.key, e.target.value)}
        placeholder={placeholderText}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    );
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-4"
    >
      {params.map((param) => (
        <div key={param.key}>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            {param.label}
          </label>
          {renderField(param)}
        </div>
      ))}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )}
        Fetch Data
      </button>
    </form>
  );
}
