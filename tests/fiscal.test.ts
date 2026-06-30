import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFiscalCompanyKey,
  buildFiscalCompanyProfileParams,
  buildFiscalDailyRatioHistoryParams,
  buildFiscalFinancialsParams,
  buildFiscalCompaniesListParams,
  normalizeFiscalPeriodType,
} from "../lib/fiscal";

test("builds Fiscal.ai company keys from exchange and ticker", () => {
  assert.equal(buildFiscalCompanyKey("MSFT", "NASDAQ"), "NASDAQ_MSFT");
});

test("builds Fiscal.ai standardized financial params without exposing anything beyond the supplied key", () => {
  const params = buildFiscalFinancialsParams({
    apiKey: "TEST_KEY",
    ticker: "FPI",
    exchange: "NYSE",
    periodType: "annual,quarterly,semi-annual",
    currency: "USD",
    limit: "100",
  });

  assert.equal(params.get("ticker"), "FPI");
  assert.equal(params.get("exchange"), "NYSE");
  assert.equal(params.get("companyKey"), "NYSE_FPI");
  assert.equal(params.get("periodType"), "annual,quarterly,semi-annual");
  assert.equal(params.get("currency"), "USD");
  assert.equal(params.get("limit"), "100");
  assert.equal(params.get("apiKey"), "TEST_KEY");
});

test("builds Fiscal.ai daily ratio history params", () => {
  const params = buildFiscalDailyRatioHistoryParams({
    apiKey: "TEST_KEY",
    companyKey: "NASDAQ_MSFT",
  });

  assert.equal(params.get("companyKey"), "NASDAQ_MSFT");
  assert.equal(params.get("apiKey"), "TEST_KEY");
});

test("builds Fiscal.ai companies-list params", () => {
  const params = buildFiscalCompaniesListParams({
    apiKey: "TEST_KEY",
    pageNumber: "2",
    pageSize: "500",
  });

  assert.equal(params.get("pageNumber"), "2");
  assert.equal(params.get("pageSize"), "500");
  assert.equal(params.get("apiKey"), "TEST_KEY");
});

test("builds Fiscal.ai company-profile params with ticker and exchange", () => {
  const params = buildFiscalCompanyProfileParams({
    apiKey: "TEST_KEY",
    ticker: "RY",
    exchange: "TSX",
  });

  assert.equal(params.get("ticker"), "RY");
  assert.equal(params.get("exchange"), "TSX");
  assert.equal(params.get("apiKey"), "TEST_KEY");
});

test("omits exchange from Fiscal.ai company-profile params when blank", () => {
  const params = buildFiscalCompanyProfileParams({
    apiKey: "TEST_KEY",
    ticker: "MSFT",
  });

  assert.equal(params.get("ticker"), "MSFT");
  assert.equal(params.has("exchange"), false);
  assert.equal(params.get("apiKey"), "TEST_KEY");
});

test("normalizes Fiscal.ai period type spellings", () => {
  assert.equal(normalizeFiscalPeriodType("Semi Annual"), "semi-annual");
  assert.equal(normalizeFiscalPeriodType("semi_annual"), "semi-annual");
  assert.equal(normalizeFiscalPeriodType("semiannual"), "semiannual");
});
