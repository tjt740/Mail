import React from 'react';
import '../../static/css/admin-owner-tag.css';

export default function AdminOwnerTag({ owner, t }) {
  const name = String(owner ?? '').trim();
  const normalized = name.toLowerCase();
  const tone = !name ? 'unknown' : ['tjt740', 'pink', 'lhm'].includes(normalized)
    ? `owner-animated owner-${normalized}` : '';
  const label = name || t('历史数据');
  return <span className={`mailbox-owner-tag ${tone}`} title={label} translate={name ? 'no' : undefined}>{label}</span>;
}
