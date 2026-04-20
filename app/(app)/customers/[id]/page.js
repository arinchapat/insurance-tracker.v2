'use client'
// app/(app)/customers/[id]/page.js
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Icons, fmtB, fmtDate } from '@/components/ui/Icons'
import Link from 'next/link'

// ── FIX 1: เพิ่มแท็ก "ต่ออายุ" ──
const TAG_COLORS = {
  VIP:    'b-am',
  Fleet:  'b-bl',
  ใหม่:   'b-gr',
  ต่ออายุ: 'b-or',   // orange badge — เพิ่มใหม่
}
const STATUS_BADGE = { active: 'b-gr', overdue: 'b-rd', cancelled: 'b-sl', expired: 'b-sl' }
const STATUS_LABEL = { active: 'ใช้งานอยู่', overdue: 'ค้างชำระ', cancelled: 'ยกเลิก', expired: 'หมดอายุ' }

// ── shared inline style tokens ──
const inp = {
  width: '100%', boxSizing: 'border-box',
  padding: '8px 11px', borderRadius: 7,
  border: '1px solid #d1d5db', fontSize: 13.5,
  outline: 'none', background: '#fff',
}
const sel = { ...inp, cursor: 'pointer' }
const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }

const btnPri = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '7px 16px', borderRadius: 8, border: 'none',
  background: '#2563eb', color: '#fff',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
  boxShadow: '0 1px 4px rgba(37,99,235,.3)',
  textDecoration: 'none',
}
const btnSec = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '7px 14px', borderRadius: 8,
  border: '1px solid #d1d5db', background: '#fff',
  color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer',
  textDecoration: 'none',
}
const btnSm = { padding: '5px 12px', fontSize: 12 }

