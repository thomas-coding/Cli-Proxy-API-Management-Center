/**
 * 认证文件相关类型
 * 基于原项目 src/modules/auth-files.js
 */

export type AuthFileType =
  | 'qwen'
  | 'kimi'
  | 'gemini'
  | 'gemini-cli'
  | 'aistudio'
  | 'claude'
  | 'codex'
  | 'antigravity'
  | 'iflow'
  | 'vertex'
  | 'empty'
  | 'unknown';

export type AuthCategory = 'team' | 'free' | 'unknown';

export interface AuthFileItem {
  name: string;
  type?: AuthFileType | string;
  provider?: string;
  channel?: string;
  size?: number;
  authIndex?: string | number | null;
  runtimeOnly?: boolean | string;
  disabled?: boolean;
  unavailable?: boolean;
  status?: string;
  statusMessage?: string;
  lastRefresh?: string | number;
  modified?: number;
  auth_category?: AuthCategory | string;
  auth_type?: string;
  plan_type?: string;
  priority?: number | string | null;
  category_priority?: number | string | null;
  category_priority_mixed?: boolean;
  prefix?: string;
  proxy_url?: string;
  [key: string]: unknown;
}

export interface AuthFilesResponse {
  files: AuthFileItem[];
  total?: number;
  category_priorities?: Partial<Record<AuthCategory, number>>;
  categoryPriorities?: Partial<Record<AuthCategory, number>>;
}
