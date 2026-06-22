import assert from "node:assert/strict";
import test from "node:test";

import { detectTableData } from "../lib/tableData";

test("pivots QuoteMedia Enhanced Financials reports into statement metric rows and newest report dates first", () => {
  const tables = detectTableData({
    results: {
      companies: [
        {
          reports: [
            {
              reportDate: "2025-12-31",
              incomeStatement: {
                revenue: 120,
                netIncome: 12,
              },
              balanceSheet: {
                totalAssets: 300,
              },
              cashFlow: {
                operatingCashFlow: 31,
              },
            },
            {
              reportDate: "2024-12-31",
              incomeStatement: {
                revenue: 100,
                netIncome: 10,
              },
              balanceSheet: {
                totalAssets: 280,
              },
              cashFlow: {
                operatingCashFlow: 25,
              },
            },
          ],
        },
      ],
    },
  });

  assert.equal(tables.length, 1);
  assert.equal(tables[0].title, "Financials");
  assert.deepEqual(tables[0].headers, [
    "Statement | Metric",
    "2025-12-31",
    "2024-12-31",
  ]);
  assert.deepEqual(tables[0].rows, [
    ["incomeStatement | revenue", 120, 100],
    ["incomeStatement | netIncome", 12, 10],
    ["balanceSheet | totalAssets", 300, 280],
    ["cashFlow | operatingCashFlow", 31, 25],
  ]);
});

test("exports Enhanced Financials rows when reports contain only one statement section", () => {
  const tables = detectTableData({
    results: {
      companies: [
        {
          reports: [
            {
              reportDate: "2026-03-31",
              incomeStatement: {
                revenue: 50,
              },
            },
          ],
        },
      ],
    },
  });

  assert.equal(tables.length, 1);
  assert.deepEqual(tables[0].headers, ["Statement | Metric", "2026-03-31"]);
  assert.deepEqual(tables[0].rows, [["incomeStatement | revenue", 50]]);
});

test("converts top-level arrays of objects into table rows", () => {
  const tables = detectTableData([
    { symbol: "AAPL", price: 200 },
    { symbol: "MSFT", price: 420 },
  ]);

  assert.equal(tables.length, 1);
  assert.equal(tables[0].title, "Data");
  assert.deepEqual(tables[0].headers, ["symbol", "price"]);
  assert.deepEqual(tables[0].rows, [
    ["MSFT", 420],
    ["AAPL", 200],
  ]);
});

test("unrolls QuoteMedia earnings estimate brokers into one row per estimate", () => {
  const tables = detectTableData({
    results: {
      brokers: [
        {
          broker: "Broker A",
          estimates: [
            { period: "2026", eps: 1.25 },
            { period: "2027", eps: 1.4 },
          ],
        },
      ],
    },
  });

  assert.equal(tables.length, 1);
  assert.equal(tables[0].title, "Earnings Estimates");
  assert.deepEqual(tables[0].headers, ["broker", "period", "eps"]);
  assert.deepEqual(tables[0].rows, [
    ["Broker A", "2026", 1.25],
    ["Broker A", "2027", 1.4],
  ]);
});

test("falls back to key value rows instead of returning header-only table data", () => {
  const tables = detectTableData({
    status: "ok",
    results: {
      companies: [
        {
          reports: [],
        },
      ],
    },
  });

  assert.equal(tables.length, 1);
  assert.equal(tables[0].title, "Data");
  assert.deepEqual(tables[0].headers, ["Key", "Value"]);
  assert.deepEqual(tables[0].rows, [
    ["status", "ok"],
    ["results", "{\"companies\":[{\"reports\":[]}]}"],
  ]);
});

test("exports QuoteMedia company arrays returned by profile and fundamentals calls", () => {
  const tables = detectTableData({
    results: {
      copyright: "Copyright (c) 2026 QuoteMedia, Inc.",
      symbolcount: 1,
      company: [
        {
          symbol: "MSFT",
          longname: "Microsoft Corporation",
          exchange: "NGS",
        },
      ],
    },
  });

  assert.equal(tables.length, 1);
  assert.equal(tables[0].title, "company");
  assert.deepEqual(tables[0].headers, ["symbol", "longname", "exchange"]);
  assert.deepEqual(tables[0].rows, [["MSFT", "Microsoft Corporation", "NGS"]]);
});

