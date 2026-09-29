import React, { useEffect, useRef, useState } from 'react';
import { Alert, App, Button, Card, Checkbox, DatePicker, Descriptions, Empty, Input, Modal, Pagination, Select, Space, Spin, Switch, Tag, Typography } from 'antd';
import { CopyOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/vi';
import AdminOwnerTag from './AdminOwnerTag.jsx';
import './account-data.css';

const INITIAL_FILTERS = { search: '', owner: undefined, group_id: undefined, auth_type: undefined, account_status: 'normal', start_date: '', end_date: '' };
const AUTH_OPTIONS = ['password', 'oauth', 'graph'];
const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'normal', label: '正常' },
  { value: 'pending', label: '未检测' },
  { value: 'banned', label: '封禁' },
  { value: 'invalid_credentials', label: '凭据失效' },
  { value: 'network_error', label: '网络异常' },
  { value: 'test_error', label: '检测异常' }
];

async function requestJSON(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  if (response.redirected || response.status === 401) throw new Error('会话已过期，请重新登录');
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('获取邮箱信息失败');
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || '获取邮箱信息失败');
  return payload;
}

async function writeClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch { /* HTTP deployments can still use the selection-based clipboard path. */ }
  const input = document.createElement('textarea');
  input.value = text;
  input.readOnly = true;
  input.style.cssText = 'position:fixed;left:-9999px;top:0';
  const previous = document.activeElement;
  document.body.appendChild(input);
  try {
    input.select();
    if (!document.execCommand('copy')) throw new Error('复制失败，请手动复制');
  } finally {
    input.remove();
    previous?.focus();
  }
}

function accountLine(account, reveal = true) {
  return ['email', 'password', 'oauth_client_id', 'oauth_refresh_token'].map(key => {
    const value = String(account[key] ?? '');
    return !reveal && value && ['password', 'oauth_refresh_token'].includes(key) ? '••••••••' : value;
  }).join('----');
}

function groupPath(group, groups) {
  const names = [group.name];
  const visited = new Set([group.id]);
  let parent = groups.find(item => item.id === group.parent_id);
  while (parent && !visited.has(parent.id)) {
    visited.add(parent.id);
    names.unshift(parent.name);
    parent = groups.find(item => item.id === parent.parent_id);
  }
  return names.join(' / ');
}