export default function CustomerDetailPage() {
  const { id }  = useParams()
  const router  = useRouter()
  const [customer, setCustomer] = useState(null)
  const [policies, setPolicies] = useState([])
  const [logs, setLogs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [editModal, setEditModal] = useState(false)

  const supabase = createClient()

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const [{ data: cust }, { data: pols }, { data: lg }] = await Promise.all([
      supabase.from('customers').select('*').eq('id', id).single(),
      supabase.from('policies')
        .select('*, companies(name,color), agent_codes(code,label)')
        .eq('customer_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('contact_logs')
        .select('*')
        .eq('customer_id', id)
        .order('contacted_at', { ascending: false })   // ← ใช้ contacted_at
        .limit(30),
    ])
    setCustomer(cust)
    setPolicies(pols ?? [])
    setLogs(lg ?? [])
    setLoading(false)
  }

  if (loading) return <div style={{ padding: 32 }}>กำลังโหลด...</div>
  if (!customer) return <div style={{ padding: 32 }}>ไม่พบลูกค้า</div>

  const initials  = customer.name.replace(/^(คุณ|บริษัท|บจก\.|นาย|นาง|นางสาว)\s*/u, '').charAt(0)
  const activePol = policies.filter(p => p.policy_status === 'active').length

  return (
    <div>
      {/* Topbar */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 28px', background: '#fff',
        borderBottom: '1px solid #e5eaf1', position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#6b7280' }}>
          <Link href="/customers" style={{ color: '#6b7280', textDecoration: 'none' }}>ลูกค้า</Link>
          <span>/</span>
          <span style={{ color: '#111827', fontWeight: 600 }}>{customer.name}</span>
        </div>
        <div style={{ flex: 1 }} />
        {/* ── FIX 2: ปุ่ม inline style ไม่พึ่ง class ── */}
        <button style={{ ...btnSec, ...btnSm }} onClick={() => setEditModal(true)}>
          {Icons.edit} แก้ไข
        </button>
      </header>

      <div style={{ padding: '26px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 18 }}>

          {/* ── Left: Info card ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Avatar + contact buttons */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, textAlign: 'center' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%', margin: '0 auto 12px',
                background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
                color: '#fff', display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 700,
              }}>{initials}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>{customer.name}</div>
              {customer.tag && (
                <div style={{ marginTop: 8 }}>
                  <span className={`badge ${TAG_COLORS[customer.tag] ?? 'b-sl'}`}>{customer.tag}</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                {customer.phone && (
                  <a href={`tel:${customer.phone}`} style={{ ...btnPri, ...btnSm, flex: 1, justifyContent: 'center' }}>
                    {Icons.phone} โทร
                  </a>
                )}
                <button style={{ ...btnSec, ...btnSm, flex: 1, justifyContent: 'center' }}>
                  {Icons.mail} LINE
                </button>
              </div>
            </div>

            {/* Contact info */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>
                ข้อมูลติดต่อ
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <KV label="โทรศัพท์"    value={customer.phone      || '—'} />
                <KV label="อีเมล"       value={customer.email      || '—'} />
                {/* ── FIX 3: แสดงวันเกิด ── */}
                <KV label="วันเกิด"     value={customer.birth_date ? fmtDate(customer.birth_date) : '—'} />
                <KV label="เลขบัตร/ภาษี" value={customer.id_number || '—'} mono />
                <KV label="ช่องทาง"    value={customer.channel    || '—'} />
                <KV label="ชื่อ Inbox"  value={customer.inbox_name || '—'} />
                <KV label="วันที่เพิ่ม" value={fmtDate(customer.created_at)} />
              </div>
            </div>

            {customer.notes && (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>
                  หมายเหตุ
                </div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{customer.notes}</div>
              </div>
            )}
          </div>

          {/* ── Right ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Policies */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>กรมธรรม์ ({policies.length})</h3>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{activePol} ใช้งานอยู่</span>
                <Link href={`/policies/new?customer_id=${id}`} style={{ ...btnPri, ...btnSm, marginLeft: 'auto' }}>
                  {Icons.plus} เพิ่ม
                </Link>
              </div>
              <table className="data">
                <thead>
                  <tr>
                    <th>เลขที่</th><th>ประเภท</th><th>บริษัท · รหัส</th>
                    <th>ทะเบียน / รายละเอียด</th><th>สิ้นสุด</th>
                    <th style={{ textAlign: 'right' }}>เบี้ย</th><th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {policies.length === 0 ? (
                    <tr><td colSpan={7}>
                      <div className="empty">
                        <div className="ei">{Icons.doc}</div>
                        ยังไม่มีกรมธรรม์
                      </div>
                    </td></tr>
                  ) : policies.map(p => (
                    <tr key={p.id} className="clk" onClick={() => router.push(`/policies/${p.id}`)}>
                      <td><code style={{ color: '#1d4ed8', fontSize: 11.5 }}>{p.policy_number || p.id.slice(0,8)}</code></td>
                      <td><span className="badge b-bl">{p.coverage_type}</span></td>
                      <td>
                        <div style={{ fontSize: 12.5 }}>{p.companies?.name}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{p.agent_code}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12.5 }}>{p.plate || '—'}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.model}</div>
                      </td>
                      <td style={{ fontSize: 12.5, color: '#6b7280' }}>{fmtDate(p.policy_end)}</td>
                      <td className="tnum" style={{ textAlign: 'right' }}>{fmtB(p.premium)}</td>
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

            {/* Contact logs */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>ประวัติการติดต่อ</h3>
                <AddLogButton customerId={id} onSaved={load} />
              </div>
              <div style={{ padding: '4px 16px' }}>
                {logs.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>ยังไม่มีประวัติ</div>
                ) : logs.map((lg, i) => (
                  <LogRow key={lg.id} lg={lg} isLast={i === logs.length - 1} onDeleted={load} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {editModal && (
        <EditCustomerModal
          customer={customer}
          onClose={() => setEditModal(false)}
          onSaved={() => { setEditModal(false); load() }}
        />
      )}
    </div>
  )
}

// ── KV label ──
function KV({ label, value, mono }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#111827', ...(mono ? { fontFamily: 'monospace', fontSize: 12 } : {}) }}>{value}</div>
    </div>
  )
}

// ── Log row (ลบได้) ──
function LogRow({ lg, isLast, onDeleted }) {
  const supabase = createClient()
  const TYPE_LABEL = { note: 'Note', call: 'โทร', line: 'LINE', paid: 'ชำระแล้ว' }
  const TYPE_COLOR = {
    paid: { background: '#dcfce7', color: '#15803d' },
    call: { background: '#dbeafe', color: '#1d4ed8' },
    line: { background: '#f0fdf4', color: '#16a34a' },
    note: { background: '#f3f4f6', color: '#374151' },
  }

  // แสดงวันที่จาก contacted_at ก่อน fallback created_at
  const dateStr = new Date(lg.contacted_at || lg.created_at)
    .toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })

  return (
    <div style={{
      display: 'flex', gap: 12, padding: '10px 4px',
      borderBottom: isLast ? 'none' : '1px solid #f3f4f6',
      alignItems: 'flex-start',
    }}>
      <div style={{ width: 64, fontSize: 11, color: '#9ca3af', fontWeight: 500, paddingTop: 2, flexShrink: 0 }}>
        {dateStr}
      </div>
      <span style={{
        padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, flexShrink: 0,
        ...TYPE_COLOR[lg.type] ?? TYPE_COLOR.note,
      }}>
        {TYPE_LABEL[lg.type] ?? lg.type}
      </span>
      <div style={{ flex: 1, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{lg.note}</div>
      <button
        onClick={async () => {
          if (!confirm('ลบรายการนี้?')) return
          await supabase.from('contact_logs').delete().eq('id', lg.id)
          onDeleted()
        }}
        style={{
          width: 24, height: 24, borderRadius: 6, border: 'none',
          background: 'transparent', cursor: 'pointer', color: '#d1d5db',
          fontSize: 14, display: 'grid', placeItems: 'center', flexShrink: 0,
        }}
        title="ลบ"
      >×</button>
    </div>
  )
}

// ── FIX 4: AddLogButton พร้อม date picker ──
function AddLogButton({ customerId, onSaved }) {
  const supabase = createClient()
  const [show, setShow]   = useState(false)
  const [note, setNote]   = useState('')
  const [type, setType]   = useState('note')
  // วันที่ติดต่อ — default = วันนี้
  const todayISO = new Date().toISOString().slice(0, 10)
  const [contactedAt, setContactedAt] = useState(todayISO)

  async function save() {
    if (!note.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('contact_logs').insert({
      customer_id:  customerId,
      type,
      note,
      contacted_at: contactedAt,   // ← บันทึกวันที่ที่ user เลือก
      user_id:      user.id,
    })
    if (error) {
      // fallback: ถ้า column contacted_at ยังไม่มีใน DB ให้ insert แบบไม่มี field นั้น
      console.warn('contacted_at column missing, retrying without it:', error.message)
      await supabase.from('contact_logs').insert({ customer_id: customerId, type, note, user_id: user.id })
    }
    setNote(''); setContactedAt(todayISO); setShow(false); onSaved()
  }

  if (!show) return (
    <button
      onClick={() => setShow(true)}
      style={{ ...btnSec, ...btnSm, marginLeft: 'auto' }}
    >
      {Icons.plus} บันทึก
    </button>
  )

  return (
    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {/* ── date picker ── */}
      <input
        type="date"
        value={contactedAt}
        onChange={e => setContactedAt(e.target.value)}
        style={{ ...inp, width: 140, padding: '5px 8px', fontSize: 12 }}
      />
      <select
        value={type}
        onChange={e => setType(e.target.value)}
        style={{ ...sel, width: 100, padding: '5px 8px', fontSize: 12 }}
      >
        <option value="note">Note</option>
        <option value="call">โทร</option>
        <option value="line">LINE</option>
        <option value="paid">ชำระแล้ว</option>
      </select>
      <input
        placeholder="บันทึก..."
        value={note}
        onChange={e => setNote(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && save()}
        style={{ ...inp, width: 220, padding: '5px 10px', fontSize: 12 }}
      />
      <button style={{ ...btnPri, ...btnSm }} onClick={save}>บันทึก</button>
      <button style={{ ...btnSec, ...btnSm }} onClick={() => setShow(false)}>ยกเลิก</button>
    </div>
  )
}

// ── FIX 5: EditCustomerModal + วันเกิด + ช่องทาง sync + แท็กใหม่ ──
function EditCustomerModal({ customer, onClose, onSaved }) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  // แปลง birth_date (ISO) → วว/ดด/ปปปป สำหรับแสดงใน input
  function isoToDisplay(iso) {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }
  function displayToISO(s) {
    if (!s) return null
    const parts = s.split('/')
    if (parts.length !== 3) return null
    const [d, m, y] = parts
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }

  const [form, setForm] = useState({
    ...customer,
    birth_date_display: isoToDisplay(customer.birth_date),
  })
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    setErrMsg('')
    setSaving(true)
    const { id, created_at, policies, birth_date_display, ...rest } = form
    const payload = {
      ...rest,
      birth_date: displayToISO(birth_date_display),
    }
    const { error } = await supabase.from('customers').update(payload).eq('id', customer.id)
    if (error) {
      setErrMsg(error.message)
      setSaving(false)
      return
    }
    onSaved()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, width: '100%', maxWidth: 600,
          boxShadow: '0 20px 60px rgba(0,0,0,.18)',
          display: 'flex', flexDirection: 'column', maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid #e5e7eb',
        }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>แก้ไขข้อมูลลูกค้า</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#f3f4f6', cursor: 'pointer', fontSize: 18, color: '#6b7280', display: 'grid', placeItems: 'center' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {errMsg && (
            <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 13 }}>
              ⚠️ {errMsg}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>

            {/* ชื่อ full width */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>ชื่อ-นามสกุล</label>
              <input style={inp} value={form.name || ''} onChange={e => set('name', e.target.value)} />
            </div>

            <div>
              <label style={lbl}>เบอร์โทร</label>
              <input style={inp} value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>อีเมล</label>
              <input style={inp} value={form.email || ''} onChange={e => set('email', e.target.value)} />
            </div>

            {/* วันเกิด */}
            <div>
              <label style={lbl}>วันเกิด (วว/ดด/ปปปป)</label>
              <input
                style={inp}
                placeholder="15/03/2533"
                value={form.birth_date_display || ''}
                onChange={e => set('birth_date_display', e.target.value)}
              />
            </div>

            <div>
              <label style={lbl}>เลขบัตร / เลขภาษี</label>
              <input style={inp} value={form.id_number || ''} onChange={e => set('id_number', e.target.value)} />
            </div>

            {/* แท็ก — เพิ่ม ต่ออายุ */}
            <div>
              <label style={lbl}>แท็ก</label>
              <select style={sel} value={form.tag || ''} onChange={e => set('tag', e.target.value)}>
                <option value="">ไม่มี</option>
                <option value="VIP">VIP</option>
                <option value="Fleet">Fleet — ลูกค้ารถ</option>
                <option value="ใหม่">ใหม่</option>
                <option value="ต่ออายุ">ต่ออายุ</option>
              </select>
            </div>

            {/* ช่องทาง sync กับหน้า add */}
            <div>
              <label style={lbl}>ช่องทางติดต่อ</label>
              <select style={sel} value={form.channel || ''} onChange={e => set('channel', e.target.value)}>
                <option value="line">LINE</option>
                <option value="facebook">Facebook</option>
                <option value="line_ad">LINE Ads</option>
                <option value="page_facebook">Page Facebook</option>
                <option value="phone">โทรศัพท์</option>
                <option value="other">อื่นๆ</option>
              </select>
            </div>

            <div>
              <label style={lbl}>ชื่อ Inbox / LINE</label>
              <input style={inp} value={form.inbox_name || ''} onChange={e => set('inbox_name', e.target.value)} />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>หมายเหตุ</label>
              <textarea style={{ ...inp, resize: 'vertical', minHeight: 72 }} value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 24px', borderBottom: '1px solid #e5e7eb' }}>
          <button onClick={onClose} style={btnSec}>ยกเลิก</button>
          <button
            onClick={save}
            disabled={saving}
            style={{
              ...btnPri,
              background: saving ? '#93c5fd' : '#2563eb',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกข้อมูล'}
          </button>
        </div>
      </div>
    </div>
  )
}