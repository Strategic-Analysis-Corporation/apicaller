export const FISCAL_STANDARDIZED_WORKBOOK_TYPE =
  "fiscalStandardizedFinancialsWorkbook" as const;

export const FISCAL_STATEMENTS = [
  { statementType: "income-statement", label: "Income Statement" },
  { statementType: "balance-sheet", label: "Balance Sheet" },
  { statementType: "cash-flow-statement", label: "Cash Flow Statement" },
] as const;

export const FISCAL_PERIOD_SHEETS = [
  { title: "Annual", aliases: ["annual"] },
  { title: "Quarterly", aliases: ["quarterly"] },
  { title: "Semi-Annual", aliases: ["semi-annual", "semiannual"] },
] as const;

export type FiscalStatementType =
  (typeof FISCAL_STATEMENTS)[number]["statementType"];

export type FiscalFinancialsSectionStatus = "fulfilled" | "failed";

export interface FiscalFinancialsSection {
  statementType: FiscalStatementType;
  label: string;
  status: FiscalFinancialsSectionStatus;
  data: unknown;
  params: Record<string, string>;
  error?: string;
  httpStatus?: number;
}

export interface FiscalStandardizedFinancialsWorkbook {
  type: typeof FISCAL_STANDARDIZED_WORKBOOK_TYPE;
  ticker: string;
  exchange: string;
  companyKey: string;
  requestedPeriodTypes: string;
  sections: FiscalFinancialsSection[];
}

export function buildFiscalCompanyKey(ticker: string, exchange: string): string {
  const normalizedTicker = ticker.trim();
  const normalizedExchange = exchange.trim();
  return normalizedTicker && normalizedExchange
    ? `${normalizedExchange}_${normalizedTicker}`
    : "";
}

export function normalizeFiscalPeriodType(value: unknown): string {
  return String(value || "").toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
}

export function isFiscalStandardizedFinancialsWorkbook(
  value: unknown
): value is FiscalStandardizedFinancialsWorkbook {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as { type?: unknown }).type === FISCAL_STANDARDIZED_WORKBOOK_TYPE &&
    Array.isArray((value as { sections?: unknown }).sections)
  );
}

export function buildFiscalCompanyRatiosParams({
  apiKey,
  companyKey,
  periodType,
  currency,
  ratioId,
}: {
  apiKey: string;
  companyKey: string;
  periodType: string;
  currency: string;
  ratioId: string;
}): URLSearchParams {
  return new URLSearchParams({
    companyKey,
    periodType,
    currency,
    ratioId,
    apiKey,
  });
}

export function buildFiscalDailyRatioHistoryParams({
  apiKey,
  companyKey,
}: {
  apiKey: string;
  companyKey: string;
}): URLSearchParams {
  return new URLSearchParams({
    companyKey,
    apiKey,
  });
}

export function buildFiscalFinancialsParams({
  apiKey,
  ticker,
  exchange,
  periodType,
  currency,
  limit,
}: {
  apiKey: string;
  ticker: string;
  exchange: string;
  periodType: string;
  currency?: string;
  limit: string;
}): URLSearchParams {
  const params = new URLSearchParams({
    ticker,
    exchange,
    companyKey: buildFiscalCompanyKey(ticker, exchange),
    periodType,
    limit,
    apiKey,
  });

  if (currency) {
    params.set("currency", currency);
  }

  return params;
}

export function buildFiscalCompaniesListParams({
  apiKey,
  pageNumber,
  pageSize,
}: {
  apiKey: string;
  pageNumber: string;
  pageSize: string;
}): URLSearchParams {
  return new URLSearchParams({
    pageNumber,
    pageSize,
    apiKey,
  });
}

export function buildFiscalCompanyProfileParams({
  apiKey,
  ticker,
  exchange,
}: {
  apiKey: string;
  ticker: string;
  exchange?: string;
}): URLSearchParams {
  const params = new URLSearchParams({ ticker });
  if (exchange) {
    params.set("exchange", exchange);
  }
  params.set("apiKey", apiKey);
  return params;
}

export function buildFiscalStandardizedMetricsListParams({
  apiKey,
}: {
  apiKey: string;
}): URLSearchParams {
  return new URLSearchParams({ apiKey });
}
