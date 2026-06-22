import * as XLSX from "xlsx";
import { detectTableData, type TableData } from "./tableData";

const INVALID_SHEET_NAME_CHARS = /[\[\]*?:/\\]/g;

function hasExportableRows(table: TableData): boolean {
  return table.headers.length > 0 && table.rows.length > 0;
}

export function sanitizeWorksheetName(
  preferredName: string | undefined,
  fallbackName: string,
  usedNames: Set<string>
): string {
  const base =
    (preferredName || fallbackName)
      .replace(INVALID_SHEET_NAME_CHARS, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 31) || fallbackName;
  let name = base;
  let suffix = 2;

  while (usedNames.has(name.toLowerCase())) {
    const marker = ` (${suffix})`;
    name = `${base.slice(0, 31 - marker.length)}${marker}`;
    suffix += 1;
  }

  usedNames.add(name.toLowerCase());
  return name;
}

export function createWorkbookFromData(data: unknown): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const tables = detectTableData(data).filter(hasExportableRows);

  if (tables.length > 0) {
    const usedSheetNames = new Set<string>();
    tables.forEach((table, index) => {
      const wsData = [table.headers, ...table.rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const sheetName = sanitizeWorksheetName(
        table.title,
        index === 0 ? "Data" : `Data ${index + 1}`,
        usedSheetNames
      );
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
  } else {
    const jsonString = JSON.stringify(data, null, 2);
    const ws = XLSX.utils.aoa_to_sheet([[jsonString]]);
    XLSX.utils.book_append_sheet(wb, ws, "JSON");
  }

  return wb;
}

export function hasWorkbookTables(data: unknown): boolean {
  return detectTableData(data).some(hasExportableRows);
}

export function downloadWorkbook(data: unknown, filename: string): void {
  const wb = createWorkbookFromData(data);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
