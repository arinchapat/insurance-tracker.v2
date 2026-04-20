'use client'
// app/(app)/policies/page.js
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Icons, fmtB, fmtDate } from '@/components/ui/Icons'

const STATUS_BADGE = { active: 'b-gr', overdue: 'b-rd', cancelled: 'b-sl', expired: 'b-sl' }
const STATUS_LABEL = { active: 'ใช้งานอยู่', overdue: 'ค้างชำระ', cancelled: 'ยกเลิก', expired: 'หมดอายุ' }

export default function PoliciesPage() {
  const router = useRouter()
  const [policies, setPolicies] = useState([])
  const [loading, setLoading]   = useState(true)
  const [q, setQ]               = useState('')
  const [statusFilter, setStatus] = useState('all')
  const [typeFilter, setType]     = useState('all')

  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('policies')
      .select('*, customers(name), companies(name, color), agent_codes(label)')
      .order('created_at', { ascending: false })

    if (statusFilter !== 'all') query = query.eq('policy_status', statusFilter)
    if (typeFilter   !== 'all') query = query.eq('coverage_type', typeFilter)
    if (q) query = query.or(`id.ilike.%${q}%,plate.ilike.%${q}%,model.ilike.%${q}%`)

    const { data } = await query
    setPolicies(data ?? [])
    setLoading(false)
  }, [q, statusFilter, typeFilter])

  useEffect(() => { load() }, [load])

  // นับแต่ละ status
  const counts = policies.reduce((acc, p) => {
    acc[p.policy_status] = (acc[p.policy_status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 28px', background: '#fff', borderBottom: '1px solid #e5eaf1', position: 'sticky', top: 0, zIndex: 20 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>กรมธรรม์</span>
        <div style={{ flex: 1 }} />
        <Link href="/policies/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: '#2563eb', color: '#fff', textDecoration: 'none' }}>
          {Icons.plus} สร้างกรมธรรม์
        </Link>
      </header>

      <div style={{ padding: '26px 32px' }}>
        <div className="ph">
          <div>
            <h1>กรมธรรม์</h1>
            <div className="sub">ทั้งหมด {policies.length} ฉบับ</div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="tb-wrap">
          <div className="tabs">
            {[
              { id: 'all',       label: 'ทั้งหมด' },
              { id: 'active',    label: 'ใช้งานอยู่',  cls: '' },
              { id: 'overdue',   label: 'ค้างชำระ',    cls: 'r' },
              { id: 'expired',   label: 'หมดอายุ' },
              { id: 'cancelled', label: 'ยกเลิก' },
            ].map(t => (
              <button
                key={t.id}
                className={`tab${t.cls ? ` ${t.cls}` : ''}${statusFilter === t.id ? ' on' : ''}`}
                onClick={() => setStatus(t.id)}
              >
                {t.label}
                <span className="c">{t.id === 'all' ? policies.length : (counts[t.id] ?? 0)}</span>
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div className="tb-tool">
            <div className="search">
              {Icons.search}
              <input placeholder="ค้นหาเลขที่ ทะเบียน รุ่น..." value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <select className="select" style={{ width: 140 }} value={typeFilter} onChange={e => setType(e.target.value)}>
              <option value="all">ทุกประเภท</option>
              <option value="Motor">Motor</option>
              <option value="CMI">CMI (พ.ร.บ.)</option>
              <option value="Travel">Travel</option>
              <option value="Fire">Fire</option>
            </select>
            <div className="sp" />
            <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>{policies.length} รายการ</span>
          </div>

          <table className="data">
            <thead>
              <tr>
                <th>เลขที่กรมธรรม์</th>
                <th>ลูกค้า</th>
                <th>ประเภท</th>
                <th>บริษัท · รหัส</th>
                <th>ทะเบียน / รุ่น</th>
                <th>อายุกรมธรรม์</th>
                <th>วิธีชำระ</th>
                <th style={{ textAlign: 'right' }}>เบี้ย</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9}><div className="empty">กำลังโหลด...</div></td></tr>
              ) : policies.length === 0 ? (
                <tr><td colSpan={9}>
                  <div className="empty">
                    <div className="ei">{Icons.doc}</div>
                    ยังไม่มีกรมธรรม์
                    {q === '' && statusFilter === 'all' && (
                      <div style={{ marginTop: 12 }}>
                        <Link href="/policies/new" className="btn pri sm" style={{ textDecoration: 'none' }}>
                          {Icons.plus} สร้างกรมธรรม์แรก
                        </Link>
                      </div>
                    )}
                  </div>
                </td></tr>
              ) : policies.map(p => (
                <tr key={p.id} className="clk" onClick={() => router.push(`/policies/${p.id}`)}>
                  <td><code style={{ color: 'var(--blue-700)', fontSize: 11.5 }}>{p.id}</code></td>
                  <td style={{ fontWeight: 500, maxWidth: 180 }}>{p.customers?.name}</td>
                  <td><span className="badge b-bl">{p.coverage_type}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.companies?.color ?? '#64748b', flexShrink: 0 }} />
                      {p.companies?.name}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--muted)', fontFamily: 'monospace' }}>{p.agent_code}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12.5 }}>{p.plate || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.model}</div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                    <div>{fmtDate(p.policy_start)}</div>
                    <div>ถึง {fmtDate(p.policy_end)}</div>
                  </td>
                  <td>
                    <span className={`badge ${p.pay_mode === 'installment' ? 'b-am' : 'b-sl'}`}>
                      {p.pay_mode === 'installment' ? 'ผ่อน' : 'เงินสด'}
                    </span>
                  </td>
                  <td className="tnum" style={{ textAlign: 'right', fontWeight: 600 }}>{fmtB(p.premium)}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[p.policy_status] ?? 'b-sl'}`}>
                      <span className="dot" />
                      {STATUS_LABEL[p.policy_status] ?? p.policy_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}