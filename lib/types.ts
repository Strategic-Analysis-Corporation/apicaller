export interface ParamDef {
  key: string;
  label: string;
  // A literal string, or a function evaluated at call-selection/render time so
  // dynamic defaults (e.g. current year / today) stay fresh rather than freezing
  // at module-load. Resolve via `resolveParamDefault` in lib/platforms.ts.
  default: string | (() => string);
  type?: "entry" | "combo" | "searchable_ratio" | "searchable_exchange" | "ticker_list";
  options?: string[];
}

export interface ApiCallDef {
  id: string;
  name: string;
  desc: string;
  params: ParamDef[];
}

export interface PlatformDef {
  name: string;
  calls: ApiCallDef[];
}

export interface Tab {
  id: string;
  label: string;
  data: unknown;
  platform: string;
  callName: string;
  callId: string;
  params: Record<string, string>;
  loading?: boolean;
  error?: string;
  httpStatus?: number;
}

export interface FetchRequest {
  platformId: string;
  callId: string;
  params: Record<string, string>;
}
