'use client'
// app/(app)/customers/page.js
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Icons, fmtDate } from '@/components/ui/Icons'

const TAG_COLORS = { VIP: 'b-am', Fleet: 'b-bl', ใหม่: 'b-gr' }

export default function CustomersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading]     = useState(true)
  const [q, setQ]                 = useState('')
  const [modal, setModal]         = useState(false)

  const supabase = createClient()

  // ── FIX 1: กรอง user_id และใช้ left join (ไม่ใช่ inner) ──
  const load = useCallback(async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    let query = supabase
      .from('customers')
      // left join → ลูกค้าที่ไม่มีกรมธรรม์ก็แสดง (inner จะตัดออก)
      .select('*, policies(id, policy_status)')
      .eq('user_id', user.id)          // ← FIX: กรองเฉพาะของ user นี้
      .order('created_at', { ascending: false })

    if (q) query = query.ilike('name', `%${q}%`)

    const { data, error } = await query
    if (error) console.error('[customers] load error:', error)
    setCustomers(data ?? [])
    setLoading(false)
  }, [q])

  useEffect(() => { load() }, [load])

  return (
    <div>
      {/* Topbar */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 28px', background: '#fff',
        borderBottom: '1px solid #e5eaf1', position: 'sticky', top: 0, zIndex: 20,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>ลูกค้า</span>
      </header>

      <div style={{ padding: '26px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>ลูกค้า</h1>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>
              รายการลูกค้าทั้งหมด · {customers.length} คน
            </div>
          </div>
          <button
            onClick={() => setModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: '#2563eb', color: '#fff', fontSize: 13.5, fontWeight: 600,
              boxShadow: '0 1px 4px rgba(37,99,235,.35)',
            }}
          >
            {Icons.plus} เพิ่มลูกค้า
          </button>
        </div>

        <div className="tb-wrap">
          <div className="tb-tool">
            <div className="search">
              {Icons.search}
              <input
                placeholder="ค้นหาชื่อ..."
                value={q}
                onChange={e => setQ(e.target.value)}
              />
            </div>
            <div className="sp" />
            <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>
              {customers.length} รายการ
            </span>
          </div>

          <table className="data">
            <thead>
              <tr>
                <th>ชื่อลูกค้า</th>
                <th>ติดต่อ</th>
                <th>เลขบัตร / ภาษี</th>
                <th>ช่องทาง</th>
                <th style={{ textAlign: 'right' }}>กรมธรรม์</th>
                <th>แท็ก</th>
                <th>วันที่เพิ่ม</th>
                <th style={{ width: 48 }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8}><div className="empty">กำลังโหลด...</div></td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={8}>
                  <div className="empty">
                    <div className="ei">{Icons.users}</div>
                    {q ? 'ไม่พบลูกค้าที่ค้นหา' : 'ยังไม่มีลูกค้า'}
                  </div>
                </td></tr>
              ) : customers.map(c => {
                const totalPol  = c.policies?.length ?? 0
                const activePol = c.policies?.filter(p => p.policy_status === 'active').length ?? 0
                const initials  = (c.name ?? '').replace(/^(คุณ|บริษัท|บจก\.|ห้างหุ้นส่วน)\s*/u, '').charAt(0)

                return (
                  <tr key={c.id} className="clk" onClick={() => router.push(`/customers/${c.id}`)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                          background: 'linear-gradient(135deg,#64748b,#334155)',
                          color: '#fff', display: 'grid', placeItems: 'center',
                          fontSize: 11, fontWeight: 600,
                        }}>{initials}</div>
                        <div>
                          <div style={{ fontWeight: 500 }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.id.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12.5 }}>{c.phone || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.email || ''}</div>
                    </td>
                    <td><code style={{ fontSize: 11.5, color: 'var(--slate-600)' }}>{c.id_number || '—'}</code></td>
                    <td>
                      {c.channel
                        ? <span className="badge b-sl">{c.channel}</span>
                        : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <b>{activePol}</b>
                      <span style={{ color: 'var(--muted)' }}> / {totalPol}</span>
                    </td>
                    <td>
                      {c.tag && (
                        <span className={`badge ${TAG_COLORS[c.tag] ?? 'b-sl'}`}>{c.tag}</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 12.5 }}>{fmtDate(c.created_at)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="ib">{Icons.dots}</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <AddCustomerModal
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); load() }}
        />
      )}
    </div>
  )
}

