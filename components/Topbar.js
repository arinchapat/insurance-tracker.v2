'use client'
// components/Topbar.js
import { Icons } from './ui/Icons'

// crumbs = [{ label: 'หน้าหลัก' }, { label: 'ลูกค้า', href: '/customers' }, { label: 'สมชาย' }]
export default function Topbar({ crumbs = [] }) {
  return (
    <header className="top">
      {/* Breadcrumbs */}
      <div className="crumb">
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === crumbs.length - 1 ? 'cur' : ''}>{c.label}</span>
          </span>
        ))}
      </div>

      {/* Search */}
      <div className="tsearch">
        {Icons.search}
        <input placeholder="ค้นหาลูกค้า, เลขกรมธรรม์, ทะเบียนรถ..." />
        <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--slate-100)', padding: '1px 6px', borderRadius: 4 }}>
          ⌘K
        </span>
      </div>

      {/* Actions */}
      <div className="tact">
        <button className="ib" title="Notifications">
          {Icons.bell}
          <span className="dot" />
        </button>
        <button className="ib" title="Help" style={{ fontSize: 13, fontWeight: 600 }}>?</button>
        <div className="avatar">พ</div>
      </div>
    </header>
  )
}