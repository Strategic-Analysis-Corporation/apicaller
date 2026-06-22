import assert from "node:assert/strict";
import test from "node:test";

import {
  buildIssueReport,
  parseProviderSupportEmails,
  redactSecrets,
  sanitizeFilenamePart,
} from "../lib/issueReport";
import { Tab } from "../lib/types";

const tab: Tab = {
  id: "1",
  label: "AAPL - Analyst Estimates",
  data: {
    rows: [{ symbol: "AAPL", value: 10 }],
    apiKey: "SHOULD_NOT_APPEAR",
    nested: { Authorization: "Bearer token" },
  },
  platform: "FMP",
  callName: "Analyst Estimates",
  callId: "fmp_analyst_estimates",
  params: {
    symbol: "AAPL",
    period: "annual",
  },
  httpStatus: 200,
};

test("parses provider support email configuration", () => {
  const parsed = parseProviderSupportEmails("FMP=fmp@example.com;Fiscal.ai=fiscal@example.com");

  assert.equal(parsed.FMP, "fmp@example.com");
  assert.equal(parsed["Fiscal.ai"], "fiscal@example.com");
});

test("builds a provider issue report with mailto draft and attachment files", () => {
  const report = buildIssueReport({
    tab,
    issueDescription: "Revenue estimate looks stale.",
    recipientMap: { FMP: "fmp@example.com" },
    generatedAt: "2026-06-22T12:00:00.000Z",
  });

  assert.equal(report.recipient, "fmp@example.com");
  assert.equal(report.subject, "Data Issue - FMP - Analyst Estimates - AAPL");
  assert.match(report.mailtoHref, /^mailto:fmp@example.com\?/);
  assert.match(report.body, /Revenue estimate looks stale/);
  assert.deepEqual(
    report.files.map((file) => file.filename),
    [
      "FMP_Analyst_Estimates_AAPL_2026-06-22_issue-summary.md",
      "FMP_Analyst_Estimates_AAPL_2026-06-22_api-request.json",
      "FMP_Analyst_Estimates_AAPL_2026-06-22_diagnostics.json",
      "FMP_Analyst_Estimates_AAPL_2026-06-22_api-response.json",
    ]
  );
  assert.doesNotMatch(report.files[3].contents, /SHOULD_NOT_APPEAR/);
  assert.doesNotMatch(report.files[3].contents, /Bearer token/);
});

test("builds issue package without a configured recipient", () => {
  const report = buildIssueReport({
    tab,
    issueDescription: "",
    generatedAt: "2026-06-22T12:00:00.000Z",
  });

  assert.equal(report.recipient, undefined);
  assert.match(report.mailtoHref, /^mailto:\?/);
  assert.match(report.files[2].contents, /"recipientConfigured": false/);
});

test("redacts secret-like keys recursively", () => {
  assert.deepEqual(
    redactSecrets({
      ok: "visible",
      token: "hidden",
      nested: [{ api_key: "hidden" }],
    }),
    {
      ok: "visible",
      token: "[redacted]",
      nested: [{ api_key: "[redacted]" }],
    }
  );
});

test("sanitizes filenames", () => {
  assert.equal(sanitizeFilenamePart("FMP / Analyst: AAPL"), "FMP_Analyst_AAPL");
});
