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

export interface OpsReportMetricTriple {
  avg?: number;
  p95?: number;
  max?: number;
}

export interface OpsReportMetricPair {
  min?: number;
  p05?: number;
}

export interface OpsReportShardTopErrorAuth {
  auth_id?: string;
  count?: number;
}

export interface OpsReportShardHostOverview {
  samples?: number;
  cpu_host_pct?: OpsReportMetricTriple;
  mem_available_mb?: OpsReportMetricPair;
  tcp_established?: {
    avg?: number;
    p95?: number;
    max?: number;
  };
  cliproxy_cpu_pct?: {
    p95?: number;
    max?: number;
  };
}

export interface OpsReportShardCliproxyOverview {
  phase_counts?: Record<string, number>;
  first_chunk_upstream_ms?: OpsReportMetricTriple;
  error_count?: number;
  top_error_auths?: OpsReportShardTopErrorAuth[];
}

export interface OpsReportShardInvalidGroup {
  count?: number;
  http_status?: number;
  error_type?: string | null;
  error_code?: string | null;
  message?: string | null;
  accounts?: Array<{
    name?: string;
    account?: string;
    auth_index?: string;
  }>;
}

export interface OpsReportShardPoolOverview {
  ok?: boolean;
  current_pool_status?: OpsReportCurrentPoolStatus;
  invalid_error_groups?: OpsReportShardInvalidGroup[];
  reserve_pool_status?: OpsReportCurrentPoolStatus;
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
  shard?: string;
  host?: OpsReportShardHostOverview;
  cliproxy_perf?: OpsReportShardCliproxyOverview;
  pool_overview?: OpsReportShardPoolOverview;
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
