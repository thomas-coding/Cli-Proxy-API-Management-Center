import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { opsReportApi, type OpsReportResponse } from '@/services/api/opsReport';
import { formatDateTime, formatNumber, truncateText } from '@/utils/format';
import styles from './OpsReportPage.module.scss';

const formatMetricNumber = (value: number | undefined, locale?: string) =>
  typeof value === 'number' ? formatNumber(value, locale) : '-';

const formatMetricDecimal = (
  value: number | undefined,
  locale?: string,
  maximumFractionDigits = 2,
  suffix = ''
) =>
  typeof value === 'number'
    ? `${value.toLocaleString(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits,
      })}${suffix}`
    : '-';

const formatMetricSeries = (
  values: Array<number | undefined>,
  locale?: string,
  maximumFractionDigits = 2,
  suffix = ''
) => {
  const formatted = values
    .map((value) =>
      typeof value === 'number'
        ? `${value.toLocaleString(locale, {
            minimumFractionDigits: 0,
            maximumFractionDigits,
          })}${suffix}`
        : ''
    )
    .filter(Boolean);

  return formatted.length ? formatted.join(' / ') : '-';
};

const formatTokensInMillions = (value: number | undefined, locale?: string) =>
  typeof value === 'number'
    ? `${value.toLocaleString(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
      })} M`
    : '-';

