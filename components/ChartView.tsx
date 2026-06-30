"use client";

import { useMemo, useRef, useState } from "react";

interface ChartData {
  tickers: string[];
  startDate: string;
  endDate: string;
  priceField?: "close" | "adjusted_close";
  dates: string[];
  raw: Record<string, (number | null)[]>;
  rebased: Record<string, (number | null)[]>;
}

interface ChartViewProps {
  data: unknown;
  filename?: string;
}

interface FailedTicker {
  ticker: string;
  error: string;
}

interface DisplaySeries {
  key: string;
  label: string;
  values: (number | null)[];
  colour: string;
  dashed?: boolean;
}

interface Annotation {
  date: string;
  label: string;
}

interface SummaryStat {
  ticker: string;
  start: number | null;
  end: number | null;
  totalReturn: number | null;
  annualizedReturn: number | null;
  volatility: number | null;
  maxDrawdown: number | null;
  currentDrawdown: number | null;
  bestDay: number | null;
  worstDay: number | null;
}

type ChartMode =
  | "rebased"
  | "return"
  | "excess"
  | "ratio"
  | "moving_average"
  | "volatility"
  | "correlation"
  | "drawdown"
  | "raw";

const COLOURS = [
  "#1f77b4",
  "#d62728",
  "#2ca02c",
  "#ff7f0e",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#17becf",
];

const MODE_LABELS: Array<[ChartMode, string]> = [
  ["rebased", "Rebased"],
  ["return", "Return %"],
  ["excess", "Excess"],
  ["ratio", "Ratio"],
  ["moving_average", "Moving Avg"],
  ["volatility", "Volatility"],
  ["correlation", "Correlation"],
  ["drawdown", "Drawdown"],
  ["raw", "Raw prices"],
];

function extractChartData(data: unknown): ChartData | null {
  if (!data || typeof data !== "object") return null;
  const cd = (data as { chartData?: unknown }).chartData;
  if (!cd || typeof cd !== "object") return null;
  const c = cd as ChartData;
  if (
    !Array.isArray(c.tickers) ||
    !Array.isArray(c.dates) ||
    !c.raw ||
    !c.rebased
  ) {
    return null;
  }
  return c;
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const year = String(d.getUTCFullYear()).slice(2);
  return `${month} '${year}`;
}

function formatLongDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function pctReturn(prev: number, next: number): number | null {
  if (prev === 0) return null;
  return (next / prev - 1) * 100;
}

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function movingAverage(values: (number | null)[], window: number): (number | null)[] {
  return values.map((_, idx) => {
    const slice = values.slice(Math.max(0, idx - window + 1), idx + 1);
    const nums = slice.filter(finite);
    if (nums.length < Math.min(window, idx + 1)) return null;
    return nums.reduce((sum, v) => sum + v, 0) / nums.length;
  });
}

function returns(values: (number | null)[]): (number | null)[] {
  return values.map((value, idx) => {
    if (idx === 0) return null;
    const prev = values[idx - 1];
    if (!finite(prev) || !finite(value)) return null;
    return pctReturn(prev, value);
  });
}

