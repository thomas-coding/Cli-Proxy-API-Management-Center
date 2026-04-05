import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { IconDownload } from '@/components/ui/icons';
import { QuotaProgressBar } from '@/components/quota/QuotaCard';
import { CODEX_CONFIG, buildCodexQuotaWindows } from '@/components/quota/quotaConfigs';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { reserveAuthFilesApi } from '@/services/api';
import { useAuthStore, useNotificationStore, useThemeStore } from '@/stores';
import type { AuthFileItem, CodexQuotaState } from '@/types';
import { downloadBlob } from '@/utils/download';
import { MAX_AUTH_FILE_SIZE } from '@/utils/constants';
import { formatFileSize } from '@/utils/format';
import { normalizePlanType, parseCodexUsagePayload } from '@/utils/quota';
import {
  formatModified,
  getAuthFileStatusMessage,
  getTypeColor,
  getTypeLabel,
  type ResolvedTheme,
} from '@/features/authFiles/constants';
import styles from './AuthFilesPage.module.scss';

const PAGE_SIZE_OPTIONS = [9, 18, 27];

function filterReserveFiles(files: AuthFileItem[], search: string) {
  const keyword = search.trim().toLowerCase();
  if (!keyword) return files;

  return files.filter((file) => {
    const statusMessage = getAuthFileStatusMessage(file).toLowerCase();
    const email = String(file.email ?? '').toLowerCase();
    const account = String(file.account ?? '').toLowerCase();
    return (
      file.name.toLowerCase().includes(keyword) ||
      email.includes(keyword) ||
      account.includes(keyword) ||
      statusMessage.includes(keyword)
    );
  });
}

function getVisibleReserveFiles(
  files: AuthFileItem[],
  search: string,
  page: number,
  pageSize: number
) {
  const filteredFiles = filterReserveFiles(files, search);
  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  return filteredFiles.slice(startIndex, startIndex + pageSize);
}

