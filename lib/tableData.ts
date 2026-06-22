import { isQuoteMediaEnhancedFinancialsBundle } from "./quotemedia";
import {
  FISCAL_PERIOD_SHEETS,
  isFiscalStandardizedFinancialsWorkbook,
  normalizeFiscalPeriodType,
} from "./fiscal";

export type CellValue = string | number | boolean | null;

export interface TableData {
  title?: string;
  headers: string[];
  rows: CellValue[][];
}

const FINANCIAL_STATEMENT_KEYS = [
  "incomeStatement",
  "balanceSheet",
  "cashFlow",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function formatCellValue(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getCompanyLabel(company: Record<string, unknown>, index: number): string {
  const candidate =
    company.symbol ||
    company.companySymbol ||
    company.name ||
    company.companyName ||
    company.longname;
  return candidate ? String(candidate) : `Company ${index + 1}`;
}

function findArrayOfObjects(
  obj: Record<string, unknown>,
  depth = 0
): unknown[] | null {
  if (depth > 5) return null;

  for (const value of Object.values(obj)) {
    if (
      Array.isArray(value) &&
      value.length > 0 &&
      value.some(hasTabularObjectShape)
    ) {
      return value;
    }
  }

  for (const value of Object.values(obj)) {
    if (isRecord(value)) {
      const found = findArrayOfObjects(value, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

function hasTabularObjectShape(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;

  return Object.values(value).some((fieldValue) => {
    if (fieldValue === null || fieldValue === undefined) return true;
    if (!Array.isArray(fieldValue) && typeof fieldValue !== "object") return true;
    if (isRecord(fieldValue)) return Object.keys(fieldValue).length > 0;
    return false;
  });
}

function arrayToTable(arr: unknown[], title?: string): TableData {
  const flatRows: Record<string, CellValue>[] = [];

  for (const item of arr) {
    if (!isRecord(item)) continue;

    const flat: Record<string, CellValue> = {};
    for (const [key, val] of Object.entries(item)) {
      if (isRecord(val)) {
        for (const [subKey, subVal] of Object.entries(val)) {
          flat[`${key}.${subKey}`] = formatCellValue(subVal);
        }
      } else {
        flat[key] = formatCellValue(val);
      }
    }
    flatRows.push(flat);
  }

  const headerSet = new Set<string>();
  for (const row of flatRows) {
    for (const key of Object.keys(row)) {
      headerSet.add(key);
    }
  }
  const headers = Array.from(headerSet);

  const rows = flatRows.map((row) =>
    headers.map((header) => (header in row ? row[header] : null))
  );

  return { title, headers, rows };
}

function enhancedFinancialsToTable(
  companies: unknown[],
  title = "Financials"
): TableData | null {
  const reportsByCompany = companies
    .map((company, index) => {
      if (!isRecord(company) || !Array.isArray(company.reports)) return null;
      return {
        company,
        companyLabel: getCompanyLabel(company, index),
        reports: company.reports.filter(isRecord),
      };
    })
    .filter(
      (
        item
      ): item is {
        company: Record<string, unknown>;
        companyLabel: string;
        reports: Record<string, unknown>[];
      } => !!item && item.reports.length > 0
    );

  const hasStatementShape = reportsByCompany.some(({ reports }) =>
    reports.some((report) =>
      FINANCIAL_STATEMENT_KEYS.some((statementKey) => isRecord(report[statementKey]))
    )
  );
  if (!hasStatementShape) return null;

  const includeCompanyInMetric = reportsByCompany.length > 1;
  const dateSet = new Set<string>();
  const pivoted = new Map<string, Record<string, CellValue>>();

  for (const { companyLabel, reports } of reportsByCompany) {
    for (const report of reports) {
      const reportDate = String(report.reportDate || "");
      dateSet.add(reportDate);

      for (const statementKey of FINANCIAL_STATEMENT_KEYS) {
        const statement = report[statementKey];
        if (!isRecord(statement)) continue;

        for (const [metric, value] of Object.entries(statement)) {
          const rowKey = includeCompanyInMetric
            ? `${companyLabel} | ${statementKey} | ${metric}`
            : `${statementKey} | ${metric}`;
          if (!pivoted.has(rowKey)) {
            pivoted.set(rowKey, {});
          }
          pivoted.get(rowKey)![reportDate] = formatCellValue(value);
        }
      }
    }
  }

  const dates = Array.from(dateSet).sort().reverse();
  const headers = [
    includeCompanyInMetric ? "Company | Statement | Metric" : "Statement | Metric",
    ...dates,
  ];
  const rows = Array.from(pivoted.entries()).map(([metric, values]) => [
    metric,
    ...dates.map((date) => values[date] ?? ""),
  ]);

  return rows.length > 0 ? { title, headers, rows } : null;
}

function dedupeLabels(labels: string[]): string[] {
  const counts = new Map<string, number>();
  return labels.map((label) => {
    const safeLabel = label || "?";
    const count = counts.get(safeLabel) ?? 0;
    counts.set(safeLabel, count + 1);
    return count === 0 ? safeLabel : `${safeLabel} (${count + 1})`;
  });
}

function getFiscalMetricIdKey(
  metric: Record<string, unknown>
): "standardizedMetricId" | "asReportedMetricId" | null {
  if (typeof metric.standardizedMetricId === "string") {
    return "standardizedMetricId";
  }
  if (typeof metric.asReportedMetricId === "string") {
    return "asReportedMetricId";
  }
  return null;
}

function getFiscalPeriodDate(period: Record<string, unknown>): string {
  const value = period.reportDate || period.periodId || "";
  return String(value);
}

function fiscalPeriodLabel(period: Record<string, unknown>): string {
  const date = getFiscalPeriodDate(period);
  const periodType = normalizeFiscalPeriodType(period.periodType);
  const fiscalYear = period.fiscalYear ? String(period.fiscalYear) : "";
  const fiscalQuarter = period.fiscalQuarter
    ? String(period.fiscalQuarter)
    : "";

  if (periodType.startsWith("annual")) {
    const label = fiscalYear ? `FY${fiscalYear}` : "Annual";
    return date ? `${label} - ${date}` : label;
  }

  if (fiscalQuarter && fiscalYear) {
    return date ? `Q${fiscalQuarter} ${fiscalYear} - ${date}` : `Q${fiscalQuarter} ${fiscalYear}`;
  }

  return date || "?";
}

function getMetricValue(value: unknown): CellValue {
  if (isRecord(value) && "value" in value) {
    return formatCellValue(value.value);
  }
  return formatCellValue(value);
}

function fiscalFinancialsToTable(
  data: unknown,
  title = "Financials"
): TableData | null {
  if (!isRecord(data) || !Array.isArray(data.metrics) || !Array.isArray(data.data)) {
    return null;
  }

  const metrics = data.metrics.filter(isRecord);
  const periods = data.data.filter(isRecord);
  if (metrics.length === 0 || periods.length === 0) return null;

  const idKey = getFiscalMetricIdKey(metrics[0]);
  if (!idKey) return null;

  const sortedPeriods = [...periods].sort((a, b) =>
    getFiscalPeriodDate(b).localeCompare(getFiscalPeriodDate(a))
  );
  const periodLabels = dedupeLabels(sortedPeriods.map(fiscalPeriodLabel));
  const headers = ["Section", "Metric", "Type", ...periodLabels];
  const rows: CellValue[][] = [];

  for (const metric of metrics) {
    const metricId = metric[idKey];
    if (typeof metricId !== "string") continue;

    const headersValue = Array.isArray(metric.headers)
      ? metric.headers.filter(Boolean).map(String).join(" > ")
      : "";
    const metricName = String(metric.metricName || metricId);
    const parentRow: CellValue[] = [
      headersValue,
      metricName,
      idKey === "standardizedMetricId" ? "Standardized" : "As-Reported",
    ];

    for (const period of sortedPeriods) {
      const metricValues = isRecord(period.metricsValues)
        ? period.metricsValues
        : {};
      parentRow.push(getMetricValue(metricValues[metricId]));
    }
    rows.push(parentRow);

    if (idKey !== "standardizedMetricId" || !Array.isArray(metric.asReportedMetrics)) {
      continue;
    }

    for (const childMetric of metric.asReportedMetrics.filter(isRecord)) {
      const childId = childMetric.asReportedMetricId;
      if (typeof childId !== "string") continue;

      const operation = childMetric.operation
        ? `${String(childMetric.operation)} `
        : "";
      const childName = String(childMetric.metricName || childId);
      const childRow: CellValue[] = [
        headersValue,
        `        ${operation}${childName}`,
        "As-Reported",
      ];

      for (const period of sortedPeriods) {
        const metricValues = isRecord(period.metricsValues)
          ? period.metricsValues
          : {};
        const standardMetricValue = metricValues[metricId];
        const asReportedValues = isRecord(standardMetricValue) &&
          Array.isArray(standardMetricValue.asReportedValues)
            ? standardMetricValue.asReportedValues.filter(isRecord)
            : [];
        const childValue = asReportedValues.find(
          (item) => item.asReportedMetricId === childId
        );
        childRow.push(getMetricValue(childValue));
      }

      rows.push(childRow);
    }
  }

  return rows.length > 0 ? { title, headers, rows } : null;
}

function fiscalWorkbookSheetTable(
  workbook: { sections: unknown[] },
  title: string,
  aliases: readonly string[]
): TableData {
  const dateSet = new Set<string>();
  const rowRecords: Record<string, CellValue>[] = [];

  for (const sectionValue of workbook.sections) {
    if (!isRecord(sectionValue) || sectionValue.status === "failed") continue;
    const sectionData = sectionValue.data;
    if (
      !isRecord(sectionData) ||
      !Array.isArray(sectionData.metrics) ||
      !Array.isArray(sectionData.data)
    ) {
      continue;
    }

    const periods = sectionData.data
      .filter(isRecord)
      .filter((period) =>
        aliases.includes(normalizeFiscalPeriodType(period.periodType))
      )
      .sort((a, b) => getFiscalPeriodDate(a).localeCompare(getFiscalPeriodDate(b)));
    const metrics = sectionData.metrics.filter(isRecord);
    if (periods.length === 0 || metrics.length === 0) continue;

    const idKey = getFiscalMetricIdKey(metrics[0]);
    if (!idKey) continue;

    for (const period of periods) {
      dateSet.add(getFiscalPeriodDate(period) || "?");
    }

    const sectionLabel = String(sectionValue.label || "Financial Statement");
    const headerRow: Record<string, CellValue> = {
      Metric: `--- ${sectionLabel} ---`,
      Type: null,
    };
    rowRecords.push(headerRow);

    for (const metric of metrics) {
      const metricId = metric[idKey];
      if (typeof metricId !== "string") continue;

      const parentRow: Record<string, CellValue> = {
        Metric: String(metric.metricName || metricId),
        Type: idKey === "standardizedMetricId" ? "Standardized" : "As-Reported",
      };
      for (const period of periods) {
        const date = getFiscalPeriodDate(period) || "?";
        const metricValues = isRecord(period.metricsValues)
          ? period.metricsValues
          : {};
        parentRow[date] = getMetricValue(metricValues[metricId]);
      }
      rowRecords.push(parentRow);

      if (idKey !== "standardizedMetricId" || !Array.isArray(metric.asReportedMetrics)) {
        continue;
      }

      for (const childMetric of metric.asReportedMetrics.filter(isRecord)) {
        const childId = childMetric.asReportedMetricId;
        if (typeof childId !== "string") continue;

        const operation = childMetric.operation
          ? `${String(childMetric.operation)} `
          : "";
        const childRow: Record<string, CellValue> = {
          Metric: `        ${operation}${String(childMetric.metricName || childId)}`,
          Type: "As-Reported",
        };

        for (const period of periods) {
          const date = getFiscalPeriodDate(period) || "?";
          const metricValues = isRecord(period.metricsValues)
            ? period.metricsValues
            : {};
          const standardMetricValue = metricValues[metricId];
          const asReportedValues = isRecord(standardMetricValue) &&
            Array.isArray(standardMetricValue.asReportedValues)
              ? standardMetricValue.asReportedValues.filter(isRecord)
              : [];
          const childValue = asReportedValues.find(
            (item) => item.asReportedMetricId === childId
          );
          childRow[date] = getMetricValue(childValue);
        }
        rowRecords.push(childRow);
      }
    }

    rowRecords.push({ Metric: "", Type: null });
  }

  if (rowRecords.length === 0) {
    return {
      title,
      headers: ["Metric", "Type"],
      rows: [[`(No ${title.toLowerCase()} data reported)`, null]],
    };
  }

  const dateColumns = Array.from(dateSet).sort();
  const headers = ["Metric", "Type", ...dateColumns];
  const rows = rowRecords.map((row) =>
    headers.map((header) => (header in row ? row[header] : null))
  );

  return { title, headers, rows };
}

function fiscalWorkbookToTables(data: unknown): TableData[] {
  if (!isFiscalStandardizedFinancialsWorkbook(data)) return [];

  return FISCAL_PERIOD_SHEETS.map((sheet) =>
    fiscalWorkbookSheetTable(data, sheet.title, sheet.aliases)
  );
}

function unrollBrokerEstimates(brokers: unknown[]): TableData | null {
  const firstBroker = brokers[0];
  if (!isRecord(firstBroker) || !Array.isArray(firstBroker.estimates)) {
    return null;
  }

  const unrolled: Record<string, unknown>[] = [];
  for (const brokerValue of brokers) {
    if (!isRecord(brokerValue)) continue;
    const { estimates, ...brokerInfo } = brokerValue;
    const estimateRows = Array.isArray(estimates) ? estimates : [];

    if (estimateRows.length === 0) {
      unrolled.push(brokerInfo);
      continue;
    }

    for (const estimate of estimateRows) {
      if (isRecord(estimate)) {
        unrolled.push({ ...brokerInfo, ...estimate });
      }
    }
  }

  return unrolled.length > 0
    ? arrayToTable(unrolled, "Earnings Estimates")
    : null;
}

function resultArrayTables(results: Record<string, unknown>): TableData[] {
  const tables: TableData[] = [];
  const knownKeys = [
    "company",
    "dividends",
    "earningsEvents",
    "estimates",
    "earningsEstimates",
  ];

  for (const key of knownKeys) {
    const val = results[key];
    if (!val || typeof val !== "object") continue;

    if (Array.isArray(val) && val.length > 0) {
      tables.push(arrayToTable(val, key));
      continue;
    }

    if (Array.isArray(val)) continue;

    const scalarEntries: [string, unknown][] = [];
    for (const [nestedKey, nestedVal] of Object.entries(val)) {
      if (
        Array.isArray(nestedVal) &&
        nestedVal.length > 0 &&
        typeof nestedVal[0] === "object"
      ) {
        tables.push(arrayToTable(nestedVal, `${key} > ${nestedKey}`));
      } else if (isRecord(nestedVal)) {
        tables.push({
          title: `${key} > ${nestedKey}`,
          headers: ["Field", "Value"],
          rows: Object.entries(nestedVal).map(([subKey, subVal]) => [
            subKey,
            formatCellValue(subVal),
          ]),
        });
      } else {
        scalarEntries.push([nestedKey, nestedVal]);
      }
    }

    if (scalarEntries.length > 0) {
      tables.push({
        title: key,
        headers: ["Field", "Value"],
        rows: scalarEntries.map(([nestedKey, nestedVal]) => [
          nestedKey,
          formatCellValue(nestedVal),
        ]),
      });
    }
  }

  return tables;
}

export function detectTableData(data: unknown): TableData[] {
  if (!data || typeof data !== "object") return [];

  if (Array.isArray(data)) {
    if (
      data.length > 0 &&
      typeof data[0] === "object" &&
      data[0] !== null
    ) {
      return [arrayToTable([...data].reverse(), "Data")];
    }
    return [];
  }

  const obj = data as Record<string, unknown>;

  if (isQuoteMediaEnhancedFinancialsBundle(obj)) {
    const tables = obj.sections.flatMap((section) => {
      if (section.status === "failed" || !isRecord(section.data)) return [];

      const sectionResults = isRecord(section.data.results)
        ? section.data.results
        : undefined;
      const sectionCompanies = sectionResults?.companies;
      if (!Array.isArray(sectionCompanies) || sectionCompanies.length === 0) {
        return [];
      }

      const table = enhancedFinancialsToTable(sectionCompanies, section.label);
      return table ? [table] : [];
    });

    return tables;
  }

  if (isFiscalStandardizedFinancialsWorkbook(obj)) {
    return fiscalWorkbookToTables(obj);
  }

  const res = isRecord(obj.results) ? obj.results : undefined;

  const companies = res?.companies;
  if (Array.isArray(companies) && companies.length > 0) {
    const financialsTable = enhancedFinancialsToTable(companies);
    if (financialsTable) return [financialsTable];

    const firstCompany = companies[0];
    const reports = isRecord(firstCompany) ? firstCompany.reports : null;
    if (Array.isArray(reports) && reports.length > 0) {
      return [arrayToTable(reports, "Reports")];
    }
  }

  const brokers = res?.brokers;
  if (Array.isArray(brokers) && brokers.length > 0) {
    const estimatesTable = unrollBrokerEstimates(brokers);
    if (estimatesTable) return [estimatesTable];
  }

  if (res) {
    const knownResultTables = resultArrayTables(res);
    if (knownResultTables.length > 0) return knownResultTables;
  }

  const fiscalFinancialsTable = fiscalFinancialsToTable(obj);
  if (fiscalFinancialsTable) {
    return [fiscalFinancialsTable];
  }

  if (Array.isArray(obj.data) && obj.data.length > 0) {
    return [arrayToTable(obj.data, "Ratios")];
  }

  const found = findArrayOfObjects(obj);
  if (found) {
    return [arrayToTable(found, "Data")];
  }

  const rows = Object.entries(obj).map(([key, value]) => {
    const cellValue = formatCellValue(value);
    return [
      key,
      typeof cellValue === "string" ? cellValue.slice(0, 200) : cellValue,
    ];
  });

  return rows.length > 0 ? [{ title: "Data", headers: ["Key", "Value"], rows }] : [];
}
