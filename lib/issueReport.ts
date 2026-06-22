import { Tab } from "./types";

export interface ProviderIssueRecipient {
  provider: string;
  email?: string;
}

export type ProviderIssueRecipientMap = Record<string, string | undefined>;

export interface IssueReportFile {
  filename: string;
  mimeType: string;
  contents: string;
}

export interface IssueReport {
  provider: string;
  recipient?: string;
  subject: string;
  body: string;
  mailtoHref: string;
  baseFilename: string;
  files: IssueReportFile[];
}

const REDACTED = "[redacted]";
const SECRET_KEY_PATTERN =
  /(api[-_ ]?key|apikey|token|secret|authorization|cookie|password|bearer|credential)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function sanitizeFilenamePart(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "api_call";
}

export function parseProviderSupportEmails(
  raw: string | undefined
): ProviderIssueRecipientMap {
  if (!raw) return {};

  return raw.split(/[;\n]/).reduce<ProviderIssueRecipientMap>((acc, entry) => {
    const trimmed = entry.trim();
    if (!trimmed) return acc;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) return acc;

    const provider = trimmed.slice(0, separatorIndex).trim();
    const email = trimmed.slice(separatorIndex + 1).trim();
    if (provider && email) {
      acc[provider] = email;
    }
    return acc;
  }, {});
}

export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSecrets);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      SECRET_KEY_PATTERN.test(key) ? REDACTED : redactSecrets(entryValue),
    ])
  );
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(redactSecrets(value), null, 2);
}

function getPrimaryEntity(params: Record<string, string>): string {
  const candidates = [
    "symbol",
    "ticker",
    "company_key",
    "companyKey",
    "query",
    "exchange_group",
    "tickers",
  ];

  for (const key of candidates) {
    const value = params[key];
    if (value) return value;
  }

  return "";
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildBody({
  tab,
  issueDescription,
  generatedAt,
}: {
  tab: Tab;
  issueDescription: string;
  generatedAt: string;
}): string {
  const entity = getPrimaryEntity(tab.params);
  const paramLines = Object.entries(tab.params)
    .map(([key, value]) => `- ${key}: ${value || "(empty)"}`)
    .join("\n");

  return [
    "Hello,",
    "",
    "I am reporting a possible data issue found while using API Caller.",
    "",
    `Issue summary: ${issueDescription.trim() || "(please describe the issue)"}`,
    "",
    "API context:",
    `- Provider: ${tab.platform}`,
    `- API call: ${tab.callName}`,
    `- Call ID: ${tab.callId}`,
    entity ? `- Queried entity: ${entity}` : "",
    `- HTTP status: ${tab.httpStatus ?? "not captured"}`,
    `- Generated at: ${generatedAt}`,
    "",
    "Parameters:",
    paramLines || "- none",
    "",
    tab.error ? `Application error/diagnostic: ${tab.error}` : "",
    "",
    "I have generated attachment files from API Caller with request metadata, diagnostics, and the API response for review.",
    "",
    "Thank you.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function buildSummaryMarkdown({
  tab,
  issueDescription,
  generatedAt,
}: {
  tab: Tab;
  issueDescription: string;
  generatedAt: string;
}): string {
  const paramLines = Object.entries(tab.params)
    .map(([key, value]) => `| ${key} | ${value || "(empty)"} |`)
    .join("\n");

  return [
    "# API Caller Data Issue",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Issue",
    "",
    issueDescription.trim() || "(please describe the issue)",
    "",
    "## API Context",
    "",
    `- Provider: ${tab.platform}`,
    `- API call: ${tab.callName}`,
    `- Call ID: ${tab.callId}`,
    `- HTTP status: ${tab.httpStatus ?? "not captured"}`,
    tab.error ? `- Error/diagnostic: ${tab.error}` : "",
    "",
    "## Parameters",
    "",
    "| Name | Value |",
    "| --- | --- |",
    paramLines || "| (none) | |",
    "",
    "## Attachments",
    "",
    "- api-request.json",
    "- diagnostics.json",
    "- api-response.json",
    "- api-response.xlsx, when table data is available",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function buildIssueReport({
  tab,
  issueDescription,
  recipientMap = {},
  generatedAt = nowIso(),
}: {
  tab: Tab;
  issueDescription: string;
  recipientMap?: ProviderIssueRecipientMap;
  generatedAt?: string;
}): IssueReport {
  const entity = getPrimaryEntity(tab.params);
  const recipient = recipientMap[tab.platform];
  const subjectParts = ["Data Issue", tab.platform, tab.callName, entity].filter(
    Boolean
  );
  const subject = subjectParts.join(" - ");
  const body = buildBody({ tab, issueDescription, generatedAt });
  const baseFilename = sanitizeFilenamePart(
    [
      tab.platform,
      tab.callName,
      entity || tab.callId,
      generatedAt.slice(0, 10),
    ].join("_")
  );
  const requestMetadata = {
    generatedAt,
    platform: tab.platform,
    callName: tab.callName,
    callId: tab.callId,
    params: tab.params,
  };
  const diagnostics = {
    generatedAt,
    platform: tab.platform,
    callName: tab.callName,
    callId: tab.callId,
    httpStatus: tab.httpStatus ?? null,
    error: tab.error ?? null,
    loading: !!tab.loading,
    recipientConfigured: !!recipient,
  };
  const files: IssueReportFile[] = [
    {
      filename: `${baseFilename}_issue-summary.md`,
      mimeType: "text/markdown",
      contents: buildSummaryMarkdown({ tab, issueDescription, generatedAt }),
    },
    {
      filename: `${baseFilename}_api-request.json`,
      mimeType: "application/json",
      contents: stringifyJson(requestMetadata),
    },
    {
      filename: `${baseFilename}_diagnostics.json`,
      mimeType: "application/json",
      contents: stringifyJson(diagnostics),
    },
    {
      filename: `${baseFilename}_api-response.json`,
      mimeType: "application/json",
      contents: stringifyJson(tab.data),
    },
  ];

  const mailtoParams = new URLSearchParams({
    subject,
    body,
  });
  const mailtoHref = `mailto:${recipient || ""}?${mailtoParams.toString()}`;

  return {
    provider: tab.platform,
    recipient,
    subject,
    body,
    mailtoHref,
    baseFilename,
    files,
  };
}
