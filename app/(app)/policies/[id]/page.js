'use client'
// app/(app)/policies/[id]/page.js
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Icons, fmtB, fmtDate } from '@/components/ui/Icons'
import { getInstallmentStatus, STATUS_LABEL } from '@/lib/domain/installment'

// --- Helper: Regex Extractors ---
function parsePolicyNotes(rawNotes) {
  if (!rawNotes) return { realPolicyNo: null, docPath: null, cleanNotes: '' }

  const policyNoMatch = rawNotes.match(/\[policy_no:(.*?)\]/) 
  const docMatch = rawNotes.match(/\[doc:(.*?)\]/) 
  
  const cleanNotes = rawNotes.replace(/\[.*?\]/g, '').trim()

  return {
    realPolicyNo: policyNoMatch ? policyNoMatch[1].trim() : null,
    docPath: docMatch ? docMatch[1].trim() : null,
    cleanNotes
  }
}

// --- Helper: Remittance Due Calculation ---
function calculateRemittanceDue(policyStart, billCycleDay, creditDays) {
  if (!policyStart || !billCycleDay || !creditDays) return null
  const start = new Date(policyStart)
  let billDate = new Date(start.getFullYear(), start.getMonth(), billCycleDay)
  
  if (start.getDate() > billCycleDay) {
    billDate.setMonth(billDate.getMonth() + 1)
  }
  billDate.setDate(billDate.getDate() + creditDays)
  return billDate.toISOString()
}

