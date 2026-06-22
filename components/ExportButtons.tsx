"use client";

import { useState } from "react";
import { isQuoteMediaEnhancedFinancialsBundle } from "@/lib/quotemedia";
import { downloadWorkbook } from "@/lib/excelExport";

interface ExportButtonsProps {
  data: unknown;
  filename: string;
}

export default function ExportButtons({
  data,
  filename,
}: ExportButtonsProps) {
  const [exporting, setExporting] = useState(false);

  const handleDownloadJson = () => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadText = () => {
    const textString = JSON.stringify(data, null, 2);
    const blob = new Blob([textString], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadExcel = async () => {
    setExporting(true);
    try {
      downloadWorkbook(data, filename);
    } catch (error) {
      console.error("Failed to export to Excel:", error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={handleDownloadJson}
        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
      >
        Download JSON
      </button>
      {isQuoteMediaEnhancedFinancialsBundle(data) && (
        <button
          onClick={handleDownloadText}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          Download TXT
        </button>
      )}
      <button
        onClick={handleDownloadExcel}
        disabled={exporting}
        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
      >
        {exporting ? "Exporting..." : "Download Excel"}
      </button>
    </div>
  );
}
