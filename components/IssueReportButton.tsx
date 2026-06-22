"use client";

import { useMemo, useState } from "react";
import { Tab } from "@/lib/types";
import {
  buildIssueReport,
  parseProviderSupportEmails,
  type IssueReportFile,
} from "@/lib/issueReport";
import { downloadWorkbook, hasWorkbookTables } from "@/lib/excelExport";

interface IssueReportButtonProps {
  tab: Tab;
}

function downloadTextFile(file: IssueReportFile): void {
  const blob = new Blob([file.contents], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function IssueReportButton({ tab }: IssueReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [issueDescription, setIssueDescription] = useState("");
  const providerRecipients = useMemo(
    () => parseProviderSupportEmails(process.env.NEXT_PUBLIC_PROVIDER_SUPPORT_EMAILS),
    []
  );
  const report = useMemo(
    () =>
      buildIssueReport({
        tab,
        issueDescription,
        recipientMap: providerRecipients,
      }),
    [tab, issueDescription, providerRecipients]
  );
  const canDownloadWorkbook = hasWorkbookTables(tab.data);

  const handleOpenDraft = () => {
    window.location.href = report.mailtoHref;
  };

  const handleDownloadPackage = () => {
    report.files.forEach((file, index) => {
      window.setTimeout(() => downloadTextFile(file), index * 150);
    });

    if (canDownloadWorkbook) {
      window.setTimeout(
        () => downloadWorkbook(tab.data, `${report.baseFilename}_api-response`),
        report.files.length * 150
      );
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={tab.loading}
        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
      >
        Report Data Issue
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-lg border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Report Data Issue
                </h2>
                <p className="text-sm text-gray-500">
                  {tab.platform} / {tab.callName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                aria-label="Close report issue dialog"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Generated files include request metadata, diagnostics, and the visible API response.
                API keys, auth headers, cookies, and secret-like fields are redacted before download.
              </div>

              <div className="grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Recipient
                  </span>
                  <span className="font-mono text-gray-900">
                    {report.recipient || "Not configured"}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Subject
                  </span>
                  <span className="text-gray-900">{report.subject}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Issue Summary
                </label>
                <textarea
                  value={issueDescription}
                  onChange={(event) => setIssueDescription(event.target.value)}
                  rows={4}
                  placeholder="Describe the incorrect, missing, stale, or unexpected data."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <span className="block text-sm font-medium text-gray-900 mb-1">
                  Email Body Preview
                </span>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800">
                  {report.body}
                </pre>
              </div>

              <div>
                <span className="block text-sm font-medium text-gray-900 mb-2">
                  Attachment Files
                </span>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                  <ul className="list-disc pl-5">
                    {report.files.map((file) => (
                      <li key={file.filename}>{file.filename}</li>
                    ))}
                    {canDownloadWorkbook && (
                      <li>{report.baseFilename}_api-response.xlsx</li>
                    )}
                  </ul>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={handleOpenDraft}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Open Email Draft
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPackage}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Download Email Package
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