export function ReserveAuthFilesPage() {
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const resolvedTheme: ResolvedTheme = useThemeStore((state) => state.resolvedTheme);

  const disableControls = connectionStatus !== 'connected';
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [files, setFiles] = useState<AuthFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [quotaByName, setQuotaByName] = useState<Record<string, CodexQuotaState>>({});

  const loadFiles = useCallback(async (): Promise<AuthFileItem[]> => {
    setLoading(true);
    setError('');
    try {
      const data = await reserveAuthFilesApi.list();
      const nextFiles = Array.isArray(data?.files) ? data.files : [];
      setFiles(nextFiles);
      return nextFiles;
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : t('reserve_pool.load_failed', { defaultValue: '备用号池加载失败' });
      setError(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadFiles().catch(() => {});
  }, [loadFiles]);

  useEffect(() => {
    if (files.length === 0) {
      setQuotaByName({});
      return;
    }
    const existing = new Set(files.map((file) => file.name));
    setQuotaByName((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([name]) => existing.has(name))
      ) as Record<string, CodexQuotaState>;
      const prevKeys = Object.keys(prev).sort();
      const nextKeys = Object.keys(next).sort();
      const sameKeys =
        prevKeys.length === nextKeys.length &&
        prevKeys.every((key, index) => key === nextKeys[index]);
      return sameKeys ? prev : next;
    });
  }, [files]);

  const filteredFiles = useMemo(() => {
    return filterReserveFiles(files, search);
  }, [files, search]);

  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / pageSize));
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const visibleFiles = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredFiles.slice(startIndex, startIndex + pageSize);
  }, [filteredFiles, page, pageSize]);

  const refreshVisibleFiles = useCallback(async () => {
    if (disableControls || visibleFiles.length === 0) return;

    try {
      const processedNames = new Set<string>();
      let pendingNames = visibleFiles.map((file) => file.name);
      let removedCount = 0;
      let latestFiles = files;
      let rounds = 0;

      while (pendingNames.length > 0 && rounds < pageSize) {
        rounds += 1;

        setQuotaByName((prev) => {
          const next = { ...prev };
          pendingNames.forEach((name) => {
            next[name] = CODEX_CONFIG.buildLoadingState();
          });
          return next;
        });

        const results = await reserveAuthFilesApi.refresh(pendingNames);
        const nextStates: Record<string, CodexQuotaState> = {};
        const seenNames = new Set<string>();

        results.forEach((result) => {
          if (!result?.name) return;
          seenNames.add(result.name);

          if (result.removed) {
            removedCount += 1;
            nextStates[result.name] = CODEX_CONFIG.buildErrorState(
              t('reserve_pool.removed_after_refresh', {
                defaultValue: '该账号已失效并迁移到外部 401 仓库',
              }),
              result.status_code
            );
            return;
          }

          if ((result.status_code ?? 0) >= 200 && (result.status_code ?? 0) < 300) {
            const payload = parseCodexUsagePayload(result.body ?? '');
            if (!payload) {
              nextStates[result.name] = CODEX_CONFIG.buildErrorState(
                t('reserve_pool.empty_usage', { defaultValue: 'usage 返回为空' }),
                result.status_code
              );
              return;
            }
            nextStates[result.name] = CODEX_CONFIG.buildSuccessState({
              planType: normalizePlanType(payload.plan_type ?? payload.planType),
              windows: buildCodexQuotaWindows(payload, t),
            });
            return;
          }

          const message =
            result.error?.trim() ||
            result.body?.trim() ||
            t('common.unknown_error');
          nextStates[result.name] = CODEX_CONFIG.buildErrorState(message, result.status_code);
        });

        pendingNames.forEach((name) => {
          if (seenNames.has(name)) return;
          nextStates[name] = CODEX_CONFIG.buildErrorState(
            t('reserve_pool.refresh_missing_result', {
              defaultValue: '刷新结果缺失，请重试',
            })
          );
        });

        setQuotaByName((prev) => ({ ...prev, ...nextStates }));
        pendingNames.forEach((name) => processedNames.add(name));

        latestFiles = await loadFiles();
        pendingNames = getVisibleReserveFiles(latestFiles, search, page, pageSize)
          .map((file) => file.name)
          .filter((name) => !processedNames.has(name));
      }

      showNotification(
        removedCount > 0
          ? t('reserve_pool.refresh_partial', {
              defaultValue: '当前页已刷新，部分失效账号已迁移到外部 401 仓库',
            })
          : t('reserve_pool.refresh_success', { defaultValue: '当前页额度已刷新' }),
        removedCount > 0 ? 'warning' : 'success'
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('common.unknown_error');
      setQuotaByName((prev) => {
        const next = { ...prev };
        visibleFiles.forEach((file) => {
          next[file.name] = CODEX_CONFIG.buildErrorState(message);
        });
        return next;
      });
      showNotification(
        t('reserve_pool.refresh_failed', {
          defaultValue: '当前页刷新失败: {{message}}',
          message,
        }),
        'error'
      );
    }
  }, [disableControls, files, loadFiles, page, pageSize, search, showNotification, t, visibleFiles]);

  useHeaderRefresh(refreshVisibleFiles);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const fileList = event.target.files;
      if (!fileList || fileList.length === 0) return;

      const filesToUpload = Array.from(fileList);
      const validFiles: File[] = [];
      const invalidFiles: string[] = [];
      const oversizedFiles: string[] = [];

      filesToUpload.forEach((file) => {
        if (!file.name.endsWith('.json')) {
          invalidFiles.push(file.name);
          return;
        }
        if (file.size > MAX_AUTH_FILE_SIZE) {
          oversizedFiles.push(file.name);
          return;
        }
        validFiles.push(file);
      });

      if (invalidFiles.length > 0) {
        showNotification(
          t('reserve_pool.upload_json_only', { defaultValue: '备用号池只接受 .json 文件' }),
          'error'
        );
      }
      if (oversizedFiles.length > 0) {
        showNotification(
          t('reserve_pool.upload_too_large', {
            defaultValue: '文件过大，单文件上限 {{maxSize}}',
            maxSize: formatFileSize(MAX_AUTH_FILE_SIZE),
          }),
          'error'
        );
      }
      if (validFiles.length === 0) {
        event.target.value = '';
        return;
      }

      setUploading(true);
      let successCount = 0;
      const failures: string[] = [];

      for (const file of validFiles) {
        try {
          await reserveAuthFilesApi.upload(file);
          successCount += 1;
        } catch (err: unknown) {
          failures.push(
            `${file.name}: ${err instanceof Error ? err.message : t('common.unknown_error')}`
          );
        }
      }

      setUploading(false);
      event.target.value = '';

      if (successCount > 0) {
        await loadFiles();
        showNotification(
          t('reserve_pool.upload_success', {
            defaultValue: '备用号上传成功 ({{count}})',
            count: successCount,
          }),
          failures.length > 0 ? 'warning' : 'success'
        );
      }
      if (failures.length > 0) {
        showNotification(failures.join('; '), 'error');
      }
    },
    [loadFiles, showNotification, t]
  );

  const handleDownload = useCallback(
    async (name: string) => {
      try {
        const text = await reserveAuthFilesApi.downloadText(name);
        downloadBlob({
          filename: name,
          blob: new Blob([text], { type: 'application/json' }),
        });
      } catch (err: unknown) {
        showNotification(
          err instanceof Error ? err.message : t('common.unknown_error'),
          'error'
        );
      }
    },
    [showNotification, t]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
        <div style={{ flex: '1 1 280px', minWidth: 240 }}>
          <Input
            label={t('reserve_pool.search', { defaultValue: '搜索备用号' })}
            placeholder={t('reserve_pool.search_placeholder', {
              defaultValue: '文件名 / 邮箱 / 账号 / 状态',
            })}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            disabled={loading}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {t('reserve_pool.page_size', { defaultValue: '每页' })}
          </label>
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value) || PAGE_SIZE_OPTIONS[0]);
              setPage(1);
            }}
            disabled={loading}
            style={{
              minWidth: 84,
              borderRadius: 10,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              padding: '10px 12px',
            }}
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <Button
            variant="primary"
            onClick={handleUploadClick}
            disabled={disableControls || uploading}
          >
            {uploading
              ? t('reserve_pool.uploading', { defaultValue: '上传中' })
              : t('reserve_pool.upload', { defaultValue: '上传 JSON' })}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            multiple
            style={{ display: 'none' }}
            onChange={(event) => void handleFileChange(event)}
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {t('reserve_pool.summary', {
            defaultValue: '共 {{count}} 个备用号，顶部刷新按钮只刷新当前页额度。',
            count: filteredFiles.length,
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button
            variant="secondary"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={page <= 1}
          >
            {t('common.previous', { defaultValue: '上一页' })}
          </Button>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {page} / {totalPages}
          </span>
          <Button
            variant="secondary"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={page >= totalPages}
          >
            {t('common.next', { defaultValue: '下一页' })}
          </Button>
        </div>
      </div>

      {loading ? (
        <EmptyState
          title={t('reserve_pool.loading', { defaultValue: '备用号池加载中' })}
          description={t('reserve_pool.loading_desc', { defaultValue: '正在读取备用号列表。' })}
        />
      ) : error ? (
        <EmptyState
          title={t('reserve_pool.error', { defaultValue: '备用号池加载失败' })}
          description={error}
        />
      ) : visibleFiles.length === 0 ? (
        <EmptyState
          title={t('reserve_pool.empty', { defaultValue: '没有可显示的备用号' })}
          description={t('reserve_pool.empty_desc', {
            defaultValue: '可以先上传新的 Codex JSON 到备用号池。',
          })}
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 16,
          }}
        >
          {visibleFiles.map((file) => {
            const quota = quotaByName[file.name];
            const typeColor = getTypeColor(file.type || 'codex', resolvedTheme);
            const statusMessage = getAuthFileStatusMessage(file);
            const quotaStatus = quota?.status ?? 'idle';

            return (
              <div key={file.name} className={`${styles.fileCard} ${styles.codexCard}`}>
                <div className={styles.fileCardLayout}>
                  <div className={styles.fileCardMain}>
                    <div className={styles.cardHeader}>
                      <span
                        className={styles.typeBadge}
                        style={{
                          backgroundColor: typeColor.bg,
                          color: typeColor.text,
                          ...(typeColor.border ? { border: typeColor.border } : {}),
                        }}
                      >
                        {getTypeLabel(t, file.type || 'codex')}
                      </span>
                      <span className={styles.fileName}>{file.name}</span>
                    </div>

                    <div className={styles.cardMeta}>
                      <span>
                        {t('auth_files.file_size')}: {file.size ? formatFileSize(file.size) : '-'}
                      </span>
                      <span>
                        {t('auth_files.file_modified')}: {formatModified(file)}
                      </span>
                    </div>

                    <div className={styles.cardMeta}>
                      <span>
                        {t('reserve_pool.email', { defaultValue: '邮箱' })}: {String(file.email ?? '-')}
                      </span>
                      <span>
                        {t('reserve_pool.account', { defaultValue: '账号' })}: {String(file.account ?? '-')}
                      </span>
                    </div>

                    {statusMessage && (
                      <div className={styles.healthStatusMessage} title={statusMessage}>
                        {statusMessage}
                      </div>
                    )}

                    <div className={styles.quotaSection}>
                      {quotaStatus === 'loading' ? (
                        <div className={styles.quotaMessage}>
                          {t('reserve_pool.refreshing', { defaultValue: '正在刷新额度' })}
                        </div>
                      ) : quotaStatus === 'idle' ? (
                        <div className={styles.quotaMessage}>
                          {t('reserve_pool.quota_idle', {
                            defaultValue: '点击顶部刷新按钮刷新当前页额度',
                          })}
                        </div>
                      ) : quotaStatus === 'error' ? (
                        <div className={styles.quotaError}>
                          {quota?.error || t('common.unknown_error')}
                        </div>
                      ) : quota ? (
                        CODEX_CONFIG.renderQuotaItems(quota, t, { styles, QuotaProgressBar })
                      ) : (
                        <div className={styles.quotaMessage}>
                          {t('reserve_pool.quota_idle', {
                            defaultValue: '点击顶部刷新按钮刷新当前页额度',
                          })}
                        </div>
                      )}
                    </div>

                    <div className={styles.cardActions}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleDownload(file.name)}
                        className={styles.iconButton}
                        title={t('auth_files.download_button')}
                        disabled={disableControls}
                      >
                        <IconDownload className={styles.actionIcon} size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