function std(values: number[]): number | null {
  if (values.length < 2) return null;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

function rollingVolatility(values: (number | null)[], window: number): (number | null)[] {
  const rets = returns(values);
  return rets.map((_, idx) => {
    const nums = rets.slice(Math.max(0, idx - window + 1), idx + 1).filter(finite);
    const s = std(nums);
    return s === null ? null : s * Math.sqrt(252);
  });
}

function rollingCorrelation(
  a: (number | null)[],
  b: (number | null)[],
  window: number
): (number | null)[] {
  const ar = returns(a);
  const br = returns(b);
  return ar.map((_, idx) => {
    const pairs: Array<[number, number]> = [];
    for (let i = Math.max(0, idx - window + 1); i <= idx; i++) {
      const av = ar[i];
      const bv = br[i];
      if (finite(av) && finite(bv)) pairs.push([av, bv]);
    }
    if (pairs.length < 3) return null;
    const ax = pairs.map((p) => p[0]);
    const bx = pairs.map((p) => p[1]);
    const aAvg = ax.reduce((sum, v) => sum + v, 0) / ax.length;
    const bAvg = bx.reduce((sum, v) => sum + v, 0) / bx.length;
    const cov = pairs.reduce((sum, [x, y]) => sum + (x - aAvg) * (y - bAvg), 0);
    const aVar = ax.reduce((sum, x) => sum + (x - aAvg) ** 2, 0);
    const bVar = bx.reduce((sum, y) => sum + (y - bAvg) ** 2, 0);
    const denom = Math.sqrt(aVar * bVar);
    return denom === 0 ? null : cov / denom;
  });
}

function drawdown(values: (number | null)[]): (number | null)[] {
  let peak: number | null = null;
  return values.map((value) => {
    if (!finite(value)) return null;
    peak = peak === null ? value : Math.max(peak, value);
    return peak === 0 ? 0 : ((value - peak) / peak) * 100;
  });
}

function firstFinite(values: (number | null)[]): number | null {
  return values.find(finite) ?? null;
}

function lastFinite(values: (number | null)[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    if (finite(values[i])) return values[i];
  }
  return null;
}

function maxDrawdown(values: (number | null)[]): number | null {
  const dds = drawdown(values).filter(finite);
  return dds.length ? Math.min(...dds) : null;
}

function commonStartIndex(chart: ChartData): number {
  for (let i = 0; i < chart.dates.length; i++) {
    if (chart.tickers.every((ticker) => finite(chart.raw[ticker]?.[i]))) return i;
  }
  return 0;
}

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str;
}

