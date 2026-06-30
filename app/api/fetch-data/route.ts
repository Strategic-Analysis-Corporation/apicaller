import { NextRequest, NextResponse } from 'next/server';
import {
  buildQuoteMediaEnhancedFinancialsParams,
  buildQuoteMediaExchangeParams,
  buildQuoteMediaProfileParams,
  getQuoteMediaExchangeGroup,
} from '@/lib/quotemedia';
import {
  FISCAL_STANDARDIZED_WORKBOOK_TYPE,
  FISCAL_STATEMENTS,
  type FiscalFinancialsSection,
  type FiscalStatementType,
  buildFiscalCompaniesListParams,
  buildFiscalCompanyKey,
  buildFiscalCompanyProfileParams,
  buildFiscalCompanyRatiosParams,
  buildFiscalDailyRatioHistoryParams,
  buildFiscalFinancialsParams,
  buildFiscalStandardizedMetricsListParams,
} from '@/lib/fiscal';
import { redactSecrets } from '@/lib/redaction';

// Types for the request body
interface FetchDataRequest {
  platformId: string;
  callId: string;
  params: Record<string, unknown>;
}

// Validate that a param looks like a ticker/symbol (no path traversal)
function isValidSymbol(value: string): boolean {
  return /^[A-Za-z0-9.:_\-]{1,30}$/.test(value);
}

function isValidLooseIdentifier(value: string, maxLength = 80): boolean {
  return /^[A-Za-z0-9.,:_\-\s]{1,80}$/.test(value) && value.length <= maxLength;
}

function isFiscalStatementType(value: string): value is FiscalStatementType {
  return FISCAL_STATEMENTS.some((item) => item.statementType === value);
}

function clampPageSize(value: string): string {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return "1000";
  return String(Math.min(Math.max(parsed, 1), 1000));
}

// Helper function to make HTTP requests with timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getConfiguredSecretValues(): string[] {
  return [
    process.env.QM_TOKEN,
    process.env.QM_WEBMASTER_ID,
    process.env.FISCAL_API_KEY,
    process.env.EODHD_API_TOKEN,
    process.env.FMP_API_KEY,
  ].filter((value): value is string => Boolean(value));
}

function safeJson(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(
    redactSecrets(data, getConfiguredSecretValues()),
    init
  );
}