// ── Add Customer Modal ──
function AddCustomerModal({ onClose, onSaved }) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [form, setForm] = useState({
    prefix: 'คุณ', name: '', phone: '', email: '',
    birth_date: '',
    id_number: '', inbox_name: '', channel: 'line',
    tag: '', notes: '',
  })
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    setErrMsg('')
    if (!form.name.trim()) { setErrMsg('กรุณากรอกชื่อ-นามสกุล'); return }

    setSaving(true)

    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      setErrMsg('ไม่พบข้อมูล session กรุณา login ใหม่')
      setSaving(false)
      return
    }

    const fullName = form.name.trim()

    // แปลง วว/ดด/ปปปป → YYYY-MM-DD ถ้ากรอกมา
    let birthDateISO = null
    if (form.birth_date) {
      const parts = form.birth_date.split('/')
      if (parts.length === 3) {
        const [dd, mm, yyyy] = parts
        birthDateISO = `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`
      }
    }

    const payload = {
      prefix:     form.prefix     || null,
      name:       fullName,
      phone:      form.phone      || null,
      email:      form.email      || null,
      birth_date: birthDateISO,
      id_number:  form.id_number  || null,
      inbox_name: form.inbox_name || null,
      channel:    form.channel    || null,
      tag:        form.tag        || null,
      notes:      form.notes      || null,
      user_id:    user.id,
    }

    console.log('[AddCustomer] payload:', payload)

    const { error } = await supabase.from('customers').insert(payload)

    if (error) {
      console.error('[AddCustomer] insert error:', error)
      setErrMsg(`${error.message} (code: ${error.code})`)
      setSaving(false)
      return
    }

    onSaved()
  }

  // ── Reusable label style ──
  const lbl = { display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 5 }
  const inp = {
    width: '100%', boxSizing: 'border-box',
    padding: '8px 11px', borderRadius: 7,
    border: '1px solid #d1d5db', fontSize: 13.5,
    outline: 'none', background: '#fff',
  }
  const sel = { ...inp, cursor: 'pointer' }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
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
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#111827' }}>เพิ่มลูกค้าใหม่</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>กรอกข้อมูลลูกค้าให้ครบถ้วน</div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: '#f3f4f6', cursor: 'pointer', fontSize: 18, color: '#6b7280',
              display: 'grid', placeItems: 'center',
            }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>

          {/* Error Banner */}
          {errMsg && (
            <div style={{
              marginBottom: 16, padding: '10px 14px', borderRadius: 8,
              background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 13,
            }}>⚠️ {errMsg}</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>

            {/* ① ชื่อ-นามสกุล — full width */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>ชื่อ-นามสกุล <span style={{ color: '#ef4444' }}>*</span></label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select style={{ ...sel, width: 130, flexShrink: 0 }} value={form.prefix} onChange={e => set('prefix', e.target.value)}>
                  <option value="คุณ">คุณ</option>
                  <option value="นาย">นาย</option>
                  <option value="นาง">นาง</option>
                  <option value="นางสาว">นางสาว</option>
                  <option value="บริษัท">บริษัท</option>
                  <option value="บจก.">บจก.</option>
                  <option value="">ไม่มีคำนำหน้า</option>
                </select>
                <input style={{ ...inp, flex: 1 }} placeholder="สมชาย ใจดี" value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
            </div>

            {/* ② เบอร์โทร */}
            <div>
              <label style={lbl}>เบอร์โทร</label>
              <input style={inp} placeholder="081-234-5678" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>

            {/* ③ อีเมล */}
            <div>
              <label style={lbl}>อีเมล</label>
              <input style={inp} type="email" placeholder="email@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>

            {/* ④ วันเกิด */}
            <div>
              <label style={lbl}>วันเกิด (วว/ดด/ปปปป)</label>
              <input
                style={inp} placeholder="15/03/2533"
                value={form.birth_date}
                onChange={e => set('birth_date', e.target.value)}
              />
            </div>

            {/* ⑤ เลขบัตร */}
            <div>
              <label style={lbl}>เลขบัตร / เลขภาษี</label>
              <input style={inp} placeholder="1-XXXX-XXXXX-XX-X" value={form.id_number} onChange={e => set('id_number', e.target.value)} />
            </div>

            {/* ⑥ แท็ก */}
            <div>
              <label style={lbl}>แท็ก</label>
              <select style={sel} value={form.tag} onChange={e => set('tag', e.target.value)}>
                <option value="">ไม่มี</option>
                <option value="VIP">VIP — ลูกค้า VIP</option>
                <option value="Fleet">Fleet — ลูกค้ารถ</option>
                <option value="ใหม่">ใหม่</option>
              </select>
            </div>

            {/* ⑦ ช่องทางติดต่อ */}
            <div>
              <label style={lbl}>ช่องทางติดต่อ</label>
              <select style={sel} value={form.channel} onChange={e => set('channel', e.target.value)}>
                <option value="line">LINE</option>
                <option value="facebook">Facebook</option>
                <option value="line_ad">LINE Ads</option>
                <option value="page_facebook">Page Facebook</option>
                <option value="phone">โทรศัพท์</option>
                <option value="other">อื่นๆ</option>
              </select>
            </div>

            {/* ⑧ ชื่อ Inbox */}
            <div>
              <label style={lbl}>ชื่อ Inbox / LINE</label>
              <input style={inp} placeholder="ชื่อที่แสดงใน LINE OA" value={form.inbox_name} onChange={e => set('inbox_name', e.target.value)} />
            </div>

            {/* ⑨ หมายเหตุ — full width */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>หมายเหตุ</label>
              <textarea
                style={{ ...inp, resize: 'vertical', minHeight: 72 }}
                placeholder="ข้อมูลเพิ่มเติม เช่น ประวัติการซื้อ ความต้องการพิเศษ..."
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
              />
            </div>

          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 10, justifyContent: 'flex-end',
          padding: '16px 24px', borderTop: '1px solid #e5e7eb',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 20px', borderRadius: 8, border: '1px solid #d1d5db',
              background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#374151',
            }}
          >
            ยกเลิก
          </button>
          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: '9px 24px', borderRadius: 8, border: 'none',
              background: saving ? '#93c5fd' : '#2563eb',
              color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 600,
              boxShadow: saving ? 'none' : '0 2px 8px rgba(37,99,235,.35)',
              transition: 'background .15s',
            }}
          >
            {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกข้อมูลลูกค้า'}
          </button>
        </div>
      </div>
    </div>
  )
}