export default function PolicyDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [policy, setPolicy] = useState(null)
  const [ac, setAc] = useState(null)
  const [insts, setInsts] = useState([])
  const [parsedNotes, setParsedNotes] = useState({ realPolicyNo: null, docPath: null, cleanNotes: '' })
  const [remittanceDue, setRemittanceDue] = useState(null)
  const [loading, setLoading] = useState(true)

  const [payModal, setPayModal] = useState(null)
  const [delModal, setDelModal] = useState(false)

  // Viewer State 
  const [viewerPath, setViewerPath] = useState(null)
  const [viewerUrl, setViewerUrl] = useState(null)
  const [viewerType, setViewerType] = useState('doc') 
  const [viewerLoading, setViewerLoading] = useState(false)

  useEffect(() => { load() }, [id])

  // ดึง Signed URL อัตโนมัติเมื่อกำหนด viewerPath
  useEffect(() => {
    async function fetchSignedUrl() {
      if (!viewerPath) {
        setViewerUrl(null)
        return
      }
      setViewerLoading(true)
      const { data, error } = await supabase.storage.from('policy-docs').createSignedUrl(viewerPath, 60 * 60)
      if (error) console.error("Error loading document:", error)
      setViewerUrl(data?.signedUrl || null)
      setViewerLoading(false)
    }
    fetchSignedUrl()
  }, [viewerPath])

  async function load() {
    setLoading(true)
    const [{ data: pol }, { data: ins }] = await Promise.all([
      supabase.from('policies')
        .select('*, customers(id, name, phone), companies(name, color)')
        .eq('id', id).single(),
      supabase.from('installments')
        .select('*')
        .eq('policy_id', id)
        .order('installment_no'),
    ])
    setPolicy(pol)
    setInsts(ins ?? [])

    let fetchedAc = null
    if (pol?.agent_code) {
      const { data: acData } = await supabase
        .from('agent_codes').select('*').eq('code', pol.agent_code).maybeSingle()
      fetchedAc = acData ?? null
      setAc(fetchedAc)
    }

    if (pol) {
      const parsed = parsePolicyNotes(pol.notes)
      setParsedNotes(parsed)

      if (fetchedAc) {
        const due = calculateRemittanceDue(pol.policy_start, fetchedAc.bill_cycle_day, fetchedAc.credit_days)
        setRemittanceDue(due)
      }
    }
    setLoading(false)
  }

  async function deletePolicy() {
    await supabase.from('policies').delete().eq('id', id)
    router.push('/policies')
  }

  if (loading) return <div style={{ padding: 32 }}>กำลังโหลด...</div>
  if (!policy) return <div style={{ padding: 32 }}>ไม่พบกรมธรรม์</div>

  const paidCount = insts.filter(i => i.paid_amount > 0).length
  const paidTotal = insts.filter(i => i.paid_amount > 0).reduce((s, i) => s + Number(i.paid_amount), 0)
  const remaining = Number(policy.premium) - paidTotal

  const isPolicyActive = !['cancelled', 'dropped', 'expired', 'void'].includes(policy.policy_status?.toLowerCase())

  const statusColors = {
    active: { bg: '#f0fdf4', color: '#15803d', dot: '#22c55e' },
    overdue: { bg: '#fef2f2', color: '#b91c1c', dot: '#ef4444' },
    cancelled: { bg: '#f8fafc', color: '#475569', dot: '#94a3b8' },
    dropped: { bg: '#f8fafc', color: '#475569', dot: '#94a3b8' },
    expired: { bg: '#f8fafc', color: '#475569', dot: '#94a3b8' },
  }
  const sc = statusColors[policy.policy_status?.toLowerCase()] ?? statusColors.active
  
  // ลอจิกทะเบียน
  const dbPlate = (`${policy.plate || ''} ${policy.plate_province || ''}`).trim()
  const finalPlate = dbPlate || policy.model || 'ไม่ระบุทะเบียน'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 28px', background: '#fff', borderBottom: '1px solid #e5eaf1', zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
          <Link href="/policies" style={{ color: 'var(--muted)', textDecoration: 'none' }}>กรมธรรม์</Link>
          <span>/</span>
          <code style={{ color: 'var(--text)', fontWeight: 600, fontSize: 12 }}>{policy.id}</code>
        </div>
        <div style={{ flex: 1 }} />
        
        {/* เพิ่มปุ่ม แก้ไขข้อมูลกรมธรรม์ */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href={`/policies/${policy.id}/edit`} className="btn sec sm">
            ✏️ แก้ไข
          </Link>
          <button className="btn dng sm" onClick={() => setDelModal(true)}>{Icons.trash} ลบ</button>
        </div>
      </header>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: viewerPath ? '60% 40%' : '1fr', 
        flex: 1, 
        overflow: 'hidden',
        transition: 'grid-template-columns 0.3s ease-in-out'
      }}>
        
        {/* ⬅️ LEFT COLUMN */}
        <div style={{ padding: '26px 32px', overflowY: 'auto', background: '#f8fafc' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: viewerPath ? 'none' : '1000px', margin: viewerPath ? '0' : '0 auto' }}>

            <div className="card" style={{ padding: 24, background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span className="badge b-bl">{policy.coverage_type}</span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                      background: sc.bg, color: sc.color,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot }} />
                      {policy.policy_status}
                    </span>
                  </div>
                  <h2 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>{finalPlate}</h2>
                  
                  <div style={{ color: 'var(--text)', fontSize: 15, marginTop: 6, fontWeight: 500 }}>
                    เลขกรมธรรม์: {parsedNotes.realPolicyNo ? (
                      <span style={{ color: 'var(--blue-700)' }}>{parsedNotes.realPolicyNo}</span>
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>อยู่ระหว่างดำเนินการออกเลข</span>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>(Ref: {policy.id})</span>
                  </div>

                  {/* ปุ่มเปิดดูเอกสาร (แสดงเมื่อมี docPath) */}
                  {parsedNotes.docPath && (
                    <button 
                      className="btn sm" 
                      onClick={() => { setViewerPath(parsedNotes.docPath); setViewerType('doc'); }} 
                      style={{ marginTop: 12, background: '#f1f5f9', border: '1px solid #cbd5e1' }}
                    >
                      📄 เปิดดูหน้าตารางกรมธรรม์
                    </button>
                  )}
                </div>
              </div>

              <div className="hrlight" style={{ margin: '20px 0' }} />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
                <KV label="บริษัทประกัน" value={policy.companies?.name} />
                <KV label="วันเริ่มคุ้มครอง" value={fmtDate(policy.policy_start)} />
                <KV label="วันสิ้นสุด" value={fmtDate(policy.policy_end)} />
                <KV label="รหัสตัวแทน" value={policy.agent_code} mono />
                <KV label="วิธีชำระเงิน" value={policy.pay_mode === 'installment' ? `ผ่อน ${insts.length} งวด` : 'เงินสด'} />
                
                <div style={{ background: '#fefce8', padding: '10px 14px', borderRadius: 8, border: '1px solid #fef08a' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#ca8a04', marginBottom: 4 }}>กำหนดเคลียร์ดีลบริษัท (Remittance)</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#854d0e' }}>
                    {remittanceDue ? fmtDate(remittanceDue) : '—'}
                  </div>
                </div>
              </div>

              {parsedNotes.cleanNotes && (
                <div className="alert i" style={{ marginTop: 20 }}>
                  {Icons.doc}
                  <div>{parsedNotes.cleanNotes}</div>
                </div>
              )}
            </div>

            <div className="card" style={{ padding: 20, background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>ข้อมูลลูกค้า</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{policy.customers?.name}</div>
                  {policy.customers?.phone && (
                    <a href={`tel:${policy.customers.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)', textDecoration: 'none', fontSize: 14 }}>
                      {Icons.phone} {policy.customers.phone}
                    </a>
                  )}
                </div>
              </div>
              <Link href={`/customers/${policy.customers?.id}`} className="btn sec sm">
                ดูโปรไฟล์ลูกค้า →
              </Link>
            </div>

            <div className="card" style={{ background: '#fff' }}>
              <div className="card-h" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <h3 className="card-t" style={{ fontSize: 16 }}>ตารางคุมชำระเงิน</h3>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                    {paidCount}/{insts.length || 1} งวด · ชำระแล้ว <span style={{ color: 'var(--green-600)', fontWeight: 600 }}>{fmtB(paidTotal)}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>เบี้ยรวม (Total Premium)</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFeatureSettings: '"tnum"' }}>{fmtB(policy.premium)}</div>
                  {remaining > 0 && <div style={{ fontSize: 12, color: 'var(--red-600)', fontWeight: 600 }}>ค้างชำระ {fmtB(remaining)}</div>}
                </div>
              </div>

              <table className="data" style={{ width: '100%' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ paddingLeft: 24 }}>งวดที่</th>
                    <th>ครบกำหนด</th>
                    <th style={{ textAlign: 'right' }}>ยอดชำระ</th>
                    <th>สถานะ</th>
                    <th style={{ textAlign: 'center', paddingRight: 24 }}>จัดการ / สลิป</th>
                  </tr>
                </thead>
                <tbody>
                  {insts.length === 0 ? (
                    ['cash', 'full'].includes(policy.pay_mode?.toLowerCase()) ? (
                      <tr key="full-pay">
                        <td style={{ fontWeight: 600, paddingLeft: 24 }}>ชำระเต็มจำนวน</td>
                        <td style={{ color: 'var(--muted)', fontSize: 13 }}>{fmtDate(policy.policy_start)}</td>
                        <td className="tnum" style={{ textAlign: 'right', fontWeight: 600 }}>{fmtB(policy.premium)}</td>
                        <td>
                          <span className="badge b-am"><span className="dot" />รอชำระเงิน</span>
                        </td>
                        <td style={{ textAlign: 'center', paddingRight: 24 }}>
                          {isPolicyActive ? (
                            <button 
                              className="btn ok sm" 
                              onClick={() => setPayModal({ isNewFullPayment: true, amount_due: policy.premium, installment_no: 1, total_inst: 1 })} 
                              style={{ width: '100%', justifyContent: 'center' }}
                            >
                              ➕ รับชำระ
                            </button>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>ไม่อนุญาต</span>
                          )}
                        </td>
                      </tr>
                    ) : (
                      <tr><td colSpan={5}><div className="empty">ไม่มีข้อมูลการแบ่งชำระ</div></td></tr>
                    )
                  ) : insts.map(inst => {
                    const status = getInstallmentStatus(inst, ac)
                    const isPaid = inst.paid_amount > 0
                    const hasSlip = !!inst.slip_url

                    return (
                      <tr key={inst.id}>
                        <td style={{ fontWeight: 600, paddingLeft: 24 }}>
                          {inst.total_inst === 1 ? 'ชำระเต็มจำนวน' : `งวด ${inst.installment_no}/${inst.total_inst}`}
                        </td>
                        <td style={{ color: 'var(--muted)', fontSize: 13 }}>{fmtDate(inst.due_date)}</td>
                        <td className="tnum" style={{ textAlign: 'right', fontWeight: 600 }}>{fmtB(inst.amount_due)}</td>
                        <td>
                          <span className={`badge ${isPaid ? 'b-gr' : status === 'overdue' || status === 'critical' ? 'b-rd' : status === 'due' || status === 'prep' ? 'b-am' : 'b-sl'}`}>
                            <span className="dot" />
                            {isPaid ? 'ชำระแล้ว' : STATUS_LABEL[status] ?? status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', paddingRight: 24 }}>
                          {!isPaid ? (
                            isPolicyActive ? (
                              <button className="btn ok sm" onClick={() => setPayModal(inst)} style={{ width: '100%', justifyContent: 'center' }}>
                                ➕ รับชำระ
                              </button>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--muted)' }}>ไม่อนุญาต (ยกเลิกแล้ว)</span>
                            )
                          ) : hasSlip ? (
                            <button 
                              className="btn sm" 
                              style={{ width: '100%', justifyContent: 'center', background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}
                              onClick={() => {
                                setViewerPath(inst.slip_url)
                                setViewerType('slip')
                              }}
                            >
                              👁️ ดูสลิป
                            </button>
                          ) : (
                            <button 
                              className="btn sm" 
                              style={{ width: '100%', justifyContent: 'center', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}
                              onClick={() => setPayModal(inst)}
                            >
                              ➕ แนบสลิปย้อนหลัง
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

          </div>
        </div>

        {/* ➡️ RIGHT COLUMN: Document & Slip Viewer */}
        {viewerPath && (
          <div style={{ background: '#e2e8f0', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #cbd5e1' }}>
            
            <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {viewerType === 'doc' ? '📄 เอกสารกรมธรรม์' : '🧾 หลักฐานการโอนเงิน (Slip)'}
              </div>
              
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {viewerUrl && (
                  <>
                    <a href={viewerUrl} download className="btn sec sm" title="ดาวน์โหลด">📥 โหลด</a>
                    <a href={viewerUrl} target="_blank" rel="noreferrer" className="btn sec sm" title="เปิดแท็บใหม่">↗️ เต็มจอ</a>
                  </>
                )}
                <button 
                  className="btn sm" 
                  onClick={() => setViewerPath(null)} 
                  style={{ background: '#fee2e2', color: '#991b1b', border: 'none', marginLeft: 8 }}
                >
                  ✖ ปิด
                </button>
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', background: '#cbd5e1' }}>
              {viewerLoading ? (
                <div style={{ color: '#475569', fontSize: 14 }}>กำลังโหลดเอกสาร...</div>
              ) : viewerUrl ? (
                viewerType === 'doc' ? (
                  <iframe 
                    src={`${viewerUrl}#toolbar=0`} 
                    style={{ width: '100%', height: '100%', border: 'none' }} 
                    title="Document Viewer"
                  />
                ) : (
                  <img 
                    src={viewerUrl} 
                    alt="Payment Slip" 
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                  />
                )
              ) : (
                <div style={{ color: '#ef4444', fontSize: 14 }}>เกิดข้อผิดพลาด ไม่สามารถดึงไฟล์ได้ หรือไฟล์ถูกลบไปแล้ว</div>
              )}
            </div>

          </div>
        )}
      </div>

      {payModal && (
        <PayModal
          inst={payModal}
          policy={policy}
          onClose={() => setPayModal(null)}
          onPaid={() => { setPayModal(null); load() }}
        />
      )}

      {delModal && (
        <div className="mov" onClick={() => setDelModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="m-h">
              <h2 className="m-t" style={{ color: 'var(--red-600)' }}>ยืนยันการลบ</h2>
              <button className="ib" style={{ marginLeft: 'auto' }} onClick={() => setDelModal(false)}>{Icons.x}</button>
            </div>
            <div className="m-b">
              <div className="alert d" style={{ marginBottom: 16 }}>
                {Icons.alert}
                <div>การลบจะลบงวดชำระทั้งหมดของกรมธรรม์นี้ด้วย และ<b>ไม่สามารถกู้คืนได้</b></div>
              </div>
            </div>
            <div className="m-f">
              <button className="btn sec" onClick={() => setDelModal(false)}>ยกเลิก</button>
              <button className="btn dng" onClick={deletePolicy}>ลบถาวร</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KV({ label, value, mono }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 500, ...(mono ? { fontFamily: 'monospace', fontSize: 13, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, display: 'inline-block' } : {}) }}>
        {value || '—'}
      </div>
    </div>
  )
}

// ── Pay modal ──
function PayModal({ inst, policy, onClose, onPaid }) {
  const supabase = createClient()
  const [amount, setAmount] = useState(inst.paid_amount > 0 ? inst.paid_amount : (inst.amount_due || 0))
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)

  async function confirm() {
    setSaving(true)
    let uploadedPath = null

    if (file) {
      const fileExt = file.name.split('.').pop()
      const fileName = `slip_${Date.now()}.${fileExt}`
      const filePath = `${policy.id}/slips/${fileName}`
      
      const { data, error } = await supabase.storage.from('policy-docs').upload(filePath, file)
      
      if (error) {
        alert("❌ อัปโหลดไฟล์รูปไม่สำเร็จ: " + error.message)
        setSaving(false)
        return 
      }
      if (data) uploadedPath = data.path
    }

    if (inst.isNewFullPayment) {
      // ✅ กลับมาใช้ Insert ธรรมดา เพราะเคลียร์ข้อมูลเก่าที่มีปัญหาออกแล้ว
      const { error: insertErr } = await supabase.from('installments').insert({
        policy_id: policy.id,
        user_id: policy.user_id, // ส่ง user_id ไปด้วย ไม่ให้ RLS บล็อกอีก
        installment_no: 1,
        total_inst: 1,
        amount_due: parseFloat(inst.amount_due),
        paid_amount: parseFloat(amount),
        paid_at: new Date().toISOString(),
        due_date: policy.policy_start,
        slip_url: uploadedPath
      })
      
      if (insertErr) {
        alert("❌ บันทึกข้อมูลไม่สำเร็จ: " + insertErr.message)
        setSaving(false)
        return
      }
    } else {
      const { error: updateErr } = await supabase.from('installments').update({
        paid_at: inst.paid_at || new Date().toISOString(),
        paid_amount: parseFloat(amount),
        slip_url: uploadedPath || inst.slip_url
      }).eq('id', inst.id)

      if (updateErr) {
        alert("❌ อัปเดตข้อมูลไม่สำเร็จ: " + updateErr.message)
        setSaving(false)
        return
      }
    }
    
    onPaid()
  }

  return (
    <div className="mov" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="m-h">
          <h2 className="m-t">
            {inst.paid_amount > 0 ? `อัปเดตสลิป` : inst.isNewFullPayment ? 'รับชำระเต็มจำนวน' : `รับชำระงวด ${inst.installment_no}/${inst.total_inst}`}
          </h2>
          <button className="ib" style={{ marginLeft: 'auto' }} onClick={onClose}>{Icons.x}</button>
        </div>
        <div className="m-b" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field">
            <label>ยอดชำระ (บาท)</label>
            <input
              className="input"
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ fontSize: 18, fontWeight: 700, textAlign: 'center' }}
            />
            <span className="hint">ยอดตามใบแจ้ง: {fmtB(inst.amount_due)}</span>
          </div>
          
          <div className="field">
            <label>{inst.paid_amount > 0 ? 'แนบสลิปโอนเงินย้อนหลัง' : 'แนบสลิปโอนเงิน (ตัวเลือก)'}</label>
            <input 
              type="file" 
              accept="image/*" 
              onChange={e => setFile(e.target.files[0])} 
              className="input"
              style={{ padding: '8px' }}
            />
          </div>

          <div className="alert i">
            {Icons.calendar}
            <div>วันที่บันทึก: <b>{inst.paid_at ? new Date(inst.paid_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</b></div>
          </div>
        </div>
        <div className="m-f">
          <button className="btn sec" onClick={onClose}>ยกเลิก</button>
          <button className="btn ok" onClick={confirm} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : `${Icons.check} ยืนยันข้อมูล`}
          </button>
        </div>
      </div>
    </div>
  )
}