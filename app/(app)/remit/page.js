'use client'
// app/(app)/remit/page.js
// กระเป๋าขวา — วางบิล / โอนเบี้ยให้บริษัท

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Icons, fmtB, fmtDate } from '@/components/ui/Icons'

// ─────────────────────────────────────────────────────────────────────────────
// LOGIC (ห้ามแตะ)
// ─────────────────────────────────────────────────────────────────────────────

// กลุ่ม 1: เริ่มคุ้มครอง 1–15  → ตัดรอบ 15
//   credit 15 → EOM เดือนนั้น | credit 30 → 15 เดือนถัดไป | credit 60 → 15 เดือน+2
// กลุ่ม 2: เริ่มคุ้มครอง 16–EOM → ตัดรอบ EOM
//   credit 15 → 15 เดือนถัดไป | credit 30 → EOM เดือนถัดไป | credit 60 → EOM เดือน+2

function eom(year, month) { return new Date(year, month + 1, 0) }

function calcDeadlineInfo(policyStart, creditDays) {
  if (!policyStart || creditDays == null) return null
  const s = new Date(policyStart)
  const d = s.getDate(), y = s.getFullYear(), m = s.getMonth()
  if (d >= 1 && d <= 15) {
    const cutoffDate = new Date(y, m, 15)
    const remitDeadline = creditDays === 15 ? eom(y, m)
      : creditDays === 30 ? new Date(y, m + 1, 15)
      : creditDays === 60 ? new Date(y, m + 2, 15) : null
    return { cutoffDate, remitDeadline, group: 1 }
  } else {
    const cutoffDate = eom(y, m)
    const remitDeadline = creditDays === 15 ? new Date(y, m + 1, 15)
      : creditDays === 30 ? eom(y, m + 1)
      : creditDays === 60 ? eom(y, m + 2) : null
    return { cutoffDate, remitDeadline, group: 2 }
  }
}

function todayMidnight() { const d = new Date(); d.setHours(0,0,0,0); return d }
function daysDiff(target) { return Math.ceil((target - todayMidnight()) / 86400000) }

function fmtThShort(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'2-digit' })
}
function fmtThLong(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('th-TH', { day:'numeric', month:'long', year:'numeric' })
}

function makeCycleKey(policyStart, group) {
  const s = new Date(policyStart)
  return `${s.getFullYear()}-${String(s.getMonth()+1).padStart(2,'0')}-${group}`
}
function makeCycleLabel(policyStart, group, remitDeadline) {
  const s = new Date(policyStart)
  const eomDay = eom(s.getFullYear(), s.getMonth()).getDate()
  const period = group === 1 ? '1–15' : `16–${eomDay}`
  const month  = s.toLocaleDateString('th-TH', { month:'short', year:'2-digit' })
  return `รอบ ${period} ${month} → ดิว ${fmtThShort(remitDeadline)}`
}