export default function ChartView({ data, filename }: ChartViewProps) {
  const chart = useMemo(() => extractChartData(data), [data]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const failed = useMemo(() => {
    if (!data || typeof data !== "object") return [];
    const maybeFailed = (data as { failed?: unknown }).failed;
    if (!Array.isArray(maybeFailed)) return [];
    return maybeFailed.filter(
      (item): item is FailedTicker =>
        !!item &&
        typeof item === "object" &&
        typeof (item as FailedTicker).ticker === "string" &&
        typeof (item as FailedTicker).error === "string"
    );
  }, [data]);

  const [mode, setMode] = useState<ChartMode>("rebased");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [benchmark, setBenchmark] = useState<string>("");
  const [commonOnly, setCommonOnly] = useState(false);
  const [logScale, setLogScale] = useState(false);
  const [maWindow, setMaWindow] = useState(20);
  const [rollingWindow, setRollingWindow] = useState(20);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotationDate, setAnnotationDate] = useState("");
  const [annotationLabel, setAnnotationLabel] = useState("");

  const activeBenchmark = chart?.tickers.includes(benchmark)
    ? benchmark
    : chart?.tickers[0] || "";

  const analysis = useMemo(() => {
    if (!chart) return null;
    const startIdx = commonOnly ? commonStartIndex(chart) : 0;
    const dates = chart.dates.slice(startIdx);
    const tickers = chart.tickers;
    const slice = (values: (number | null)[]) => values.slice(startIdx);
    const raw = Object.fromEntries(
      tickers.map((ticker) => [ticker, slice(chart.raw[ticker] || [])])
    ) as Record<string, (number | null)[]>;
    const rebased = Object.fromEntries(
      tickers.map((ticker) => [ticker, slice(chart.rebased[ticker] || [])])
    ) as Record<string, (number | null)[]>;
    const firstPeer = tickers.find((ticker) => ticker !== activeBenchmark) || tickers[0];
    const series: DisplaySeries[] = [];

    if (mode === "raw") {
      tickers.forEach((ticker, idx) => {
        series.push({
          key: ticker,
          label: ticker,
          values: raw[ticker],
          colour: COLOURS[idx % COLOURS.length],
        });
      });
    } else if (mode === "moving_average") {
      tickers.forEach((ticker, idx) => {
        series.push({
          key: `${ticker}-raw`,
          label: ticker,
          values: raw[ticker],
          colour: COLOURS[idx % COLOURS.length],
          dashed: true,
        });
        series.push({
          key: `${ticker}-ma`,
          label: `${ticker} MA${maWindow}`,
          values: movingAverage(raw[ticker], maWindow),
          colour: COLOURS[idx % COLOURS.length],
        });
      });
    } else if (mode === "return") {
      tickers.forEach((ticker, idx) => {
        series.push({
          key: ticker,
          label: ticker,
          values: rebased[ticker].map((value) => (finite(value) ? value - 100 : null)),
          colour: COLOURS[idx % COLOURS.length],
        });
      });
    } else if (mode === "excess") {
      const bench = rebased[activeBenchmark] || [];
      tickers
        .filter((ticker) => ticker !== activeBenchmark)
        .forEach((ticker, idx) => {
          series.push({
            key: ticker,
            label: `${ticker} - ${activeBenchmark}`,
            values: rebased[ticker].map((value, i) =>
              finite(value) && finite(bench[i]) ? value - bench[i] : null
            ),
            colour: COLOURS[idx % COLOURS.length],
          });
        });
    } else if (mode === "ratio") {
      const numerator = firstPeer;
      const denominator = activeBenchmark;
      const num = raw[numerator] || [];
      const den = raw[denominator] || [];
      series.push({
        key: `${numerator}/${denominator}`,
        label: `${numerator} / ${denominator}`,
        values: num.map((value, i) =>
          finite(value) && finite(den[i]) && den[i] !== 0 ? (value / den[i]) * 100 : null
        ),
        colour: COLOURS[0],
      });
    } else if (mode === "volatility") {
      tickers.forEach((ticker, idx) => {
        series.push({
          key: ticker,
          label: `${ticker} ${rollingWindow}D vol`,
          values: rollingVolatility(raw[ticker], rollingWindow),
          colour: COLOURS[idx % COLOURS.length],
        });
      });
    } else if (mode === "correlation") {
      const peer = firstPeer;
      if (peer && activeBenchmark && peer !== activeBenchmark) {
        series.push({
          key: `${peer}-${activeBenchmark}-corr`,
          label: `${peer} vs ${activeBenchmark}`,
          values: rollingCorrelation(raw[peer], raw[activeBenchmark], rollingWindow),
          colour: COLOURS[0],
        });
      }
    } else if (mode === "drawdown") {
      tickers.forEach((ticker, idx) => {
        series.push({
          key: ticker,
          label: ticker,
          values: drawdown(rebased[ticker]),
          colour: COLOURS[idx % COLOURS.length],
        });
      });
    } else {
      tickers.forEach((ticker, idx) => {
        series.push({
          key: ticker,
          label: ticker,
          values: rebased[ticker],
          colour: COLOURS[idx % COLOURS.length],
        });
      });
    }

    const summary: SummaryStat[] = tickers.map((ticker) => {
      const prices = raw[ticker] || [];
      const rets = returns(prices).filter(finite);
      const start = firstFinite(prices);
      const end = lastFinite(prices);
      const totalReturn =
        finite(start) && finite(end) && start !== 0 ? (end / start - 1) * 100 : null;
      const days =
        dates.length > 1
          ? Math.max(
              1,
              (new Date(`${dates[dates.length - 1]}T00:00:00Z`).getTime() -
                new Date(`${dates[0]}T00:00:00Z`).getTime()) /
                86400000
            )
          : 1;
      const annualizedReturn =
        finite(totalReturn) && days > 0
          ? ((1 + totalReturn / 100) ** (365 / days) - 1) * 100
          : null;
      const dailyStd = std(rets);
      return {
        ticker,
        start,
        end,
        totalReturn,
        annualizedReturn,
        volatility: dailyStd === null ? null : dailyStd * Math.sqrt(252),
        maxDrawdown: maxDrawdown(rebased[ticker]),
        currentDrawdown: lastFinite(drawdown(rebased[ticker])),
        bestDay: rets.length ? Math.max(...rets) : null,
        worstDay: rets.length ? Math.min(...rets) : null,
      };
    });

    return { dates, series, summary };
  }, [activeBenchmark, chart, commonOnly, maWindow, mode, rollingWindow]);

  const dims = useMemo(() => {
    if (!analysis) return null;
    const width = 900;
    const height = 460;
    const margin = { top: 40, right: 130, bottom: 44, left: 62 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const allValues = analysis.series.flatMap((s) => s.values.filter(finite));
    if (allValues.length === 0 || analysis.dates.length === 0) return null;

    const canLog = logScale && allValues.every((value) => value > 0);
    const plotted = canLog ? allValues.map((value) => Math.log(value)) : allValues;
    const minV = Math.min(...plotted);
    const maxV = Math.max(...plotted);
    const pad = (maxV - minV) * 0.08 || 1;
    const baseline =
      mode === "rebased" ? 100 : ["return", "excess", "drawdown", "correlation"].includes(mode) ? 0 : null;
    const plottedBaseline = baseline !== null && (!canLog || baseline > 0)
      ? canLog
        ? Math.log(baseline)
        : baseline
      : null;
    const yMin =
      plottedBaseline !== null ? Math.min(minV, plottedBaseline) - pad : minV - pad;
    const yMax =
      plottedBaseline !== null ? Math.max(maxV, plottedBaseline) + pad : maxV + pad;
    const nDates = analysis.dates.length;
    const xAt = (i: number) =>
      margin.left + (nDates <= 1 ? innerW / 2 : (i / (nDates - 1)) * innerW);
    const plotValue = (value: number) => (canLog ? Math.log(value) : value);
    const yAt = (value: number) =>
      margin.top + innerH - ((plotValue(value) - yMin) / (yMax - yMin)) * innerH;
    // Evenly spaced ticks across the domain...
    const plottedTicks: number[] = [];
    for (let i = 0; i <= 6; i++) {
      plottedTicks.push(yMin + (i / 6) * (yMax - yMin));
    }
    // ...but when there's a baseline (rebased -> 100, return/excess/drawdown -> 0),
    // guarantee a labeled gridline exactly at it so the chart visibly anchors there,
    // and drop any auto tick that would render too close to overlap the baseline label.
    let plottedTicksFinal = plottedTicks;
    if (plottedBaseline !== null) {
      const minGap = ((yMax - yMin) * 14) / innerH;
      plottedTicksFinal = plottedTicks
        .filter((p) => Math.abs(p - plottedBaseline) > minGap)
        .concat(plottedBaseline)
        .sort((a, b) => a - b);
    }
    const yTicks = plottedTicksFinal.map((p) => (canLog ? Math.exp(p) : p));
    const xTickCount = Math.min(8, Math.max(3, Math.floor(nDates / 20)));
    const xTickIndices: number[] = [];
    for (let i = 0; i < xTickCount; i++) {
      const idx = Math.round((i / (xTickCount - 1 || 1)) * (nDates - 1));
      if (!xTickIndices.includes(idx)) xTickIndices.push(idx);
    }
    return {
      width,
      height,
      margin,
      innerW,
      innerH,
      baseline,
      yMin,
      yMax,
      canLog,
      xAt,
      yAt,
      yTicks,
      xTickIndices,
      nDates,
    };
  }, [analysis, logScale, mode]);

  if (!chart) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-sm">
        No chart data available.
      </div>
    );
  }

  if (!analysis || !dims) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-sm">
        No numeric values to plot.
      </div>
    );
  }

  const {
    width,
    height,
    margin,
    innerW,
    innerH,
    baseline,
    xAt,
    yAt,
    yTicks,
    xTickIndices,
    nDates,
  } = dims;

  const formatValue = (value: number): string => {
    if (mode === "raw" || mode === "moving_average" || mode === "ratio") {
      return value.toFixed(2);
    }
    if (mode === "rebased") return value.toFixed(1);
    if (mode === "correlation") return value.toFixed(2);
    return `${value.toFixed(1)}%`;
  };

  const downloadPng = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const source = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((pngBlob) => {
        URL.revokeObjectURL(url);
        if (!pngBlob) return;
        const pngUrl = URL.createObjectURL(pngBlob);
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = `${filename || "chart"}.png`;
        a.click();
        URL.revokeObjectURL(pngUrl);
      }, "image/png");
    };
    image.src = url;
  };

  const downloadChartCsv = () => {
    const headers = ["date", ...analysis.series.map((s) => s.label)];
    const rows = analysis.dates.map((date, idx) => [
      date,
      ...analysis.series.map((s) => s.values[idx] ?? ""),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename || "chart"}_series.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const addAnnotation = () => {
    if (!annotationDate || !annotationLabel.trim()) return;
    setAnnotations((prev) => [
      ...prev,
      { date: annotationDate, label: annotationLabel.trim() },
    ]);
    setAnnotationLabel("");
  };

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPx = ((e.clientX - rect.left) / rect.width) * width;
    if (xPx < margin.left || xPx > margin.left + innerW) {
      setHoverIdx(null);
      return;
    }
    const ratio = (xPx - margin.left) / innerW;
    const idx = Math.round(ratio * (nDates - 1));
    setHoverIdx(Math.max(0, Math.min(nDates - 1, idx)));
  };

  const modeTitle =
    MODE_LABELS.find(([key]) => key === mode)?.[1] || "Chart";
  const subtitle = `${formatLongDate(analysis.dates[0])} to ${formatLongDate(
    analysis.dates[analysis.dates.length - 1]
  )}`;
  const hoverX = hoverIdx !== null ? xAt(hoverIdx) : null;

  return (
    <div className="flex flex-col gap-4">
      {failed.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Some tickers could not be plotted:{" "}
          {failed.map((f) => `${f.ticker} (${f.error})`).join(", ")}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {MODE_LABELS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                mode === key
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 bg-white border border-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={downloadChartCsv}
            className="px-3 py-1 text-sm font-medium rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={downloadPng}
            className="px-3 py-1 text-sm font-medium rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          >
            Download PNG
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="mb-1 flex items-start justify-between gap-4">
            <div>
              <div className="text-base font-semibold text-gray-900">
                {modeTitle} — {analysis.series.map((s) => s.label).join(" vs ")}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {subtitle} · {analysis.dates.length} trading day
                {analysis.dates.length === 1 ? "" : "s"} ·{" "}
                {chart.priceField === "adjusted_close" ? "Adjusted close" : "Close"}
              </div>
            </div>
            {dims.canLog && (
              <div className="text-xs text-gray-500">log scale</div>
            )}
          </div>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto"
            preserveAspectRatio="xMidYMid meet"
            onMouseMove={handleMove}
            onMouseLeave={() => setHoverIdx(null)}
          >
            {yTicks.map((v, i) => (
              <g key={`yt-${i}`}>
                <line
                  x1={margin.left}
                  x2={margin.left + innerW}
                  y1={yAt(v)}
                  y2={yAt(v)}
                  stroke="#e5e7eb"
                  strokeWidth={0.8}
                  strokeDasharray="3 3"
                />
                <text
                  x={margin.left - 8}
                  y={yAt(v)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={10}
                  fill="#6b7280"
                >
                  {formatValue(v)}
                </text>
              </g>
            ))}

            {baseline !== null && (!dims.canLog || baseline > 0) && (
              <line
                x1={margin.left}
                x2={margin.left + innerW}
                y1={yAt(baseline)}
                y2={yAt(baseline)}
                stroke="#9ca3af"
                strokeWidth={1}
                strokeDasharray="4 3"
              />
            )}

            <line
              x1={margin.left}
              x2={margin.left}
              y1={margin.top}
              y2={margin.top + innerH}
              stroke="#d1d5db"
              strokeWidth={1}
            />

            {xTickIndices.map((i) => (
              <text
                key={`xt-${i}`}
                x={xAt(i)}
                y={margin.top + innerH + 16}
                textAnchor="middle"
                fontSize={10}
                fill="#6b7280"
              >
                {formatDateLabel(analysis.dates[i])}
              </text>
            ))}

            {annotations.map((annotation, idx) => {
              const i = analysis.dates.indexOf(annotation.date);
              if (i < 0) return null;
              const x = xAt(i);
              return (
                <g key={`${annotation.date}-${idx}`}>
                  <line
                    x1={x}
                    x2={x}
                    y1={margin.top}
                    y2={margin.top + innerH}
                    stroke="#f59e0b"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                  />
                  <text
                    x={x + 4}
                    y={margin.top + 10}
                    fontSize={9}
                    fill="#92400e"
                  >
                    {annotation.label}
                  </text>
                </g>
              );
            })}

            {analysis.series.map((s) => {
              let d = "";
              let lastValidIdx = -1;
              let lastValidVal = 0;
              let penDown = false;
              for (let i = 0; i < s.values.length; i++) {
                const v = s.values[i];
                if (!finite(v) || (dims.canLog && v <= 0)) {
                  penDown = false;
                  continue;
                }
                const x = xAt(i);
                const y = yAt(v);
                d += `${penDown ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)} `;
                penDown = true;
                lastValidIdx = i;
                lastValidVal = v;
              }
              return (
                <g key={s.key}>
                  <path
                    d={d.trim()}
                    fill="none"
                    stroke={s.colour}
                    strokeWidth={s.dashed ? 1.1 : 1.8}
                    strokeDasharray={s.dashed ? "4 3" : undefined}
                    opacity={s.dashed ? 0.6 : 1}
                  />
                  {lastValidIdx >= 0 && (
                    <text
                      x={xAt(lastValidIdx) + 6}
                      y={yAt(lastValidVal)}
                      dominantBaseline="middle"
                      fontSize={10}
                      fill={s.colour}
                      fontWeight={600}
                    >
                      {s.label} {formatValue(lastValidVal)}
                    </text>
                  )}
                </g>
              );
            })}

            {hoverIdx !== null && hoverX !== null && (
              <g>
                <line
                  x1={hoverX}
                  x2={hoverX}
                  y1={margin.top}
                  y2={margin.top + innerH}
                  stroke="#9ca3af"
                  strokeWidth={0.8}
                  strokeDasharray="2 2"
                />
                {analysis.series.map((s) => {
                  const v = s.values[hoverIdx];
                  if (!finite(v) || (dims.canLog && v <= 0)) return null;
                  return (
                    <circle
                      key={`hv-${s.key}`}
                      cx={hoverX}
                      cy={yAt(v)}
                      r={3.5}
                      fill="#fff"
                      stroke={s.colour}
                      strokeWidth={1.8}
                    />
                  );
                })}
              </g>
            )}
          </svg>

          {hoverIdx !== null && (
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-700 border-t border-gray-100 pt-2">
              <span className="font-mono text-gray-500">
                {formatLongDate(analysis.dates[hoverIdx])}
              </span>
              {analysis.series.map((s) => {
                const v = s.values[hoverIdx];
                if (!finite(v)) return null;
                return (
                  <span key={s.key} className="flex items-center gap-1.5">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: s.colour }}
                    />
                    <span className="font-medium">{s.label}</span>
                    <span className="font-mono">{formatValue(v)}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-sm font-semibold text-gray-900 mb-2">Controls</div>
            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="block text-xs font-medium text-gray-600 mb-1">
                  Benchmark
                </span>
                <select
                  value={activeBenchmark}
                  onChange={(e) => setBenchmark(e.target.value)}
                  className="w-full rounded border border-gray-200 bg-white px-2 py-1.5"
                >
                  {chart.tickers.map((ticker) => (
                    <option key={ticker} value={ticker}>
                      {ticker}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-gray-700">
                <input
                  type="checkbox"
                  checked={commonOnly}
                  onChange={(e) => setCommonOnly(e.target.checked)}
                />
                First common date
              </label>
              <label className="flex items-center gap-2 text-gray-700">
                <input
                  type="checkbox"
                  checked={logScale}
                  onChange={(e) => setLogScale(e.target.checked)}
                />
                Log scale
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-gray-600 mb-1">
                  Moving average
                </span>
                <select
                  value={maWindow}
                  onChange={(e) => setMaWindow(Number(e.target.value))}
                  className="w-full rounded border border-gray-200 bg-white px-2 py-1.5"
                >
                  {[20, 50, 200].map((window) => (
                    <option key={window} value={window}>
                      {window}D
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-gray-600 mb-1">
                  Rolling window
                </span>
                <select
                  value={rollingWindow}
                  onChange={(e) => setRollingWindow(Number(e.target.value))}
                  className="w-full rounded border border-gray-200 bg-white px-2 py-1.5"
                >
                  {[20, 60, 120].map((window) => (
                    <option key={window} value={window}>
                      {window}D
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-sm font-semibold text-gray-900 mb-2">Annotations</div>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={annotationDate}
                onChange={(e) => setAnnotationDate(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="rounded border border-gray-200 px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-500"
              />
              <input
                type="text"
                value={annotationLabel}
                onChange={(e) => setAnnotationLabel(e.target.value)}
                placeholder="Label"
                className="rounded border border-gray-200 px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-500"
              />
              <button
                type="button"
                onClick={addAnnotation}
                className="rounded bg-gray-900 px-2 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
              >
                Add Event
              </button>
              {annotations.length > 0 && (
                <div className="flex flex-col gap-1 pt-1">
                  {annotations.map((annotation, idx) => (
                    <button
                      key={`${annotation.date}-${idx}`}
                      type="button"
                      onClick={() =>
                        setAnnotations((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-left text-xs text-gray-600 hover:text-red-600"
                    >
                      {annotation.date} · {annotation.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-sm font-semibold text-gray-900 mb-3">Summary Stats</div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm text-gray-900">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-700">
                {[
                  "Ticker",
                  "Start",
                  "End",
                  "Return",
                  "Ann.",
                  "Vol.",
                  "Max DD",
                  "Current DD",
                  "Best Day",
                  "Worst Day",
                ].map((header) => (
                  <th key={header} className="py-2 pr-4 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analysis.summary.map((stat) => (
                <tr key={stat.ticker} className="border-b border-gray-50">
                  <td className="py-2 pr-4 font-semibold text-gray-950">{stat.ticker}</td>
                  <td className="py-2 pr-4 font-mono text-gray-900">
                    {stat.start?.toFixed(2) ?? ""}
                  </td>
                  <td className="py-2 pr-4 font-mono text-gray-900">
                    {stat.end?.toFixed(2) ?? ""}
                  </td>
                  {[
                    stat.totalReturn,
                    stat.annualizedReturn,
                    stat.volatility,
                    stat.maxDrawdown,
                    stat.currentDrawdown,
                    stat.bestDay,
                    stat.worstDay,
                  ].map((value, idx) => (
                    <td key={idx} className="py-2 pr-4 font-mono text-gray-900">
                      {finite(value) ? `${value.toFixed(1)}%` : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