export function OpsReportPage() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<OpsReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const next = await opsReportApi.getReport();
      setData(next);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
      setError(
        `${t('ops_report.load_failed', { defaultValue: '加载运维日报失败' })}${message ? `: ${message}` : ''}`
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useHeaderRefresh(loadReport);

  const report = data?.report ?? null;
  const isShardReport = Boolean(report?.shard || report?.host || report?.pool_overview);
  const userOverview = report?.user_overview;
  const oauthOverview = report?.oauth_overview;
  const poolStatus = oauthOverview?.current_pool_status;
  const poolDelta = oauthOverview?.daily_pool_delta;
  const quotaReentry = oauthOverview?.daily_quota_reentry;
  const dailyNewInvalid = oauthOverview?.daily_new_invalid_401;
  const reserveOverview = report?.reserve_pool_overview;
  const reserveStatus = reserveOverview?.current_pool_status;
  const reserveDaily = reserveOverview?.daily_consumption;
  const serverHealth = report?.server_health;
  const riskNotes = report?.risk_notes ?? [];
  const shardHost = report?.host;
  const shardCliproxy = report?.cliproxy_perf;
  const shardPoolOverview = report?.pool_overview;
  const shardPoolStatus = shardPoolOverview?.current_pool_status;
  const shardReserveStatus = shardPoolOverview?.reserve_pool_status;
  const shardInvalidGroups = shardPoolOverview?.invalid_error_groups ?? [];
  const shardTopErrorAuth = shardCliproxy?.top_error_auths?.[0];
  const locale = i18n.language;

  const generatedAt =
    report?.generated_at && report.generated_at.trim()
      ? formatDateTime(report.generated_at, locale)
      : '-';

  const summaryCards = isShardReport
    ? [
        {
          label: t('ops_report.cards.pool_available', { defaultValue: '生产池可用号' }),
          value: formatMetricNumber(shardPoolStatus?.available, locale),
          sublabel: t('ops_report.cards.pool_available_desc', {
            total: formatMetricNumber(shardPoolStatus?.auth_files, locale),
          }),
        },
        {
          label: t('ops_report.metrics.quota_limited', { defaultValue: '生产池 429 号' }),
          value: formatMetricNumber(shardPoolStatus?.usage_limit_reached, locale),
          sublabel: t('ops_report.cards.new_invalid_401_desc', {
            defaultValue: '当前 401 {{current}} / 空状态 {{external}}',
            current: formatMetricNumber(shardPoolStatus?.invalid_401, locale),
            external: formatMetricNumber(shardPoolStatus?.blank_unavailable, locale),
          }),
        },
        {
          label: t('ops_report.metrics.reserve_available', { defaultValue: '备用池可用号' }),
          value: formatMetricNumber(shardReserveStatus?.available, locale),
          sublabel: t('ops_report.cards.pool_available_desc', {
            total: formatMetricNumber(shardReserveStatus?.auth_files, locale),
          }),
        },
        {
          label: t('ops_report.metrics.cliproxy_errors', {
            defaultValue: 'CLIProxy upstream error phases',
          }),
          value: formatMetricNumber(shardCliproxy?.error_count, locale),
          sublabel: t('ops_report.cards.requests', {
            defaultValue: 'dispatch {{total}}',
            total: formatMetricNumber(shardCliproxy?.phase_counts?.dispatch, locale),
          }),
        },
        {
          label: t('ops_report.shard.host_cpu_p95', { defaultValue: 'Host CPU p95' }),
          value: formatMetricDecimal(shardHost?.cpu_host_pct?.p95, locale, 2, '%'),
          sublabel: t('ops_report.shard.host_cpu_desc', {
            defaultValue: 'avg {{avg}} / max {{max}}',
            avg: formatMetricDecimal(shardHost?.cpu_host_pct?.avg, locale, 2, '%'),
            max: formatMetricDecimal(shardHost?.cpu_host_pct?.max, locale, 2, '%'),
          }),
        },
        {
          label: t('ops_report.shard.mem_min', { defaultValue: '内存余量最低' }),
          value: formatMetricDecimal(shardHost?.mem_available_mb?.min, locale, 2, ' MB'),
          sublabel: t('ops_report.shard.mem_min_desc', {
            defaultValue: 'TCP p95 {{p95}} / max {{max}}',
            p95: formatMetricNumber(shardHost?.tcp_established?.p95, locale),
            max: formatMetricNumber(shardHost?.tcp_established?.max, locale),
          }),
        },
      ]
    : [
      {
        label: t('ops_report.cards.active_users', { defaultValue: '活跃用户' }),
        value: formatMetricNumber(userOverview?.active_users, locale),
        sublabel: t('ops_report.cards.active_users_desc', {
          total: formatMetricNumber(userOverview?.total_users, locale),
        }),
      },
      {
        label: t('ops_report.cards.requests', { defaultValue: '请求数' }),
        value: formatMetricNumber(userOverview?.request_count, locale),
        sublabel: t('ops_report.cards.tokens_desc', {
          total: formatTokensInMillions(userOverview?.total_m_tokens, locale),
        }),
      },
      {
        label: t('ops_report.cards.pool_available', { defaultValue: '生产池可用号' }),
        value: formatMetricNumber(poolStatus?.available, locale),
        sublabel: t('ops_report.cards.pool_available_desc', {
          total: formatMetricNumber(poolStatus?.auth_files, locale),
        }),
      },
      {
        label: t('ops_report.cards.reserve_promoted', { defaultValue: '备用池补仓' }),
        value: formatMetricNumber(reserveDaily?.promoted, locale),
        sublabel: t('ops_report.cards.reserve_promoted_desc', {
          total: formatMetricNumber(reserveDaily?.invalid_moved, locale),
        }),
      },
      {
        label: t('ops_report.cards.nginx_5xx', { defaultValue: '公网 5xx' }),
        value: formatMetricNumber(serverHealth?.nginx_access?.status_5xx, locale),
        sublabel: t('ops_report.cards.nginx_5xx_desc', {
          total: formatMetricNumber(serverHealth?.nginx_access?.status_429, locale),
        }),
      },
      {
        label: t('ops_report.cards.new_invalid_401', { defaultValue: '新产生 401' }),
        value: formatMetricNumber(dailyNewInvalid?.count, locale),
        sublabel: t('ops_report.cards.new_invalid_401_desc', {
          defaultValue: '池内 {{current}} / external-401 {{external}}',
          current: formatMetricNumber(dailyNewInvalid?.sources?.current_live_invalid_updated_today, locale),
          external: formatMetricNumber(
            dailyNewInvalid?.sources?.external_401_archive_mtime_today,
            locale
          ),
        }),
      },
    ];

  const fallbackNotice =
    data?.fallback_to_latest && data.requested_date && data.resolved_date
      ? t('ops_report.fallback_notice', {
          defaultValue: '昨天的日报尚未就绪，当前展示服务器上最新的 {{resolved}} 日报（原请求 {{requested}}）。',
          requested: data.requested_date,
          resolved: data.resolved_date,
        })
      : '';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>
            {t('ops_report.title', { defaultValue: '运维日报' })}
          </h1>
          <p className={styles.subtitle}>
            {t('ops_report.subtitle', {
              defaultValue: '直接读取服务器日报文件，默认展示昨天的日报并在未生成时回退到最新可用日报。',
            })}
          </p>
        </div>
        <div className={styles.headerActions}>
          {data?.resolved_date ? (
            <span className={styles.reportDateBadge}>
              {t('ops_report.report_date', { defaultValue: '日报日期' })}: {data.resolved_date}
            </span>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => void loadReport()} loading={loading}>
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      {error ? <div className={styles.errorBox}>{error}</div> : null}

      {data && !error ? (
        <>
          <Card className={styles.heroCard}>
            <div className={styles.heroTop}>
              <div className={styles.heroHeading}>
                <div className={styles.heroLabel}>
                  {isShardReport
                    ? t('ops_report.shard.hero_label', { defaultValue: 'Shard 运维快照' })
                    : t('ops_report.hero_label', { defaultValue: '昨日运维快照' })}
                </div>
                <div className={styles.heroDate}>{data.resolved_date || '-'}</div>
                <div className={styles.heroMeta}>
                  <span>
                    {t('ops_report.generated_at', { defaultValue: '生成时间' })}: {generatedAt}
                  </span>
                  <span>
                    {t('ops_report.requested_date', { defaultValue: '默认目标日' })}:{' '}
                    {data.requested_date || '-'}
                  </span>
                  {isShardReport ? (
                    <span>
                      {t('ops_report.shard.node', { defaultValue: 'Shard 节点' })}:{' '}
                      {report?.shard || '-'}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className={styles.heroHighlights}>
                <div className={styles.highlightItem}>
                  <span className={styles.highlightLabel}>
                    {isShardReport
                      ? t('ops_report.shard.node', { defaultValue: 'Shard 节点' })
                      : t('ops_report.hero_top_user', { defaultValue: '最高消耗用户' })}
                  </span>
                  <span className={styles.highlightValue}>
                    {isShardReport ? report?.shard || '-' : userOverview?.top_user?.username || '-'}
                  </span>
                  <span className={styles.highlightSub}>
                    {isShardReport
                      ? t('ops_report.shard.node_desc', {
                          defaultValue: '生产池可用 {{available}} / {{total}}',
                          available: formatMetricNumber(shardPoolStatus?.available, locale),
                          total: formatMetricNumber(shardPoolStatus?.auth_files, locale),
                        })
                      : t('ops_report.hero_top_user_desc', {
                          defaultValue: '{{tokens}} · {{requests}} 次请求',
                          tokens: formatTokensInMillions(userOverview?.top_user?.total_m_tokens, locale),
                          requests: formatMetricNumber(userOverview?.top_user?.request_count, locale),
                        })}
                  </span>
                </div>
                <div className={styles.highlightItem}>
                  <span className={styles.highlightLabel}>
                    {isShardReport
                      ? t('ops_report.shard.top_error_auth', { defaultValue: '高频错误 auth' })
                      : t('ops_report.hero_reentry', { defaultValue: '429 回流' })}
                  </span>
                  <span className={styles.highlightValue}>
                    {isShardReport
                      ? formatMetricNumber(shardTopErrorAuth?.count, locale)
                      : formatMetricNumber(quotaReentry?.count, locale)}
                  </span>
                  <span className={styles.highlightSub}>
                    {isShardReport
                      ? shardTopErrorAuth?.auth_id
                        ? truncateText(shardTopErrorAuth.auth_id, 56)
                        : t('ops_report.shard.no_top_error_auth', {
                            defaultValue: '当天没有明显集中的 error auth。',
                          })
                      : t('ops_report.hero_reentry_desc', {
                          total: formatMetricNumber(quotaReentry?.outcomes?.available, locale),
                        })}
                  </span>
                </div>
              </div>
            </div>

            <div className={`status-badge ${data.fallback_to_latest ? 'warning' : 'success'}`}>
              {data.fallback_to_latest
                ? fallbackNotice
                : t('ops_report.ready_notice', {
                    defaultValue: '当前直接展示服务器上已生成的昨天日报，无需再手动同步到本地控制仓库。',
                  })}
            </div>
          </Card>

          <div className={styles.summaryGrid}>
            {summaryCards.map((card) => (
              <div key={card.label} className={styles.summaryCard}>
                <div className={styles.summaryLabel}>{card.label}</div>
                <div className={styles.summaryValue}>{card.value}</div>
                <div className={styles.summarySublabel}>{card.sublabel}</div>
              </div>
            ))}
          </div>

          <div className={styles.detailGrid}>
            <Card
              title={t('ops_report.pool_title', { defaultValue: '号池与备用池' })}
              className={styles.detailCard}
            >
              <div className={styles.metricList}>
                {isShardReport ? (
                  <>
                    <div className={styles.metricRow}>
                      <span>{t('ops_report.shard.prod_auth_files', { defaultValue: '生产 auth 文件' })}</span>
                      <strong>{formatMetricNumber(shardPoolStatus?.auth_files, locale)}</strong>
                    </div>
                    <div className={styles.metricRow}>
                      <span>{t('ops_report.cards.pool_available', { defaultValue: '生产池可用号' })}</span>
                      <strong>{formatMetricNumber(shardPoolStatus?.available, locale)}</strong>
                    </div>
                    <div className={styles.metricRow}>
                      <span>{t('ops_report.metrics.quota_limited', { defaultValue: '生产池 429 号' })}</span>
                      <strong>{formatMetricNumber(shardPoolStatus?.usage_limit_reached, locale)}</strong>
                    </div>
                    <div className={styles.metricRow}>
                      <span>{t('ops_report.metrics.invalid_401', { defaultValue: '生产池当前 401' })}</span>
                      <strong>{formatMetricNumber(shardPoolStatus?.invalid_401, locale)}</strong>
                    </div>
                    <div className={styles.metricRow}>
                      <span>{t('ops_report.shard.reserve_auth_files', { defaultValue: '备用 auth 文件' })}</span>
                      <strong>{formatMetricNumber(shardReserveStatus?.auth_files, locale)}</strong>
                    </div>
                    <div className={styles.metricRow}>
                      <span>{t('ops_report.metrics.reserve_available', { defaultValue: '备用池可用号' })}</span>
                      <strong>{formatMetricNumber(shardReserveStatus?.available, locale)}</strong>
                    </div>
                    <div className={styles.metricRow}>
                      <span>{t('ops_report.shard.invalid_group_count', { defaultValue: '401 分组数' })}</span>
                      <strong>{formatMetricNumber(shardInvalidGroups.length, locale)}</strong>
                    </div>
                    <div className={styles.metricRow}>
                      <span>{t('ops_report.shard.top_error_auth_count', { defaultValue: '高频 error auth 次数' })}</span>
                      <strong>{formatMetricNumber(shardTopErrorAuth?.count, locale)}</strong>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.metricRow}>
                      <span>{t('ops_report.metrics.quota_limited', { defaultValue: '生产池 429 号' })}</span>
                      <strong>{formatMetricNumber(poolStatus?.usage_limit_reached, locale)}</strong>
                    </div>
                    <div className={styles.metricRow}>
                      <span>{t('ops_report.metrics.invalid_401', { defaultValue: '生产池当前 401' })}</span>
                      <strong>{formatMetricNumber(poolStatus?.invalid_401, locale)}</strong>
                    </div>
                    <div className={styles.metricRow}>
                      <span>{t('ops_report.metrics.transient_error', { defaultValue: '生产池瞬时错误' })}</span>
                      <strong>{formatMetricNumber(oauthOverview?.counts?.transient_error, locale)}</strong>
                    </div>
                    <div className={styles.metricRow}>
                      <span>
                        {t('ops_report.metrics.quota_delta', { defaultValue: '429 净新增（相对前一日报）' })}
                      </span>
                      <strong>{formatMetricNumber(poolDelta?.usage_limit_reached_net_increase, locale)}</strong>
                    </div>
                    <div className={styles.metricRow}>
                      <span>
                        {t('ops_report.metrics.invalid_delta', { defaultValue: '401 净新增（相对前一日报）' })}
                      </span>
                      <strong>{formatMetricNumber(poolDelta?.invalid_401_net_increase, locale)}</strong>
                    </div>
                    <div className={styles.metricRow}>
                      <span>{t('ops_report.metrics.reserve_available', { defaultValue: '备用池可用号' })}</span>
                      <strong>{formatMetricNumber(reserveStatus?.available, locale)}</strong>
                    </div>
                    <div className={styles.metricRow}>
                      <span>{t('ops_report.metrics.reserve_consumed', { defaultValue: '备用池 24h 消耗' })}</span>
                      <strong>{formatMetricNumber(reserveDaily?.consumed_total, locale)}</strong>
                    </div>
                    <div className={styles.metricRow}>
                      <span>{t('ops_report.metrics.reserve_429', { defaultValue: '备用池 429 异常' })}</span>
                      <strong>{formatMetricNumber(reserveDaily?.anomaly_429, locale)}</strong>
                    </div>
                  </>
                )}
              </div>
            </Card>

            <Card
              title={
                isShardReport
                  ? t('ops_report.shard.runtime_title', { defaultValue: 'Host / CLIProxyAPI / 401 分组' })
                  : t('ops_report.runtime_title', { defaultValue: '运行态与风险提示' })
              }
              className={styles.detailCard}
            >
              <div className={styles.metricList}>
                {isShardReport ? (
                  <>
                    <div className={styles.metricRow}>
                      <span>{t('ops_report.shard.host_samples', { defaultValue: 'Host samples' })}</span>
                      <strong>{formatMetricNumber(shardHost?.samples, locale)}</strong>
                    </div>
                    <div className={styles.metricRow}>
                      <span>{t('ops_report.shard.host_cpu', { defaultValue: 'Host CPU avg/p95/max' })}</span>
                      <strong>
                        {formatMetricSeries(
                          [
                            shardHost?.cpu_host_pct?.avg,
                            shardHost?.cpu_host_pct?.p95,
                            shardHost?.cpu_host_pct?.max,
                          ],
                          locale,
                          2,
                          '%'
                        )}
                      </strong>
                    </div>
                    <div className={styles.metricRow}>
                      <span>{t('ops_report.shard.mem_available', { defaultValue: 'MemAvailable min/p05' })}</span>
                      <strong>
                        {formatMetricSeries(
                          [shardHost?.mem_available_mb?.min, shardHost?.mem_available_mb?.p05],
                          locale,
                          2,
                          ' MB'
                        )}
                      </strong>
                    </div>
                    <div className={styles.metricRow}>
                      <span>{t('ops_report.shard.tcp_established', { defaultValue: 'TCP established p95/max' })}</span>
                      <strong>
                        {formatMetricSeries(
                          [shardHost?.tcp_established?.p95, shardHost?.tcp_established?.max],
                          locale,
                          0
                        )}
                      </strong>
                    </div>
                    <div className={styles.metricRow}>
                      <span>{t('ops_report.shard.cliproxy_cpu', { defaultValue: 'CLIProxy CPU p95/max' })}</span>
                      <strong>
                        {formatMetricSeries(
                          [shardHost?.cliproxy_cpu_pct?.p95, shardHost?.cliproxy_cpu_pct?.max],
                          locale,
                          2,
                          '%'
                        )}
                      </strong>
                    </div>
                    <div className={styles.metricRow}>
                      <span>
                        {t('ops_report.shard.first_chunk', {
                          defaultValue: 'first_chunk_upstream_ms avg/p95/max',
                        })}
                      </span>
                      <strong>
                        {formatMetricSeries(
                          [
                            shardCliproxy?.first_chunk_upstream_ms?.avg,
                            shardCliproxy?.first_chunk_upstream_ms?.p95,
                            shardCliproxy?.first_chunk_upstream_ms?.max,
                          ],
                          locale,
                          2,
                          ' ms'
                        )}
                      </strong>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.metricRow}>
                      <span>{t('ops_report.metrics.nginx_total', { defaultValue: 'Nginx 总请求' })}</span>
                      <strong>{formatMetricNumber(serverHealth?.nginx_access?.total, locale)}</strong>
                    </div>
                    <div className={styles.metricRow}>
                      <span>{t('ops_report.metrics.newapi_errors', { defaultValue: 'new-api 非 200' })}</span>
                      <strong>{formatMetricNumber(serverHealth?.newapi_perf?.error_count, locale)}</strong>
                    </div>
                    <div className={styles.metricRow}>
                      <span>
                        {t('ops_report.metrics.cliproxy_errors', {
                          defaultValue: 'CLIProxy upstream error phases',
                        })}
                      </span>
                      <strong>{formatMetricNumber(serverHealth?.cliproxy_perf?.error_count, locale)}</strong>
                    </div>
                    <div className={styles.metricRow}>
                      <span>{t('ops_report.metrics.reentry_available', { defaultValue: '回流后首个结果可用' })}</span>
                      <strong>{formatMetricNumber(quotaReentry?.outcomes?.available, locale)}</strong>
                    </div>
                    <div className={styles.metricRow}>
                      <span>{t('ops_report.metrics.reentry_invalid', { defaultValue: '回流后首个结果 401' })}</span>
                      <strong>{formatMetricNumber(quotaReentry?.outcomes?.invalid_401, locale)}</strong>
                    </div>
                    <div className={styles.metricRow}>
                      <span>{t('ops_report.metrics.reentry_transient', { defaultValue: '回流后首个结果瞬时错误' })}</span>
                      <strong>{formatMetricNumber(quotaReentry?.outcomes?.transient_error, locale)}</strong>
                    </div>
                  </>
                )}
              </div>

              <div className={styles.riskSection}>
                <div className={styles.riskTitle}>
                  {isShardReport
                    ? t('ops_report.shard.invalid_groups_title', { defaultValue: '401 分组' })
                    : t('ops_report.risks_title', { defaultValue: '风险提示' })}
                </div>
                {isShardReport ? (
                  shardInvalidGroups.length ? (
                    <ul className={styles.riskList}>
                      {shardInvalidGroups.map((group, index) => (
                        <li key={`${group.error_code || 'group'}-${group.message || index}`}>
                          {`count=${formatMetricNumber(group.count, locale)} status=${group.http_status ?? '-'} code=${group.error_code || '-'} message=${group.message || '-'}`}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className={styles.emptyText}>
                      {t('ops_report.shard.no_invalid_groups', {
                        defaultValue: '当前 shard 报表没有 401 分组。',
                      })}
                    </div>
                  )
                ) : riskNotes.length ? (
                  <ul className={styles.riskList}>
                    {riskNotes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                ) : (
                  <div className={styles.emptyText}>
                    {t('ops_report.no_risks', { defaultValue: '当前日报没有额外风险提示。' })}
                  </div>
                )}
              </div>
            </Card>
          </div>

          <Card
            title={t('ops_report.raw_markdown_title', { defaultValue: '日报原文' })}
            extra={
              <span className={styles.rawMeta}>
                {t('ops_report.raw_markdown_meta', {
                  defaultValue: '来源：服务器日报 Markdown 文件',
                })}
              </span>
            }
          >
            {data.markdown ? (
              <pre className={styles.markdownBlock}>{data.markdown}</pre>
            ) : (
              <div className={styles.emptyText}>
                {t('ops_report.no_markdown', { defaultValue: '当前没有可展示的 Markdown 原文。' })}
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