function csvEsc(v) {
  const s = String(v ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s
}
function downloadCSV(filename, rows) {
  const csv  = rows.map(r => r.map(csvEsc).join(',')).join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type:'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
function todayStr() { return new Date().toISOString().slice(0,10) }
function xlLink(url, label='ดูสลิป') { return url ? `=HYPERLINK("${url}","${label}")` : '' }

function enrichPolicy(policy, creditDays) {
  const allInsts  = policy.installments ?? []
  const paidInsts = allInsts.filter(i => i.paid_at != null)
  const paidCount = paidInsts.length
  const totalInst = allInsts.length
  const netPremium = Number(policy.premium ?? 0)
  const isFullPay  = policy.pay_mode === 'full'
  const isEligible = isFullPay || paidCount >= 2
  const info = calcDeadlineInfo(policy.policy_start, creditDays)
  const cutoffDate    = info?.cutoffDate    ?? null
  const remitDeadline = info?.remitDeadline ?? null
  const group         = info?.group         ?? null
  const today      = todayMidnight()
  const deadlineMs = remitDeadline ? new Date(remitDeadline).setHours(0,0,0,0) : null
  const isOverdue  = deadlineMs != null && today.getTime() > deadlineMs
  const isDueToday = deadlineMs != null && today.getTime() === deadlineMs
  const isDue      = isOverdue || isDueToday
  const daysLeft   = remitDeadline ? daysDiff(remitDeadline) : null
  const isRisk     = isDue && !isEligible
  const isCreditCard   = (policy.pay_mode ?? '').toLowerCase().includes('credit')
  const ccWarningToday = isCreditCard && isDueToday
  const isTravel       = (policy.coverage_type ?? '').toLowerCase().includes('travel')
  const travelLocked   = isTravel && !isDue
  const cycleKey   = policy.policy_start && group ? makeCycleKey(policy.policy_start, group) : 'unknown'
  const cycleLabel = policy.policy_start && group ? makeCycleLabel(policy.policy_start, group, remitDeadline) : 'ไม่ระบุรอบ'
  const slipUrls   = paidInsts.sort((a,b) => a.installment_no - b.installment_no).map(i => ({ no:i.installment_no, url:i.slip_url ?? '' }))
  const clientStatus = isFullPay ? 'ชำระเต็มจำนวน' : paidCount === 0 ? 'ยังไม่ชำระ' : `ผ่อน ${paidCount}/${totalInst} งวด`
  return { ...policy, paidInsts, paidCount, totalInst, netPremium, isFullPay, isEligible, cutoffDate, remitDeadline, group, isOverdue, isDueToday, isDue, daysLeft, isRisk, isCreditCard, ccWarningToday, isTravel, travelLocked, cycleKey, cycleLabel, slipUrls, clientStatus }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function RemitPage() {
  const supabase = createClient()
  const [agentCodes,    setAgentCodes]    = useState([])
  const [selected,      setSelected]      = useState(null)
  const [allPolicies,   setAllPolicies]   = useState([])
  const [loading,       setLoading]       = useState(true)
  const [loadingPol,    setLoadingPol]    = useState(false)
  const [tab,           setTab]           = useState('ready')
  const [selectedCycle, setSelectedCycle] = useState('all')
  const [checkedIds,    setCheckedIds]    = useState(new Set())

  useEffect(() => { loadCodes() }, [])
  useEffect(() => { if (selected) { loadPolicies(selected); setCheckedIds(new Set()); setSelectedCycle('all') } }, [selected])
  useEffect(() => { setCheckedIds(new Set()) }, [selectedCycle, tab])

  async function loadCodes() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('agent_codes').select('*, companies(name, color)').eq('user_id', user.id).eq('is_active', true).order('code')
    setAgentCodes(data ?? [])
    if (data?.length) setSelected(data[0])
    setLoading(false)
  }

  async function loadPolicies(ac) {
    setLoadingPol(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('policies').select(`id, policy_start, policy_end, premium, pay_mode, coverage_type, plate, model, policy_status, customers(name), installments(id, installment_no, total_inst, amount_due, paid_at, paid_amount, slip_url, due_date)`).eq('agent_code', ac.code).eq('user_id', user.id).in('policy_status', ['active', 'reinstated']).order('policy_start', { ascending: false })
    if (error) console.error('loadPolicies:', error)
    setAllPolicies((data ?? []).map(p => enrichPolicy(p, ac.credit_days ?? 15)))
    setLoadingPol(false)
  }

  const billingCycles = useMemo(() => {
    const map = new Map()
    allPolicies.forEach(p => { if (!map.has(p.cycleKey)) map.set(p.cycleKey, { key:p.cycleKey, label:p.cycleLabel }) })
    return Array.from(map.values()).sort((a,b) => a.key.localeCompare(b.key))
  }, [allPolicies])

  const cyclePolicies = useMemo(() => selectedCycle === 'all' ? allPolicies : allPolicies.filter(p => p.cycleKey === selectedCycle), [allPolicies, selectedCycle])

  const ready    = cyclePolicies.filter(p => p.isDue && p.isEligible)
  const risk     = cyclePolicies.filter(p => p.isRisk)
  const reconAll = cyclePolicies
  const displayed = tab === 'ready' ? ready : tab === 'risk' ? risk : reconAll

  const allChecked  = displayed.length > 0 && displayed.every(p => checkedIds.has(p.id))
  const someChecked = displayed.some(p => checkedIds.has(p.id))

  function toggleCheck(id) { setCheckedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAll() {
    if (allChecked) { setCheckedIds(prev => { const n = new Set(prev); displayed.forEach(p => n.delete(p.id)); return n }) }
    else            { setCheckedIds(prev => { const n = new Set(prev); displayed.forEach(p => n.add(p.id));    return n }) }
  }

  const checkedPolicies = cyclePolicies.filter(p => checkedIds.has(p.id))
  const sumReady = checkedPolicies.filter(p =>  p.isEligible).reduce((s,p) => s + p.netPremium, 0)
  const sumRisk  = checkedPolicies.filter(p => !p.isEligible).reduce((s,p) => s + p.netPremium, 0)
  const sumTotal = checkedPolicies.reduce((s,p) => s + p.netPremium, 0)
  const cntReady = checkedPolicies.filter(p =>  p.isEligible).length
  const cntRisk  = checkedPolicies.filter(p => !p.isEligible).length

  const ccToday     = cyclePolicies.filter(p => p.ccWarningToday)
  const travelLocks = cyclePolicies.filter(p => p.travelLocked)

  function exportRows() { return checkedIds.size > 0 ? checkedPolicies : displayed }
  function exportNote() { const n = exportRows().length; return checkedIds.size > 0 ? `${n} รายการที่เลือก` : `${n} รายการทั้งหมด` }

  function exportRemittanceAdvice() {
    const rows = exportRows(); const total = rows.reduce((s,p) => s + p.netPremium, 0)
    downloadCSV(`remittance_advice_${selected?.code}_${todayStr()}.csv`, [
      ['📑 รายงานนำส่งเบี้ยประกัน (Remittance Advice)'],
      ['รหัสตัวแทน:', selected?.code ?? '', 'บริษัท:', selected?.companies?.name ?? ''],
      ['วันที่ออกรายงาน:', new Date().toLocaleDateString('th-TH', { dateStyle:'long' })],
      ['เครดิตส่งเงิน:', `${selected?.credit_days ?? 15} วัน`], [],
      ['เลขกรมธรรม์','ชื่อลูกค้า','ประเภทประกัน','วิธีชำระ','วันเริ่มคุ้มครอง','กลุ่มรอบบิล','วันตัดรอบ','กำหนดส่งเงิน','สถานะฝั่งลูกค้า','ยอดเต็ม (Net Premium)'],
      ...rows.map(p => [p.id, p.customers?.name??'', p.coverage_type??'', p.pay_mode??'', fmtThShort(p.policy_start), p.group===1?'กลุ่ม 1 (1–15)':'กลุ่ม 2 (16–สิ้นเดือน)', fmtThShort(p.cutoffDate), fmtThShort(p.remitDeadline), p.clientStatus, p.netPremium]),
      [], ['','','','','','','','','รวมยอดนำส่ง', total], ['','','','','','','','','จำนวนกรมธรรม์', rows.length],
      [], ['📌 แนบไปกับ:', 'สลิปโอนเงิน 1 ใบ (โอนรวมก้อนเดียว)'],
    ])
  }

  function exportDirectPayNotification() {
    const rows = exportRows(); const maxSlips = rows.reduce((m,p) => Math.max(m, p.slipUrls.length), 0)
    const slipHdrs = Array.from({ length: maxSlips }, (_,i) => `สลิปงวด ${i+1}`)
    downloadCSV(`direct_notify_${selected?.code}_${todayStr()}.csv`, [
      ['📑 รายการแจ้งงานด่วน — ลูกค้าโอนตรงบริษัท'],
      ['รหัสตัวแทน:', selected?.code??'', 'บริษัท:', selected?.companies?.name??''],
      ['วันที่:', new Date().toLocaleDateString('th-TH', { dateStyle:'long' })], [],
      ['📁 วิธีจัดสลิป:', 'ตั้งชื่อโฟลเดอร์ = เลขกรมธรรม์ → รวมสลิปทุกงวดไว้ข้างใน → ZIP แล้วส่งพร้อมไฟล์นี้'], [],
      ['เลขกรมธรรม์','ชื่อลูกค้า','ประเภท','วันเริ่มคุ้มครอง','กำหนดส่งบริษัท','สถานะฝั่งลูกค้า','ยอดเต็ม (Net Premium)','โฟลเดอร์สลิป',...slipHdrs],
      ...rows.map(p => [p.id, p.customers?.name??'', p.coverage_type??'', fmtThShort(p.policy_start), fmtThShort(p.remitDeadline), p.clientStatus, p.netPremium, p.id, ...slipHdrs.map((_,i) => { const s=p.slipUrls[i]; return s?.url ? xlLink(s.url, `สลิปงวด ${s.no}`) : '' })]),
      [], ['','','','','','รวม', rows.reduce((s,p) => s+p.netPremium,0), `${rows.length} กรมธรรม์`],
      [], ['📌 หมายเหตุ:', 'เงินถึงบริษัทแล้ว — หน้าที่เราแค่ส่งหลักฐานให้บริษัทตัดหนี้'],
    ])
  }

  function exportReconciliation() {
    const rows = exportRows()
    downloadCSV(`reconciliation_${selected?.code}_${todayStr()}.csv`, [
      ['📑 ข้อมูลกระทบยอดภายใน (Internal Reconciliation)'],
      ['รหัสตัวแทน:', selected?.code??'', 'บริษัท:', selected?.companies?.name??''],
      ['วันที่ Export:', new Date().toLocaleDateString('th-TH', { dateStyle:'long' })],
      ['วิธีใช้:', 'VLOOKUP ด้วยเลขกรมธรรม์เทียบกับ Statement ที่บริษัทส่งมาสิ้นเดือน'], [],
      ['เลขกรมธรรม์','ชื่อลูกค้า','ประเภท','วิธีชำระ','วันเริ่มคุ้มครอง','วันสิ้นสุดคุ้มครอง','กลุ่มรอบบิล','วันตัดรอบ','กำหนดส่งเงิน','ยอดเต็ม (Net Premium)','งวดจ่ายแล้ว','งวดทั้งหมด','สถานะฝั่งลูกค้า','ผ่านเงื่อนไขโอน','สถานะกรมธรรม์','สถานะความเสี่ยง'],
      ...rows.map(p => [p.id, p.customers?.name??'', p.coverage_type??'', p.pay_mode??'', fmtThShort(p.policy_start), fmtThShort(p.policy_end), p.group===1?'กลุ่ม 1 (1–15)':'กลุ่ม 2 (16–สิ้นเดือน)', fmtThShort(p.cutoffDate), fmtThShort(p.remitDeadline), p.netPremium, p.paidCount, p.totalInst, p.clientStatus, p.isEligible?'ผ่าน':'ไม่ผ่าน', p.policy_status??'', p.isRisk?'⚠️ เสี่ยง (ถึงดิวแล้ว ยังไม่ผ่านเงื่อนไข)':p.isDue&&p.isEligible?'✅ พร้อมนำส่ง':p.isEligible?'🕐 รอถึงกำหนด':'🔴 ยังไม่ผ่านเงื่อนไข']),
      [], ['','','','','','','','','รวม', rows.reduce((s,p) => s+p.netPremium,0),'','','','',`รวม ${rows.length} รายการ`],
    ])
  }

  // ── Summary stats สำหรับแสดงใน sidebar ──────────────────────────────────
  function acSummary(ac) {
    const ps = allPolicies.filter(p => p.agent_code === ac.code || selected?.code === ac.code)
    // เมื่อเลือก ac นี้ ดูจาก allPolicies (ตอนนี้เป็น selected)
    if (selected?.code !== ac.code) return null
    return { ready: ready.length, risk: risk.length, all: allPolicies.length }
  }

  // ── Footer total (based on selection) ─────────────────────────────────────
  const footerTotal = someChecked
    ? checkedPolicies.filter(p => displayed.some(d => d.id === p.id)).reduce((s,p) => s + p.netPremium, 0)
    : displayed.reduce((s,p) => s + p.netPremium, 0)

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }}>

      {/* ── Sticky top bar ────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px', height: 52, background: '#fff',
        borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 30,
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 18, width: 32, height: 32, borderRadius: 8,
            background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>💼</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
              กระเป๋าขวา — วางบิล
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: -1 }}>
              ยอดนำส่ง = Net Premium เต็ม · กำหนดส่ง = วันตัดรอบ + เครดิต (Chubb)
            </div>
          </div>
        </div>
        {selected && !loadingPol && (
          <div style={{ display: 'flex', gap: 6 }}>
            <SummaryPill color="#166534" bg="#dcfce7" label="พร้อมส่ง" count={ready.length} />
            <SummaryPill color="#92400e" bg="#fef3c7" label="ต้องตัดสินใจ" count={risk.length} />
            <SummaryPill color="#1e40af" bg="#dbeafe" label="ทั้งหมด" count={reconAll.length} />
          </div>
        )}
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 0, minHeight: 'calc(100vh - 52px)' }}>

        {/* ── Agent code sidebar ─────────────────────────────────────────── */}
        <aside style={{
          background: '#fff', borderRight: '1px solid #e2e8f0',
          padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: 1,
            textTransform: 'uppercase', padding: '0 6px', marginBottom: 8,
          }}>
            รหัสตัวแทน
          </div>

          {loading ? (
            <div style={{ fontSize: 12, color: '#94a3b8', padding: 8 }}>กำลังโหลด...</div>
          ) : agentCodes.length === 0 ? (
            <div style={{ fontSize: 12, color: '#94a3b8', padding: 8 }}>ไม่มีรหัสตัวแทน</div>
          ) : agentCodes.map(ac => {
            const isOn = selected?.code === ac.code
            const dotColor = ac.companies?.color ?? '#64748b'
            return (
              <button key={ac.code} onClick={() => setSelected(ac)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10,
                cursor: 'pointer', textAlign: 'left', width: '100%',
                border: `1.5px solid ${isOn ? '#3b82f6' : 'transparent'}`,
                background: isOn ? '#eff6ff' : 'transparent',
                transition: 'all .12s',
              }}
              onMouseOver={e => { if (!isOn) e.currentTarget.style.background = '#f8fafc' }}
              onMouseOut={e  => { if (!isOn) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  background: dotColor,
                  boxShadow: isOn ? `0 0 0 3px ${dotColor}30` : 'none',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
                    color: isOn ? '#1d4ed8' : '#1e293b',
                  }}>
                    {ac.code}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ac.companies?.name}
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>
                    เครดิต {ac.credit_days ?? 15} วัน
                  </div>
                </div>
                {isOn && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
                    <span style={{ fontSize: 10, background: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                      {ready.length} ส่งได้
                    </span>
                    {risk.length > 0 && (
                      <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                        {risk.length} เสี่ยง
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </aside>

        {/* ── Main content ──────────────────────────────────────────────────── */}
        <main style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {!selected ? (
            <EmptyState icon="🏢" title="เลือกรหัสตัวแทน" sub="เลือกรหัสตัวแทนทางด้านซ้ายเพื่อดูรายการกรมธรรม์" />
          ) : loadingPol ? (
            <EmptyState icon="⏳" title="กำลังโหลดข้อมูล..." sub="" />
          ) : (
            <>
              {/* ── Safety Alerts ──────────────────────────────────────── */}
              {ccToday.length > 0 && (
                <AlertBanner color="#c2410c" bg="#fff7ed" border="#f97316">
                  <b>⚠️ ระวัง! กรมธรรม์บัตรเครดิต — ครบกำหนดส่งวันนี้</b>
                  <br/>
                  <span style={{ fontSize: 12 }}>
                    กรมธรรม์ <b>{ccToday.map(p => p.id).join(', ')}</b>
                    {' '}ชำระด้วยบัตรเครดิตและครบกำหนดวันนี้
                    → รูดบัตรวันนี้ถูกชาร์จ <b>2%</b> และ <b>งดค่าคอม</b>
                    — แนะนำ <b>โอนเงินสดแทน</b>
                  </span>
                </AlertBanner>
              )}
              {travelLocks.length > 0 && (
                <AlertBanner color="#1d4ed8" bg="#eff6ff" border="#93c5fd">
                  <b>🔒 Travel Lock — ยังไม่ถึงกำหนดส่งเงิน ({travelLocks.length} รายการ)</b>
                  <br/>
                  <span style={{ fontSize: 12 }}>
                    ห้ามโอนล่วงหน้าเด็ดขาด — Checkbox ของรายการ Travel ถูก disable ไว้จนกว่าจะถึงวันดิว
                  </span>
                </AlertBanner>
              )}

              {/* ── Toolbar: Cycle Filter + Export ────────────────────── */}
              <div style={{
                background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
                padding: '14px 16px',
              }}>
                {/* Row 1: Filter + Export buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      🗂️ รอบวางบิล:
                    </span>
                    <select
                      value={selectedCycle}
                      onChange={e => setSelectedCycle(e.target.value)}
                      style={{
                        fontSize: 12, padding: '7px 12px', borderRadius: 8,
                        border: '1.5px solid #e2e8f0', background: '#f8fafc',
                        color: '#1e293b', cursor: 'pointer', minWidth: 280,
                        fontWeight: 500,
                      }}
                    >
                      <option value="all">ทั้งหมด ({allPolicies.length} กรมธรรม์)</option>
                      {billingCycles.map(c => {
                        const cnt = allPolicies.filter(p => p.cycleKey === c.key).length
                        return <option key={c.key} value={c.key}>{c.label} ({cnt})</option>
                      })}
                    </select>
                  </div>

                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                      📥 ดาวน์โหลด ({exportNote()}):
                    </span>
                    <ExportCard
                      icon="📄" label="Remittance Advice"
                      sub="โอนก้อนเดียว + สลิป 1 ใบ"
                      color="#1e40af" onClick={exportRemittanceAdvice}
                    />
                    <ExportCard
                      icon="⚡" label="แจ้งงานด่วน"
                      sub="ลูกค้าโอนตรงบริษัท + สลิป"
                      color="#0369a1" onClick={exportDirectPayNotification}
                    />
                    <ExportCard
                      icon="🔍" label="กระทบยอด"
                      sub="VLOOKUP เทียบ Statement"
                      color="#7c3aed" onClick={exportReconciliation}
                    />
                  </div>
                </div>

                {/* Row 2: Format guide */}
                <div style={{
                  marginTop: 12, paddingTop: 10, borderTop: '1px dashed #e2e8f0',
                  display: 'flex', gap: 24, flexWrap: 'wrap',
                }}>
                  <FormatGuide n="1" label="Remittance Advice" desc="ยอดรวมทุกกรมธรรม์ แนบสลิปโอนเงิน 1 ใบ" />
                  <FormatGuide n="2" label="แจ้งงานด่วน + สลิป" desc="มี Hyperlink คลิกดูสลิปต่องวดได้เลย (1 โฟลเดอร์/กรมธรรม์)" />
                  <FormatGuide n="3" label="กระทบยอด VLOOKUP" desc="Raw Data ทุกฟิลด์ เอาไป VLOOKUP เทียบ Statement ที่บริษัทส่งมาสิ้นเดือน" />
                </div>
              </div>

              {/* ── Real-time Dashboard (แสดงเฉพาะตอน check) ─────────── */}
              {checkedIds.size > 0 && (
                <div style={{
                  background: '#fff', borderRadius: 12,
                  border: '2px solid #3b82f6',
                  padding: '16px 18px',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', marginBottom: 12 }}>
                    📊 สรุปยอดจากรายการที่เลือก — {checkedIds.size} กรมธรรม์
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <DashCard
                      icon="✅" label="ยอดพร้อมนำส่ง"
                      sub={`${cntReady} กรมธรรม์ ผ่านเงื่อนไขครบ`}
                      amount={fmtB(sumReady)}
                      color="#166534" bg="#f0fdf4" border="#bbf7d0"
                    />
                    <DashCard
                      icon="⚠️" label="ยอดที่ต้องตัดสินใจ"
                      sub={cntRisk > 0 ? `${cntRisk} กรมธรรม์ ต้องสำรองจ่าย` : 'ไม่มีรายการเสี่ยง'}
                      amount={fmtB(sumRisk)}
                      color={cntRisk > 0 ? '#92400e' : '#94a3b8'}
                      bg={cntRisk > 0 ? '#fffbeb' : '#f8fafc'}
                      border={cntRisk > 0 ? '#fde68a' : '#e2e8f0'}
                    />
                    <DashCard
                      icon="💰" label="ยอดรวมทั้งสิ้น"
                      sub={`${checkedIds.size} กรมธรรม์ที่เลือก`}
                      amount={fmtB(sumTotal)}
                      color="#1e40af" bg="#eff6ff" border="#bfdbfe"
                    />
                  </div>
                </div>
              )}

              {/* ── Tabs ────────────────────────────────────────────────── */}
              <div style={{
                display: 'flex', gap: 0,
                background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
                overflow: 'hidden',
              }}>
                {[
                  { key:'ready', emoji:'✅', label:'พร้อมนำส่ง',    count:ready.length,
                    hint:'ถึงกำหนดแล้ว + เงินลูกค้าครบเงื่อนไข',
                    activeColor:'#166534', activeBg:'#f0fdf4', activeBorder:'#86efac' },
                  { key:'risk',  emoji:'⚠️', label:'ต้องตัดสินใจ', count:risk.length,
                    hint:'ถึงกำหนดแล้ว แต่เงินลูกค้ายังไม่ครบ',
                    activeColor:'#92400e', activeBg:'#fffbeb', activeBorder:'#fde68a' },
                  { key:'recon', emoji:'📊', label:'รายการทั้งหมด', count:reconAll.length,
                    hint:'ดูทุกสถานะ สำหรับกระทบยอด',
                    activeColor:'#1e40af', activeBg:'#eff6ff', activeBorder:'#bfdbfe' },
                ].map((t, i) => (
                  <button key={t.key} onClick={() => setTab(t.key)} style={{
                    flex: 1, padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                    borderRight: i < 2 ? '1px solid #e2e8f0' : 'none',
                    background: tab === t.key ? t.activeBg : '#fff',
                    borderBottom: tab === t.key ? `3px solid ${t.activeBorder}` : '3px solid transparent',
                    transition: 'all .15s', border: 'none',
                    borderRight: i < 2 ? '1px solid #e2e8f0' : 'none',
                    borderBottom: tab === t.key ? `3px solid ${t.activeBorder}` : '3px solid transparent',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{t.emoji}</span>
                      <span style={{
                        fontSize: 13, fontWeight: 700,
                        color: tab === t.key ? t.activeColor : '#475569',
                      }}>
                        {t.label}
                      </span>
                      <span style={{
                        marginLeft: 'auto',
                        fontSize: 13, fontWeight: 700,
                        background: tab === t.key ? t.activeBorder : '#f1f5f9',
                        color: tab === t.key ? t.activeColor : '#64748b',
                        padding: '1px 10px', borderRadius: 20, minWidth: 28, textAlign: 'center',
                      }}>
                        {t.count}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, paddingLeft: 24 }}>
                      {t.hint}
                    </div>
                  </button>
                ))}
              </div>

              {/* ── Tab hints ────────────────────────────────────────────── */}
              {tab === 'risk' && risk.length > 0 && (
                <AlertBanner color="#92400e" bg="#fffbeb" border="#fde68a">
                  <b>ต้องตัดสินใจ:</b> กรมธรรม์เหล่านี้ถึงกำหนดส่งบริษัทแล้ว
                  แต่เงินลูกค้ายังไม่ครบเงื่อนไข (ไม่ใช่จ่ายเต็ม และจ่ายน้อยกว่า 2 งวด)
                  <br/>
                  <span style={{ fontSize: 12 }}>
                    → ถ้าจะส่ง: <b>สำรองเงินส่วนตัวก่อน</b>
                    แล้วรอลูกค้าจ่ายงวด 2 หรือไปกดยกเลิกในห้องฉุกเฉิน
                  </span>
                </AlertBanner>
              )}
              {tab === 'recon' && (
                <AlertBanner color="#1d4ed8" bg="#eff6ff" border="#bfdbfe">
                  <b>วิธีใช้ Format 3 (กระทบยอด):</b>{' '}
                  Export → เปิด Excel → VLOOKUP ด้วย <b>เลขกรมธรรม์</b> เทียบกับ Statement สิ้นเดือน
                  <br/>
                  <span style={{ fontSize: 12 }}>
                    ถ้ารายการไหน <b>โผล่มาเกิน</b> หรือ <b>หายไป</b>
                    → แย้งได้ทันที พร้อมวันตัดรอบ วันดิว และยอด Net Premium อ้างอิง
                  </span>
                </AlertBanner>
              )}

              {/* ── Policy Table ─────────────────────────────────────────── */}
              <div style={{
                background: '#fff', borderRadius: 12,
                border: '1px solid #e2e8f0', overflow: 'hidden',
              }}>
                {/* Table header bar */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 18px', borderBottom: '1px solid #e2e8f0',
                  background: '#f8fafc',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                    {tab === 'ready'
                      ? '✅ กรมธรรม์พร้อมนำส่ง'
                      : tab === 'risk'
                        ? '⚠️ กรมธรรม์ที่ต้องตัดสินใจ'
                        : '📊 รายการทั้งหมด'}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    {tab === 'ready'
                      ? 'ถึงกำหนดแล้ว + ผ่านเงื่อนไข 2 งวด หรือชำระเต็มจำนวน'
                      : tab === 'risk'
                        ? 'ถึงกำหนดแล้ว แต่ยังไม่ผ่านเงื่อนไข'
                        : 'ทุกสถานะ ใช้ VLOOKUP เทียบ Statement'}
                  </div>
                  {someChecked && (
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: 12, fontWeight: 600, color: '#1d4ed8',
                      background: '#dbeafe', padding: '3px 12px', borderRadius: 20,
                    }}>
                      เลือก {checkedIds.size} / {displayed.length} รายการ
                    </span>
                  )}
                  {!someChecked && (
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>
                      {displayed.length} รายการ
                    </span>
                  )}
                </div>

                {displayed.length === 0 ? (
                  <EmptyState icon={tab === 'ready' ? '✅' : tab === 'risk' ? '⚠️' : '📊'}
                    title="ไม่มีรายการในหมวดนี้"
                    sub={tab === 'ready' ? 'ยังไม่มีกรมธรรม์ที่ถึงกำหนดและผ่านเงื่อนไข' : tab === 'risk' ? 'ดีมาก ไม่มีรายการที่ต้องสำรองจ่าย' : 'ไม่มีกรมธรรม์ในรอบที่เลือก'}
                  />
                ) : (
                  <>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{
                        width: '100%', borderCollapse: 'collapse', fontSize: 13,
                      }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                            <Th center w={44}>
                              <input
                                type="checkbox" checked={allChecked}
                                ref={el => { if (el) el.indeterminate = someChecked && !allChecked }}
                                onChange={toggleAll} style={{ cursor: 'pointer' }}
                              />
                            </Th>
                            <Th>กรมธรรม์ / ลูกค้า</Th>
                            <Th center w={80}>ประเภท</Th>
                            <Th center w={130}>การชำระของลูกค้า</Th>
                            <Th center w={110}>วันเริ่มคุ้มครอง</Th>
                            <Th center w={180}>รอบตัด → ส่งภายใน</Th>
                            <Th center w={110}>สถานะ</Th>
                            <Th right w={130}>ยอดส่งบริษัท</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayed.map((p, idx) => (
                            <PolicyRow
                              key={p.id} p={p} idx={idx}
                              checked={checkedIds.has(p.id)}
                              onToggle={() => toggleCheck(p.id)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer total */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '14px 18px', borderTop: '2px solid #e2e8f0',
                      background: '#f8fafc',
                    }}>
                      <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                        {someChecked ? `ยอดรวม ${checkedIds.size} รายการที่เลือก` : `ยอดรวม ${displayed.length} รายการ`}
                        <span style={{ fontSize: 11, marginLeft: 6, color: '#94a3b8' }}>
                          (Net Premium ที่ต้องโอนให้บริษัท)
                        </span>
                      </span>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#1e40af', fontFeatureSettings: '"tnum"' }}>
                          {fmtB(footerTotal)}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function PolicyRow({ p, idx, checked, onToggle }) {
  const disabled  = p.travelLocked
  const isEvenRow = idx % 2 === 0
  const bg = checked ? '#eff6ff' : isEvenRow ? '#fff' : '#fafafa'

  return (
    <tr style={{
      background: bg, opacity: disabled ? .5 : 1,
      borderBottom: '1px solid #e2e8f0',
      transition: 'background .1s',
    }}>
      {/* Checkbox */}
      <td style={{ textAlign: 'center', padding: '12px 0', width: 44 }}>
        <input
          type="checkbox" checked={checked} onChange={onToggle} disabled={disabled}
          title={disabled ? 'Travel Lock — ยังไม่ถึงกำหนดส่ง' : undefined}
          style={{ cursor: disabled ? 'not-allowed' : 'pointer', width: 15, height: 15 }}
        />
      </td>

      {/* กรมธรรม์ + ลูกค้า */}
      <td style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <code style={{
            fontSize: 12, fontWeight: 700, color: '#1d4ed8',
            background: '#eff6ff', padding: '2px 6px', borderRadius: 5,
          }}>
            {p.id}
          </code>
          {p.isCreditCard && <MicroBadge bg="#fee2e2" color="#991b1b" text="💳 บัตร" />}
          {p.travelLocked && <MicroBadge bg="#fef3c7" color="#92400e" text="🔒 Travel" />}
        </div>
        <div style={{ fontSize: 12, color: '#475569', marginTop: 4, fontWeight: 500 }}>
          {p.customers?.name ?? '—'}
        </div>
      </td>

      {/* ประเภท */}
      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
          background: '#f1f5f9', color: '#475569', whiteSpace: 'nowrap',
        }}>
          {p.coverage_type ?? '—'}
        </span>
      </td>

      {/* การชำระของลูกค้า */}
      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
        <div style={{
          fontSize: 12, fontWeight: 700,
          color: p.isEligible ? '#166534' : '#d97706',
        }}>
          {p.clientStatus}
        </div>
        {!p.isFullPay && p.totalInst > 0 && (
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
            จ่ายแล้ว {p.paidCount} จาก {p.totalInst} งวด
          </div>
        )}
      </td>

      {/* วันเริ่มคุ้มครอง + กลุ่ม */}
      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>
          {fmtThShort(p.policy_start)}
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
          {p.group === 1 ? 'กลุ่ม 1 (1–15)' : 'กลุ่ม 2 (16–EOM)'}
        </div>
      </td>

      {/* รอบตัด + กำหนดส่ง */}
      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>
          ตัดรอบ {fmtThShort(p.cutoffDate)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 3 }}>
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: p.isOverdue ? '#dc2626' : p.isDueToday ? '#dc2626' : p.daysLeft != null && p.daysLeft <= 7 ? '#d97706' : '#1e293b',
          }}>
            {fmtThShort(p.remitDeadline)}
          </span>
          {p.isDueToday && <span style={{ fontSize: 10, background: '#fee2e2', color: '#dc2626', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>วันนี้!</span>}
          {p.isOverdue && !p.isDueToday && <span style={{ fontSize: 10, background: '#fee2e2', color: '#dc2626', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>เกิน</span>}
          {!p.isDue && p.daysLeft != null && p.daysLeft <= 7 && (
            <span style={{ fontSize: 10, color: '#d97706' }}>({p.daysLeft} ว.)</span>
          )}
        </div>
      </td>

      {/* สถานะ */}
      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
        {p.travelLocked ? (
          <StatusPill bg="#fef3c7" color="#92400e" text="🔒 Travel Lock" />
        ) : p.isRisk ? (
          <StatusPill bg="#fef3c7" color="#92400e" text="⚠️ ต้องสำรองจ่าย" bold />
        ) : p.isDue && p.isEligible ? (
          <StatusPill bg="#dcfce7" color="#166534" text="✅ ส่งได้เลย" bold />
        ) : p.isEligible ? (
          <StatusPill bg="#f1f5f9" color="#64748b" text="🕐 รอถึงกำหนด" />
        ) : (
          <StatusPill bg="#fff1f2" color="#be123c" text="ยังไม่ผ่านเงื่อนไข" />
        )}
      </td>

      {/* ยอดส่งบริษัท */}
      <td style={{ padding: '12px 18px', textAlign: 'right' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b', fontFeatureSettings: '"tnum"' }}>
          {fmtB(p.netPremium)}
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
          Net Premium
        </div>
      </td>
    </tr>
  )
}

// ── Atom components ────────────────────────────────────────────────────────

function Th({ children, center, right, w }) {
  return (
    <th style={{
      padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#64748b',
      textAlign: center ? 'center' : right ? 'right' : 'left',
      whiteSpace: 'nowrap', width: w,
      letterSpacing: .3,
    }}>
      {children}
    </th>
  )
}

function StatusPill({ bg, color, text, bold }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: bold ? 700 : 500,
      background: bg, color, padding: '4px 10px', borderRadius: 20,
      whiteSpace: 'nowrap',
    }}>
      {text}
    </span>
  )
}

function MicroBadge({ bg, color, text }) {
  return (
    <span style={{
      fontSize: 10, background: bg, color,
      padding: '1px 6px', borderRadius: 4, fontWeight: 600,
    }}>
      {text}
    </span>
  )
}

function SummaryPill({ color, bg, label, count }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: bg, borderRadius: 20, padding: '4px 12px',
    }}>
      <span style={{ fontSize: 11, color, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color }}>{count}</span>
    </div>
  )
}

function AlertBanner({ children, color, bg, border }) {
  return (
    <div style={{
      background: bg, border: `1.5px solid ${border}`,
      borderRadius: 10, padding: '12px 16px',
      fontSize: 13, color, lineHeight: 1.6,
    }}>
      {children}
    </div>
  )
}

function DashCard({ icon, label, sub, amount, color, bg, border }) {
  return (
    <div style={{
      background: bg, border: `1.5px solid ${border}`,
      borderRadius: 10, padding: '14px 16px',
    }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color, fontFeatureSettings: '"tnum"' }}>
        {amount}
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{sub}</div>
    </div>
  )
}

function ExportCard({ icon, label, sub, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', gap: 1,
      padding: '8px 14px', borderRadius: 8,
      background: color, color: '#fff', border: 'none',
      cursor: 'pointer', textAlign: 'left',
      transition: 'opacity .15s',
    }}
    onMouseOver={e => e.currentTarget.style.opacity = '.85'}
    onMouseOut={e  => e.currentTarget.style.opacity = '1'}
    >
      <span style={{ fontSize: 12, fontWeight: 700 }}>{icon} {label}</span>
      <span style={{ fontSize: 10, opacity: .8 }}>{sub}</span>
    </button>
  )
}

function FormatGuide({ n, label, desc }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{
        fontSize: 10, fontWeight: 700, background: '#1e293b', color: '#fff',
        width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {n}
      </span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>{label}</div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{desc}</div>
      </div>
    </div>
  )
}

function EmptyState({ icon, title, sub }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px', gap: 10, color: '#94a3b8',
    }}>
      <div style={{ fontSize: 40 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#64748b' }}>{title}</div>
      {sub && <div style={{ fontSize: 13 }}>{sub}</div>}
    </div>
  )
}