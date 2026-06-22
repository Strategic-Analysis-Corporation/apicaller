import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

const secretEnvNames = [
  "QM_TOKEN",
  "QM_WEBMASTER_ID",
  "FISCAL_API_KEY",
  "EODHD_API_TOKEN",
  "FMP_API_KEY",
];

const clientSourceFiles = [
  "app/page.tsx",
  "components/CallSelector.tsx",
  "components/ChartView.tsx",
  "components/ExportButtons.tsx",
  "components/IssueReportButton.tsx",
  "components/JsonView.tsx",
  "components/ParamForm.tsx",
  "components/PlatformSelector.tsx",
  "components/ResultTabs.tsx",
  "components/TableView.tsx",
  "lib/excelExport.ts",
  "lib/fiscal.ts",
  "lib/issueReport.ts",
  "lib/platforms.ts",
  "lib/quotemedia.ts",
  "lib/redaction.ts",
  "lib/tableData.ts",
  "lib/types.ts",
];

function readRepoFile(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

test("vendor API credentials are never declared as public env vars", () => {
  const envExample = readRepoFile(".env.example");

  for (const envName of secretEnvNames) {
    assert.doesNotMatch(
      envExample,
      new RegExp(`^NEXT_PUBLIC_${envName}=`, "m"),
      `${envName} must not use the NEXT_PUBLIC_ prefix`
    );
  }

  assert.doesNotMatch(
    envExample,
    /^NEXT_PUBLIC_.*(API[-_]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH|WEBMASTER_ID)=/im,
    "secret-like variables must not use NEXT_PUBLIC_"
  );
});

test("client-side source does not reference vendor API credentials", () => {
  const forbiddenEnvPattern = new RegExp(
    `process\\.env\\.(${secretEnvNames.join("|")})\\b`
  );

  for (const file of clientSourceFiles) {
    assert.doesNotMatch(
      readRepoFile(file),
      forbiddenEnvPattern,
      `${file} must not read vendor credentials`
    );
  }
});
