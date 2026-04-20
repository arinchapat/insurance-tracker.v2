'use client'
// app/onboarding/page.js
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const DEFAULT_COMPANIES = [
  { id_suffix:'chubb',   name:'Chubb',              short_name:'CHB', color:'#1e40af' },
  { id_suffix:'viriyah', name:'วิริยะประกันภัย',       short_name:'VRY', color:'#059669' },
  { id_suffix:'allianz', name:'Allianz Ayudhya',     short_name:'ALZ', color:'#0284c7' },
  { id_suffix:'tvi',     name:'ทิพยประกันภัย',         short_name:'TIP', color:'#be123c' },
  { id_suffix:'dhipaya', name:'ธนชาตประกันภัย',        short_name:'TKI', color:'#7c3aed' },
  { id_suffix:'smk',     name:'สินมั่นคงประกันภัย',     short_name:'SMK', color:'#b45309' },
]

const DEFAULT_RULES = {
  chubb:   { credit_days:15, cancel_after_days:30, customer_grace_days:5, notify_before_due:7, alert_before_cancel:3 },
  viriyah: { credit_days:60, cancel_after_days:60, customer_grace_days:5, notify_before_due:7, alert_before_cancel:3 },
  allianz: { credit_days:30, cancel_after_days:30, customer_grace_days:5, notify_before_due:7, alert_before_cancel:3 },
  tvi:     { credit_days:30, cancel_after_days:30, customer_grace_days:5, notify_before_due:7, alert_before_cancel:3 },
  dhipaya: { credit_days:30, cancel_after_days:30, customer_grace_days:5, notify_before_due:7, alert_before_cancel:3 },
  smk:     { credit_days:30, cancel_after_days:30, customer_grace_days:5, notify_before_due:7, alert_before_cancel:3 },
}

// สร้าง code row เปล่าสำหรับบริษัทนั้น
function newCodeRow(co) {
  const def = DEFAULT_RULES[co.id_suffix] ?? DEFAULT_RULES.chubb
  return { code:'', label:'', ...def }
}

