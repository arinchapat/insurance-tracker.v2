'use client'
// app/(app)/policies/page.js
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Icons, fmtB, fmtDate } from '@/components/ui/Icons'

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_TO_TAB = {
  active:     'active',
  reinstated: 'active',    
  pending:    'active',    
  overdue:    'overdue',
  expired:    'expired',
  lapsed:     'expired',   
  cancelled:  'cancelled',
  dropped:    'cancelled', 
}

const STATUS_LABEL = {
  active:     'ใช้งานอยู่',
  reinstated: 'คืนสภาพ',
  overdue:    'ค้างชำระ',
  expired:    'หมดอายุ',
  lapsed:     'ขาดอายุ',
  cancelled:  'ยกเลิก',
  dropped:    'ถูกยกเลิก',
  pending:    'รอดำเนินการ',
}

const STATUS_BADGE = {
  active:     'b-gr',
  reinstated: 'b-gr',
  pending:    'b-am',
  overdue:    'b-rd',
  expired:    'b-sl',
  lapsed:     'b-sl',
  cancelled:  'b-sl',
  dropped:    'b-sl',
}

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'all',       label: 'ทั้งหมด',    accent: '#2563eb' },
  { id: 'active',    label: 'ใช้งานอยู่', accent: '#16a34a' },
  { id: 'overdue',   label: 'ค้างชำระ',   accent: '#dc2626' },
  { id: 'expired',   label: 'หมดอายุ',    accent: '#64748b' },
  { id: 'cancelled', label: 'ยกเลิก',     accent: '#64748b' },
]

// ─── Misc config ──────────────────────────────────────────────────────────────
const TYPE_COLOR     = { Motor: '#3b82f6', CMI: '#6366f1', Travel: '#10b981', Fire: '#f59e0b' }
const PAY_MODE_LABEL = { installment: 'ผ่อน', cash: 'เงินสด', full: 'เต็มจำนวน' }
const PAY_MODE_CLS   = { installment: 'b-am', cash: 'b-sl', full: 'b-gr' }
const SEL_STYLE = {
  fontSize: 13, padding: '7px 10px', borderRadius: 8,
  border: '1px solid #e2e8f0', background: '#f8fafc',
  color: '#374151', cursor: 'pointer', outline: 'none',
}

