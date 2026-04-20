'use client'
// app/(app)/policies/[id]/page.js
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Icons, fmtB, fmtDate } from '@/components/ui/Icons'
import { getInstallmentStatus, STATUS_LABEL, STATUS_BADGE } from '@/lib/domain/installment'

export default function PolicyDetailPage() {
  const { id } = useParams()
  const router  = useRouter()
  const supabase = createClient()

  const [policy, setPolicy]     = useState(null)
  const [ac, setAc]             = useState(null)
  const [insts, setInsts]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [payModal, setPayModal] = useState(null)   // installment record
  const [delModal, setDelModal] = useState(false)

  useEffect(() => { load() }, [id])

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

    // Fetch agent_code record by code string (no FK — query separately)
    if (pol?.agent_code) {
      const { data: acData } = await supabase
        .from('agent_codes').select('*').eq('code', pol.agent_code).maybeSingle()
      setAc(acData ?? null)
    }

    setLoading(false)
  }

  async function deletePolicy() {
    await supabase.from('policies').delete().eq('id', id)
    router.push('/policies')
  }

  if (loading) return <div style={{ padding: 32 }}>กำลังโหลด...</div>
  if (!policy)  return <div style={{ padding: 32 }}>ไม่พบกรมธรรม์</div>

  const paidCount = insts.filter(i => i.paid_at).length
  const paidTotal = insts.filter(i => i.paid_at).reduce((s, i) => s + Number(i.paid_amount ?? i.amount_due), 0)
  const remaining = Number(policy.premium) - paidTotal

  const statusColors = {
    active:    { bg: '#f0fdf4', color: '#15803d', dot: '#22c55e' },
    overdue:   { bg: '#fef2f2', color: '#b91c1c', dot: '#ef4444' },
    cancelled: { bg: '#f8fafc', color: '#475569', dot: '#94a3b8' },
    expired:   { bg: '#f8fafc', color: '#475569', dot: '#94a3b8' },
  }
  const sc = statusColors[policy.policy_status] ?? statusColors.active

  return (
    <div>
      {/* Topbar */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 28px', background: '#fff', borderBottom: '1px solid #e5eaf1', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
          <Link href="/policies" style={{ color: 'var(--muted)', textDecoration: 'none' }}>กรมธรรม์</Link>
          <span>/</span>
          <code style={{ color: 'var(--text)', fontWeight: 600, fontSize: 12 }}>{policy.id}</code>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn dng sm" onClick={() => setDelModal(true)}>{Icons.trash} ลบ</button>
      </header>

      <div style={{ padding: '26px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18 }}>

          {/* LEFT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Header card */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span className="badge b-bl">{policy.coverage_type}</span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                      background: sc.bg, color: sc.color,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot }} />
                      {policy.policy_status === 'active' ? 'ใช้งานอยู่' : policy.policy_status === 'overdue' ? 'ค้างชำระ' : policy.policy_status}
                    </span>
                  </div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{policy.plate || policy.model || policy.id}</h2>
                  {policy.model && policy.plate && <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>{policy.model}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>เบี้ยประกัน</div>
                  <div style={{ fontSize: 24, fontWeight: 700, fontFeatureSettings: '"tnum"' }}>{fmtB(policy.premium)}</div>
                </div>
              </div>

              <div className="hrlight" />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
                <KV label="ลูกค้า"       value={policy.customers?.name} link={`/customers/${policy.customers?.id}`} />
                <KV label="บริษัท"       value={policy.companies?.name} />
                <KV label="รหัสตัวแทน"   value={policy.agent_code} mono />
                <KV label="วิธีชำระ"     value={policy.pay_mode === 'installment' ? `ผ่อน ${insts.length} งวด` : 'เงินสด'} />
                <KV label="วันเริ่มคุ้มครอง" value={fmtDate(policy.policy_start)} />
                <KV label="วันสิ้นสุด"   value={fmtDate(policy.policy_end)} />
                <KV label="Grace period" value={ac ? `${ac.cancel_after_days} วัน` : '—'} />
                <KV label="รอบบิล"       value={ac ? `วันที่ ${ac.bill_cycle_day}` : '—'} />
              </div>

              {policy.notes && (
                <div className="alert i" style={{ marginTop: 14 }}>
                  {Icons.doc}
                  <div>{policy.notes}</div>
                </div>
              )}
            </div>

            {/* Installments */}
            <div className="card">
              <div className="card-h">
                <h3 className="card-t">งวดชำระ</h3>
                <span className="card-s">{paidCount}/{insts.length} งวด · ชำระแล้ว {fmtB(paidTotal)}</span>
                {remaining > 0 && (
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--amber-700)', fontWeight: 600 }}>
                    ยังเหลือ {fmtB(remaining)}
                  </span>
                )}
              </div>

              {/* Progress */}
              {insts.length > 0 && (
                <div style={{ padding: '12px 18px 0' }}>
                  <div className="pbar">
                    <div className="s" style={{ width: `${(paidCount / insts.length) * 100}%` }} />
                  </div>
                </div>
              )}

              <table className="data">
                <thead>
                  <tr>
                    <th>งวดที่</th>
                    <th>ครบกำหนด</th>
                    <th style={{ textAlign: 'right' }}>ยอด</th>
                    <th>สถานะ</th>
                    <th>ชำระเมื่อ</th>
                    <th style={{ width: 100 }} />
                  </tr>
                </thead>
                <tbody>
                  {insts.length === 0 ? (
                    <tr><td colSpan={6}><div className="empty">ไม่มีงวด</div></td></tr>
                  ) : insts.map(inst => {
                    const status = getInstallmentStatus(inst, ac)
                    const isPaid = !!inst.paid_at
                    return (
                      <tr key={inst.id}>
                        <td style={{ fontWeight: 600 }}>
                          งวด {inst.installment_no}/{inst.total_inst}
                        </td>
                        <td style={{ color: 'var(--muted)', fontSize: 12.5 }}>{fmtDate(inst.due_date)}</td>
                        <td className="tnum" style={{ textAlign: 'right', fontWeight: 600 }}>{fmtB(inst.amount_due)}</td>
                        <td>
                          <span className={`badge ${isPaid ? 'b-gr' : status === 'overdue' || status === 'critical' ? 'b-rd' : status === 'due' || status === 'prep' ? 'b-am' : 'b-sl'}`}>
                            <span className="dot" />
                            {isPaid ? 'ชำระแล้ว' : STATUS_LABEL[status] ?? status}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {inst.paid_at ? fmtDate(inst.paid_at) : '—'}
                        </td>
                        <td>
                          {!isPaid ? (
                            <button className="btn ok sm" onClick={() => setPayModal(inst)}>
                              {Icons.check} รับชำระ
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--green-600)' }}>✓ เสร็จสิ้น</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT: quick info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>สรุปการชำระ</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Row label="เบี้ยรวม"       value={fmtB(policy.premium)} />
                <Row label="ชำระแล้ว"        value={fmtB(paidTotal)} color="var(--green-600)" />
                <Row label="ค้างชำระ"        value={fmtB(remaining)}  color={remaining > 0 ? 'var(--red-600)' : 'var(--muted)'} />
              </div>
              <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />
              <div className="pbar"><div className="s" style={{ width: `${policy.premium > 0 ? (paidTotal / policy.premium) * 100 : 0}%` }} /></div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, textAlign: 'right' }}>
                {policy.premium > 0 ? Math.round((paidTotal / policy.premium) * 100) : 0}% ชำระแล้ว
              </div>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>ลูกค้า</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <div style={{ fontWeight: 500 }}>{policy.customers?.name}</div>
                {policy.customers?.phone && (
                  <a href={`tel:${policy.customers.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--blue-600)', textDecoration: 'none', fontSize: 13 }}>
                    {Icons.phone} {policy.customers.phone}
                  </a>
                )}
                <Link href={`/customers/${policy.customers?.id}`} style={{ fontSize: 12, color: 'var(--blue-600)', textDecoration: 'none' }}>
                  ดูโปรไฟล์ลูกค้า →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pay modal */}
      {payModal && (
        <PayModal
          inst={payModal}
          onClose={() => setPayModal(null)}
          onPaid={() => { setPayModal(null); load() }}
        />
      )}

      {/* Delete confirm */}
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
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                กรมธรรม์: <code style={{ fontSize: 12 }}>{policy.id}</code><br />
                ลูกค้า: {policy.customers?.name}
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

function KV({ label, value, mono, link }) {
  return (
    <div>
      <div className="kv">{label}</div>
      {link
        ? <Link href={link} className="kval" style={{ color: 'var(--blue-600)', textDecoration: 'none', display: 'block', marginTop: 2 }}>{value}</Link>
        : <div className="kval" style={{ marginTop: 2, ...(mono ? { fontFamily: 'monospace', fontSize: 12 } : {}) }}>{value}</div>
      }
    </div>
  )
}

function Row({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontWeight: 600, fontFeatureSettings: '"tnum"', color: color ?? 'var(--text)' }}>{value}</span>
    </div>
  )
}

// ── Pay modal ──
function PayModal({ inst, onClose, onPaid }) {
  const supabase = createClient()
  const [amount, setAmount] = useState(inst.amount_due)
  const [saving, setSaving] = useState(false)

  async function confirm() {
    setSaving(true)
    await supabase.from('installments').update({
      paid_at:     new Date().toISOString(),
      paid_amount: parseFloat(amount),
    }).eq('id', inst.id)
    onPaid()
  }

  return (
    <div className="mov" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="m-h">
          <h2 className="m-t">รับชำระงวด {inst.installment_no}/{inst.total_inst}</h2>
          <button className="ib" style={{ marginLeft: 'auto' }} onClick={onClose}>{Icons.x}</button>
        </div>
        <div className="m-b">
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
          <div className="alert i" style={{ marginTop: 12 }}>
            {Icons.calendar}
            <div>วันที่บันทึก: <b>{new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</b></div>
          </div>
        </div>
        <div className="m-f">
          <button className="btn sec" onClick={onClose}>ยกเลิก</button>
          <button className="btn ok" onClick={confirm} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : `${Icons.check} ยืนยันรับชำระ`}
          </button>
        </div>
      </div>
    </div>
  )
}