test("creates one Enhanced Financials table per available A/Q/H bundle section", () => {
  const tables = detectTableData({
    type: "quoteMediaEnhancedFinancialsBundle",
    symbol: "POW:CA",
    sections: [
      {
        reportType: "A",
        label: "Annual",
        status: "fulfilled",
        data: {
          results: {
            companies: [
              {
                reports: [
                  {
                    reportDate: "2025-12-31",
                    incomeStatement: { revenue: 100 },
                  },
                ],
              },
            ],
          },
        },
      },
      {
        reportType: "Q",
        label: "Quarterly",
        status: "fulfilled",
        data: {
          results: {
            companies: [
              {
                reports: [
                  {
                    reportDate: "2026-03-31",
                    balanceSheet: { totalAssets: 250 },
                  },
                ],
              },
            ],
          },
        },
      },
      {
        reportType: "H",
        label: "Half-Yearly",
        status: "skipped",
        data: {
          results: {
            companies: [{ reports: [] }],
          },
        },
      },
    ],
  });

  assert.equal(tables.length, 2);
  assert.equal(tables[0].title, "Annual");
  assert.deepEqual(tables[0].headers, ["Statement | Metric", "2025-12-31"]);
  assert.deepEqual(tables[0].rows, [["incomeStatement | revenue", 100]]);
  assert.equal(tables[1].title, "Quarterly");
  assert.deepEqual(tables[1].headers, ["Statement | Metric", "2026-03-31"]);
  assert.deepEqual(tables[1].rows, [["balanceSheet | totalAssets", 250]]);
});

test("pivots Fiscal.ai standardized financials with as-reported child rows", () => {
  const tables = detectTableData({
    metrics: [
      {
        standardizedMetricId: "revenue",
        metricName: "Revenue",
        headers: ["Income Statement"],
        asReportedMetrics: [
          {
            asReportedMetricId: "sales",
            metricName: "Sales",
            operation: "+",
          },
        ],
      },
    ],
    data: [
      {
        reportDate: "2025-12-31",
        periodType: "annual",
        fiscalYear: 2025,
        metricsValues: {
          revenue: {
            value: 100,
            asReportedValues: [
              {
                asReportedMetricId: "sales",
                value: 95,
              },
            ],
          },
        },
      },
      {
        reportDate: "2024-12-31",
        periodType: "annual",
        fiscalYear: 2024,
        metricsValues: {
          revenue: {
            value: 90,
            asReportedValues: [
              {
                asReportedMetricId: "sales",
                value: 88,
              },
            ],
          },
        },
      },
    ],
  });

  assert.equal(tables.length, 1);
  assert.deepEqual(tables[0].headers, [
    "Section",
    "Metric",
    "Type",
    "FY2025 - 2025-12-31",
    "FY2024 - 2024-12-31",
  ]);
  assert.deepEqual(tables[0].rows, [
    ["Income Statement", "Revenue", "Standardized", 100, 90],
    ["Income Statement", "        + Sales", "As-Reported", 95, 88],
  ]);
});

test("creates Fiscal.ai workbook period sheets with stacked statement sections", () => {
  const statementData = {
    metrics: [
      {
        standardizedMetricId: "revenue",
        metricName: "Revenue",
      },
    ],
    data: [
      {
        reportDate: "2025-12-31",
        periodType: "annual",
        metricsValues: {
          revenue: { value: 100 },
        },
      },
      {
        reportDate: "2026-03-31",
        periodType: "quarterly",
        metricsValues: {
          revenue: { value: 30 },
        },
      },
    ],
  };

  const tables = detectTableData({
    type: "fiscalStandardizedFinancialsWorkbook",
    ticker: "FPI",
    exchange: "NYSE",
    companyKey: "NYSE_FPI",
    requestedPeriodTypes: "annual,quarterly,semi-annual",
    sections: [
      {
        statementType: "income-statement",
        label: "Income Statement",
        status: "fulfilled",
        data: statementData,
        params: {},
      },
      {
        statementType: "balance-sheet",
        label: "Balance Sheet",
        status: "failed",
        data: null,
        params: {},
      },
    ],
  });

  assert.equal(tables.length, 3);
  assert.equal(tables[0].title, "Annual");
  assert.deepEqual(tables[0].headers, ["Metric", "Type", "2025-12-31"]);
  assert.deepEqual(tables[0].rows.slice(0, 2), [
    ["--- Income Statement ---", null, null],
    ["Revenue", "Standardized", 100],
  ]);
  assert.equal(tables[1].title, "Quarterly");
  assert.deepEqual(tables[1].headers, ["Metric", "Type", "2026-03-31"]);
  assert.deepEqual(tables[1].rows.slice(0, 2), [
    ["--- Income Statement ---", null, null],
    ["Revenue", "Standardized", 30],
  ]);
  assert.equal(tables[2].title, "Semi-Annual");
  assert.deepEqual(tables[2].rows, [["(No semi-annual data reported)", null]]);
});
