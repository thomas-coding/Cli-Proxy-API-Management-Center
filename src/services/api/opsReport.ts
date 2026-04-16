import { apiClient } from './client';

const OPS_REPORT_TIMEOUT_MS = 30 * 1000;

export interface OpsReportTopUser {
  user_id?: number;
  username?: string;
  request_count?: number;
  total_tokens?: number;
  total_quota?: number;
  total_m_tokens?: number;
}

export interface OpsReportUserOverview {
  total_users?: number;
  active_users?: number;
  request_count?: number;
  total_tokens?: number;
  total_m_tokens?: number;
  top_user?: OpsReportTopUser;
}

export interface OpsReportCurrentPoolStatus {
  auth_files?: number;
  available?: number;
  usage_limit_reached?: number;
  blank_unavailable?: number;
  invalid_401?: number;
}

export interface OpsReportPoolDelta {
  usage_limit_reached_net_increase?: number;
  blank_unavailable_net_increase?: number;
  invalid_401_net_increase?: number;
}

export interface OpsReportQuotaReentry {
  count?: number;
  unique_auth_count?: number;
  outcomes?: {
    available?: number;
    invalid_401?: number;
    still_429?: number;
    transient_error?: number;
    other_error?: number;
  };
}

export interface OpsReportDailyNewInvalid401 {
  count?: number;
  sources?: {
    current_live_invalid_updated_today?: number;
    external_401_archive_mtime_today?: number;
    auto_archive_log_only_today?: number;
  };
}

export interface OpsReportOAuthOverview {
  current_pool_status?: OpsReportCurrentPoolStatus;
  daily_pool_delta?: OpsReportPoolDelta;
  daily_quota_reentry?: OpsReportQuotaReentry;
  daily_new_invalid_401?: OpsReportDailyNewInvalid401;
  counts?: {
    transient_error?: number;
  };
}

export interface OpsReportReserveOverview {
  endpoint_available?: boolean;
  current_pool_status?: {
    auth_files?: number;
    available?: number;
    invalid_401?: number;
  };
  daily_consumption?: {
    consumed_total?: number;
    invalid_moved?: number;
    promoted?: number;
    anomaly_429?: number;
  };
}

export interface OpsReportServerHealth {
  nginx_access?: {
    total?: number;
    status_429?: number;
    status_5xx?: number;
  };
  newapi_perf?: {
    error_count?: number;
    count?: number;
  };
  cliproxy_perf?: {
    error_count?: number;
  };
}

export interface OpsReportData {
  date?: string;
  generated_at?: string;
  user_overview?: OpsReportUserOverview;
  oauth_overview?: OpsReportOAuthOverview;
  reserve_pool_overview?: OpsReportReserveOverview;
  server_health?: OpsReportServerHealth;
  risk_notes?: string[];
}

export interface OpsReportResponse {
  requested_date: string;
  resolved_date: string;
  source: 'date' | 'yesterday' | 'latest_fallback';
  fallback_to_latest: boolean;
  markdown?: string;
  report?: OpsReportData | null;
}

export const opsReportApi = {
  getReport: (date?: string) =>
    apiClient.get<OpsReportResponse>('/ops-report', {
      timeout: OPS_REPORT_TIMEOUT_MS,
      params: date ? { date } : undefined,
    }),
};