// ─────────────────────────────────────────────────────────────────────────────
export default function PoliciesPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [allPolicies, setAllPolicies] = useState([])
  const [companies,   setCompanies]   = useState([])
  const [loading,     setLoading]     = useState(true)

  const [q,             setQ]       = useState('')
  const [statusFilter,  setStatus]  = useState('all')
  const [typeFilter,    setType]    = useState('all')
  const [companyFilter, setCompany] = useState('all')
  const [agentFilter,   setAgent]   = useState('all')

  useEffect(() => {
    supabase
      .from('companies')
      .select('id, name, color')
      .order('name')
      .then(({ data }) => setCompanies(data ?? []))
  }, []) 

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('policies')
      .select('*, customers(name, province), companies(name, color)')
      .order('created_at', { ascending: false })

    if (q.trim()) {
      query = query.or(
        `id.ilike.%${q.trim()}%,plate.ilike.%${q.trim()}%,model.ilike.%${q.trim()}%`
      )
    }

    const { data, error } = await query
    if (error) console.error('[policies] load error:', error.message)
    setAllPolicies(data ?? [])
    setLoading(false)
  }, [q]) 

  useEffect(() => { load() }, [load])

  const agentCodes = useMemo(
    () => [...new Set(allPolicies.map(p => p.agent_code).filter(Boolean))].sort(),
    [allPolicies]
  )

  const filtered = useMemo(() => allPolicies.filter(p => {
    if (statusFilter  !== 'all' && (STATUS_TO_TAB[p.policy_status] ?? p.policy_status) !== statusFilter) return false
    if (typeFilter    !== 'all' && p.coverage_type !== typeFilter)    return false
    if (companyFilter !== 'all' && p.company_id    !== companyFilter) return false
    if (agentFilter   !== 'all' && p.agent_code    !== agentFilter)   return false
    return true
  }), [allPolicies, statusFilter, typeFilter, companyFilter, agentFilter])

  const tabCounts = useMemo(() => {
    const c = {}
    allPolicies.forEach(p => {
      const tab = STATUS_TO_TAB[p.policy_status] ?? 'other'
      c[tab] = (c[tab] ?? 0) + 1
    })
    return c
  }, [allPolicies])

  const hasActiveFilter = statusFilter !== 'all' || typeFilter !== 'all' || companyFilter !== 'all' || agentFilter !== 'all' || q

  return (
    <>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 28px', height: 52,
        background: '#fff', borderBottom: '1px solid #e5eaf1',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>กรมธรรม์</span>
        <div style={{ flex: 1 }} />
        <Link href="/policies/new" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: '#2563eb', color: '#fff', textDecoration: 'none',
          boxShadow: '0 1px 4px rgba(37,99,235,.35)',
        }}>
          {Icons.plus} สร้างกรมธรรม์
        </Link>
      </header>

      <div style={{ padding: '28px 32px', minHeight: 'calc(100vh - 52px)', background: '#f8fafc' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>กรมธรรม์</h1>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>
            ทั้งหมด {allPolicies.length} ฉบับ
            {filtered.length !== allPolicies.length && (
              <span style={{ color: '#2563eb', marginLeft: 6 }}>· กรองแล้ว {filtered.length} รายการ</span>
            )}
          </div>
        </div>

        <div style={{
          background: '#fff', borderRadius: 14,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 4px rgba(0,0,0,.05)',
          overflow: 'hidden',
        }}>

          <div style={{
            display: 'flex', alignItems: 'stretch',
            borderBottom: '1px solid #e2e8f0',
            overflowX: 'auto', background: '#f8fafc',
          }}>
            {TABS.map(t => {
              const count  = t.id === 'all' ? allPolicies.length : (tabCounts[t.id] ?? 0)
              const active = statusFilter === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setStatus(t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '13px 20px',
                    background: active ? '#fff' : 'transparent',
                    border: 'none',
                    borderBottom: active ? `2.5px solid ${t.accent}` : '2.5px solid transparent',
                    borderRight: '1px solid #e2e8f0',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    transition: 'background .12s',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? t.accent : '#64748b' }}>
                    {t.label}
                  </span>
                  <span style={{
                    fontSize: 11.5, fontWeight: 600,
                    padding: '1px 7px', borderRadius: 20,
                    background: active ? t.accent : '#e2e8f0',
                    color: active ? '#fff' : '#475569',
                    minWidth: 22, textAlign: 'center',
                  }}>
                    {count}
                  </span>
                </button>
              )
            })}
            <div style={{ flex: 1 }} />
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#fff',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#f1f5f9', borderRadius: 8,
              padding: '0 12px', flex: '1 1 200px', maxWidth: 280,
              border: '1px solid #e2e8f0',
            }}>
              <span style={{ color: '#94a3b8', display: 'flex' }}>{Icons.search}</span>
              <input
                placeholder="ค้นหาเลขที่ ทะเบียน รุ่น..."
                value={q}
                onChange={e => setQ(e.target.value)}
                style={{
                  border: 'none', background: 'transparent',
                  fontSize: 13, padding: '8px 0', outline: 'none',
                  color: '#0f172a', width: '100%',
                }}
              />
            </div>

            <select value={typeFilter} onChange={e => setType(e.target.value)} style={SEL_STYLE}>
              <option value="all">ทุกประเภท</option>
              <option value="Motor">Motor</option>
              <option value="CMI">CMI (พ.ร.บ.)</option>
              <option value="Travel">Travel</option>
              <option value="Fire">Fire</option>
            </select>

            <select value={companyFilter} onChange={e => setCompany(e.target.value)} style={SEL_STYLE}>
              <option value="all">ทุกบริษัท</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select value={agentFilter} onChange={e => setAgent(e.target.value)} style={SEL_STYLE}>
              <option value="all">ทุกรหัสตัวแทน</option>
              {agentCodes.map(ac => (
                <option key={ac} value={ac}>{ac}</option>
              ))}
            </select>

            <div style={{ flex: 1 }} />

            {hasActiveFilter && (
              <button
                onClick={() => { setStatus('all'); setType('all'); setCompany('all'); setAgent('all'); setQ('') }}
                style={{
                  fontSize: 12, color: '#64748b', background: 'none',
                  border: '1px solid #e2e8f0', borderRadius: 7,
                  padding: '5px 10px', cursor: 'pointer',
                }}
              >
                ล้างตัวกรอง
              </button>
            )}

            <span style={{ fontSize: 12, color: '#94a3b8' }}>{filtered.length} รายการ</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {[
                    ['เลขที่กรมธรรม์', 'left'],
                    ['ลูกค้า', 'left'],
                    ['ประเภท', 'left'],
                    ['บริษัท · รหัส', 'left'],
                    ['ทะเบียน / รุ่น', 'left'],
                    ['จังหวัด', 'left'], // <-- เพิ่มหัวคอลัมน์ใหม่ที่นี่
                    ['อายุกรมธรรม์', 'left'],
                    ['วิธีชำระ', 'left'],
                    ['เบี้ย', 'right'],
                    ['สถานะ', 'left'],
                  ].map(([h, align]) => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: align,
                      fontSize: 11, fontWeight: 700, color: '#64748b',
                      letterSpacing: '.04em', textTransform: 'uppercase',
                      borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10}>
                      <div style={{ padding: '52px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                        กำลังโหลด...
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10}>
                      <div style={{ padding: '60px 0', textAlign: 'center' }}>
                        <div style={{ fontSize: 32, marginBottom: 10, opacity: .25 }}>{Icons.doc}</div>
                        <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
                          {allPolicies.length > 0 ? 'ไม่พบรายการที่ตรงกับตัวกรอง' : 'ยังไม่มีกรมธรรม์'}
                        </div>
                        {allPolicies.length === 0 && (
                          <Link href="/policies/new" style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                            background: '#2563eb', color: '#fff', textDecoration: 'none',
                          }}>
                            {Icons.plus} สร้างกรมธรรม์แรก
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : filtered.map((p, idx) => (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/policies/${p.id}`)}
                    style={{
                      cursor: 'pointer',
                      background: idx % 2 === 0 ? '#fff' : '#fafbfc',
                      transition: 'background .1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafbfc'}
                  >
                    {/* เลขที่ */}
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}>
                      <code style={{
                        fontSize: 11.5, fontWeight: 700, color: '#2563eb',
                        background: '#eff6ff', padding: '3px 7px', borderRadius: 6,
                        fontFamily: 'monospace',
                      }}>
                        {p.id}
                      </code>
                    </td>

                    {/* ลูกค้า (ตัดคำว่า / จังหวัด ออกจากหัวข้อเพื่อให้ดูโล่งขึ้น) */}
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', maxWidth: 200 }}>
                      <div style={{
                        fontWeight: 600, color: '#0f172a', fontSize: 13,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {p.customers?.name ?? '—'}
                      </div>
                      {p.customers?.province && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                          <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                            <path d="M8 1a5 5 0 0 1 5 5c0 3.5-5 9-5 9S3 9.5 3 6a5 5 0 0 1 5-5z" fill="#cbd5e1"/>
                            <circle cx="8" cy="6" r="1.8" fill="#fff"/>
                          </svg>
                          {p.customers.province}
                        </div>
                      )}
                    </td>

                    {/* ประเภท */}
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{
                        fontSize: 11.5, fontWeight: 700,
                        padding: '3px 9px', borderRadius: 6,
                        background: (TYPE_COLOR[p.coverage_type] ?? '#64748b') + '18',
                        color: TYPE_COLOR[p.coverage_type] ?? '#64748b',
                        border: `1px solid ${(TYPE_COLOR[p.coverage_type] ?? '#64748b')}30`,
                      }}>
                        {p.coverage_type}
                      </span>
                    </td>

                    {/* บริษัท · รหัส */}
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#0f172a' }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: p.companies?.color ?? '#64748b',
                          boxShadow: `0 0 0 2px ${(p.companies?.color ?? '#64748b')}30`,
                        }} />
                        <span style={{ fontWeight: 500 }}>{p.companies?.name ?? '—'}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginTop: 2, paddingLeft: 14 }}>
                        {p.agent_code}
                      </div>
                    </td>

                    {/* ทะเบียน / รุ่น */}
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{p.plate || '—'}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{p.model || '—'}</div>
                    </td>

                    {/* จังหวัด (ป้ายทะเบียน) <-- เพิ่มคอลัมน์ใหม่ตรงนี้ */}
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: 13, color: '#374151' }}>{p.plate_province || '—'}</div>
                    </td>

                    {/* อายุกรมธรรม์ */}
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: 12, color: '#374151' }}>{fmtDate(p.policy_start)}</div>
                      <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>ถึง {fmtDate(p.policy_end)}</div>
                    </td>

                    {/* วิธีชำระ */}
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}>
                      <span className={`badge ${PAY_MODE_CLS[p.pay_mode] ?? 'b-sl'}`}>
                        {PAY_MODE_LABEL[p.pay_mode] ?? p.pay_mode}
                      </span>
                    </td>

                    {/* เบี้ย */}
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtB(p.premium)}
                      </span>
                    </td>

                    {/* สถานะ */}
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}>
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
    </>
  )
}