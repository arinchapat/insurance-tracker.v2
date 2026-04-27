'use client'
// Single payment-recording UI. Used by /collect and /policies/[id].
// All payment writes go through recordPayment in lib/domains/payment.

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { recordPayment } from '@/lib/domains/payment/service'
import { PAYMENT_CHANNELS } from '@/lib/domains/payment/types'

const fmtB = n => Number(n || 0).toLocaleString('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export default function PaymentForm({ installment, policy, summary, onClose, onSaved }) {
  const supabase  = createClient()
  const remaining = Math.max(summary.totalPremium - summary.totalPaid, 0)
  const isOverpaid = remaining <= 0

  const [amount, setAmount]     = useState(
    isOverpaid ? 0 : Math.min(Number(installment.amount_due ?? 0), remaining)
  )
  const [channel, setChannel]   = useState('insurer_transfer')
  const [slipFile, setSlipFile] = useState(null)
  const [slipPreview, setSlipPreview] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)

  const amountNum = Number(amount) || 0
  const afterPay  = summary.totalPaid + amountNum
  const pctAfter  = Math.min((afterPay / summary.totalPremium) * 100, 100)

  function pickSlip(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setSlipFile(file)
    setSlipPreview(URL.createObjectURL(file))
    setError(null)
  }

  async function confirm() {
    setError(null)
    if (!(amountNum > 0))                { setError('กรุณากรอกยอดชำระ'); return }
    if (amountNum > remaining + 0.001)   { setError(`ยอดเกินคงเหลือ ${fmtB(remaining)} บาท`); return }
    setSaving(true)
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) throw new Error('ไม่ได้ล็อกอิน')
      await recordPayment(supabase, {
        installmentId: installment.id,
        userId:        user.id,
        amount:        amountNum,
        channel,
        file:          slipFile,
      })
      onSaved?.()
    } catch (err) {
      setError(err.message ?? 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div onClick={onClose} style={S.backdrop}>
      <div onClick={e => e.stopPropagation()} style={S.modal}>
        <header style={S.header}>
          <div>
            <h2 style={S.title}>รับชำระงวด {installment.installment_no}/{installment.total_inst}</h2>
            <p style={S.subtitle}>{policy?.id}</p>
          </div>
          <button onClick={onClose} style={S.closeBtn}>✕</button>
        </header>

        <div style={S.body}>
          {policy?.customers && (
            <div style={S.customer}>
              <div style={S.avatar}>👤</div>
              <div>
                <div style={S.custName}>{policy.customers.name}</div>
                <div style={S.custPhone}>{policy.customers.phone}</div>
              </div>
            </div>
          )}

          <div style={isOverpaid ? S.balanceOver : S.balanceOk}>
            <div style={isOverpaid ? S.balanceLabelOver : S.balanceLabelOk}>
              {isOverpaid ? '⚠️ ชำระครบแล้ว' : '📊 ยอดคงเหลือ'}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
              <Cell label="เบี้ยรวม" val={fmtB(summary.totalPremium)} color="#374151" />
              <Cell label="ชำระแล้ว" val={fmtB(summary.totalPaid)}    color="#15803d" />
              <Cell label="คงเหลือ"  val={fmtB(remaining)}             color="#1e40af" />
            </div>
            <div style={S.progressOuter}>
              <div style={{
                ...S.progressInner,
                width: `${Math.min((summary.totalPaid / summary.totalPremium) * 100, 100)}%`,
              }} />
            </div>
          </div>

          {!isOverpaid && (
            <>
              <Field label={`ยอดชำระ (บาท) · คงเหลือ ${fmtB(remaining)}`}>
                <input
                  type="number"
                  value={amount}
                  onChange={e => { setAmount(e.target.value); setError(null) }}
                  style={{ ...S.amountInput, borderColor: error ? '#f59e0b' : '#2563eb' }}
                />
                {amountNum > 0 && !error && (
                  <Hint>หลังชำระ: {fmtB(afterPay)} / {fmtB(summary.totalPremium)} ({Math.round(pctAfter)}%)</Hint>
                )}
              </Field>

              <Field label="ช่องทางชำระ">
                <select value={channel} onChange={e => setChannel(e.target.value)} style={S.select}>
                  {PAYMENT_CHANNELS.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="แนบสลิป (ไม่บังคับ)">
                {slipPreview ? (
                  <div style={{ position:'relative', display:'inline-block' }}>
                    <img src={slipPreview} alt="slip" style={S.slipImg} />
                    <button
                      onClick={() => { setSlipFile(null); setSlipPreview(null) }}
                      style={S.slipRemove}
                    >✕</button>
                  </div>
                ) : (
                  <label style={S.slipPicker}>
                    <span style={{ fontSize:20 }}>📎</span>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:'#374151' }}>เลือกรูปสลิป</div>
                      <div style={{ fontSize:11, color:'#94a3b8' }}>JPG / PNG / PDF · ไม่เกิน 10 MB</div>
                    </div>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={pickSlip}
                      style={{ display:'none' }}
                    />
                  </label>
                )}
              </Field>

              {error && <div style={S.error}>{error}</div>}
            </>
          )}
        </div>

        <footer style={S.footer}>
          <button onClick={onClose} style={S.cancelBtn}>ยกเลิก</button>
          {isOverpaid ? (
            <button onClick={onClose} style={S.disabledBtn}>ชำระครบแล้ว</button>
          ) : (
            <button
              onClick={confirm}
              disabled={saving || amountNum <= 0}
              style={{
                ...S.confirmBtn,
                background: (saving || amountNum <= 0) ? '#94a3b8' : '#0f172a',
                cursor:     (saving || amountNum <= 0) ? 'default' : 'pointer',
              }}
            >
              {saving ? 'กำลังบันทึก...' : `✓ ยืนยัน ${fmtB(amountNum)} บาท`}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}

function Cell({ label, val, color }) {
  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:10, color:'#64748b', marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:700, color, fontFamily:'monospace' }}>{val}</div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:6 }}>{label}</label>
      {children}
    </div>
  )
}

