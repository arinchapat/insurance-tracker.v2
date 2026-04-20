'use client'
// app/(app)/risk/page.js
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Icons, fmtB } from '@/components/ui/Icons'

export default function RiskPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('critical')
  const [draftModal, setDraftModal] = useState(null)

  // ── Filter & Search State ──────────────────────────────────────────────────
  const [search, setSearch]                 = useState('')
  const [filterCompany, setFilterCompany]   = useState('')
  const [filterAgentCode, setFilterAgentCode] = useState('')
  const [agentCodes, setAgentCodes]         = useState([]) // list ของ code ใน dropdown

  useEffect(() => { load() }, [])

  // โหลด agent codes เมื่อเปลี่ยนบริษัท (reset โค้ดเดิมด้วย)
  useEffect(() => {
    setFilterAgentCode('')
    loadAgentCodes(filterCompany)
  }, [filterCompany])

  async function loadAgentCodes(companyId) {
    const { data: { user } } = await supabase.auth.getUser()
    let q = supabase
      .from('agent_codes')
      .select('code')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('code')
    if (companyId) q = q.eq('company_id', companyId)
    const { data } = await q
    setAgentCodes(data ? data.map(r => r.code) : [])
  }

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { data } = await supabase
      .from('installments')
      .select(`
        id,
        amount_due,
        installment_no,
        total_inst,
        policies!inner(
          id,
          policy_start,
          company_id,
          agent_code,
          policy_status,
          plate,
          model,
          customers(id, name, phone)
        )
      `)
      .eq('user_id', user.id)
      .is('paid_at', null)

    // Group by policy
    const policyMap = {}
    if (data) {
      data.forEach(inst => {
        const polId = inst.policies.id
        if (!policyMap[polId]) {
          policyMap[polId] = {
            policy_id: polId,
            policies: inst.policies,
            total_due: 0,
            missing_installments: [],
            total_inst: inst.total_inst
          }
        }
        policyMap[polId].total_due += Number(inst.amount_due)
        policyMap[polId].missing_installments.push(inst.installment_no)
      })
    }

    setItems(Object.values(policyMap))
    setLoading(false)
  }

  // ── Enrich with stage/days calculation ────────────────────────────────────
  const enriched = useMemo(() => items.map(group => {
    const pol       = group.policies
    const startDate = new Date(pol.policy_start)
    const today     = new Date()
    startDate.setHours(0,0,0,0)
    today.setHours(0,0,0,0)
    const policyAge = Math.floor((today - startDate) / 86400000)
    const graceDays = 30
    const daysLeft  = graceDays - policyAge
    let stage = 'other'
    if      (pol.policy_status === 'standby_cancel')    stage = 'standby'
    else if (pol.policy_status === 'pending_reinstate') stage = 'pending'
    else if (pol.policy_status === 'reinstated')        stage = 'reinstated'
    else if (pol.policy_status === 'cancelled')         stage = 'cancelled'
    // legacy: dropped → treat as cancelled
    else if (pol.policy_status === 'dropped')           stage = 'cancelled'
    else if (policyAge >= 27)                           stage = 'critical'
    return { ...group, _policyAge: policyAge, _daysLeft: daysLeft, _stage: stage, _graceDays: graceDays }
  }), [items])

  // ── Unique company list for dropdown ──────────────────────────────────────
  const companyOptions = useMemo(() => {
    const ids = [...new Set(enriched.map(i => i.policies.company_id).filter(Boolean))]
    return ids.sort()
  }, [enriched])

  // ── Tab bucketing ─────────────────────────────────────────────────────────
  const byStage = useMemo(() => ({
    critical:   enriched.filter(i => i._stage === 'critical'),
    standby:    enriched.filter(i => i._stage === 'standby'),
    pending:    enriched.filter(i => i._stage === 'pending'),
    reinstated: enriched.filter(i => i._stage === 'reinstated'),
    cancelled:  enriched.filter(i => i._stage === 'cancelled'),
  }), [enriched])

  // ── Filter → Search → Sort (by daysLeft ASC) ─────────────────────────────
  const displayed = useMemo(() => {
    let base = tab === 'all' ? enriched : (byStage[tab] ?? [])

    if (filterCompany) {
      base = base.filter(i => i.policies.company_id === filterCompany)
    }
    if (filterAgentCode) {
      base = base.filter(i => i.policies.agent_code === filterAgentCode)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      base = base.filter(i => {
        const name  = (i.policies.customers?.name ?? '').toLowerCase()
        const polId = (i.policies.id ?? '').toLowerCase()
        return name.includes(q) || polId.includes(q)
      })
    }

    // Auto-sort: เวลาที่เหลือ น้อยสุด (วิกฤตสุด) ขึ้นบน
    return [...base].sort((a, b) => a._daysLeft - b._daysLeft)
  }, [enriched, byStage, tab, filterCompany, filterAgentCode, search])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const fmtCompany = id => id ? id.replace(/^[a-z0-9]+_/, '').toUpperCase() : '-'

  const daysLeftCell = (daysLeft, stage) => {
    if (stage === 'cancelled')  return <span style={{ color:'#9ca3af', fontSize:12 }}>ยกเลิกแล้ว</span>
    if (stage === 'reinstated') return <span style={{ color:'#059669', fontSize:12, fontWeight:600 }}>✅ เสร็จสิ้น</span>
    if (stage === 'pending')    return <span style={{ color:'#2563eb', fontSize:12, fontWeight:600 }}>รอดึงกลับ</span>
    if (daysLeft <= 0)          return <b style={{ color:'#dc2626', fontSize:13 }}>เลยกำหนด</b>
    const color = daysLeft <= 3 ? '#dc2626' : daysLeft <= 7 ? '#d97706' : '#16a34a'
    return <b style={{ color, fontSize:13 }}>{daysLeft} วัน</b>
  }

  const stageBadge = stage => {
    const map = {
      critical:   { bg:'#fee2e2', color:'#b91c1c', label:'⚠️ วิกฤต' },
      standby:    { bg:'#fef9c3', color:'#92400e', label:'⏳ แจ้งแล้ว' },
      pending:    { bg:'#dbeafe', color:'#1e40af', label:'♻️ รอดึงกลับ' },
      reinstated: { bg:'#d1fae5', color:'#065f46', label:'✅ ดึงคืนสำเร็จ' },
      cancelled:  { bg:'#fce7f3', color:'#9d174d', label:'🚫 ยกเลิก' },
      other:      { bg:'#eff6ff', color:'#1e40af', label:'👀 เฝ้าระวัง' },
    }
    const s = map[stage] ?? map.other
    return (
      <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:600, background:s.bg, color:s.color, whiteSpace:'nowrap' }}>
        {s.label}
      </span>
    )
  }

  // ── Draft email ───────────────────────────────────────────────────────────
  const openDraftEmail = (e, item) => {
    e.stopPropagation()
    const pol  = item.policies
    const text = `เรียน ทีมการเงิน/รับประกัน\n\n` +
      `รบกวนดำเนินการ "ระงับกรมธรรม์" รายการต่อไปนี้โดยด่วน (ป้องกันเกินกำหนด 30 วัน)\n\n` +
      `- เลขกรมธรรม์: ${pol.id}\n` +
      `- ชื่อลูกค้า: ${pol.customers?.name}\n` +
      `- วันเริ่มคุ้มครอง: ${pol.policy_start}\n` +
      `- ทะเบียนรถ: ${pol.plate ?? '-'}\n` +
      `- งวดที่ค้างชำระ: ${item.missing_installments.sort().join(', ')}\n` +
      `- ยอดค้างชำระรวม: ${fmtB(item.total_due)} บาท\n\n` +
      `หากดำเนินการเรียบร้อยแล้ว รบกวนแจ้งกลับด้วยครับ\nขอบคุณครับ`
    setDraftModal({ id: pol.id, text })
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(draftModal.text)
    alert('✅ คัดลอกข้อความเรียบร้อยแล้ว! นำไปวางในอีเมลหรือ Line ได้เลย')
    setDraftModal(null)
  }

  const updateStatus = async (e, policyId, newStatus) => {
    e.stopPropagation()
    if (!confirm(`ยืนยันการเปลี่ยนสถานะกรมธรรม์ ${policyId} ใช่หรือไม่?`)) return
    const { error } = await supabase.from('policies').update({ policy_status: newStatus }).eq('id', policyId)
    if (!error) {
      setItems(prev => prev.map(item =>
        item.policy_id === policyId
          ? { ...item, policies: { ...item.policies, policy_status: newStatus } }
          : item
      ))
    } else {
      alert('เกิดข้อผิดพลาดในการอัปเดตข้อมูล')
    }
  }

  // ── Styles (inline — Tailwind unreliable in this codebase) ─────────────
  const S = {
    // Action buttons — explicit, always visible
    btn: (bg, fg = '#fff') => ({
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
      fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
      background: bg, color: fg, lineHeight: 1.4,
      boxShadow: '0 1px 2px rgba(0,0,0,.15)',
    }),
    // Table
    th: {
      padding: '10px 14px', textAlign: 'left', fontSize: 11,
      fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
      letterSpacing: '.05em', background: '#f9fafb',
      borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap',
    },
    td: {
      padding: '10px 14px', borderBottom: '1px solid #f3f4f6',
      verticalAlign: 'middle', fontSize: 13,
    },
    // Filter bar
    input: {
      height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid #d1d5db',
      fontSize: 13, outline: 'none', background: '#fff', minWidth: 220,
    },
    select: {
      height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid #d1d5db',
      fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer',
    },
  }

  const TABS = [
    { id:'all',        label:'ทั้งหมด',          dot: null },
    { id:'critical',   label:'ต้องตัดสินใจด่วน', dot: '#dc2626' },
    { id:'standby',    label:'แจ้งระงับไว้แล้ว', dot: '#d97706' },
    { id:'pending',    label:'รอดึงกลับ',         dot: '#2563eb' },
    { id:'reinstated', label:'ดึงคืนสำเร็จ',      dot: '#059669' },
    { id:'cancelled',  label:'ยกเลิก',            dot: '#be185d' },
  ]

  return (
    <div>
      {/* Header */}
      <header style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 28px', background:'#fff', borderBottom:'1px solid #e5eaf1', position:'sticky', top:0, zIndex:20 }}>
        <span style={{ fontSize:13, fontWeight:600 }}>ห้องฉุกเฉิน (สู้กฎ 30 วัน)</span>
      </header>

      <div style={{ padding:'24px 28px' }}>
        {/* Page title */}
        <div className="ph">
          <div>
            <h1>ห้องฉุกเฉิน</h1>
            <div className="sub">กรมธรรม์เสี่ยงถูกตัดสิทธิ์ — อายุกรมธรรม์เข้าใกล้ 30 วัน · เรียงจากวิกฤตที่สุดขึ้นบน</div>
          </div>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────────── */}
        <div className="tb-wrap" style={{ marginTop: 24 }}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, padding:'12px 16px', background:'#fff', borderBottom:'1px solid #e5e7eb' }}>
            {TABS.map(t => {
              const count = t.id === 'all' ? enriched.length : (byStage[t.id]?.length ?? 0)
              const isOn  = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: isOn ? 700 : 500,
                    background: isOn ? '#1e293b' : '#f1f5f9',
                    color: isOn ? '#fff' : '#475569',
                    boxShadow: isOn ? '0 1px 3px rgba(0,0,0,.2)' : 'none',
                    transition: 'all .15s',
                  }}
                >
                  {t.dot && (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: isOn ? '#fff' : t.dot, opacity: isOn ? .8 : 1, flexShrink: 0 }} />
                  )}
                  {t.label}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: 20, height: 20, padding: '0 5px',
                    borderRadius: 10, fontSize: 11, fontWeight: 700,
                    background: isOn ? 'rgba(255,255,255,.25)' : (count > 0 && t.dot ? t.dot : '#cbd5e1'),
                    color: isOn ? '#fff' : (count > 0 && t.dot ? '#fff' : '#64748b'),
                  }}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* ── Filter & Search bar ─────────────────────────────────────────── */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:10, padding:'14px 16px', background:'#f9fafb', borderBottom:'1px solid #e5e7eb' }}>
            {/* Search */}
            <div style={{ position:'relative', flex:'1 1 220px' }}>
              <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#9ca3af', fontSize:14, pointerEvents:'none' }}>🔍</span>
              <input
                type="text"
                placeholder="ค้นหาชื่อลูกค้า / เลขกรมธรรม์..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ ...S.input, paddingLeft: 32, width: '100%', boxSizing:'border-box' }}
              />
            </div>

            {/* Company filter */}
            <select
              value={filterCompany}
              onChange={e => setFilterCompany(e.target.value)}
              style={S.select}
            >
              <option value="">🏢 ทุกบริษัท</option>
              {companyOptions.map(id => (
                <option key={id} value={id}>{fmtCompany(id)}</option>
              ))}
            </select>

            {/* Agent code filter — โหลดจาก agent_codes table ตามบริษัทที่เลือก */}
            <select
              value={filterAgentCode}
              onChange={e => setFilterAgentCode(e.target.value)}
              style={{ ...S.select, minWidth: 150 }}
              disabled={agentCodes.length === 0}
            >
              <option value="">👤 ทุกโค้ดตัวแทน</option>
              {agentCodes.map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>

            {/* Clear filters */}
            {(search || filterCompany || filterAgentCode) && (
              <button
                onClick={() => { setSearch(''); setFilterCompany(''); setFilterAgentCode('') }}
                style={S.btn('#6b7280')}
              >
                ✕ ล้างตัวกรอง
              </button>
            )}

            {/* Result count */}
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', fontSize:12, color:'#6b7280' }}>
              {displayed.length} รายการ · เรียงตามเวลาที่เหลือ ↑
            </div>
          </div>

          {/* ── Content ────────────────────────────────────────────────────── */}
          {loading ? (
            <div className="empty">กำลังโหลด...</div>
          ) : displayed.length === 0 ? (
            <div className="empty">
              <div className="ei">{Icons.shield}</div>
              {search || filterCompany ? 'ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา' : 'ไม่มีรายการในกลุ่มนี้'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth: 860 }}>
                <thead>
                  <tr>
                    <th style={S.th}>#</th>
                    <th style={S.th}>ลูกค้า / กรมธรรม์</th>
                    <th style={S.th}>บริษัท</th>
                    <th style={S.th}>อายุ (วัน)</th>
                    <th style={{ ...S.th, color:'#dc2626' }}>⏱ เหลือเวลา</th>
                    <th style={S.th}>งวดค้าง</th>
                    <th style={{ ...S.th, textAlign:'right' }}>ยอดค้างรวม</th>
                    <th style={S.th}>สถานะ</th>
                    <th style={S.th}>การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((item, idx) => {
                    const pol      = item.policies
                    const isPanic  = item._stage === 'critical'
                    const isStandby= item._stage === 'standby'
                    const rowBg    = isPanic   ? '#fff5f5'
                                   : isStandby ? '#fffbeb'
                                   : '#ffffff'
                    const rowBorder= isPanic   ? '3px solid #fca5a5'
                                   : isStandby ? '3px solid #fde68a'
                                   : '3px solid transparent'

                    return (
                      <tr
                        key={pol.id}
                        style={{ background: rowBg, borderLeft: rowBorder, cursor:'pointer', transition:'background .15s' }}
                        onClick={() => router.push(`/policies/${pol.id}`)}
                        onMouseEnter={e => e.currentTarget.style.background = isPanic ? '#fee2e2' : isStandby ? '#fef9c3' : '#f9fafb'}
                        onMouseLeave={e => e.currentTarget.style.background = rowBg}
                      >
                        {/* # */}
                        <td style={{ ...S.td, color:'#9ca3af', fontSize:12, width:36 }}>{idx + 1}</td>

                        {/* ลูกค้า / กรมธรรม์ */}
                        <td style={S.td}>
                          <div style={{ fontWeight:600, fontSize:13, color:'#111827' }}>
                            {pol.customers?.name ?? '—'}
                          </div>
                          <div style={{ fontSize:11, color:'#9ca3af', marginTop:2, fontFamily:'monospace' }}>
                            {pol.id}
                          </div>
                          {pol.plate && (
                            <div style={{ fontSize:11, color:'#6b7280', marginTop:1 }}>🚗 {pol.plate}</div>
                          )}
                        </td>

                        {/* บริษัท */}
                        <td style={{ ...S.td, fontSize:12 }}>
                          <span style={{ display:'inline-block', padding:'2px 8px', background:'#e0e7ff', color:'#3730a3', borderRadius:6, fontWeight:600, fontSize:11 }}>
                            {fmtCompany(pol.company_id)}
                          </span>
                          {pol.agent_code && (
                            <div style={{ fontSize:11, color:'#9ca3af', marginTop:3 }}>{pol.agent_code}</div>
                          )}
                        </td>

                        {/* อายุ */}
                        <td style={{ ...S.td, textAlign:'center' }}>
                          <div style={{ position:'relative', display:'inline-block', width:52, height:52 }}>
                            <svg width="52" height="52" style={{ transform:'rotate(-90deg)' }}>
                              <circle cx="26" cy="26" r="20" fill="none" stroke="#e5e7eb" strokeWidth="4"/>
                              <circle cx="26" cy="26" r="20" fill="none"
                                stroke={item._policyAge >= 27 ? '#ef4444' : item._policyAge >= 20 ? '#f59e0b' : '#10b981'}
                                strokeWidth="4"
                                strokeDasharray={`${2 * Math.PI * 20}`}
                                strokeDashoffset={`${2 * Math.PI * 20 * (1 - Math.min(item._policyAge / item._graceDays, 1))}`}
                                strokeLinecap="round"
                              />
                            </svg>
                            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color: item._policyAge >= 27 ? '#dc2626' : '#374151' }}>
                              {item._policyAge}
                            </div>
                          </div>
                        </td>

                        {/* เหลือเวลา */}
                        <td style={{ ...S.td, textAlign:'center' }}>
                          {daysLeftCell(item._daysLeft, item._stage)}
                        </td>

                        {/* งวดค้าง */}
                        <td style={{ ...S.td, fontSize:12 }}>
                          <span style={{ fontFamily:'monospace', color:'#374151' }}>
                            งวด {item.missing_installments.sort((a,b) => a-b).join(', ')}
                          </span>
                          <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>
                            / {item.total_inst} งวด
                          </div>
                        </td>

                        {/* ยอดค้างรวม */}
                        <td style={{ ...S.td, textAlign:'right' }}>
                          <b style={{ fontSize:13, color:'#dc2626', fontFamily:'monospace' }}>
                            {fmtB(item.total_due)}
                          </b>
                          <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>บาท</div>
                        </td>

                        {/* สถานะ */}
                        <td style={S.td}>{stageBadge(item._stage)}</td>

                        {/* การดำเนินการ */}
                        <td style={{ ...S.td, whiteSpace:'nowrap' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display:'flex', flexDirection:'column', gap:5, alignItems:'flex-start' }}>

                            {/* เฝ้าระวัง */}
                            {item._stage === 'other' && (<>
                              <button style={S.btn('#2563eb')} onClick={e => openDraftEmail(e, item)}>📝 ร่างข้อความ</button>
                              <button style={S.btn('#d97706')} onClick={e => updateStatus(e, pol.id, 'standby_cancel')}>⏳ แจ้งระงับแล้ว</button>
                              <button style={S.btn('#be185d')} onClick={e => updateStatus(e, pol.id, 'cancelled')}>🚫 ยกเลิก</button>
                            </>)}

                            {/* วิกฤต */}
                            {isPanic && (<>
                              <button style={S.btn('#2563eb')} onClick={e => openDraftEmail(e, item)}>📝 ร่างข้อความ</button>
                              <button style={S.btn('#d97706')} onClick={e => updateStatus(e, pol.id, 'standby_cancel')}>⏳ แจ้งระงับแล้ว</button>
                              <button style={S.btn('#be185d')} onClick={e => updateStatus(e, pol.id, 'cancelled')}>🚫 ยกเลิก</button>
                            </>)}

                            {/* แจ้งระงับแล้ว */}
                            {isStandby && (<>
                              <button style={S.btn('#059669')} onClick={e => updateStatus(e, pol.id, 'pending_reinstate')}>♻️ ลูกค้าจ่ายแล้ว (รอดึงกลับ)</button>
                              <button style={S.btn('#be185d')} onClick={e => updateStatus(e, pol.id, 'cancelled')}>🚫 ยกเลิก</button>
                            </>)}

                            {/* รอดึงกลับ */}
                            {item._stage === 'pending' && (<>
                              <button style={S.btn('#059669')} onClick={e => updateStatus(e, pol.id, 'reinstated')}>✅ ดึงคืนสำเร็จ!</button>
                              <button style={S.btn('#be185d')} onClick={e => updateStatus(e, pol.id, 'cancelled')}>🚫 ยกเลิก</button>
                            </>)}

                            {/* Terminal */}
                            {item._stage === 'reinstated' && (
                              <span style={{ fontSize:11, color:'#059669', fontWeight:700 }}>✅ เสร็จสิ้น</span>
                            )}
                            {item._stage === 'cancelled' && (
                              <span style={{ fontSize:11, color:'#be185d' }}>🚫 ยกเลิกแล้ว</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Draft Modal ──────────────────────────────────────────────────────── */}
      {draftModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => setDraftModal(null)}
        >
          <div style={{ background:'#fff', padding:28, borderRadius:14, width:520, maxWidth:'92%', boxShadow:'0 25px 50px rgba(0,0,0,.15)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize:16, fontWeight:700, marginBottom:4, color:'#111827' }}>📝 ร่างข้อความแจ้งระงับกรมธรรม์</div>
            <p style={{ fontSize:12, color:'#6b7280', marginBottom:12 }}>คัดลอกและนำไปวางในอีเมล / LINE เจ้าหน้าที่รับประกันได้เลย</p>
            <textarea
              readOnly
              value={draftModal.text}
              style={{ width:'100%', height:230, padding:12, borderRadius:8, border:'1px solid #d1d5db', fontSize:13, background:'#f9fafb', resize:'none', boxSizing:'border-box', lineHeight:1.6, color:'#374151' }}
            />
            <div style={{ display:'flex', gap:10, marginTop:16, justifyContent:'flex-end' }}>
              <button style={S.btn('#6b7280')} onClick={() => setDraftModal(null)}>ยกเลิก</button>
              <button style={S.btn('#2563eb')} onClick={copyToClipboard}>📋 คัดลอกข้อความ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}