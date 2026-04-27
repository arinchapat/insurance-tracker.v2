'use client'
// app/(app)/collect/page.js
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Icons, fmtB, fmtDate } from '@/components/ui/Icons'
import { getInstallmentStatus } from '@/lib/domains/installment/service'
import PaymentForm from '@/components/domain/PaymentForm'

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  overdue:          { label:'ค้างชำระ',        bg:'#fee2e2', color:'#b91c1c', dot:'#ef4444' },
  critical:         { label:'วิกฤต',           bg:'#fee2e2', color:'#b91c1c', dot:'#ef4444' },
  due:              { label:'ถึงเวลาชำระ',     bg:'#fef9c3', color:'#92400e', dot:'#f59e0b' },
  prep:             { label:'ใกล้ถึงกำหนด',   bg:'#dbeafe', color:'#1e40af', dot:'#3b82f6' },
  installment:      { label:'กำลังผ่อนปกติ',  bg:'#d1fae5', color:'#065f46', dot:'#10b981' },
  paid:             { label:'ชำระครบแล้ว',    bg:'#f0fdf4', color:'#15803d', dot:'#22c55e' },
  cancelled_policy: { label:'กรมธรรม์ยกเลิก', bg:'#fce7f3', color:'#9d174d', dot:'#db2777' },
}
// ลำดับความเร่งด่วน (น้อย = วิกฤตกว่า)
const STATUS_RANK = { overdue:0, critical:1, due:2, prep:3, installment:4, paid:5, cancelled_policy:9 }

// ✅ reinstated ไม่อยู่ที่นี่ — policy ดึงคืนแล้วยังต้องผ่อนต่อ
const CANCELLED_STATUSES = ['cancelled', 'dropped']

// ─────────────────────────────────────────────────────────────────────────────
// UI Components
// ─────────────────────────────────────────────────────────────────────────────
function Badge({ statusKey }) {
  const cfg = STATUS_CFG[statusKey] ?? { label: statusKey, bg:'#f1f5f9', color:'#475569', dot:'#94a3b8' }
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 9px', borderRadius:99, fontSize:11, fontWeight:600, background:cfg.bg, color:cfg.color, whiteSpace:'nowrap' }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:cfg.dot, flexShrink:0 }} />
      {cfg.label}
    </span>
  )
}

