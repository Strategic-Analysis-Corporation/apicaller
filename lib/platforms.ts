import { PlatformDef } from "./types";
import {
  QUOTEMEDIA_ENHANCED_REPORT_TYPES,
  QUOTEMEDIA_EXCHANGE_OPTIONS,
} from "./quotemedia";
import { FISCAL_STATEMENTS } from "./fiscal";

export const PLATFORMS: PlatformDef[] = [
  {
    name: "QuoteMedia",
    calls: [
      {
        id: "qm_earnings_events",
        name: "Earnings Events by Symbol",
        desc: "Historical earnings events for a symbol.",
        params: [
          { key: "symbol", label: "Symbol (e.g. MSFT:US)", default: "" },
          { key: "start_year", label: "Start Year (e.g. 2023)", default: "2023" },
          { key: "end_year", label: "End Year (e.g. 2025)", default: "2025" },
        ],
      },
      {
        id: "qm_enhanced_financials",
        name: "Enhanced Financials",
        desc: "Income statement, balance sheet, cash flow.",
        params: [
          { key: "symbol", label: "Symbol (e.g. ARX:CA)", default: "" },
          {
            key: "report_type",
            label: "Report Type",
            default: "Q",
            type: "combo",
            options: QUOTEMEDIA_ENHANCED_REPORT_TYPES.map((item) => item.code),
          },
          { key: "number_of_reports", label: "Number of Reports", default: "300" },
        ],
      },
      {
        id: "qm_dividends",
        name: "Dividends",
        desc: "Dividend history for a symbol within a date range.",
        params: [
          { key: "symbol", label: "Symbol (e.g. PHX:CA)", default: "" },
          { key: "start_date", label: "Start Date (YYYY-MM-DD)", default: "2024-01-01" },
          { key: "end_date", label: "End Date (YYYY-MM-DD)", default: "2026-04-11" },
        ],
      },
      {
        id: "qm_fundamentals_mini",
        name: "Fundamentals Mini by Exchange",
        desc: "Fundamental values for an entire exchange (large response).",
        params: [
          {
            key: "exchange_group",
            label: "Exchange Group",
            default: "tsx",
            type: "searchable_exchange",
          },
        ],
      },
      {
        id: "qm_earnings_estimates_old",
        name: "Earnings Estimates (Legacy)",
        desc: "Earnings estimates via the older getEarningsEstimates endpoint.",
        params: [
          { key: "symbol", label: "Symbol (e.g. TXP:CA)", default: "" },
        ],
      },
      {
        id: "qm_earnings_estimates_v3",
        name: "Earnings Estimates (v3)",
        desc: "Earnings estimates via the newer v3 endpoint.",
        params: [
          { key: "symbol", label: "Symbol (e.g. JBSS:US)", default: "" },
        ],
      },
      {
        id: "qm_profiles",
        name: "Company Profile",
        desc: "Company profile including description, address, CEO.",
        params: [
          { key: "symbol", label: "Symbol (e.g. MSFT:US)", default: "" },
        ],
      },
    ],
  },
  {
    name: "Fiscal.ai",
    calls: [
      {
        id: "fiscal_company_ratios",
        name: "Company Ratios",
        desc: "Specific financial ratios for a company.",
        params: [
          { key: "company_key", label: "Company Key (e.g. TSX_CRR.UN)", default: "" },
          {
            key: "period_type",
            label: "Period Type",
            default: "quarterly",
            type: "combo",
            options: ["quarterly", "annual"],
          },
          {
            key: "currency",
            label: "Currency",
            default: "CAD",
            type: "combo",
            options: ["CAD", "USD"],
          },
          {
            key: "ratio_id",
            label: "Ratio ID",
            default: "",
            type: "searchable_ratio",
          },
        ],
      },
      {
        id: "fiscal_daily_ratio_history",
        name: "Daily Ratio History",
        desc: "Daily history for a Fiscal.ai ratio that supports daily data.",
        params: [
          { key: "company_key", label: "Company Key (e.g. NASDAQ_MSFT)", default: "" },
          {
            key: "ratio_id",
            label: "Ratio ID",
            default: "",
            type: "searchable_ratio",
          },
        ],
      },
      {
        id: "fiscal_standardized_financials",
        name: "Standardized Financials",
        desc: "Standardized income statement, balance sheet, or cash flow data.",
        params: [
          { key: "ticker", label: "Ticker (e.g. MSFT, RY)", default: "" },
          { key: "exchange", label: "Exchange (e.g. NASDAQ, NYSE, TSX)", default: "" },
          {
            key: "statement_type",
            label: "Statement",
            default: "income-statement",
            type: "combo",
            options: FISCAL_STATEMENTS.map((item) => item.statementType),
          },
          {
            key: "period_type",
            label: "Period Type (comma-separated allowed)",
            default: "annual,quarterly",
          },
          { key: "currency", label: "Currency", default: "USD" },
          { key: "limit", label: "Limit", default: "100" },
        ],
      },
      {
        id: "fiscal_as_reported_financials",
        name: "As-Reported Financials",
        desc: "As-reported income statement, balance sheet, or cash flow data.",
        params: [
          { key: "ticker", label: "Ticker (e.g. MSFT, RY)", default: "" },
          { key: "exchange", label: "Exchange (e.g. NASDAQ, NYSE, TSX)", default: "" },
          {
            key: "statement_type",
            label: "Statement",
            default: "income-statement",
            type: "combo",
            options: FISCAL_STATEMENTS.map((item) => item.statementType),
          },
          {
            key: "period_type",
            label: "Period Type (comma-separated allowed)",
            default: "annual,quarterly",
          },
          { key: "limit", label: "Limit", default: "100" },
        ],
      },
      {
        id: "fiscal_standardized_financials_workbook",
        name: "Standardized Financials Workbook",
        desc: "Fetch standardized income statement, balance sheet, and cash flow together for workbook-style export.",
        params: [
          { key: "ticker", label: "Ticker (e.g. MSFT, RY)", default: "" },
          { key: "exchange", label: "Exchange (e.g. NASDAQ, NYSE, TSX)", default: "" },
          {
            key: "period_type",
            label: "Period Types",
            default: "annual,quarterly,semi-annual",
          },
          { key: "currency", label: "Currency", default: "USD" },
          { key: "limit", label: "Limit", default: "100" },
        ],
      },
      {
        id: "fiscal_companies_list",
        name: "Companies List",
        desc: "Paginated list of companies in the Fiscal.ai universe.",
        params: [
          { key: "page_number", label: "Page Number", default: "1" },
          { key: "page_size", label: "Page Size (max 1000)", default: "1000" },
        ],
      },
      {
        id: "fiscal_ratios_list",
        name: "Ratios List",
        desc: "Reference list of Fiscal.ai ratios with metadata.",
        params: [],
      },
      {
        id: "fiscal_standardized_metrics_list",
        name: "Standardized Metrics List",
        desc: "Metric template for a Fiscal.ai report format and statement type.",
        params: [
          { key: "report_format", label: "Report Format", default: "standard" },
          {
            key: "statement_type",
            label: "Statement",
            default: "balance-sheet",
            type: "combo",
            options: FISCAL_STATEMENTS.map((item) => item.statementType),
          },
        ],
      },
    ],
  },
  {
    name: "EODHD",
    calls: [
      {
        id: "eodhd_fundamentals",
        name: "Fundamentals",
        desc: "Full fundamental data for a ticker.",
        params: [
          { key: "ticker", label: "Ticker (e.g. RY.TO or MSFT.US)", default: "" },
        ],
      },
      {
        id: "eodhd_eod",
        name: "End-of-Day Prices",
        desc: "Historical end-of-day price data.",
        params: [
          { key: "ticker", label: "Ticker (e.g. RY.TO or MSFT.US)", default: "" },
        ],
      },
    ],
  },
  {
    name: "Charts",
    calls: [
      {
        id: "price_history_rebased",
        name: "Price History (Rebased to 100)",
        desc: "Fetch daily closes for multiple tickers and rebase to 100 at the start date for relative performance comparison. Uses EODHD. Bare US tickers auto-suffixed with .US (e.g. AAPL, SPY). For non-US use SYMBOL.EXCHANGE (e.g. BP.LSE, RY.TO).",
        params: [
          {
            key: "tickers",
            label: "Tickers (comma-separated, e.g. ITA, SPY)",
            default: "ITA, SPY",
            type: "ticker_list",
          },
          {
            key: "start_date",
            label: "Start Date (YYYY-MM-DD)",
            default: "2026-01-01",
          },
          {
            key: "end_date",
            label: "End Date (YYYY-MM-DD, blank = yesterday)",
            default: "",
          },
          {
            key: "price_field",
            label: "Price Type",
            default: "close",
            type: "combo",
            options: ["close", "adjusted_close"],
          },
        ],
      },
    ],
  },
  {
    name: "FMP",
    calls: [
      {
        id: "fmp_analyst_estimates",
        name: "Analyst Estimates",
        desc: "Analyst estimates for a company.",
        params: [
          { key: "symbol", label: "Symbol (e.g. AAPL)", default: "" },
          {
            key: "period",
            label: "Period",
            default: "quarterly",
            type: "combo",
            options: ["quarterly", "annual"],
          },
        ],
      },
      {
        id: "fmp_income_statement",
        name: "Income Statement",
        desc: "Income statement data.",
        params: [
          { key: "symbol", label: "Symbol (e.g. AAPL)", default: "" },
          {
            key: "period",
            label: "Period",
            default: "quarterly",
            type: "combo",
            options: ["quarterly", "annual"],
          },
        ],
      },
      {
        id: "fmp_search_symbol",
        name: "Symbol Search",
        desc: "Search for symbols by company name or ticker.",
        params: [
          { key: "query", label: "Search Query (ticker or company name)", default: "" },
        ],
      },
    ],
  },
];

export const EXCHANGE_OPTIONS = [
  ...QUOTEMEDIA_EXCHANGE_OPTIONS,
];