// API call implementations
async function handleQuoteMediaCall(
  callId: string,
  params: Record<string, unknown>
): Promise<NextResponse> {
  const token = process.env.QM_TOKEN;
  const webmasterId = process.env.QM_WEBMASTER_ID;

  if (!token || !webmasterId) {
    return safeJson(
      { error: 'QuoteMedia API credentials not configured' },
      { status: 500 }
    );
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
  };

  let url: string;

  switch (callId) {
    case 'qm_earnings_events': {
      const symbol = params.symbol as string;
      const startYear = params.start_year as string;
      const endYear = params.end_year as string;

      if (!symbol || !startYear || !endYear) {
        return safeJson(
          { error: 'Missing required params: symbol, start_year, end_year' },
          { status: 400 }
        );
      }

      const queryParams = new URLSearchParams({
        webmasterId,
        symbol,
        startYear,
        endYear,
      });

      url = `https://quotes.quotemedia.com/data/getEarningsEventsBySymbol.json?${queryParams}`;
      break;
    }

    case 'qm_enhanced_financials': {
      const symbol = params.symbol as string;
      const reportType = params.report_type as string;
      const numberOfReports = params.number_of_reports as string | undefined;

      if (!symbol || !reportType) {
        return safeJson(
          { error: 'Missing required params: symbol, report_type' },
          { status: 400 }
        );
      }

      const queryParams = buildQuoteMediaEnhancedFinancialsParams({
        webmasterId,
        symbol,
        reportType,
        numberOfReports,
      });
      url = `https://quotes.quotemedia.com/v3/financials/enhanced?${queryParams}`;
      break;
    }

    case 'qm_dividends': {
      const symbol = params.symbol as string;
      const startDate = params.start_date as string;
      const endDate = params.end_date as string;

      if (!symbol) {
        return safeJson(
          { error: 'Missing required param: symbol' },
          { status: 400 }
        );
      }

      const queryParams = new URLSearchParams({
        symbol,
        webmaster_id: webmasterId,
      });
      if (startDate) queryParams.append('start_date', startDate);
      if (endDate) queryParams.append('end_date', endDate);
      url = `https://quotes.quotemedia.com/v3/events/dividends?${queryParams}`;
      break;
    }

    case 'qm_fundamentals_mini': {
      const exchangeGroup = params.exchange_group as string;

      if (!exchangeGroup) {
        return safeJson(
          { error: 'Missing required param: exchange_group' },
          { status: 400 }
        );
      }

      if (!getQuoteMediaExchangeGroup(exchangeGroup)) {
        return safeJson(
          { error: `Unsupported QuoteMedia exchange group: ${exchangeGroup}` },
          { status: 400 }
        );
      }

      const queryParams = buildQuoteMediaExchangeParams(
        webmasterId,
        exchangeGroup
      );

      url = `https://quotes.quotemedia.com/data/getFundamentalsMiniByExchange.json?${queryParams}`;

      // This call has a 60s timeout
      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers,
        timeout: 60000,
      });

      const data = await response.json();
      return safeJson(data, { status: response.ok ? 200 : response.status });
    }

    case 'qm_earnings_estimates_old': {
      const symbol = params.symbol as string;

      if (!symbol) {
        return safeJson(
          { error: 'Missing required param: symbol' },
          { status: 400 }
        );
      }

      const queryParams = new URLSearchParams({
        webmasterId,
        symbol,
      });

      url = `https://quotes.quotemedia.com/data/getEarningsEstimates.json?${queryParams}`;
      break;
    }

    case 'qm_earnings_estimates_v3': {
      const symbol = params.symbol as string;

      if (!symbol) {
        return safeJson(
          { error: 'Missing required param: symbol' },
          { status: 400 }
        );
      }

      const queryParams = new URLSearchParams({
        symbol,
        webmaster_id: webmasterId,
      });
      url = `https://quotes.quotemedia.com/v3/earnings/estimates?${queryParams}`;
      break;
    }

    case 'qm_profiles': {
      const symbol = params.symbol as string;

      if (!symbol) {
        return safeJson(
          { error: 'Missing required param: symbol' },
          { status: 400 }
        );
      }

      const queryParams = buildQuoteMediaProfileParams(webmasterId, symbol);

      url = `https://app.quotemedia.com/data/getProfiles.json?${queryParams}`;
      break;
    }

    default:
      return safeJson(
        { error: `Unknown QuoteMedia callId: ${callId}` },
        { status: 400 }
      );
  }

  try {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers,
      timeout: 30000,
    });

    const data = await response.json();
    // Pass through the response even on error status — the body has useful error details
    return safeJson(data, { status: response.ok ? 200 : response.status });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return safeJson(
        { error: 'Request timeout — the API took too long to respond' },
        { status: 504 }
      );
    }
    return safeJson(
      { error: `QuoteMedia request failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

async function handleFiscalAiCall(
  callId: string,
  params: Record<string, unknown>
): Promise<NextResponse> {
  const apiKey = process.env.FISCAL_API_KEY;

  if (!apiKey) {
    return safeJson(
      { error: 'Fiscal.ai API key not configured' },
      { status: 500 }
    );
  }

  const fetchFiscalUrl = async (url: string, timeout = 30000) => {
    try {
      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        timeout,
      });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : { detail: await response.text() };

      if (!response.ok) {
        return safeJson(
          {
            error: `Fiscal.ai API error: ${response.statusText || response.status}`,
            detail: data,
          },
          { status: response.status }
        );
      }

      return safeJson(data);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return safeJson(
          { error: 'Request timeout' },
          { status: 504 }
        );
      }
      return safeJson(
        { error: `Fiscal.ai request failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      );
    }
  };

  const fetchFiscalSection = async ({
    ticker,
    exchange,
    statementType,
    periodType,
    currency,
    limit,
  }: {
    ticker: string;
    exchange: string;
    statementType: FiscalStatementType;
    periodType: string;
    currency: string;
    limit: string;
  }): Promise<FiscalFinancialsSection> => {
    const statement = FISCAL_STATEMENTS.find(
      (item) => item.statementType === statementType
    )!;
    const sectionParams = {
      ticker,
      exchange,
      statement_type: statementType,
      period_type: periodType,
      currency,
      limit,
    };
    const queryParams = buildFiscalFinancialsParams({
      apiKey,
      ticker,
      exchange,
      periodType,
      currency,
      limit,
    });
    const url = `https://api.fiscal.ai/v1/company/financials/${encodeURIComponent(statementType)}/standardized?${queryParams}`;

    try {
      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        timeout: 45000,
      });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : { detail: await response.text() };

      if (!response.ok) {
        return {
          statementType,
          label: statement.label,
          status: "failed",
          data,
          params: sectionParams,
          error: `HTTP ${response.status}: ${response.statusText || "Fiscal.ai error"}`,
          httpStatus: response.status,
        };
      }

      return {
        statementType,
        label: statement.label,
        status: "fulfilled",
        data,
        params: sectionParams,
        httpStatus: response.status,
      };
    } catch (error) {
      return {
        statementType,
        label: statement.label,
        status: "failed",
        data: null,
        params: sectionParams,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  switch (callId) {
    case 'fiscal_company_ratios': {
      const companyKey = String(params.company_key || "").trim();
      const periodType = String(params.period_type || "").trim();
      const currency = String(params.currency || "").trim();
      const ratioId = String(params.ratio_id || "").trim();

      if (!companyKey || !periodType || !currency || !ratioId) {
        return safeJson(
          { error: 'Missing required params: company_key, period_type, currency, ratio_id' },
          { status: 400 }
        );
      }

      const queryParams = buildFiscalCompanyRatiosParams({
        apiKey,
        companyKey,
        periodType,
        currency,
        ratioId,
      });
      const url = `https://api.fiscal.ai/v1/company/ratios?${queryParams}`;
      return await fetchFiscalUrl(url);
    }

    case 'fiscal_daily_ratio_history': {
      const companyKey = String(params.company_key || "").trim();
      const ratioId = String(params.ratio_id || "").trim();

      if (!companyKey || !ratioId) {
        return safeJson(
          { error: 'Missing required params: company_key, ratio_id' },
          { status: 400 }
        );
      }

      const queryParams = buildFiscalDailyRatioHistoryParams({
        apiKey,
        companyKey,
      });
      const url = `https://api.fiscal.ai/v1/company/ratios/daily/${encodeURIComponent(ratioId)}?${queryParams}`;
      return await fetchFiscalUrl(url);
    }

    case 'fiscal_standardized_financials':
    case 'fiscal_as_reported_financials': {
      const ticker = String(params.ticker || "").trim();
      const exchange = String(params.exchange || "").trim();
      const statementType = String(params.statement_type || "").trim();
      const periodType = String(params.period_type || "").trim();
      const currency = String(params.currency || "").trim();
      const limit = String(params.limit || "100").trim();

      if (
        !ticker ||
        !exchange ||
        !statementType ||
        !periodType ||
        !limit ||
        !isValidSymbol(ticker) ||
        !isValidLooseIdentifier(exchange) ||
        !isValidLooseIdentifier(periodType) ||
        !isFiscalStatementType(statementType)
      ) {
        return safeJson(
          { error: 'Missing or invalid params: ticker, exchange, statement_type, period_type, limit' },
          { status: 400 }
        );
      }

      const queryParams = buildFiscalFinancialsParams({
        apiKey,
        ticker,
        exchange,
        periodType,
        currency: callId === 'fiscal_standardized_financials' ? currency : undefined,
        limit,
      });
      const endpointKind =
        callId === 'fiscal_standardized_financials' ? 'standardized' : 'as-reported';
      const url = `https://api.fiscal.ai/v1/company/financials/${encodeURIComponent(statementType)}/${endpointKind}?${queryParams}`;
      return await fetchFiscalUrl(url, 45000);
    }

    case 'fiscal_standardized_financials_workbook': {
      const ticker = String(params.ticker || "").trim();
      const exchange = String(params.exchange || "").trim();
      const periodType = String(params.period_type || "annual,quarterly,semi-annual").trim();
      const currency = String(params.currency || "USD").trim();
      const limit = String(params.limit || "100").trim();

      if (
        !ticker ||
        !exchange ||
        !periodType ||
        !limit ||
        !isValidSymbol(ticker) ||
        !isValidLooseIdentifier(exchange) ||
        !isValidLooseIdentifier(periodType)
      ) {
        return safeJson(
          { error: 'Missing or invalid params: ticker, exchange, period_type, limit' },
          { status: 400 }
        );
      }

      const sections = await Promise.all(
        FISCAL_STATEMENTS.map((statement) =>
          fetchFiscalSection({
            ticker,
            exchange,
            statementType: statement.statementType,
            periodType,
            currency,
            limit,
          })
        )
      );
      const failedSections = sections.filter(
        (section) => section.status === "failed"
      );
      const bundle = {
        type: FISCAL_STANDARDIZED_WORKBOOK_TYPE,
        ticker,
        exchange,
        companyKey: buildFiscalCompanyKey(ticker, exchange),
        requestedPeriodTypes: periodType,
        sections,
      };

      if (failedSections.length === sections.length) {
        return safeJson(
          {
            ...bundle,
            error: `Fiscal.ai workbook failed: ${failedSections
              .map((section) => `${section.label} (${section.error})`)
              .join(", ")}`,
          },
          { status: 502 }
        );
      }

      return safeJson(bundle);
    }

    case 'fiscal_companies_list': {
      const pageNumber = String(params.page_number || "1").trim();
      const pageSize = clampPageSize(String(params.page_size || "1000").trim());

      if (!/^\d+$/.test(pageNumber)) {
        return safeJson(
          { error: 'page_number must be a positive integer' },
          { status: 400 }
        );
      }

      const queryParams = buildFiscalCompaniesListParams({
        apiKey,
        pageNumber,
        pageSize,
      });
      const url = `https://api.fiscal.ai/v2/companies-list?${queryParams}`;
      return await fetchFiscalUrl(url);
    }

    case 'fiscal_company_profile': {
      const ticker = String(params.ticker || "").trim();
      const exchange = String(params.exchange || "").trim();

      if (!ticker || !isValidSymbol(ticker) || (exchange && !isValidLooseIdentifier(exchange))) {
        return safeJson(
          { error: 'Missing or invalid params: ticker (required), exchange (optional)' },
          { status: 400 }
        );
      }

      const queryParams = buildFiscalCompanyProfileParams({
        apiKey,
        ticker,
        exchange: exchange || undefined,
      });
      const url = `https://api.fiscal.ai/v2/company/profile?${queryParams}`;
      return await fetchFiscalUrl(url);
    }

    case 'fiscal_ratios_list': {
      const queryParams = buildFiscalStandardizedMetricsListParams({ apiKey });
      const url = `https://api.fiscal.ai/v1/ratios-list?${queryParams}`;
      return await fetchFiscalUrl(url);
    }

    case 'fiscal_standardized_metrics_list': {
      const reportFormat = String(params.report_format || "standard").trim();
      const statementType = String(params.statement_type || "").trim();

      if (
        !reportFormat ||
        !statementType ||
        !isValidLooseIdentifier(reportFormat) ||
        !isFiscalStatementType(statementType)
      ) {
        return safeJson(
          { error: 'Missing or invalid params: report_format, statement_type' },
          { status: 400 }
        );
      }

      const queryParams = buildFiscalStandardizedMetricsListParams({ apiKey });
      const url = `https://api.fiscal.ai/v1/standardized-metrics-list/${encodeURIComponent(reportFormat)}/${encodeURIComponent(statementType)}?${queryParams}`;
      return await fetchFiscalUrl(url);
    }

    default:
      return safeJson(
        { error: `Unknown Fiscal.ai callId: ${callId}` },
        { status: 400 }
      );
  }
}

async function handleEODHDCall(
  callId: string,
  params: Record<string, unknown>
): Promise<NextResponse> {
  const token = process.env.EODHD_API_TOKEN;

  if (!token) {
    return safeJson(
      { error: 'EODHD API token not configured' },
      { status: 500 }
    );
  }

  let url: string;

  switch (callId) {
    case 'eodhd_fundamentals': {
      const ticker = params.ticker as string;

      if (!ticker || !isValidSymbol(ticker)) {
        return safeJson(
          { error: 'Missing or invalid ticker (e.g. RY.TO, MSFT.US)' },
          { status: 400 }
        );
      }

      const queryParams = new URLSearchParams({
        api_token: token,
        fmt: 'json',
      });

      url = `https://eodhd.com/api/fundamentals/${encodeURIComponent(ticker)}?${queryParams}`;
      break;
    }

    case 'eodhd_eod': {
      const ticker = params.ticker as string;

      if (!ticker || !isValidSymbol(ticker)) {
        return safeJson(
          { error: 'Missing or invalid ticker (e.g. RY.TO, MSFT.US)' },
          { status: 400 }
        );
      }

      const queryParams = new URLSearchParams({
        api_token: token,
        fmt: 'json',
      });

      url = `https://eodhd.com/api/eod/${encodeURIComponent(ticker)}?${queryParams}`;
      break;
    }

    default:
      return safeJson(
        { error: `Unknown EODHD callId: ${callId}` },
        { status: 400 }
      );
  }

  try {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      timeout: 30000,
    });

    if (!response.ok) {
      return safeJson(
        { error: `EODHD API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return safeJson(data);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return safeJson(
        { error: 'Request timeout' },
        { status: 504 }
      );
    }
    return safeJson(
      { error: `EODHD request failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

async function handleFMPCall(
  callId: string,
  params: Record<string, unknown>
): Promise<NextResponse> {
  const apiKey = process.env.FMP_API_KEY;

  if (!apiKey) {
    return safeJson(
      { error: 'FMP API key not configured' },
      { status: 500 }
    );
  }

  let url: string;

  switch (callId) {
    case 'fmp_analyst_estimates': {
      const symbol = params.symbol as string;
      const period = params.period as string;

      if (!symbol || !period) {
        return safeJson(
          { error: 'Missing required params: symbol, period' },
          { status: 400 }
        );
      }

      const queryParams = new URLSearchParams({
        symbol,
        period,
        apikey: apiKey,
      });

      url = `https://financialmodelingprep.com/stable/analyst-estimates?${queryParams}`;
      break;
    }

    case 'fmp_income_statement': {
      const symbol = params.symbol as string;
      const period = params.period as string;

      if (!symbol || !period) {
        return safeJson(
          { error: 'Missing required params: symbol, period' },
          { status: 400 }
        );
      }

      const queryParams = new URLSearchParams({
        symbol,
        period,
        apikey: apiKey,
      });

      url = `https://financialmodelingprep.com/stable/income-statement?${queryParams}`;
      break;
    }

    case 'fmp_search_symbol': {
      const query = params.query as string;

      if (!query) {
        return safeJson(
          { error: 'Missing required param: query' },
          { status: 400 }
        );
      }

      const queryParams = new URLSearchParams({
        query,
        apikey: apiKey,
      });

      url = `https://financialmodelingprep.com/stable/search-symbol?${queryParams}`;
      break;
    }

    default:
      return safeJson(
        { error: `Unknown FMP callId: ${callId}` },
        { status: 400 }
      );
  }

  try {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      timeout: 30000,
    });

    if (!response.ok) {
      return safeJson(
        { error: `FMP API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return safeJson(data);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return safeJson(
        { error: 'Request timeout' },
        { status: 504 }
      );
    }
    return safeJson(
      { error: `FMP request failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

interface EodRow {
  date: string;
  close: number;
}

type PriceField = "close" | "adjusted_close";

async function fetchEodSeries(
  ticker: string,
  start: string,
  end: string,
  token: string,
  priceField: PriceField
): Promise<EodRow[]> {
  const fullTicker = ticker.includes(".") ? ticker : `${ticker}.US`;
  const qs = new URLSearchParams({
    from: start,
    to: end,
    period: "d",
    api_token: token,
    fmt: "json",
  });
  const url = `https://eodhd.com/api/eod/${encodeURIComponent(fullTicker)}?${qs}`;

  const response = await fetchWithTimeout(url, { method: "GET", timeout: 30000 });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${fullTicker}`);
  }

  const data = (await response.json()) as Array<{
    date: string;
    close?: number;
    adjusted_close?: number;
  }>;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`No data returned for ${fullTicker} between ${start} and ${end}`);
  }

  const rows = data
    .map((r) => ({
      date: r.date,
      close: priceField === "adjusted_close" ? r.adjusted_close : r.close,
    }))
    .filter((r): r is EodRow => !!r.date && typeof r.close === "number")
    .sort((a, b) => a.date.localeCompare(b.date));

  if (rows.length === 0) {
    throw new Error(`No ${priceField} data returned for ${fullTicker}`);
  }

  return rows;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchEodSeriesWithRetry(
  ticker: string,
  start: string,
  end: string,
  token: string,
  priceField: PriceField
): Promise<EodRow[]> {
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fetchEodSeries(ticker, start, end, token, priceField);
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(350 * attempt);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown error");
}

function yesterdayIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function handleChartsCall(
  callId: string,
  params: Record<string, unknown>
): Promise<NextResponse> {
  const token = process.env.EODHD_API_TOKEN;
  if (!token) {
    return safeJson(
      { error: "EODHD API token not configured" },
      { status: 500 }
    );
  }

  if (callId !== "price_history_rebased") {
    return safeJson(
      { error: `Unknown Charts callId: ${callId}` },
      { status: 400 }
    );
  }

  const tickersRaw = (params.tickers as string) || "";
  const startDate = ((params.start_date as string) || "").trim();
  const endDateInput = ((params.end_date as string) || "").trim();
  const priceFieldInput = ((params.price_field as string) || "close").trim();
  const priceField: PriceField =
    priceFieldInput === "adjusted_close" ? "adjusted_close" : "close";

  const tickers = tickersRaw
    .split(/[,\s]+/)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  if (tickers.length === 0) {
    return safeJson(
      { error: "At least one ticker is required" },
      { status: 400 }
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return safeJson(
      { error: "start_date must be YYYY-MM-DD" },
      { status: 400 }
    );
  }
  const endDate = endDateInput || yesterdayIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return safeJson(
      { error: "end_date must be YYYY-MM-DD or blank" },
      { status: 400 }
    );
  }
  if (endDate < startDate) {
    return safeJson(
      { error: `end_date (${endDate}) is before start_date (${startDate})` },
      { status: 400 }
    );
  }
  for (const t of tickers) {
    if (!isValidSymbol(t)) {
      return safeJson(
        { error: `Invalid ticker: ${t}` },
        { status: 400 }
      );
    }
  }

  const results: Array<{
    ticker: string;
    rows: EodRow[];
    error: string | null;
  }> = [];
  for (const t of tickers) {
    try {
      const rows = await fetchEodSeriesWithRetry(t, startDate, endDate, token, priceField);
      results.push({ ticker: t, rows, error: null });
    } catch (e) {
      results.push({
        ticker: t,
        rows: [],
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  const succeeded = results.filter((r) => !r.error && r.rows.length > 0);
  const failed = results
    .filter((r) => r.error || r.rows.length === 0)
    .map((r) => ({ ticker: r.ticker, error: r.error || "No data" }));

  if (succeeded.length === 0) {
    const failedMessage = failed
      .map((f) => `${f.ticker} (${f.error})`)
      .join(", ");
    return safeJson(
      {
        error: failedMessage
          ? `No data retrieved for any ticker: ${failedMessage}`
          : "No data retrieved for any ticker",
        failed,
      },
      { status: 502 }
    );
  }

  // Build union of dates across all successful series
  const dateSet = new Set<string>();
  for (const s of succeeded) {
    for (const r of s.rows) dateSet.add(r.date);
  }
  const dates = Array.from(dateSet).sort();

  const raw: Record<string, (number | null)[]> = {};
  const rebased: Record<string, (number | null)[]> = {};

  for (const s of succeeded) {
    const byDate = new Map(s.rows.map((r) => [r.date, r.close]));
    const aligned = dates.map((d) => (byDate.has(d) ? byDate.get(d)! : null));

    const firstValid = aligned.find((v) => v !== null) ?? null;
    raw[s.ticker] = aligned;
    rebased[s.ticker] =
      firstValid && firstValid !== 0
        ? aligned.map((v) => (v === null ? null : (v / firstValid) * 100))
        : aligned;
  }

  return safeJson({
    chartData: {
      tickers: succeeded.map((s) => s.ticker),
      startDate,
      endDate,
      priceField,
      dates,
      raw,
      rebased,
    },
    failed,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: FetchDataRequest = await request.json();
    const { platformId, callId, params } = body;

    // Validate required fields
    if (!platformId || !callId || !params) {
      return safeJson(
        { error: 'Missing required fields: platformId, callId, params' },
        { status: 400 }
      );
    }

    // Route to appropriate handler based on platformId
    switch (platformId) {
      case 'QuoteMedia':
        return await handleQuoteMediaCall(callId, params);

      case 'Fiscal.ai':
        return await handleFiscalAiCall(callId, params);

      case 'EODHD':
        return await handleEODHDCall(callId, params);

      case 'FMP':
        return await handleFMPCall(callId, params);

      case 'Charts':
        return await handleChartsCall(callId, params);

      default:
        return safeJson(
          { error: `Unknown platformId: ${platformId}` },
          { status: 400 }
        );
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return safeJson(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    return safeJson(
      { error: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