function KpiCard({ label, count, amount, color, icon, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      background:'#fff', borderRadius:14, padding:'16px 18px', textAlign:'left',
      borderTop:    `3px solid ${color}`,
      borderRight:  active ? `2px solid ${color}` : '1.5px solid #e2e8f0',
      borderBottom: active ? `2px solid ${color}` : '1.5px solid #e2e8f0',
      borderLeft:   active ? `2px solid ${color}` : '1.5px solid #e2e8f0',
      boxShadow: active ? `0 0 0 3px ${color}20, 0 4px 12px rgba(0,0,0,.06)` : '0 1px 4px rgba(0,0,0,.05)',
      cursor:'pointer', transition:'all .15s', width:'100%',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <span style={{ fontSize:18 }}>{icon}</span>
        <span style={{ fontSize:11, fontWeight:600, color:'#64748b' }}>{label}</span>
      </div>
      <div style={{ fontSize:28, fontWeight:800, color:'#0f172a', fontFamily:'monospace', lineHeight:1 }}>{count}</div>
      <div style={{ fontSize:12, fontWeight:600, color, marginTop:5 }}>{fmtB(amount)}</div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Group installments by policy → 1 policy = 1 row
// ─────────────────────────────────────────────────────────────────────────────
function groupByPolicy(insts) {
  const map = {}
  insts.forEach(inst => {
    const polId = inst.policies?.id ?? '__unknown__'
    if (!map[polId]) map[polId] = { policy: inst.policies, insts: [] }
    map[polId].insts.push(inst)
  })

  return Object.values(map).map(g => {
    // ── คำนวณยอดรวมก่อน ──────────────────────────────────────────────────────
    const totalPremium = g.insts.reduce((s, i) => s + Number(i.amount_due), 0)
    const totalPaid    = g.insts
      .filter(i => i.paid_at)
      .reduce((s, i) => s + Number(i.paid_amount ?? i.amount_due), 0)
    const isEffectivelyPaid = totalPaid >= totalPremium  // ชำระครบหรือเกินแล้ว

    // ── ถ้าชำระครบ/เกินแล้ว → ถือว่างวดที่เหลือ "จ่ายแล้ว" ทั้งหมด ──────────
    const unpaid  = isEffectivelyPaid ? [] : g.insts.filter(i => !i.paid_at)
    const allPaid = unpaid.length === 0

    // ── worst status ─────────────────────────────────────────────────────────
    const isCancelledPolicy = g.insts.some(i => i._status === 'cancelled_policy')
    let worst = isCancelledPolicy ? 'cancelled_policy'
              : allPaid           ? 'paid'
              : 'installment'

    if (!isCancelledPolicy && !allPaid) {
      g.insts.filter(i => !i.paid_at).forEach(i => {
        if ((STATUS_RANK[i._status] ?? 99) < (STATUS_RANK[worst] ?? 99)) worst = i._status
      })
    }

    const nextInst    = [...unpaid].sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0]
    const totalUnpaid = Math.max(totalPremium - totalPaid, 0)  // ไม่ติดลบ
    const pendingNos  = unpaid.map(i => i.installment_no).sort((a, b) => a - b)
    const totalInst   = g.insts[0]?.total_inst ?? g.insts.length

    return {
      key: g.policy?.id ?? '__unknown__',
      policy: g.policy,
      insts: g.insts,
      unpaid,
      _worstStatus: worst,
      _allPaid: allPaid,
      _nextInst: nextInst,
      _totalUnpaid: totalUnpaid,
      _totalPaid: totalPaid,
      _totalPremium: totalPremium,
      _pendingNos: pendingNos,
      _totalInst: totalInst,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function CollectPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [tab, setTab]           = useState('urgent')
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [payModal, setPayModal] = useState(null)

  const [search, setSearch]               = useState('')
  const [filterCompany, setFilterCompany] = useState('')
  const [filterAgent, setFilterAgent]     = useState('')
  const [agentOptions, setAgentOptions]   = useState([])

  useEffect(() => {
    setFilterAgent('')
    if (!filterCompany) { setAgentOptions([]); return }
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase
        .from('agent_codes').select('code')
        .eq('user_id', user.id).eq('company_id', filterCompany).eq('is_active', true).order('code')
      setAgentOptions(data?.map(r => r.code) ?? [])
    }
    run()
  }, [filterCompany])

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('installments')
      .select(`
        *,
        policies(
          id, policy_status, company_id, agent_code, coverage_type, plate, model,
          customers(id, name, phone),
          agent_codes(cancel_after_days, warn_day, critical_day, bill_cycle_day)
        )
      `)
      .eq('user_id', user.id)
      .order('due_date')
    setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Split active vs cancelled ─────────────────────────────────────────────
  const activeInsts = items
    .filter(i => !CANCELLED_STATUSES.includes(i.policies?.policy_status))
    .map(i => ({ ...i, _status: getInstallmentStatus(i, i.policies?.agent_codes) }))

  const cancelledInsts = items
    .filter(i => CANCELLED_STATUSES.includes(i.policies?.policy_status))
    .map(i => ({ ...i, _status: 'cancelled_policy' }))

  // ── Company dropdown options ──────────────────────────────────────────────
  const companyOptions = [...new Set(activeInsts.map(i => i.policies?.company_id).filter(Boolean))].sort()
  const fmtCo = id => id ? id.replace(/^[a-z0-9]+_/, '').toUpperCase() : id

  // ── Apply filters ─────────────────────────────────────────────────────────
  const applyFilters = insts => insts.filter(i => {
    if (filterCompany && i.policies?.company_id !== filterCompany) return false
    if (filterAgent   && i.policies?.agent_code  !== filterAgent)  return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      if (!(i.policies?.customers?.name ?? '').toLowerCase().includes(q) &&
          !(i.policies?.id ?? '').toLowerCase().includes(q)) return false
    }
    return true
  })

  // ── Group by policy ───────────────────────────────────────────────────────
  const activeGroups    = groupByPolicy(applyFilters(activeInsts))
  const cancelledGroups = groupByPolicy(applyFilters(cancelledInsts))

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const TABS = [
    { id:'urgent',           label:'ต้องดำเนินการ', match: g => ['overdue','critical','due'].includes(g._worstStatus), dot:'#ef4444' },
    { id:'prep',             label:'ใกล้ถึงกำหนด',  match: g => g._worstStatus === 'prep',        dot:'#3b82f6' },
    { id:'installment',      label:'กำลังผ่อน',      match: g => g._worstStatus === 'installment', dot:'#10b981' },
    { id:'paid',             label:'ชำระครบแล้ว',   match: g => g._allPaid,                        dot:'#22c55e' },
    { id:'cancelled_policy', label:'ยกเลิกแล้ว',    match: null,                                   dot:'#be185d' },
    { id:'all',              label:'ทั้งหมด',        match: () => true,                             dot:'#94a3b8' },
  ]

  const getGroups = id => {
    if (id === 'cancelled_policy') return cancelledGroups
    const t = TABS.find(x => x.id === id)
    return t?.match ? activeGroups.filter(t.match) : activeGroups
  }

  const displayGroups = getGroups(tab)
  const urgentCount   = activeGroups.filter(g => ['overdue','critical','due'].includes(g._worstStatus)).length

  const kpis = [
    { id:'urgent',      label:'ค้างชำระ / วิกฤต',    statuses:['overdue','critical'], icon:'🚨', color:'#ef4444' },
    { id:'urgent',      label:'ถึงกำหนดวันนี้',       statuses:['due'],               icon:'⏰', color:'#f59e0b' },
    { id:'prep',        label:'ถึงเวลาเตือน (7 วัน)', statuses:['prep'],              icon:'🔔', color:'#3b82f6' },
    { id:'installment', label:'กำลังผ่อนปกติ',         statuses:['installment'],       icon:'✅', color:'#10b981' },
  ]

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc' }}>
      <header style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 28px', background:'#fff', borderBottom:'1px solid #e5eaf1', position:'sticky', top:0, zIndex:20 }}>
        <span style={{ fontSize:13, fontWeight:600 }}>กระเป๋าซ้าย (เก็บเงิน)</span>
        {urgentCount > 0 && (
          <span style={{ background:'#ef4444', color:'#fff', fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:10 }}>
            {urgentCount} ด่วน
          </span>
        )}
      </header>

      <div style={{ padding:'24px 28px' }}>
        <div style={{ marginBottom:20 }}>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#0f172a', margin:0 }}>กระเป๋าซ้าย — เก็บเงิน</h1>
          <p style={{ fontSize:13, color:'#64748b', marginTop:4, marginBottom:0 }}>
            {activeGroups.length} กรมธรรม์ · {activeInsts.filter(i => !i.paid_at).length} งวดรอชำระ
            {(filterCompany || filterAgent || search) && <span style={{ color:'#2563eb', fontWeight:600 }}> (กรองอยู่)</span>}
          </p>
        </div>

        {/* KPI Cards — นับระดับ policy */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
          {kpis.map((g, i) => {
            const grps  = activeGroups.filter(r => g.statuses.includes(r._worstStatus))
            const total = grps.reduce((s, r) => s + r._totalUnpaid, 0)
            return (
              <KpiCard key={i} label={g.label} count={grps.length} amount={total}
                color={g.color} icon={g.icon} active={tab === g.id} onClick={() => setTab(g.id)} />
            )
          })}
        </div>

        {/* Filter Bar */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:10, padding:'12px 16px', background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', marginBottom:16, boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
          <div style={{ position:'relative', flex:'1 1 200px' }}>
            <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:14, color:'#94a3b8', pointerEvents:'none' }}>🔍</span>
            <input type="text" placeholder="ค้นหาชื่อลูกค้า / เลขกรมธรรม์..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width:'100%', height:36, paddingLeft:32, paddingRight:10, borderRadius:8, border:'1px solid #d1d5db', fontSize:13, outline:'none', boxSizing:'border-box' }}
            />
          </div>
          <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
            style={{ height:36, padding:'0 10px', borderRadius:8, border:'1px solid #d1d5db', fontSize:13, background:'#fff', cursor:'pointer', minWidth:140 }}>
            <option value="">🏢 ทุกบริษัท</option>
            {companyOptions.map(id => <option key={id} value={id}>{fmtCo(id)}</option>)}
          </select>
          <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)}
            disabled={!filterCompany || agentOptions.length === 0}
            style={{ height:36, padding:'0 10px', borderRadius:8, border:'1px solid #d1d5db', fontSize:13, background:'#fff', cursor: filterCompany ? 'pointer' : 'not-allowed', minWidth:160, opacity: filterCompany ? 1 : .5 }}>
            <option value="">👤 ทุกโค้ดตัวแทน</option>
            {agentOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {(search || filterCompany || filterAgent) && (
            <button onClick={() => { setSearch(''); setFilterCompany(''); setFilterAgent('') }}
              style={{ height:36, padding:'0 14px', borderRadius:8, border:'none', background:'#6b7280', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>
              ✕ ล้าง
            </button>
          )}
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', fontSize:12, color:'#94a3b8' }}>
            {displayGroups.length} กรมธรรม์
          </div>
        </div>

        {/* Table Card */}
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e2e8f0', boxShadow:'0 1px 4px rgba(0,0,0,.05)', overflow:'hidden' }}>

          {/* Tab bar */}
          <div style={{ display:'flex', gap:4, padding:'12px 16px', borderBottom:'1px solid #f1f5f9', flexWrap:'wrap' }}>
            {TABS.map(t => {
              const cnt = getGroups(t.id).length
              const isOn = tab === t.id
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  display:'inline-flex', alignItems:'center', gap:6,
                  padding:'7px 14px', borderRadius:8, border:'none', cursor:'pointer',
                  fontSize:13, fontWeight: isOn ? 700 : 500,
                  background: isOn ? '#0f172a' : '#f1f5f9',
                  color: isOn ? '#fff' : '#475569', transition:'all .15s',
                }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background: isOn ? 'rgba(255,255,255,.7)' : t.dot, flexShrink:0 }} />
                  {t.label}
                  <span style={{ minWidth:20, height:20, padding:'0 5px', borderRadius:10, fontSize:11, fontWeight:700, display:'inline-flex', alignItems:'center', justifyContent:'center', background: isOn ? 'rgba(255,255,255,.2)' : (cnt > 0 ? t.dot : '#cbd5e1'), color: isOn ? '#fff' : (cnt > 0 ? '#fff' : '#64748b') }}>
                    {cnt}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Table body */}
          {loading ? (
            <div style={{ padding:40, textAlign:'center', color:'#94a3b8', fontSize:13 }}>กำลังโหลด...</div>
          ) : displayGroups.length === 0 ? (
            <div style={{ padding:56, textAlign:'center' }}>
              <div style={{ fontSize:36, marginBottom:10 }}>{tab === 'paid' ? '🎉' : '✨'}</div>
              <div style={{ fontSize:14, color:'#94a3b8' }}>ไม่มีกรมธรรม์ในกลุ่มนี้</div>
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
                <thead>
                  <tr style={{ background:'#f8fafc' }}>
                    {['ลูกค้า', 'กรมธรรม์', 'งวดที่รอ', 'ครบกำหนดงวดถัดไป', 'ยอดค้างรวม', 'สถานะ', ''].map((h, i) => (
                      <th key={i} style={{ padding:'10px 16px', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.05em', textAlign: h === 'ยอดค้างรวม' ? 'right' : 'left', borderBottom:'2px solid #e2e8f0', whiteSpace:'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayGroups.map(g => {
                    const pol         = g.policy
                    const isUrgent    = ['overdue','critical'].includes(g._worstStatus)
                    const isCancelled = tab === 'cancelled_policy'
                    const rowBg       = isUrgent ? '#fff9f9' : 'transparent'

                    const today   = new Date(); today.setHours(0,0,0,0)
                    const nextDue = g._nextInst ? new Date(g._nextInst.due_date) : null
                    if (nextDue) nextDue.setHours(0,0,0,0)
                    const diffDays = nextDue ? Math.floor((today - nextDue) / 86400000) : null

                    return (
                      <tr key={g.key}
                        style={{ background:rowBg, borderBottom:'1px solid #f8fafc', cursor:'pointer', transition:'background .1s', borderLeft: isUrgent ? '3px solid #ef4444' : isCancelled ? '3px solid #db2777' : '3px solid transparent' }}
                        onClick={() => router.push(`/policies/${pol?.id}`)}
                        onMouseEnter={e => e.currentTarget.style.background = isUrgent ? '#fff5f5' : '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = rowBg}
                      >
                        {/* ลูกค้า */}
                        <td style={{ padding:'12px 16px' }}>
                          <div style={{ fontWeight:600, fontSize:13, color:'#0f172a' }}>{pol?.customers?.name}</div>
                          <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>{pol?.customers?.phone}</div>
                        </td>

                        {/* กรมธรรม์ */}
                        <td style={{ padding:'12px 16px' }}>
                          <code style={{ fontSize:11, color:'#2563eb', background:'#eff6ff', padding:'2px 6px', borderRadius:4 }}>{pol?.id}</code>
                          {(pol?.plate || pol?.model) && (
                            <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>🚗 {pol?.plate || pol?.model}</div>
                          )}
                        </td>

                        {/* งวดที่รอ */}
                        <td style={{ padding:'12px 16px' }}>
                          {g._allPaid ? (
                            <span style={{ fontSize:12, color:'#15803d', fontWeight:600 }}>ครบทุกงวด ✓</span>
                          ) : (
                            <>
                              <span style={{ fontFamily:'monospace', fontSize:13, fontWeight:600, color: isCancelled ? '#9d174d' : '#374151' }}>
                                งวด {g._pendingNos.join(', ')}
                              </span>
                              <span style={{ fontSize:11, color:'#94a3b8' }}> / {g._totalInst}</span>
                            </>
                          )}
                        </td>

                        {/* ครบกำหนดงวดถัดไป */}
                        <td style={{ padding:'12px 16px' }}>
                          {g._nextInst ? (
                            <>
                              <div style={{ fontSize:12, color:'#374151' }}>{fmtDate(g._nextInst.due_date)}</div>
                              {diffDays !== null && diffDays > 0 ? (
                                <div style={{ fontSize:11, fontWeight:700, color: diffDays > 20 ? '#dc2626' : '#d97706', marginTop:1 }}>ค้าง {diffDays} วัน</div>
                              ) : diffDays !== null ? (
                                <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>อีก {Math.abs(diffDays)} วัน</div>
                              ) : null}
                            </>
                          ) : (
                            <span style={{ fontSize:12, color:'#94a3b8' }}>—</span>
                          )}
                        </td>

                        {/* ยอดค้างรวม */}
                        <td style={{ padding:'12px 16px', textAlign:'right' }}>
                          {g._totalUnpaid > 0 ? (
                            <span style={{ fontSize:14, fontWeight:700, color: isUrgent ? '#dc2626' : '#0f172a', fontFamily:'monospace' }}>
                              {fmtB(g._totalUnpaid)}
                            </span>
                          ) : (
                            <span style={{ fontSize:12, color:'#15803d', fontWeight:600 }}>ชำระครบ</span>
                          )}
                        </td>

                        {/* สถานะ */}
                        <td style={{ padding:'12px 16px' }}>
                          <Badge statusKey={g._worstStatus} />
                        </td>

                        {/* ปุ่ม — ไม่มีในยกเลิก */}
                        <td style={{ padding:'12px 16px' }} onClick={e => e.stopPropagation()}>
                          {isCancelled ? null
                          : g._allPaid ? <span style={{ fontSize:12, color:'#15803d', fontWeight:600 }}>✓ ครบแล้ว</span>
                          : g._nextInst ? (
                            <button onClick={() => setPayModal(g)} style={{
                              display:'inline-flex', alignItems:'center', gap:5,
                              padding:'6px 12px', borderRadius:7, border:'none', cursor:'pointer',
                              fontSize:12, fontWeight:700,
                              background: isUrgent ? '#ef4444' : '#0f172a',
                              color:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,.15)',
                            }}>
                              💳 รับชำระ
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          {displayGroups.length > 0 && !loading && tab !== 'cancelled_policy' && (
            <div style={{ padding:'12px 20px', background:'#f8fafc', borderTop:'2px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:13, color:'#64748b' }}>{displayGroups.length} กรมธรรม์</span>
              <span style={{ fontSize:15, fontWeight:700, color:'#0f172a', fontFamily:'monospace' }}>
                รวม {fmtB(displayGroups.reduce((s, g) => s + g._totalUnpaid, 0))} บาท
                <span style={{ fontSize:11, color:'#94a3b8', fontWeight:400 }}> (ยังไม่ได้ชำระ)</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {payModal && (
        <PaymentForm
          installment={payModal._nextInst}
          policy={payModal._nextInst?.policies}
          summary={{
            totalPremium: payModal._totalPremium,
            totalPaid:    payModal._totalPaid,
          }}
          onClose={() => setPayModal(null)}
          onSaved={() => { setPayModal(null); load() }}
        />
      )}
    </div>
  )
}
