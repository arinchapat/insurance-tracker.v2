'use client'
// app/(app)/settings/page.js
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────
// Style constants — inline เพื่อการันตีสีไม่หาย
// ─────────────────────────────────────────────
const S = {
  btnPri: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnSec: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
    background: '#fff', color: '#334155', border: '1px solid #e2e8f0',
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  btnGhost: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
    background: 'transparent', color: '#64748b',
    border: '1px solid #e2e8f0', cursor: 'pointer',
  },
  input: {
    border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px',
    fontSize: 13, background: '#fff', width: '100%', outline: 'none',
    fontFamily: 'inherit', color: '#0f172a', boxSizing: 'border-box',
  },
  select: {
    border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px',
    fontSize: 13, background: '#fff', width: '100%', outline: 'none',
    fontFamily: 'inherit', color: '#0f172a', cursor: 'pointer', boxSizing: 'border-box',
  },
  label: { fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' },
  hint:  { fontSize: 11, color: '#94a3b8', marginTop: 3, display: 'block' },
}

export default function SettingsPage() {
  const [tab, setTab]               = useState('companies')
  const [companies, setCompanies]   = useState([])
  const [agentCodes, setAgentCodes] = useState([])
  const [loading, setLoading]       = useState(true)
  const [companyModal, setCompanyModal] = useState(null)
  const [codeModal, setCodeModal]       = useState(null)
  const [toast, setToast]           = useState(null)

  const supabase = createClient()
  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const [{ data: cos }, { data: acs }] = await Promise.all([
      supabase.from('companies').select('*').eq('user_id', user.id).order('name'),
      supabase.from('agent_codes').select('*, companies(name,color)').eq('user_id', user.id).order('code'),
    ])
    setCompanies(cos ?? [])
    setAgentCodes(acs ?? [])
    setLoading(false)
  }

  function showToast(msg, type = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2800)
  }

  async function toggleCompany(id, val) {
    await supabase.from('companies').update({ is_active: val }).eq('id', id)
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, is_active: val } : c))
    showToast(val ? 'เปิดใช้งานบริษัทแล้ว' : 'ปิดบริษัทแล้ว')
  }

  async function toggleCode(code, val) {
    await supabase.from('agent_codes').update({ is_active: val }).eq('code', code)
    setAgentCodes(prev => prev.map(c => c.code === code ? { ...c, is_active: val } : c))
    showToast(val ? 'เปิดใช้งานรหัสแล้ว' : 'ปิดรหัสแล้ว')
  }

  if (loading) return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh', color: '#94a3b8', fontSize: 14 }}>
      กำลังโหลด...
    </div>
  )

  const activeCompanies = companies.filter(c => c.is_active).length
  const activeCodes     = agentCodes.filter(c => c.is_active).length

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 300,
          background: toast.type === 'ok' ? '#16a34a' : '#dc2626',
          color: '#fff', padding: '10px 20px', borderRadius: 10,
          fontSize: 13, fontWeight: 500, boxShadow: '0 4px 24px rgba(0,0,0,.2)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {toast.type === 'ok' ? '✓' : '✕'} {toast.msg}
        </div>
      )}

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#0f172a', letterSpacing: '-.3px' }}>ตั้งค่า</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>จัดการบริษัทประกันและรหัสตัวแทน</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <StatChip label="บริษัทเปิดใช้" value={activeCompanies} color="#2563eb" />
          <StatChip label="รหัสเปิดใช้"   value={activeCodes}     color="#7c3aed" />
        </div>
      </div>

      {/* ── Main Card ── */}
      <div style={{ background: '#fff', border: '1px solid #e5eaf1', borderRadius: 12, overflow: 'hidden' }}>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5eaf1', padding: '0 4px', background: '#fff' }}>
          {[
            { id: 'companies', label: 'บริษัทประกัน', count: companies.length, color: '#2563eb' },
            { id: 'codes',     label: 'รหัสตัวแทน',   count: agentCodes.length, color: '#7c3aed' },
          ].map(t => {
            const on = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '13px 20px', fontSize: 13, fontWeight: on ? 600 : 500,
                color: on ? t.color : '#64748b',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: `2px solid ${on ? t.color : 'transparent'}`,
                marginBottom: -1, display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                {t.label}
                <span style={{
                  background: on ? (t.color + '18') : '#f1f5f9',
                  color: on ? t.color : '#64748b',
                  padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                }}>
                  {t.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* ════ Companies Tab ════ */}
        {tab === 'companies' && (
          <div>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #f1f5f9', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>บริษัทประกัน</span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{companies.length} บริษัท</span>
              <div style={{ flex: 1 }} />
              <button
                style={S.btnPri}
                onClick={() => setCompanyModal('new')}
                onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
                onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}
              >
                <PlusIcon /> เพิ่มบริษัท
              </button>
            </div>

            {companies.length === 0 ? <EmptyState label="ยังไม่มีบริษัทประกัน" sub="กดปุ่ม + เพิ่มบริษัท เพื่อเริ่มต้น" /> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['บริษัท', 'ชื่อย่อ', 'สี', 'สถานะ', ''].map((h, i) => (
                      <th key={i} style={{
                        textAlign: 'left', padding: '10px 18px', fontSize: 10.5,
                        fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase',
                        letterSpacing: .8, borderBottom: '1px solid #e5eaf1',
                        whiteSpace: 'nowrap', width: i === 4 ? 90 : 'auto',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {companies.map((co, idx) => (
                    <tr key={co.id}
                      style={{ borderBottom: idx < companies.length - 1 ? '1px solid #f1f5f9' : 'none', background: '#fff' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                            background: co.color ?? '#3b82f6',
                            display: 'grid', placeItems: 'center',
                            color: '#fff', fontWeight: 700, fontSize: 11,
                          }}>
                            {(co.short_name ?? '??').slice(0, 2)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{co.name}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>ID: {co.id}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <code style={{ background: '#f1f5f9', padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                          {co.short_name}
                        </code>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 20, height: 20, borderRadius: 5, background: co.color, border: '1px solid rgba(0,0,0,.1)', flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{co.color}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Toggle value={co.is_active} onChange={v => toggleCompany(co.id, v)} />
                          <span style={{ fontSize: 11.5, fontWeight: 500, color: co.is_active ? '#16a34a' : '#94a3b8' }}>
                            {co.is_active ? 'เปิดใช้งาน' : 'ปิดการใช้งาน'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 12px', textAlign: 'right' }}>
                        <button style={S.btnGhost} onClick={() => setCompanyModal(co)}>
                          <EditIcon /> แก้ไข
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ════ Agent Codes Tab ════ */}
        {tab === 'codes' && (
          <div>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #f1f5f9', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>รหัสตัวแทน</span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{agentCodes.length} รหัส</span>
              <div style={{ flex: 1 }} />
              <button
                style={{ ...S.btnPri, background: '#7c3aed' }}
                onClick={() => setCodeModal('new')}
                onMouseEnter={e => e.currentTarget.style.background = '#6d28d9'}
                onMouseLeave={e => e.currentTarget.style.background = '#7c3aed'}
              >
                <PlusIcon /> เพิ่มรหัส
              </button>
            </div>

            {agentCodes.length === 0 ? <EmptyState label="ยังไม่มีรหัสตัวแทน" sub="กดปุ่ม + เพิ่มรหัส เพื่อเริ่มต้น" /> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['รหัส', 'บริษัท', 'ชื่อ / Label', 'เส้นตายยกเลิก', 'เครดิต', 'เตือน / วิกฤต', 'สถานะ', ''].map((h, i) => (
                      <th key={i} style={{
                        textAlign: 'left', padding: '10px 16px', fontSize: 10.5,
                        fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase',
                        letterSpacing: .8, borderBottom: '1px solid #e5eaf1',
                        whiteSpace: 'nowrap', width: i === 7 ? 90 : 'auto',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agentCodes.map((ac, idx) => (
                    <tr key={ac.code}
                      style={{ borderBottom: idx < agentCodes.length - 1 ? '1px solid #f1f5f9' : 'none', background: '#fff' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      <td style={{ padding: '13px 16px' }}>
                        <code style={{ background: '#f1f5f9', padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                          {ac.code}
                        </code>
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#f8fafc', border: '1px solid #e5eaf1', padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, color: '#334155' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: ac.companies?.color ?? '#64748b', flexShrink: 0 }} />
                          {ac.companies?.name ?? '—'}
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px', color: '#475569', fontSize: 12.5 }}>{ac.label}</td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ background: '#fef2f2', color: '#b91c1c', padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700 }}>
                          {ac.cancel_after_days} วัน
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600 }}>
                          {ac.credit_days} วัน
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 11.5, color: '#065f46' }}>🔔 {ac.notify_before_due ?? 7} วัน</span>
                          <span style={{ fontSize: 11.5, color: '#7f1d1d' }}>🚨 {ac.alert_before_cancel ?? 3} วัน</span>
                        </div>
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Toggle value={ac.is_active} onChange={v => toggleCode(ac.code, v)} />
                          <span style={{ fontSize: 11, fontWeight: 500, color: ac.is_active ? '#16a34a' : '#94a3b8' }}>
                            {ac.is_active ? 'เปิด' : 'ปิด'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '13px 12px', textAlign: 'right' }}>
                        <button style={S.btnGhost} onClick={() => setCodeModal(ac)}>
                          <EditIcon /> แก้ไข
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {companyModal && (
        <CompanyModal
          initial={companyModal === 'new' ? null : companyModal}
          onClose={() => setCompanyModal(null)}
          onSaved={() => { setCompanyModal(null); load(); showToast('บันทึกบริษัทแล้ว') }}
        />
      )}
      {codeModal && (
        <AgentCodeModal
          initial={codeModal === 'new' ? null : codeModal}
          companies={companies}
          onClose={() => setCodeModal(null)}
          onSaved={() => { setCodeModal(null); load(); showToast('บันทึกรหัสตัวแทนแล้ว') }}
        />
      )}
    </div>
  )
}

// ── Icons (inline SVG — ไม่พึ่ง import) ──
function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function EditIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
}

// ── Stat Chip ──
function StatChip({ label, value, color }) {
  return (
    <div style={{ background: color + '12', border: `1px solid ${color}30`, borderRadius: 10, padding: '8px 16px', textAlign: 'center', minWidth: 84 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10.5, color, opacity: .7, fontWeight: 600, marginTop: 3 }}>{label}</div>
    </div>
  )
}

// ── Empty State ──
function EmptyState({ label, sub }) {
  return (
    <div style={{ padding: '56px 24px', textAlign: 'center', color: '#94a3b8' }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f1f5f9', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12 }}>{sub}</div>
    </div>
  )
}

// ── Toggle ──
function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)} style={{
      width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
      background: value ? '#2563eb' : '#cbd5e1',
      position: 'relative', transition: 'background .2s', padding: 0, flexShrink: 0,
    }}>
      <span style={{
        position: 'absolute', top: 3, left: value ? 21 : 3,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transition: 'left .2s', display: 'block',
      }} />
    </button>
  )
}

// ── Section Label ──
function SectionLabel({ label, color = '#2563eb' }) {
  return (
    <div style={{
      gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 8,
      paddingBottom: 8, marginTop: 6, borderBottom: `2px solid ${color}22`,
    }}>
      <span style={{ width: 3, height: 14, background: color, borderRadius: 2, flexShrink: 0, display: 'inline-block' }} />
      <span style={{ fontSize: 10.5, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
    </div>
  )
}

// ── Field ──
function Field({ label, hint, span2, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: span2 ? 'span 2' : undefined }}>
      {label && <label style={S.label}>{label}</label>}
      {children}
      {hint && <span style={S.hint}>{hint}</span>}
    </div>
  )
}

// ── Modal Shell ──
function ModalShell({ title, onClose, onSave, saving, children, wide }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)',
      zIndex: 100, display: 'grid', placeItems: 'center', backdropFilter: 'blur(4px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 14,
        width: '92%', maxWidth: wide ? 820 : 500,
        maxHeight: '88vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px -12px rgba(15,23,42,.4)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #e5eaf1', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', flex: 1 }}>{title}</span>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#f1f5f9', color: '#64748b', cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 15 }}>
            ✕
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: 22, overflowY: 'auto', flex: 1 }}>{children}</div>
        {/* Footer */}
        <div style={{ padding: '12px 22px', borderTop: '1px solid #e5eaf1', background: '#f8fafc', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={S.btnSec} onClick={onClose}>ยกเลิก</button>
          <button
            style={{ ...S.btnPri, opacity: saving ? .6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
            onClick={onSave} disabled={saving}
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Company Modal ──
function CompanyModal({ initial, onClose, onSaved }) {
  const supabase = createClient()
  const isNew = !initial
  const [form, setForm] = useState({
    id: initial?.id ?? '', name: initial?.name ?? '',
    short_name: initial?.short_name ?? '', color: initial?.color ?? '#3b82f6',
    is_active: initial?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    if (!form.id || !form.name || !form.short_name) return alert('กรุณากรอกข้อมูลให้ครบ')
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (isNew) {
      await supabase.from('companies').insert({ ...form, user_id: user.id })
    } else {
      const { id, ...rest } = form
      await supabase.from('companies').update(rest).eq('id', form.id)
    }
    onSaved()
  }

  return (
    <ModalShell title={isNew ? 'เพิ่มบริษัทประกัน' : `แก้ไข ${initial?.name}`} onClose={onClose} onSave={save} saving={saving}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 18px' }}>
        <Field label="ID บริษัท *" hint="ภาษาอังกฤษ lowercase ไม่มีเว้นวรรค" span2>
          <input style={S.input} placeholder="chubb / viriyah / allianz" value={form.id} onChange={e => set('id', e.target.value)} disabled={!isNew} />
        </Field>
        <Field label="ชื่อบริษัท *" span2>
          <input style={S.input} placeholder="Chubb Samaggi Insurance" value={form.name} onChange={e => set('name', e.target.value)} />
        </Field>
        <Field label="ชื่อย่อ *">
          <input style={S.input} placeholder="CHB" value={form.short_name} onChange={e => set('short_name', e.target.value)} />
        </Field>
        <Field label="สีประจำบริษัท">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={form.color} onChange={e => set('color', e.target.value)}
              style={{ width: 42, height: 38, borderRadius: 8, border: '1px solid #e2e8f0', padding: 3, cursor: 'pointer' }} />
            <input style={{ ...S.input, flex: 1, width: 'auto' }} value={form.color} onChange={e => set('color', e.target.value)} />
            <div style={{ width: 38, height: 38, borderRadius: 8, background: form.color, border: '1px solid rgba(0,0,0,.1)', flexShrink: 0 }} />
          </div>
        </Field>
      </div>
    </ModalShell>
  )
}

// ── Agent Code Modal ──
function AgentCodeModal({ initial, companies, onClose, onSaved }) {
  const supabase = createClient()
  const isNew = !initial
  const [form, setForm] = useState({
    code:                initial?.code                ?? '',
    company_id:          initial?.company_id         ?? (companies[0]?.id ?? ''),
    label:               initial?.label              ?? '',
    is_active:           initial?.is_active          ?? true,
    credit_days:          initial?.credit_days         ?? 30,
    cancel_after_days:          initial?.cancel_after_days         ?? 30,
    customer_grace_days: initial?.customer_grace_days ?? 5,
    allow_credit_inst:   initial?.allow_credit_inst  ?? false,
    notify_before_due:   initial?.notify_before_due  ?? 7,
    alert_before_cancel: initial?.alert_before_cancel ?? 3,
    notes:               initial?.notes              ?? '',
  })
  const [saving, setSaving] = useState(false)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    if (!form.code || !form.company_id || !form.label) return alert('กรุณากรอกข้อมูลให้ครบ')
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      company_id: form.company_id, label: form.label, is_active: form.is_active,
      credit_days: form.credit_days, cancel_after_days: form.cancel_after_days,
      customer_grace_days: form.customer_grace_days, allow_credit_inst: form.allow_credit_inst,
      notify_before_due: form.notify_before_due, alert_before_cancel: form.alert_before_cancel,
      notes: form.notes,
    }
    if (isNew) {
      await supabase.from('agent_codes').insert({ ...payload, code: form.code, user_id: user.id })
    } else {
      await supabase.from('agent_codes').update(payload).eq('code', form.code)
    }
    onSaved()
  }

  return (
    <ModalShell title={isNew ? 'เพิ่มรหัสตัวแทน' : `แก้ไข ${initial?.code}`} onClose={onClose} onSave={save} saving={saving} wide>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 18px' }}>

        <Field label="รหัสตัวแทน *">
          <input style={S.input} placeholder="CHB-A8821" value={form.code} onChange={e => set('code', e.target.value)} disabled={!isNew} />
        </Field>
        <Field label="บริษัท *">
          <select style={S.select} value={form.company_id} onChange={e => set('company_id', e.target.value)}>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="ชื่อ / คำอธิบาย *" span2>
          <input style={S.input} placeholder="ตัวแทนหลัก (Motor)" value={form.label} onChange={e => set('label', e.target.value)} />
        </Field>

        {/* หมวด 1 */}
        <SectionLabel label="หมวดที่ 1 · กฎบริษัท (Company Rules)" color="#2563eb" />
        <Field label="เครดิตส่งการเงิน" hint="จำนวนวันที่ต้องโอนเงินให้บริษัทประกัน">
          <select style={S.select} value={form.credit_days} onChange={e => set('credit_days', +e.target.value)}>
            {[15, 30, 45, 60].map(d => <option key={d} value={d}>{d} วัน</option>)}
          </select>
        </Field>
        <Field label="เส้นตายยกเลิกกรมธรรม์ (วัน)" hint="กฎเหล็ก — ลูกค้าห้ามเลยกำหนดนี้">
          <input style={S.input} type="number" min="1" value={form.cancel_after_days} onChange={e => set('cancel_after_days', +e.target.value)} />
        </Field>

        {/* หมวด 2 */}
        <SectionLabel label="หมวดที่ 2 · การบริหารลูกค้า (Customer Rules)" color="#7c3aed" />
        <Field label="ผ่อนผันรอลูกค้า (วัน)" hint="วันรอเงินหลังระบบยิง Standby Cancel แล้ว">
          <input style={S.input} type="number" min="1" max="30" value={form.customer_grace_days} onChange={e => set('customer_grace_days', +e.target.value)} />
        </Field>
        <Field label="อนุญาต Credit Installment">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <Toggle value={form.allow_credit_inst} onChange={v => set('allow_credit_inst', v)} />
            <span style={{ fontSize: 13, color: form.allow_credit_inst ? '#7c3aed' : '#94a3b8', fontWeight: 500 }}>
              {form.allow_credit_inst ? 'อนุญาต' : 'ไม่อนุญาต'}
            </span>
          </div>
        </Field>

        {/* หมวด 3 */}
        <SectionLabel label="หมวดที่ 3 · ระบบเตือนภัย (Smart Alerts)" color="#059669" />
        <Field label="🔔 เตือนก่อนลูกค้าถึง due (วัน)" hint="แจ้งล่วงหน้าเพื่อทวงค่างวด">
          <input style={S.input} type="number" min="1" value={form.notify_before_due} onChange={e => set('notify_before_due', +e.target.value)} />
        </Field>
        <Field label="🚨 เตือนวิกฤตใกล้ยกเลิก (วัน)" hint="แจ้งฉุกเฉินก่อนหมดสิทธิ์ตามเส้นตาย">
          <input style={S.input} type="number" min="1" value={form.alert_before_cancel} onChange={e => set('alert_before_cancel', +e.target.value)} />
        </Field>

        <Field label="หมายเหตุ" span2>
          <input style={S.input} placeholder="กฎพิเศษของรหัสตัวแทนนี้..." value={form.notes} onChange={e => set('notes', e.target.value)} />
        </Field>
      </div>
    </ModalShell>
  )
}