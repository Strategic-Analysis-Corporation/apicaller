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

test("builds a provider issue report with mailto draft and one summary file", () => {
  const report = buildIssueReport({
    tab,
    issueDescription: "Revenue estimate looks stale.",
    recipientMap: { FMP: "fmp@example.com" },
    generatedAt: "2026-06-22T12:00:00.000Z",
  });

  assert.equal(report.recipient, "fmp@example.com");
  assert.equal(report.subject, "Data Issue - FMP - Analyst Estimates - AAPL");
  assert.match(report.mailtoHref, /^mailto:fmp@example.com\?/);
  assert.match(report.mailtoHref, /subject=Data%20Issue%20-%20FMP/);
  assert.doesNotMatch(report.mailtoHref, /\+/);
  assert.equal(report.body.split("\n")[0], "API Issue Context");
  assert.match(report.body, /^API Issue Context\n\nIssue summary:/);
  assert.doesNotMatch(report.body, /^Hello,/);
  assert.doesNotMatch(report.body, /attachment files/i);
  assert.match(report.body, /Revenue estimate looks stale/);
  assert.deepEqual(
    report.files.map((file) => file.filename),
    [
      "FMP_Analyst_Estimates_AAPL_2026-06-22_issue-summary.md",
    ]
  );
  assert.match(report.files[0].contents, /# API Issue Context/);
  assert.match(report.files[0].contents, /- API call: Analyst Estimates/);
  assert.match(report.files[0].contents, /- Queried entity: AAPL/);
  assert.doesNotMatch(report.files[0].contents, /Attachments/);
  assert.doesNotMatch(report.files[0].contents, /api-response\.json/);
});

test("builds issue package without a configured recipient", () => {
  const report = buildIssueReport({
    tab,
    issueDescription: "",
    generatedAt: "2026-06-22T12:00:00.000Z",
  });

  assert.equal(report.recipient, undefined);
  assert.match(report.mailtoHref, /^mailto:\?/);
  assert.equal(report.files.length, 1);
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