function Hint({ children }) {
  return (
    <div style={{ marginTop:8, padding:'8px 12px', borderRadius:8, background:'#eff6ff', border:'1px solid #bfdbfe', fontSize:12, color:'#1e40af' }}>
      {children}
    </div>
  )
}

const S = {
  backdrop:  { position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center' },
  modal:     { background:'#fff', borderRadius:16, width:460, maxWidth:'94%', boxShadow:'0 25px 60px rgba(0,0,0,.25)', overflow:'hidden', maxHeight:'90vh', overflowY:'auto' },
  header:    { padding:'20px 24px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' },
  title:     { fontSize:16, fontWeight:800, color:'#0f172a', margin:0 },
  subtitle:  { fontSize:12, color:'#94a3b8', marginTop:3, marginBottom:0 },
  closeBtn:  { width:32, height:32, borderRadius:8, border:'1px solid #e2e8f0', background:'#f8fafc', cursor:'pointer' },
  body:      { padding:'20px 24px', display:'flex', flexDirection:'column', gap:16 },
  customer:  { background:'#f8fafc', borderRadius:10, padding:'12px 16px', display:'flex', gap:12, alignItems:'center' },
  avatar:    { width:40, height:40, borderRadius:10, background:'#e0e7ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 },
  custName:  { fontWeight:700, fontSize:14, color:'#0f172a' },
  custPhone: { fontSize:12, color:'#64748b' },
  balanceOk:    { background:'#f0fdf4', borderRadius:10, padding:'14px 16px', border:'1px solid #bbf7d0' },
  balanceOver:  { background:'#fce7f3', borderRadius:10, padding:'14px 16px', border:'1px solid #fbcfe8' },
  balanceLabelOk:   { fontSize:12, fontWeight:700, color:'#15803d', marginBottom:10 },
  balanceLabelOver: { fontSize:12, fontWeight:700, color:'#9d174d', marginBottom:10 },
  progressOuter: { marginTop:12, height:6, background:'#e2e8f0', borderRadius:99, overflow:'hidden' },
  progressInner: { height:'100%', background:'#22c55e' },
  amountInput: { width:'100%', fontSize:24, fontWeight:800, textAlign:'center', padding:14, borderRadius:10, border:'2px solid #2563eb', outline:'none', boxSizing:'border-box', fontFamily:'monospace' },
  select:     { width:'100%', padding:'10px 12px', borderRadius:8, border:'1.5px solid #e2e8f0', fontSize:14, background:'#fff' },
  slipImg:    { width:'100%', maxHeight:200, objectFit:'contain', borderRadius:8, border:'1px solid #e2e8f0' },
  slipRemove: { position:'absolute', top:6, right:6, width:24, height:24, borderRadius:'50%', background:'#ef4444', border:'none', color:'#fff', cursor:'pointer' },
  slipPicker: { display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderRadius:10, border:'2px dashed #d1d5db', cursor:'pointer', background:'#f9fafb' },
  error:      { padding:'10px 14px', borderRadius:8, background:'#fef9c3', border:'1px solid #fde68a', fontSize:12, color:'#92400e', fontWeight:600 },
  footer:     { padding:'0 24px 20px', display:'flex', gap:10 },
  cancelBtn:  { flex:1, padding:12, borderRadius:10, border:'1.5px solid #e2e8f0', background:'#fff', fontSize:13, fontWeight:600, color:'#374151', cursor:'pointer' },
  disabledBtn:{ flex:2, padding:12, borderRadius:10, border:'none', background:'#f3f4f6', color:'#6b7280', fontSize:13, fontWeight:600 },
  confirmBtn: { flex:2, padding:12, borderRadius:10, border:'none', color:'#fff', fontSize:13, fontWeight:700 },
}