export default function OnboardingPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [step, setStep]     = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 1: เลือกบริษัท
  const [selectedCos, setSelectedCos] = useState([])
  const [customCos, setCustomCos]     = useState([])

  // Step 2: data structure = [ { co, codes: [{code, label, rules...}] } ]
  const [coGroups, setCoGroups] = useState([])

  // ── Step 1 helpers ──
  function toggleCompany(co) {
    setSelectedCos(prev => {
      const exists = prev.find(c => c.id_suffix === co.id_suffix)
      if (exists) return prev.filter(c => c.id_suffix !== co.id_suffix)
      return [...prev, co]
    })
  }

  function goToStep2() {
    const allCos = [
      ...selectedCos,
      ...customCos.filter(c => c.name && c.short_name),
    ]
    if (allCos.length === 0) return alert('กรุณาเลือกบริษัทอย่างน้อย 1 บริษัท')

    // สร้าง group ต่อบริษัท — เริ่มด้วย 1 code row ว่างๆ
    setCoGroups(allCos.map(co => ({
      co,
      codes: [newCodeRow(co)],
    })))
    setStep(2)
  }

  // ── Step 2 helpers ──
  function addCode(gi) {
    setCoGroups(prev => prev.map((g, i) =>
      i === gi ? { ...g, codes: [...g.codes, newCodeRow(g.co)] } : g
    ))
  }

  function removeCode(gi, ci) {
    setCoGroups(prev => prev.map((g, i) =>
      i === gi ? { ...g, codes: g.codes.filter((_, j) => j !== ci) } : g
    ))
  }

  function setCode(gi, ci, key, val) {
    setCoGroups(prev => prev.map((g, i) =>
      i !== gi ? g : {
        ...g,
        codes: g.codes.map((c, j) => j === ci ? { ...c, [key]: val } : c),
      }
    ))
  }

  // ── Save ──
  async function finish() {
    // validate
    for (const g of coGroups) {
      for (const c of g.codes) {
        if (!c.code.trim()) return alert(`กรุณากรอกรหัสตัวแทนของ ${g.co.name} ให้ครบทุกแถว`)
      }
    }

    // check duplicate codes
    const allCodes = coGroups.flatMap(g => g.codes.map(c => c.code.trim().toUpperCase()))
    const unique   = new Set(allCodes)
    if (unique.size !== allCodes.length) return alert('มีรหัสตัวแทนซ้ำกัน กรุณาตรวจสอบ')

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const uid8 = user.id.replace(/-/g, '').slice(0, 8)

    // insert companies (1 per group)
    const companyInserts = coGroups.map(g => ({
      id:         `${uid8}_${g.co.id_suffix}`,
      name:       g.co.name,
      short_name: g.co.short_name,
      color:      g.co.color ?? '#3b82f6',
      is_active:  true,
      user_id:    user.id,
    }))

    const { error: coErr } = await supabase
     .from('companies')
     .upsert(companyInserts, { onConflict: 'id' })
    if (coErr) { alert('เกิดข้อผิดพลาด: ' + coErr.message); setSaving(false); return }

    // insert all agent codes (many per company)
    const codeInserts = coGroups.flatMap(g =>
      g.codes.map(c => ({
        code:                c.code.trim().toUpperCase(),
        company_id:          `${uid8}_${g.co.id_suffix}`,
        label:               c.label.trim() || 'ตัวแทนหลัก',
        is_active:           true,
        bill_cycle_day:      25,  // placeholder ไม่ใช้แล้ว
        credit_days:          c.credit_days,
        cancel_after_days:          c.cancel_after_days,
        warn_day:            c.cancel_after_days - c.alert_before_cancel - 1,
        critical_day:        c.cancel_after_days - c.alert_before_cancel,
        allow_credit_inst:   false,
        notify_before_due:   c.notify_before_due,
        alert_before_cancel: c.alert_before_cancel,
        customer_cancel_after_days: c.customer_cancel_after_days,
        user_id:             user.id,
      }))
    )

    const { error: acErr } = await supabase
     .from('agent_codes')
     .upsert(codeInserts, { onConflict: 'code' })
    if (acErr) { alert('เกิดข้อผิดพลาด: ' + acErr.message); setSaving(false); return }

    router.push('/dashboard')
    router.refresh()
  }

  // ── Shared styles ──
  const S = {
    page:   { minHeight:'100vh', background:'#f6f8fb', display:'flex', justifyContent:'center', padding:'48px 20px' },
    wrap:   { width:'100%', maxWidth:720 },
    card:   { background:'#fff', border:'1px solid #e5eaf1', borderRadius:12, overflow:'hidden' },
    cardH:  { padding:'14px 20px', borderBottom:'1px solid #e5eaf1', display:'flex', alignItems:'center', gap:10 },
    cardB:  { padding:24 },
    cardF:  { padding:'12px 20px', borderTop:'1px solid #e5eaf1', background:'#f8fafc', display:'flex', justifyContent:'flex-end', gap:8 },
    cardF2: { padding:'12px 20px', borderTop:'1px solid #e5eaf1', background:'#f8fafc', display:'flex', justifyContent:'space-between', gap:8 },
    btnPri: { display:'inline-flex', alignItems:'center', gap:6, padding:'9px 18px', borderRadius:8, fontSize:13, fontWeight:600, background:'#2563eb', color:'#fff', border:'none', cursor:'pointer', whiteSpace:'nowrap' },
    btnSec: { display:'inline-flex', alignItems:'center', gap:6, padding:'9px 14px', borderRadius:8, fontSize:13, fontWeight:500, background:'#fff', color:'#334155', border:'1px solid #e2e8f0', cursor:'pointer', whiteSpace:'nowrap' },
    btnOk:  { display:'inline-flex', alignItems:'center', gap:6, padding:'9px 20px', borderRadius:8, fontSize:13, fontWeight:600, background:'#16a34a', color:'#fff', border:'none', cursor:'pointer' },
    btnGh:  { display:'inline-flex', alignItems:'center', padding:'4px 8px', borderRadius:6, fontSize:12, background:'none', color:'#94a3b8', border:'1px solid #e2e8f0', cursor:'pointer' },
    input:  { border:'1px solid #e5eaf1', borderRadius:8, padding:'8px 12px', fontSize:13, width:'100%', outline:'none', fontFamily:'inherit' },
    select: { border:'1px solid #e5eaf1', borderRadius:8, padding:'8px 12px', fontSize:13, width:'100%', outline:'none', fontFamily:'inherit', background:'#fff' },
    label:  { fontSize:11.5, fontWeight:600, color:'#334155', display:'block', marginBottom:4 },
    hint:   { fontSize:10.5, color:'#94a3b8', marginTop:3, lineHeight:1.4 },
    block:  { background:'#f8fafc', border:'1px solid #e5eaf1', borderRadius:10, padding:14, marginBottom:10 },
    blockT: { fontSize:10.5, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:.8, marginBottom:10, display:'flex', alignItems:'center', gap:5 },
  }

  // Step indicator
  const StepDot = ({ n, active, done }) => (
    <div style={{ width:28, height:28, borderRadius:'50%', display:'grid', placeItems:'center', fontWeight:700, fontSize:13, background: done||active ? '#2563eb' : '#f1f5f9', color: done||active ? '#fff' : '#94a3b8' }}>
      {done ? '✓' : n}
    </div>
  )

  return (
    <div style={S.page}>
      <div style={S.wrap}>

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:52, height:52, borderRadius:14, margin:'0 auto 12px', background:'linear-gradient(135deg,#3b82f6,#1d4ed8)', display:'grid', placeItems:'center', color:'#fff', fontSize:20, fontWeight:700 }}>AI</div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>ตั้งค่าครั้งแรก</h1>
          <p style={{ margin:'6px 0 0', color:'#64748b', fontSize:13 }}>กรอกข้อมูลตัวแทนของคุณ — ใช้เวลา 2 นาที</p>
        </div>

        {/* Steps */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:28 }}>
          <StepDot n={1} active={step===1} done={step>1} />
          <span style={{ fontSize:13, fontWeight:step===1?600:400, color:step===1?'#0f172a':'#94a3b8' }}>เลือกบริษัทประกัน</span>
          <span style={{ color:'#cbd5e1', margin:'0 6px' }}>→</span>
          <StepDot n={2} active={step===2} done={false} />
          <span style={{ fontSize:13, fontWeight:step===2?600:400, color:step===2?'#0f172a':'#94a3b8' }}>กรอกรหัสตัวแทน</span>
        </div>

        {/* ══ STEP 1 ══ */}
        {step === 1 && (
          <div style={S.card}>
            <div style={S.cardH}>
              <h3 style={{ margin:0, fontSize:14, fontWeight:600 }}>บริษัทประกันที่คุณเป็นตัวแทน</h3>
              <span style={{ fontSize:12, color:'#64748b' }}>เลือกได้หลายบริษัท</span>
            </div>
            <div style={S.cardB}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
                {DEFAULT_COMPANIES.map(co => {
                  const on = !!selectedCos.find(c => c.id_suffix === co.id_suffix)
                  return (
                    <button key={co.id_suffix} onClick={() => toggleCompany(co)} style={{
                      padding:'12px 16px', borderRadius:10, cursor:'pointer', textAlign:'left',
                      border:`2px solid ${on ? co.color : '#e5eaf1'}`,
                      background: on ? `${co.color}14` : '#fff', transition:'all .15s',
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                        <span style={{ width:10, height:10, borderRadius:'50%', background:co.color, flexShrink:0 }} />
                        <span style={{ fontWeight:700, fontSize:13 }}>{co.short_name}</span>
                        {on && <span style={{ marginLeft:'auto', color:co.color, fontWeight:700 }}>✓</span>}
                      </div>
                      <div style={{ fontSize:12, color:'#64748b' }}>{co.name}</div>
                    </button>
                  )
                })}
              </div>

              <div style={{ borderTop:'1px solid #e5eaf1', paddingTop:16 }}>
                <div style={{ fontSize:10.5, fontWeight:700, color:'#94a3b8', marginBottom:10, textTransform:'uppercase', letterSpacing:.8 }}>บริษัทอื่นๆ (กรอกเอง)</div>
                {customCos.map((co, i) => (
                  <div key={i} style={{ display:'flex', gap:8, marginBottom:8 }}>
                    <input style={S.input} placeholder="ชื่อบริษัท" value={co.name}
                      onChange={e => setCustomCos(prev => prev.map((c,j) => j===i ? {...c, name:e.target.value, id_suffix:e.target.value.toLowerCase().replace(/\s+/g,'_'), color:'#64748b'} : c))} />
                    <input style={{...S.input, width:110}} placeholder="ชื่อย่อ" value={co.short_name||''}
                      onChange={e => setCustomCos(prev => prev.map((c,j) => j===i ? {...c, short_name:e.target.value} : c))} />
                    <button style={S.btnGh} onClick={() => setCustomCos(prev => prev.filter((_,j) => j!==i))}>✕</button>
                  </div>
                ))}
                <button style={S.btnSec} onClick={() => setCustomCos(prev => [...prev, {name:'',short_name:'',id_suffix:'',color:'#64748b'}])}>
                  + เพิ่มบริษัทอื่น
                </button>
              </div>
            </div>
            <div style={S.cardF}>
              <button style={S.btnPri} onClick={goToStep2}>ถัดไป →</button>
            </div>
          </div>
        )}

        {/* ══ STEP 2 ══ */}
        {step === 2 && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {coGroups.map((g, gi) => (
              <div key={gi} style={S.card}>
                {/* Company header */}
                <div style={{ padding:'14px 20px', borderBottom:'1px solid #e5eaf1', display:'flex', alignItems:'center', gap:10, background: `${g.co.color}08` }}>
                  <span style={{ width:12, height:12, borderRadius:'50%', background:g.co.color, flexShrink:0 }} />
                  <span style={{ fontWeight:700, fontSize:15 }}>{g.co.name}</span>
                  <span style={{ fontSize:12, color:'#94a3b8', fontFamily:'monospace' }}>{g.co.short_name}</span>
                  <span style={{ marginLeft:'auto', fontSize:12, color:'#64748b' }}>{g.codes.length} รหัสตัวแทน</span>
                </div>

                <div style={{ padding:20, display:'flex', flexDirection:'column', gap:16 }}>
                  {g.codes.map((c, ci) => (
                    <div key={ci} style={{ border:'1px solid #e5eaf1', borderRadius:10, overflow:'hidden' }}>

                      {/* Code row header */}
                      <div style={{ padding:'10px 16px', background:'#f8fafc', borderBottom:'1px solid #e5eaf1', display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ fontSize:11.5, fontWeight:700, color:'#64748b' }}>รหัสที่ {ci+1}</span>
                        {g.codes.length > 1 && (
                          <button style={{ ...S.btnGh, marginLeft:'auto', color:'#ef4444', borderColor:'#fca5a5' }}
                            onClick={() => removeCode(gi, ci)}>✕ ลบรหัสนี้</button>
                        )}
                      </div>

                      <div style={{ padding:16, display:'flex', flexDirection:'column', gap:14 }}>
                        {/* Code + Label */}
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                          <div>
                            <label style={S.label}>รหัสตัวแทน <span style={{ color:'#ef4444' }}>*</span></label>
                            <input style={S.input} placeholder={`${g.co.short_name}-XXXXX`}
                              value={c.code} onChange={e => setCode(gi, ci, 'code', e.target.value)} />
                          </div>
                          <div>
                            <label style={S.label}>ชื่อ / คำอธิบาย</label>
                            <input style={S.input} placeholder="เช่น ตัวแทนหลัก, ทีม Travel, Broker"
                              value={c.label} onChange={e => setCode(gi, ci, 'label', e.target.value)} />
                          </div>
                        </div>

                        {/* Block 1 */}
                        <div style={S.block}>
                          <div style={S.blockT}>🏢 กฎฝั่งบริษัท (Company Rules)</div>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                            <div>
                              <label style={S.label}>เครดิตเทอม</label>
                              <select style={S.select} value={c.credit_days}
                                onChange={e => setCode(gi, ci, 'credit_days', +e.target.value)}>
                                {[7,14,15,30,45,60,90].map(n => <option key={n} value={n}>{n} วัน</option>)}
                              </select>
                              <div style={S.hint}>บริษัทให้เครดิตกี่วันหลังเก็บเงินได้</div>
                            </div>
                            <div>
                              <label style={S.label}>เส้นตายยกเลิก</label>
                              <select style={S.select} value={c.cancel_after_days}
                                onChange={e => setCode(gi, ci, 'cancel_after_days', +e.target.value)}>
                                {[14,21,30,45,60,90].map(n => <option key={n} value={n}>{n} วัน</option>)}
                              </select>
                              <div style={S.hint}>ค้างนานสุดกี่วันก่อนบริษัทระงับกรมธรรม์</div>
                            </div>
                          </div>
                        </div>

                        {/* Block 2 */}
                        <div style={S.block}>
                          <div style={S.blockT}>👤 กฎฝั่งลูกค้า (Customer Rules)</div>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                            <div>
                              <label style={S.label}>ผ่อนผันรอลูกค้า</label>
                              <select style={S.select} value={c.customer_cancel_after_days}
                                onChange={e => setCode(gi, ci, 'customer_cancel_after_days', +e.target.value)}>
                                {[1,2,3,5,7,10].map(n => <option key={n} value={n}>{n} วัน</option>)}
                              </select>
                              <div style={S.hint}>หลังส่ง cancel warning รอลูกค้าอีกกี่วัน</div>
                            </div>
                            <div style={{ padding:'10px 12px', background:'#f1f5f9', borderRadius:8, fontSize:12, color:'#64748b', display:'flex', alignItems:'center' }}>
                              📅 งวดชำระคำนวณจากวันเริ่มกรมธรรม์อัตโนมัติ ไม่ใช้วันที่คงที่
                            </div>
                          </div>
                        </div>

                        {/* Block 3 */}
                        <div style={S.block}>
                          <div style={S.blockT}>🔔 ระบบแจ้งเตือน (Smart Alerts)</div>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                            <div>
                              <label style={S.label}>เตือนก่อน due (วัน)</label>
                              <select style={S.select} value={c.notify_before_due}
                                onChange={e => setCode(gi, ci, 'notify_before_due', +e.target.value)}>
                                {[3,5,7,10,14].map(n => <option key={n} value={n}>{n} วันก่อน due</option>)}
                              </select>
                              <div style={S.hint}>ขึ้น tab "ถึงเวลาเตือน" ก่อนกี่วัน</div>
                            </div>
                            <div>
                              <label style={S.label}>เตือนฉุกเฉินก่อน cancel (วัน)</label>
                              <select style={S.select} value={c.alert_before_cancel}
                                onChange={e => setCode(gi, ci, 'alert_before_cancel', +e.target.value)}>
                                {[1,2,3,5,7].map(n => <option key={n} value={n}>{n} วันก่อน cancel</option>)}
                              </select>
                              <div style={S.hint}>= Alert ที่วันที่ {c.cancel_after_days - c.alert_before_cancel} ของ grace {c.cancel_after_days} วัน</div>
                            </div>
                          </div>
                        </div>

                        {/* Summary */}
                        <div style={{ background:'#eff6ff', borderRadius:8, padding:'8px 14px', fontSize:12, color:'#1d4ed8', display:'flex', gap:14, flexWrap:'wrap' }}>
                          <span>💳 เครดิต {c.credit_days} วัน</span>
                          <span>⏰ Cancel วันที่ {c.cancel_after_days}</span>
                          <span>🔔 เตือน {c.notify_before_due} วันก่อน due</span>
                          <span>🚨 Alert ฉุกเฉินวันที่ {c.cancel_after_days - c.alert_before_cancel}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add code button */}
                  <button style={{ ...S.btnSec, alignSelf:'flex-start', borderStyle:'dashed' }}
                    onClick={() => addCode(gi)}>
                    + เพิ่มรหัสตัวแทนของ {g.co.name}
                  </button>
                </div>
              </div>
            ))}

            {/* Privacy note */}
            <div style={{ padding:'10px 16px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, fontSize:12, color:'#15803d', display:'flex', gap:8 }}>
              🔒 ข้อมูลทั้งหมดแยกจากผู้ใช้รายอื่น — ตัวแทนแต่ละคนเห็นเฉพาะข้อมูลของตัวเองเท่านั้น
            </div>

            {/* Footer buttons */}
            <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
              <button style={S.btnSec} onClick={() => setStep(1)}>← ย้อนกลับ</button>
              <button style={S.btnOk} onClick={finish} disabled={saving}>
                {saving ? 'กำลังบันทึก...' : '✓ เริ่มใช้งานเลย'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}