export default function AccountDataPage({ t }) {
  const { message } = App.useApp();
  const [draft, setDraft] = useState(INITIAL_FILTERS);
  const [query, setQuery] = useState({ filters: INITIAL_FILTERS, page: 1, perPage: 20 });
  const [revision, setRevision] = useState(0);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, per_page: 20 });
  const [metadata, setMetadata] = useState({ owners: [], groups: [] });
  const [metadataError, setMetadataError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [showCredentials, setShowCredentials] = useState(true);
  const [copying, setCopying] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [revealed, setRevealed] = useState(new Set());
  const copyController = useRef(null);

  useEffect(() => () => copyController.current?.abort(), []);

  useEffect(() => {
    const controller = new AbortController();
    setMetadataError('');
    requestJSON('/admin/api/mailbox/account-data/filters', { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setMetadata(data); })
      .catch(err => { if (!controller.signal.aborted) { setMetadata({ owners: [], groups: [] }); setMetadataError(err.message); } });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: query.page, per_page: query.perPage });
    Object.entries(query.filters).forEach(([key, value]) => {
      if (value !== undefined && (value !== '' || key === 'owner')) params.set(key, value);
    });
    setLoading(true);
    setRows([]);
    setError('');
    requestJSON(`/admin/api/mailbox/account-data?${params}`, { signal: controller.signal })
      .then(data => {
        if (controller.signal.aborted) return;
        setRows(data.data);
        setPagination(data.pagination);
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        setError(err.message);
        setSelected(new Set());
        setPagination({ page: 1, total: 0, per_page: query.perPage });
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, revision]);

  useEffect(() => {
    setDetail(null);
    setDetailError('');
    setRevealed(new Set());
    if (detailId === null) return;
    const controller = new AbortController();
    requestJSON(`/admin/api/mailbox?id=${detailId}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setDetail(data.data); })
      .catch(err => { if (!controller.signal.aborted) setDetailError(err.message); });
    return () => controller.abort();
  }, [detailId, revision]);

  const dateText = value => value ? window.AppI18n.formatDate(value) : t('未设置');
  const updateDraft = (key, value) => setDraft(previous => ({ ...previous, [key]: value }));
  const applyFilters = (filters = draft) => {
    if (filters.start_date && filters.end_date && filters.start_date > filters.end_date) {
      message.error(t('开始日期不能晚于结束日期'));
      return;
    }
    setSelected(new Set());
    setQuery(previous => ({ ...previous, filters: { ...filters }, page: 1 }));
  };
  const toggleSelection = (ids, checked) => setSelected(previous => {
    const next = new Set(previous);
    ids.forEach(id => checked ? next.add(id) : next.delete(id));
    return next;
  });
  const selectedOnPage = rows.filter(row => selected.has(row.id)).length;

  async function copyAccounts(ids) {
    if (!ids.length || copying) return;
    const controller = new AbortController();
    copyController.current = controller;
    setCopying(true);
    try {
      const data = await requestJSON('/admin/api/mailbox/account-data/copy', {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids })
      });
      if (controller.signal.aborted) return;
      await writeClipboard(data.text);
      message.success(`${t('复制成功')} · ${data.count}`);
    } catch (err) {
      if (!controller.signal.aborted) message.error(t(err.message));
    } finally {
      if (!controller.signal.aborted) setCopying(false);
    }
  }

  async function copyValue(value) {
    try { await writeClipboard(String(value)); message.success(t('复制成功')); }
    catch { message.error(t('复制失败，请手动复制')); }
  }

  function detailValue(key, { secret = false, date = false, boolean = false } = {}) {
    const value = detail?.[key];
    if (key === 'created_by_admin' && !value) return <AdminOwnerTag owner={value} t={t} />;
    if (value === null || value === undefined || value === '') return <Typography.Text type="secondary">{t('未设置')}</Typography.Text>;
    const text = secret && !revealed.has(key) ? '••••••••' : date ? dateText(value)
      : boolean ? t(value === 1 || value === true || value === '1' ? '已开启' : '已关闭') : String(value);
    return <div className="account-detail-value">
      {key === 'created_by_admin' ? <span className="account-detail-owner"><AdminOwnerTag owner={value} t={t} /></span> : <pre translate="no">{text}</pre>}
      <Space size={4}>
        {secret && <Button size="small" aria-pressed={revealed.has(key)} onClick={() => setRevealed(previous => {
          const next = new Set(previous); next.has(key) ? next.delete(key) : next.add(key); return next;
        })}>{t(revealed.has(key) ? '隐藏' : '显示')}</Button>}
        <Button size="small" icon={<CopyOutlined />} aria-label={`${t('复制')} ${key}`} onClick={() => copyValue(value)} />
      </Space>
    </div>;
  }
  const detailSections = [
    ['基本信息', [['email', '邮箱地址'], ['username', '登录用户名'], ['id', '邮箱 ID'], ['created_by_admin', '创建人'], ['remarks', '备注']]],
    ['认证与 OAuth', [['auth_type', '认证方式 (auth_type)'], ['password', '密码 / 授权码', { secret: true }], ['oauth_client_id', 'client_id'], ['oauth_refresh_token', 'refresh_token', { secret: true }]]],
    ['收件配置', [['server', '服务器地址'], ['port', '端口'], ['protocol', '协议'], ['ssl', 'SSL', { boolean: true }]]],
    ['发件配置', [['send_server', '服务器地址'], ['send_port', '端口'], ['send_protocol', '协议'], ['send_ssl', 'SSL', { boolean: true }]]],
    ['状态与时间', [['status', '启用状态', { boolean: true }], ['account_status', '账号状态'], ['created_at', '添加时间', { date: true }], ['updated_at', '最后修改时间', { date: true }], ['last_test', '最后检测时间', { date: true }], ['test_result', '检测结果']]]
  ];

  return <div className="account-data-page">
    <Card className="account-filter-card">
      <form onSubmit={event => { event.preventDefault(); applyFilters(); }}>
        <div className="account-filter-grid">
          <label><span>{t('账号搜索')}</span><Input aria-label={t('账号搜索')} allowClear prefix={<SearchOutlined />} placeholder={t('搜索邮箱或登录用户名')} value={draft.search} onChange={event => updateDraft('search', event.target.value)} /></label>
          <label><span>{t('创建人')}</span><Select aria-label={t('创建人')} allowClear showSearch optionFilterProp="label" placeholder={t('全部创建人')} value={draft.owner} onChange={value => updateDraft('owner', value)} options={metadata.owners.map(owner => ({ value: owner, label: owner || t('历史数据') }))} optionRender={option => <AdminOwnerTag owner={option.value} t={t} />} labelRender={option => <AdminOwnerTag owner={option.value} t={t} />} /></label>
          <label><span>{t('分类（邮箱分组）')}</span><Select aria-label={t('分类（邮箱分组）')} allowClear showSearch optionFilterProp="label" placeholder={t('全部分类')} value={draft.group_id} onChange={value => updateDraft('group_id', value)} options={[{ value: 'ungrouped', label: t('未分组') }, ...metadata.groups.map(group => ({ value: String(group.id), label: groupPath(group, metadata.groups) }))]} /></label>
          <label><span>{t('认证方式')}</span><Select aria-label={t('认证方式')} allowClear placeholder={t('全部认证方式')} value={draft.auth_type} onChange={value => updateDraft('auth_type', value)} options={AUTH_OPTIONS.map(value => ({ value, label: value === 'password' ? t('密码登录') : value === 'graph' ? 'Graph API' : 'OAuth' }))} /></label>
          <label><span>{t('账号状态')}</span><Select aria-label={t('账号状态')} value={draft.account_status} onChange={value => updateDraft('account_status', value)} options={STATUS_OPTIONS.map(option => ({ ...option, label: t(option.label) }))} /></label>
          <div className="account-filter-field" role="group" aria-label={t('创建时间')}>
            <span>{t('创建时间')}</span>
            <DatePicker.RangePicker
              className="account-date-range"
              classNames={{ popup: { root: 'account-date-range-popup' } }}
              popupAlign={{ overflow: { adjustX: true, adjustY: true, shiftX: true, shiftY: true } }}
              format="YYYY-MM-DD"
              placeholder={[t('开始日期'), t('结束日期')]}
              allowEmpty={[true, true]}
              value={[draft.start_date ? dayjs(draft.start_date) : null, draft.end_date ? dayjs(draft.end_date) : null]}
              onChange={(_, [start_date, end_date]) => setDraft(previous => ({ ...previous, start_date, end_date }))}
            />
          </div>
        </div>
        <div className="account-filter-actions">
          <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>{t('筛选')}</Button>
          <Button onClick={() => { setDraft(INITIAL_FILTERS); applyFilters(INITIAL_FILTERS); }}>{t('重置')}</Button>
          <Button icon={<ReloadOutlined />} disabled={loading} onClick={() => setRevision(value => value + 1)}>{t('刷新')}</Button>
        </div>
      </form>
      {metadataError && <Alert type="error" showIcon title={t(metadataError)} />}
    </Card>

    <Card className="account-results-card">
      <div className="account-results-toolbar">
        <Space wrap>
          <Checkbox aria-label={t('全选本页')} disabled={!rows.length || loading} checked={!!rows.length && selectedOnPage === rows.length} indeterminate={selectedOnPage > 0 && selectedOnPage < rows.length} onChange={event => toggleSelection(rows.map(row => row.id), event.target.checked)}>{t('全选本页')}</Checkbox>
          <Typography.Text type="secondary">{t('筛选结果')} {pagination.total} · {t('已选')} {selected.size}</Typography.Text>
          <Button type="primary" icon={<CopyOutlined />} loading={copying} disabled={!selected.size || loading} onClick={() => copyAccounts([...selected])}>{t('复制所选')}</Button>
          <Button disabled={!selected.size} onClick={() => setSelected(new Set())}>{t('清空选择')}</Button>
        </Space>
        <Space><Typography.Text>{t('显示凭据')}</Typography.Text><Switch aria-label={t('显示凭据')} checked={showCredentials} onChange={setShowCredentials} /></Space>
      </div>
      <div className="account-format-hint">{t('复制格式')}：<code translate="no">email----password----client_id----refresh_token</code></div>
      <Typography.Paragraph type="secondary" className="account-selection-hint">{t('跨页保留勾选；应用筛选后清空。复制始终使用完整原值，每个账号一行。')}</Typography.Paragraph>
      {error ? <Alert type="error" showIcon title={t(error)} action={<Button onClick={() => setRevision(value => value + 1)}>{t('重试')}</Button>} /> :
        <Spin spinning={loading}><div className="account-result-list" aria-busy={loading}>
          {!loading && !rows.length && <Empty description={t('没有符合条件的账号')} />}
          {rows.map(row => <article className={`account-record ${selected.has(row.id) ? 'is-selected' : ''}`} key={row.id} data-account-id={row.id}>
            <div className="account-record-heading">
              <div className="account-record-identity"><Checkbox aria-label={`${t('选择')} ${row.email}`} checked={selected.has(row.id)} onChange={event => toggleSelection([row.id], event.target.checked)} /><strong translate="no">{row.email}</strong><Tag>{row.auth_type || '—'}</Tag></div>
              <Space><Button size="small" icon={<CopyOutlined />} disabled={copying} onClick={() => copyAccounts([row.id])}>{t('复制')}</Button><Button size="small" onClick={() => { setDetail(null); setDetailId(row.id); }}>{t('详情')}</Button></Space>
            </div>
            <pre className="account-credential-line" translate="no">{accountLine(row, showCredentials)}</pre>
            <div className="account-record-meta"><span>{t('创建人')}：<AdminOwnerTag owner={row.created_by_admin} t={t} /></span><span>{t('添加时间')}：{dateText(row.created_at)}</span><span>{t('分类')}：{row.groups.length ? row.groups.map(group => <Tag key={group.id}><span translate="no">{group.name}</span></Tag>) : t('未分组')}</span></div>
          </article>)}
        </div></Spin>}
      <Pagination className="account-pagination" current={pagination.page} pageSize={query.perPage} total={pagination.total} disabled={loading} showSizeChanger pageSizeOptions={[20, 50, 100]} onChange={(page, perPage) => setQuery(previous => ({ ...previous, page: perPage === previous.perPage ? page : 1, perPage }))} />
    </Card>

    <Modal title={t('邮箱详情')} open={detailId !== null} onCancel={() => setDetailId(null)} footer={<Button onClick={() => setDetailId(null)}>{t('关闭')}</Button>} width={840} destroyOnHidden className="account-detail-modal">
      {detailError ? <Alert showIcon type="error" title={t(detailError)} /> : !detail ? <div className="account-detail-loading"><Spin /></div> : <>
        <Typography.Paragraph translate="no"><strong>{detail.email}</strong></Typography.Paragraph>
        {detailSections.map(([title, fields]) => <Descriptions key={title} title={t(title)} column={1} bordered size="small" items={fields.map(([key, label, options]) => ({ key, label: t(label), children: detailValue(key, options) }))} />)}
      </>}
    </Modal>
  </div>;
}
