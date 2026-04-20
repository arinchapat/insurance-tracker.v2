'use client'
// app/(app)/remit/page.js
// กระเป๋าขวา — วางบิล / โอนเบี้ยให้บริษัท

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Icons, fmtB, fmtDate } from '@/components/ui/Icons'

// ─── Helpers ────────────────────────────────────────────────────────────────

/** policy_start + credit_days → วันกำหนดส่ง (per-policy, ไม่ใช่ fixed date) */
function calcRemitDeadline(policyStart, creditDays) {
  if (!policyStart || creditDays == null) return null
  const d = new Date(policyStart)
  d.setDate(d.getDate() + Number(creditDays))
  return d
}

function daysDiff(from, to) {
  return Math.ceil((new Date(to) - new Date(from)) / 86400000)
}

/** CSV escape + BOM สำหรับ Excel ภาษาไทย */
function csvEsc(v) {
  const s = String(v ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(csvEsc).join(',')).join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// ─── Enrichment ─────────────────────────────────────────────────────────────

/**
 * รับ policy row จาก Supabase + credit_days ของ agent_code
 * คืน object พร้อม computed fields ทั้งหมด
 */
function enrichPolicy(policy, creditDays) {
  const allInsts  = policy.installments ?? []
  const paidInsts = allInsts.filter(i => i.paid_at != null)
  const paidCount = paidInsts.length
  const totalInst = allInsts.length

  // ยอดที่เก็บได้จริง
  const totalPaid = paidInsts.reduce((s, i) => s + Number(i.paid_amount ?? 0), 0)

  // เงื่อนไข whitelist: จ่ายเต็ม หรือ จ่ายแล้ว ≥ 2 งวด
  const isFullPay  = policy.pay_mode === 'full'
                  || (totalInst > 0 && paidCount >= totalInst)
  const isEligible = isFullPay || paidCount >= 2

  // วันกำหนดส่ง = policy_start + credit_days (ไม่ใช่ fixed date)
  const remitDeadline = calcRemitDeadline(policy.policy_start, creditDays)

  const today     = new Date()
  today.setHours(0, 0, 0, 0)
  const isOverdue = remitDeadline ? today >= remitDeadline : false
  const daysLeft  = remitDeadline ? daysDiff(today, remitDeadline) : null

  // เคส Risk: ถึงกำหนดแล้ว แต่ลูกค้ายังไม่ผ่านเงื่อนไข
  const isRisk = isOverdue && !isEligible

  // Safety locks
  const payModeLower = (policy.pay_mode ?? '').toLowerCase()
  const coverageLower = (policy.coverage_type ?? '').toLowerCase()
  const isCreditCard  = payModeLower.includes('credit') || payModeLower.includes('บัตร')
  const isTravel      = coverageLower.includes('travel') || coverageLower.includes('เดินทาง')

  // Credit card: เตือนถ้าครบกำหนดวันนี้
  const todayDate = new Date(); todayDate.setHours(0,0,0,0)
  const deadlineDate = remitDeadline ? new Date(remitDeadline) : null
  if (deadlineDate) deadlineDate.setHours(0,0,0,0)
  const ccWarningToday = isCreditCard && deadlineDate &&
    deadlineDate.getTime() === todayDate.getTime()

  // Travel lock: ห้ามจ่ายจนกว่าจะถึงกำหนด
  const travelLocked = isTravel && !isOverdue

  return {
    ...policy,
    paidInsts,
    paidCount,
    totalInst,
    totalPaid,
    isFullPay,
    isEligible,
    remitDeadline,
    isOverdue,
    daysLeft,
    isRisk,
    isCreditCard,
    isTravel,
    ccWarningToday,
    travelLocked,
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function RemitPage() {
  const supabase = createClient()
  const [agentCodes, setAgentCodes] = useState([])
  const [selected,   setSelected]   = useState(null)
  const [policies,   setPolicies]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [loadingPol, setLoadingPol] = useState(false)
  const [tab,        setTab]        = useState('ready')

  useEffect(() => { loadCodes() }, [])
  useEffect(() => { if (selected) loadPolicies(selected) }, [selected])

  // ── Load agent codes ────────────────────────────────────────────────────
  async function loadCodes() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('agent_codes')
      .select('*, companies(name, color)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('code')

    setAgentCodes(data ?? [])
    if (data?.length) setSelected(data[0])
    setLoading(false)
  }

  // ── Load policies (1 กรมธรรม์ = 1 แถว) ─────────────────────────────────
  // ดึงจาก policies แล้วฝัง installments เข้ามา ไม่แยกแถวตามงวด
  async function loadPolicies(ac) {
    setLoadingPol(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('policies')
      .select(`
        id, policy_start, policy_end, premium, pay_mode, coverage_type,
        plate, model, policy_status,
        customers(name),
        installments(id, installment_no, paid_amount, amount_due, paid_at, due_date)
      `)
      .eq('agent_code', ac.code)
      .eq('user_id', user.id)
      .neq('policy_status', 'cancelled')
      .order('policy_start', { ascending: false })

    if (error) console.error('loadPolicies:', error)

    const enriched = (data ?? []).map(p => enrichPolicy(p, ac.credit_days ?? 15))
    setPolicies(enriched)
    setLoadingPol(false)
  }

  // ── Tab data ────────────────────────────────────────────────────────────
  // ✅ พร้อมนำส่ง: ผ่านเงื่อนไข + ถึงกำหนดแล้ว
  const ready = policies.filter(p => p.isEligible && p.isOverdue)
  // ⚠️ ต้องตัดสินใจ: ถึงกำหนดแล้ว แต่ยังไม่ผ่านเงื่อนไข
  const risk  = policies.filter(p => p.isRisk)
  // 📝 ตรวจสอบบิล: ทั้งหมด (รวมที่ยังไม่ถึงกำหนด)
  const all   = policies

  const displayed = tab === 'ready' ? ready
                  : tab === 'risk'  ? risk
                  : all

  const totalReady = ready.reduce((s, p) => s + p.totalPaid, 0)
  const totalRisk  = risk.reduce((s, p) => s + p.totalPaid, 0)
  const totalDisp  = displayed.reduce((s, p) => s + p.totalPaid, 0)

  // ── Safety alerts (global scan) ─────────────────────────────────────────
  const ccToday    = policies.filter(p => p.ccWarningToday)
  const travelLock = policies.filter(p => p.travelLocked)

  // ── Export helpers ──────────────────────────────────────────────────────

  /**
   * Format 1 — Remittance Advice
   * สำหรับโอนก้อนใหญ่ให้บริษัท แนบสลิป 1 ใบ
   */
  function exportRemittanceAdvice() {
    const rows = [
      ['📑 รายงานนำส่งเบี้ยประกัน (Remittance Advice)'],
      ['รหัสตัวแทน:', selected?.code ?? '', 'บริษัท:', selected?.companies?.name ?? ''],
      ['วันที่ Export:', new Date().toLocaleDateString('th-TH', { dateStyle:'long' })],
      ['เครดิตส่งเงิน:', `${selected?.credit_days ?? 15} วัน หลังวันเริ่มคุ้มครอง`],
      [],
      [
        'เลขกรมธรรม์', 'ชื่อลูกค้า', 'ประเภทประกัน', 'วิธีชำระ',
        'วันเริ่มคุ้มครอง', 'วันกำหนดส่ง',
        'งวดที่จ่ายแล้ว', 'งวดทั้งหมด', 'สถานะ',
        'ยอดนำส่งสุทธิ (บาท)',
      ],
      ...ready.map(p => [
        p.id,
        p.customers?.name ?? '',
        p.coverage_type ?? '',
        p.pay_mode ?? '',
        p.policy_start
          ? new Date(p.policy_start).toLocaleDateString('th-TH')
          : '',
        p.remitDeadline
          ? p.remitDeadline.toLocaleDateString('th-TH')
          : '',
        p.paidCount,
        p.totalInst,
        p.isFullPay ? 'จ่ายเต็ม' : `ผ่อน ${p.paidCount} งวด`,
        p.totalPaid,
      ]),
      [],
      ['', '', '', '', '', '', '', '', 'รวมทั้งหมด', totalReady],
      ['', '', '', '', '', '', '', '', 'จำนวนกรมธรรม์', ready.length],
      [],
      ['หมายเหตุ:', 'โอนก้อนเดียว', 'แนบ:', 'สลิปโอนเงิน 1 ใบ'],
    ]
    downloadCSV(`remittance_${selected?.code}_${todayStr()}.csv`, rows)
  }

  /**
   * Format 2 — แจ้งงานด่วน (ลูกค้าโอนตรงบริษัท)
   * ไม่มีเงินผ่านมือเรา แค่ส่งหลักฐานให้บริษัทตัดหนี้
   * แนะนำ: zip สลิป 1 โฟลเดอร์ / 1 กรมธรรม์
   */
  function exportDirectPayNotification() {
    const rows = [
      ['📑 รายการแจ้งงานด่วน — ลูกค้าโอนตรงบริษัท'],
      ['รหัสตัวแทน:', selected?.code ?? '', 'บริษัท:', selected?.companies?.name ?? ''],
      ['วันที่:', new Date().toLocaleDateString('th-TH', { dateStyle:'long' })],
      [],
      ['⚠️ วิธีจัดสลิป:', '1 โฟลเดอร์ต่อ 1 กรมธรรม์ (ชื่อโฟลเดอร์ = เลขกรมธรรม์)', 'รวมสลิปทุกงวดไว้ข้างใน', 'ZIP แล้วส่งพร้อมไฟล์นี้'],
      [],
      [
        'เลขกรมธรรม์', 'ชื่อลูกค้า', 'ประเภทประกัน',
        'ยอดรวม (บาท)', 'งวดที่ชำระ', 'วันที่ชำระล่าสุด',
        'ชื่อโฟลเดอร์สลิป', 'หมายเหตุ',
      ],
      ...ready.map(p => {
        const lastPaid = p.paidInsts
          .filter(i => i.paid_at)
          .sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))[0]
        const instNos = p.paidInsts
          .sort((a, b) => a.installment_no - b.installment_no)
          .map(i => `งวด ${i.installment_no}`)
          .join(', ')
        return [
          p.id,
          p.customers?.name ?? '',
          p.coverage_type ?? '',
          p.totalPaid,
          instNos,
          lastPaid?.paid_at
            ? new Date(lastPaid.paid_at).toLocaleDateString('th-TH')
            : '',
          p.id,   // ชื่อโฟลเดอร์ = เลขกรมธรรม์
          p.isFullPay ? 'จ่ายเต็ม — ปลอดภัย 100%' : `ผ่อน ${p.paidCount}/${p.totalInst} งวด`,
        ]
      }),
      [],
      ['', '', '', totalReady, '', '', '', `รวม ${ready.length} กรมธรรม์`],
    ]
    downloadCSV(`direct_notify_${selected?.code}_${todayStr()}.csv`, rows)
  }

  /**
   * Format 3 — กระทบยอดภายใน (Internal Reconciliation)
   * Raw data ครบ สำหรับ VLOOKUP เทียบ Statement จากบริษัท
   */
  function exportReconciliation() {
    const rows = [
      ['📑 ข้อมูลกระทบยอดภายใน (Internal Reconciliation)'],
      ['รหัสตัวแทน:', selected?.code ?? '', 'บริษัท:', selected?.companies?.name ?? ''],
      ['วันที่ Export:', new Date().toLocaleDateString('th-TH', { dateStyle:'long' })],
      ['วิธีใช้:', 'นำไป VLOOKUP เทียบ Statement ที่บริษัทส่งมาสิ้นเดือน'],
      [],
      [
        'เลขกรมธรรม์', 'ชื่อลูกค้า', 'ประเภท', 'วิธีชำระ',
        'วันเริ่มคุ้มครอง', 'วันสิ้นสุด', 'กำหนดส่งเงิน',
        'เบี้ยรวม (บาท)', 'ยอดเก็บได้ (บาท)',
        'งวดที่จ่าย', 'งวดทั้งหมด', 'ผ่านเงื่อนไข',
        'สถานะกรมธรรม์', 'สถานะความเสี่ยง',
        'หมายเหตุ',
      ],
      ...all.map(p => {
        const status = p.isRisk
          ? '⚠️ เสี่ยง/ต้องสำรองเงิน'
          : (p.isEligible && p.isOverdue)
            ? '✅ พร้อมนำส่ง'
            : p.isEligible
              ? '🕐 รอถึงกำหนด'
              : '🔴 ยังไม่ผ่านเงื่อนไข'
        const flags = [
          p.isCreditCard ? '💳 บัตรเครดิต' : '',
          p.isTravel     ? '✈️ Travel' : '',
          p.travelLocked ? '🔒 ล็อคไว้' : '',
        ].filter(Boolean).join(' | ')

        return [
          p.id,
          p.customers?.name ?? '',
          p.coverage_type ?? '',
          p.pay_mode ?? '',
          p.policy_start ? new Date(p.policy_start).toLocaleDateString('th-TH') : '',
          p.policy_end   ? new Date(p.policy_end).toLocaleDateString('th-TH')   : '',
          p.remitDeadline ? p.remitDeadline.toLocaleDateString('th-TH') : '',
          p.premium ?? '',
          p.totalPaid,
          p.paidCount,
          p.totalInst,
          p.isEligible ? 'ผ่าน' : 'ไม่ผ่าน',
          p.policy_status ?? '',
          status,
          flags,
        ]
      }),
      [],
      ['', '', '', '', '', '', '',
        all.reduce((s, p) => s + Number(p.premium ?? 0), 0),
        all.reduce((s, p) => s + p.totalPaid, 0),
        '', '', '', '', `รวม ${all.length} กรมธรรม์`, ''],
    ]
    downloadCSV(`reconciliation_${selected?.code}_${todayStr()}.csv`, rows)
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <header style={{
        display:'flex', alignItems:'center', gap:12,
        padding:'14px 28px', background:'#fff',
        borderBottom:'1px solid #e5eaf1',
        position:'sticky', top:0, zIndex:20,
      }}>
        <span style={{ fontSize:13, fontWeight:600 }}>กระเป๋าขวา — วางบิล / นำส่งบริษัท</span>
      </header>

      <div style={{ padding:'26px 32px' }}>
        <div className="ph">
          <div>
            <h1>กระเป๋าขวา — วางบิล</h1>
            <div className="sub">
              คำนวณวันส่งจาก <b>วันเริ่มคุ้มครอง + เครดิตส่งเงิน</b> ต่อกรมธรรม์ (ไม่ใช่ fixed date)
            </div>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:18 }}>

          {/* ── Agent code list ──────────────────────────────────────────── */}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{
              fontSize:11, fontWeight:600, color:'var(--muted)',
              textTransform:'uppercase', letterSpacing:.8, marginBottom:4,
            }}>
              รหัสตัวแทน
            </div>
            {loading ? (
              <div style={{ color:'var(--muted)', fontSize:13 }}>กำลังโหลด...</div>
            ) : agentCodes.length === 0 ? (
              <div style={{ color:'var(--muted)', fontSize:13 }}>ไม่มีรหัสตัวแทน</div>
            ) : agentCodes.map(ac => {
              const isOn = selected?.code === ac.code
              return (
                <button
                  key={ac.code}
                  onClick={() => setSelected(ac)}
                  style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'12px 14px', borderRadius:10,
                    cursor:'pointer', textAlign:'left',
                    border:`1px solid ${isOn ? 'var(--blue-500)' : 'var(--border)'}`,
                    background: isOn ? 'var(--blue-50)' : '#fff',
                    transition:'all .15s',
                  }}
                >
                  <span style={{
                    width:8, height:8, borderRadius:'50%',
                    background: ac.companies?.color ?? '#64748b',
                    flexShrink:0,
                  }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, fontFamily:'monospace' }}>
                      {ac.code}
                    </div>
                    <div style={{ fontSize:11, color:'var(--muted)', marginTop:1 }}>
                      {ac.companies?.name}
                    </div>
                    <div style={{ fontSize:10, color:'var(--muted)' }}>
                      เครดิต {ac.credit_days ?? 15} วัน
                    </div>
                  </div>
                  {isOn && <span style={{ color:'var(--blue-600)', fontSize:14 }}>→</span>}
                </button>
              )
            })}
          </div>

          {/* ── Right panel ───────────────────────────────────────────────── */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {!selected ? (
              <div className="empty">
                <div className="ei">{Icons.building}</div>
                เลือกรหัสตัวแทนทางซ้าย
              </div>
            ) : loadingPol ? (
              <div style={{ color:'var(--muted)', fontSize:13, padding:20 }}>
                กำลังโหลดกรมธรรม์...
              </div>
            ) : (
              <>
                {/* ── Summary card ──────────────────────────────────────── */}
                <div className="card" style={{ padding:20 }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:16 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                        <span style={{
                          width:10, height:10, borderRadius:'50%',
                          background: selected.companies?.color ?? '#64748b',
                        }} />
                        <span style={{ fontWeight:700, fontSize:16 }}>{selected.code}</span>
                        <span style={{ fontSize:12, color:'var(--muted)' }}>
                          {selected.companies?.name}
                        </span>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
                        <MiniKV
                          label="เครดิตส่งเงิน"
                          value={`${selected.credit_days ?? 15} วัน`}
                          sub="หลังวันเริ่มคุ้มครอง"
                        />
                        <MiniKV
                          label="✅ พร้อมนำส่ง"
                          value={`${ready.length} กรมธรรม์`}
                          valueColor="var(--green-700)"
                        />
                        <MiniKV
                          label="⚠️ ต้องตัดสินใจ"
                          value={`${risk.length} กรมธรรม์`}
                          valueColor={risk.length > 0 ? 'var(--amber-600)' : undefined}
                        />
                        <MiniKV
                          label="📊 ทั้งหมด"
                          value={`${all.length} กรมธรรม์`}
                        />
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:11, color:'var(--muted)' }}>ยอดพร้อมนำส่ง</div>
                      <div style={{
                        fontSize:28, fontWeight:700,
                        fontFeatureSettings:'"tnum"',
                        color:'var(--blue-700)',
                      }}>
                        {fmtB(totalReady)}
                      </div>
                      {risk.length > 0 && (
                        <div style={{ fontSize:12, color:'#d97706', marginTop:4, fontWeight:600 }}>
                          ⚠️ ต้องสำรอง {fmtB(totalRisk)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Safety Alerts ─────────────────────────────────────── */}
                {ccToday.length > 0 && (
                  <div
                    className="alert w"
                    style={{ background:'#fff7ed', borderColor:'#f97316', borderWidth:2 }}
                  >
                    {Icons.alert}
                    <div>
                      <b style={{ color:'#c2410c' }}>
                        ⚠️ ระวัง! บัตรเครดิต — ครบกำหนดโอนวันนี้
                      </b>
                      <div style={{ fontSize:12, marginTop:4 }}>
                        กรมธรรม์{' '}
                        <b>{ccToday.map(p => p.id).join(', ')}</b>
                        {' '}ชำระด้วยบัตรเครดิต และครบกำหนดส่งวันนี้
                        → หากโอนวันนี้จะถูกชาร์จ <b>2%</b> และงดค่าคอม
                      </div>
                    </div>
                  </div>
                )}

                {travelLock.length > 0 && (
                  <div className="alert i">
                    {Icons.shield}
                    <div>
                      <b>🔒 Travel Lock</b> — กรมธรรม์ประเภท Travel{' '}
                      {travelLock.length} รายการ ยังไม่ถึงกำหนดส่ง
                      <br/>
                      <span style={{ fontSize:12 }}>
                        ห้ามโอนก่อนวันกำหนดเด็ดขาด — รอจนถึงวันครบกำหนดของแต่ละกรมธรรม์
                      </span>
                    </div>
                  </div>
                )}

                {/* ── Export Panel ──────────────────────────────────────── */}
                <div className="card" style={{ padding:16 }}>
                  <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>
                    📥 Export ข้อมูลนำส่ง
                  </div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginBottom:12 }}>
                    เลือก format ให้ตรงกับสถานการณ์ที่จะส่ง
                  </div>
                  <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                    <ExportButton
                      emoji="📑"
                      label="Remittance Advice"
                      desc="โอนก้อนใหญ่ + สลิป 1 ใบ"
                      hint="ลูกค้าโอนผ่านตัวแทน"
                      color="#1e40af"
                      onClick={exportRemittanceAdvice}
                    />
                    <ExportButton
                      emoji="📑"
                      label="แจ้งงานด่วน"
                      desc="แนบสลิปลูกค้าต่อกรมธรรม์"
                      hint="ลูกค้าโอนตรงบริษัท"
                      color="#0369a1"
                      onClick={exportDirectPayNotification}
                    />
                    <ExportButton
                      emoji="📑"
                      label="กระทบยอดภายใน"
                      desc="Raw data ครบ VLOOKUP Statement"
                      hint="เช็กบิลสิ้นเดือน"
                      color="#6b21a8"
                      onClick={exportReconciliation}
                    />
                  </div>
                  <div style={{
                    fontSize:11, color:'var(--muted)', marginTop:12,
                    lineHeight:1.6, borderTop:'1px solid var(--border)', paddingTop:10,
                  }}>
                    <b>Format 1:</b> โอนก้อนเดียว + สลิป 1 ใบ &nbsp;·&nbsp;
                    <b>Format 2:</b> 1 โฟลเดอร์ต่อเลขกรมธรรม์ รวมสลิปทุกงวดไว้ข้างใน → ZIP ส่ง &nbsp;·&nbsp;
                    <b>Format 3:</b> เทียบ Statement สิ้นเดือน — มีรายการไหนเกิน/ขาด แย้งได้ทันที
                  </div>
                </div>

                {/* ── Status Tabs ───────────────────────────────────────── */}
                <div style={{ display:'flex', gap:6 }}>
                  {[
                    { key:'ready', label:'✅ พร้อมนำส่ง', count:ready.length,
                      activeColor:'#166534', activeBg:'#dcfce7' },
                    { key:'risk',  label:'⚠️ ต้องตัดสินใจ', count:risk.length,
                      activeColor:'#92400e', activeBg:'#fef3c7' },
                    { key:'recon', label:'📝 ตรวจสอบบิล', count:all.length,
                      activeColor:'#1e40af', activeBg:'#dbeafe' },
                  ].map(t => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      style={{
                        padding:'8px 18px', borderRadius:8,
                        cursor:'pointer', fontSize:13, fontWeight:600,
                        background: tab === t.key ? t.activeBg : '#f1f5f9',
                        color: tab === t.key ? t.activeColor : 'var(--muted)',
                        border: tab === t.key ? `1.5px solid ${t.activeColor}` : '1.5px solid transparent',
                        transition:'all .15s',
                      }}
                    >
                      {t.label} ({t.count})
                    </button>
                  ))}
                </div>

                {/* ── Table ─────────────────────────────────────────────── */}
                <div className="card">
                  <div className="card-h">
                    <h3 className="card-t">
                      {tab === 'ready'
                        ? 'กรมธรรม์พร้อมนำส่ง — ผ่านเงื่อนไข + ถึงกำหนดแล้ว'
                        : tab === 'risk'
                          ? 'ต้องตัดสินใจ — ถึงกำหนดแล้ว แต่ลูกค้ายังไม่ผ่านเงื่อนไข'
                          : 'ข้อมูลทั้งหมด (สำหรับกระทบยอด)'}
                    </h3>
                    <span className="card-s" style={{ marginLeft:'auto' }}>
                      {displayed.length} กรมธรรม์
                    </span>
                  </div>

                  {displayed.length === 0 ? (
                    <div className="empty">
                      <div className="ei">{Icons.wallet}</div>
                      ไม่มีรายการในหมวดนี้
                    </div>
                  ) : (
                    <>
                      <table className="data">
                        <thead>
                          <tr>
                            <th>กรมธรรม์</th>
                            <th>ลูกค้า</th>
                            <th>ประเภท</th>
                            <th>วิธีชำระ</th>
                            <th>งวดที่จ่าย</th>
                            <th>กำหนดส่ง</th>
                            <th>สถานะ</th>
                            <th style={{ textAlign:'right' }}>ยอดนำส่ง</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayed.map(p => (
                            <PolicyRow key={p.id} p={p} />
                          ))}
                        </tbody>
                      </table>

                      <div className="card-f" style={{
                        display:'flex', justifyContent:'space-between', alignItems:'center',
                      }}>
                        <span style={{ fontSize:13, color:'var(--muted)' }}>
                          {tab === 'ready'
                            ? `รวมยอดนำส่ง ${ready.length} กรมธรรม์`
                            : `รวม ${displayed.length} กรมธรรม์`}
                        </span>
                        <span style={{
                          fontSize:18, fontWeight:700,
                          fontFeatureSettings:'"tnum"',
                          color:'var(--blue-700)',
                        }}>
                          {fmtB(totalDisp)}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* ── Tab-specific hints ─────────────────────────────────── */}
                {tab === 'risk' && risk.length > 0 && (
                  <div className="alert w">
                    {Icons.alert}
                    <div>
                      <b>ต้องตัดสินใจ:</b> กรมธรรม์เหล่านี้ถึงกำหนดส่งบริษัทแล้ว
                      แต่ลูกค้าชำระยังไม่ถึง 2 งวด (และไม่ใช่จ่ายเต็ม)
                      <br/>
                      <span style={{ fontSize:12 }}>
                        → ถ้าจะส่ง: <b>สำรองเงินส่วนตัวก่อน</b> แล้วรอลูกค้าจ่ายงวดที่ 2
                        เพื่อไม่ให้กรมธรรม์ยกเลิกและเสียค่าปรับ
                      </span>
                    </div>
                  </div>
                )}

                {tab === 'recon' && (
                  <div className="alert i">
                    {Icons.shield}
                    <div>
                      <b>วิธีใช้ Format 3:</b> Export CSV → เปิดใน Excel
                      → VLOOKUP เทียบเลขกรมธรรม์กับ Statement ที่บริษัทส่งมาสิ้นเดือน
                      <br/>
                      <span style={{ fontSize:12 }}>
                        ถ้ารายการไหนโผล่มาเกินหรือขาด → แย้งบริษัทได้ทันที
                        พร้อมข้อมูลวันคุ้มครอง วันกำหนดส่ง และยอดที่ควรจะเป็น
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PolicyRow({ p }) {
  return (
    <tr style={{ opacity: p.travelLocked ? .65 : 1 }}>
      <td>
        <code style={{ fontSize:11, color:'var(--blue-700)' }}>{p.id}</code>
        {p.isCreditCard && (
          <span style={{
            marginLeft:4, fontSize:10,
            background:'#fee2e2', color:'#991b1b',
            padding:'1px 5px', borderRadius:4,
          }}>
            💳
          </span>
        )}
        {p.travelLocked && (
          <span style={{
            marginLeft:4, fontSize:10,
            background:'#fef3c7', color:'#92400e',
            padding:'1px 5px', borderRadius:4,
          }}>
            🔒 Travel
          </span>
        )}
      </td>
      <td style={{ fontSize:13 }}>{p.customers?.name}</td>
      <td><span className="badge b-bl">{p.coverage_type}</span></td>
      <td style={{ fontSize:12, color:'var(--muted)' }}>{p.pay_mode ?? '—'}</td>
      <td>
        <span style={{
          fontSize:12, fontWeight:600,
          color: p.paidCount >= 2 || p.isFullPay
            ? 'var(--green-600)'
            : 'var(--amber-600)',
        }}>
          {p.paidCount}/{p.totalInst}
        </span>
        {p.isFullPay && (
          <span style={{
            marginLeft:4, fontSize:10,
            background:'#dcfce7', color:'#166534',
            padding:'1px 5px', borderRadius:4,
          }}>
            เต็ม
          </span>
        )}
      </td>
      <td style={{ fontSize:12 }}>
        {p.remitDeadline ? (
          <span style={{ color: p.isOverdue ? '#dc2626' : 'var(--muted)' }}>
            {p.remitDeadline.toLocaleDateString('th-TH', { day:'numeric', month:'short' })}
            {' '}
            {p.isOverdue
              ? <b>(เกินกำหนด)</b>
              : p.daysLeft != null
                ? `(${p.daysLeft} ว.)`
                : ''}
          </span>
        ) : '—'}
      </td>
      <td>
        {p.isRisk ? (
          <span style={{
            fontSize:11, fontWeight:600,
            background:'#fef3c7', color:'#92400e',
            padding:'2px 8px', borderRadius:6,
          }}>
            ⚠️ เสี่ยง
          </span>
        ) : p.isEligible && p.isOverdue ? (
          <span style={{
            fontSize:11, fontWeight:600,
            background:'#dcfce7', color:'#166534',
            padding:'2px 8px', borderRadius:6,
          }}>
            ✅ ส่งได้
          </span>
        ) : p.isEligible ? (
          <span style={{
            fontSize:11,
            background:'#f1f5f9', color:'var(--muted)',
            padding:'2px 8px', borderRadius:6,
          }}>
            🕐 รอถึงกำหนด
          </span>
        ) : (
          <span style={{
            fontSize:11,
            background:'#fff1f2', color:'#be123c',
            padding:'2px 8px', borderRadius:6,
          }}>
            ยังไม่ผ่าน
          </span>
        )}
      </td>
      <td className="tnum" style={{ textAlign:'right', fontWeight:600 }}>
        {fmtB(p.totalPaid)}
      </td>
    </tr>
  )
}

function MiniKV({ label, value, sub, valueColor }) {
  return (
    <div style={{ background:'var(--slate-50)', borderRadius:8, padding:'10px 12px' }}>
      <div className="kv" style={{ fontSize:10 }}>{label}</div>
      <div style={{
        fontWeight:600, fontSize:14, marginTop:3,
        color: valueColor ?? 'inherit',
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>{sub}</div>
      )}
    </div>
  )
}

function ExportButton({ emoji, label, desc, hint, color, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display:'flex', flexDirection:'column', gap:3,
        padding:'12px 16px', borderRadius:8,
        cursor:'pointer', textAlign:'left',
        background: color, color:'#fff', border:'none',
        minWidth:170, transition:'opacity .15s',
      }}
      onMouseOver={e => e.currentTarget.style.opacity = '.85'}
      onMouseOut={e  => e.currentTarget.style.opacity = '1'}
    >
      <span style={{ fontSize:13, fontWeight:700 }}>{emoji} {label}</span>
      <span style={{ fontSize:11, opacity:.9 }}>{desc}</span>
      <span style={{ fontSize:10, opacity:.65, marginTop:2 }}>ใช้เมื่อ: {hint}</span>
    </button>
  )
}