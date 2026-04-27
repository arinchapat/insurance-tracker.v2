'use client'
// app/(app)/policies/new/page.js

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Icons, fmtB } from '@/components/ui/Icons'

// ─── constants ────────────────────────────────────────────────────────────────

function genPolicyId() {
  const y = new Date().getFullYear()
  const n = Math.floor(1000 + Math.random() * 9000)
  return `P-${y}-${n}`
}

// แปลง DD/MM/YYYY (CE จาก OCR) → YYYY-MM-DD (สำหรับ <input type="date">)
function ocrDateToISO(str) {
  if (!str) return ''
  const parts = str.split('/')
  if (parts.length !== 3) return ''
  const [dd, mm, yyyy] = parts
  if (!dd || !mm || !yyyy) return ''
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

const COVERAGE_TYPES = [
  { id: 'Motor',  emoji: '🚗', label: 'Motor',  sub: 'ประกันรถยนต์' },
  { id: 'CMI',    emoji: '📋', label: 'พ.ร.บ.', sub: 'ภาคบังคับ' },
  { id: 'Travel', emoji: '✈️', label: 'Travel', sub: 'เดินทาง' },
  { id: 'Fire',   emoji: '🏠', label: 'Fire',   sub: 'อัคคีภัย' },
  { id: 'PA',     emoji: '🛡', label: 'PA',     sub: 'อุบัติเหตุ' },
]

const VEHICLE_CLASSES = ['1', '2', '2+', '3', '3+']
const PREFIXES = ['นาย', 'นาง', 'นางสาว', 'บริษัท', 'ห้างหุ้นส่วน']
const CHANNELS = ['LINE', 'LINE Ads', 'Facebook','Page Facebook', 'โทรศัพท์', 'Walk-in', 'อื่นๆ']

const THAI_PROVINCES = [
  "กรุงเทพมหานคร", "กระบี่", "กาญจนบุรี", "กาฬสินธุ์", "กำแพงเพชร", "ขอนแก่น", "จันทบุรี", "ฉะเชิงเทรา", "ชลบุรี", "ชัยนาท", "ชัยภูมิ", "ชุมพร", "เชียงราย", "เชียงใหม่", "ตรัง", "ตราด", "ตาก", "นครนายก", "นครปฐม", "นครพนม", "นครราชสีมา", "นครศรีธรรมราช", "นครสวรรค์", "นนทบุรี", "นราธิวาส", "น่าน", "บึงกาฬ", "บุรีรัมย์", "ปทุมธานี", "ประจวบคีรีขันธ์", "ปราจีนบุรี", "ปัตตานี", "พระนครศรีอยุธยา", "พะเยา", "พังงา", "พัทลุง", "พิจิตร", "พิษณุโลก", "เพชรบุรี", "เพชรบูรณ์", "แพร่", "ภูเก็ต", "มหาสารคาม", "มุกดาหาร", "แม่ฮ่องสอน", "ยโสธร", "ยะลา", "ร้อยเอ็ด", "ระนอง", "ระยอง", "ราชบุรี", "ลพบุรี", "ลำปาง", "ลำพูน", "เลย", "ศรีสะเกษ", "สกลนคร", "สงขลา", "สตูล", "สมุทรปราการ", "สมุทรสงคราม", "สมุทรสาคร", "สระแก้ว", "สระบุรี", "สิงห์บุรี", "สุโขทัย", "สุพรรณบุรี", "สุราษฎร์ธานี", "สุรินทร์", "หนองคาย", "หนองบัวลำภู", "อ่างทอง", "อำนาจเจริญ", "อุดรธานี", "อุตรดิตถ์", "อุทัยธานี", "อุบลราชธานี"
];

// ─── inline style tokens ──────────────────────────────────────────────────────

const S = {
  card:     { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,.05)' },
  cardH:    { padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  cardB:    { padding: '20px 20px' },
  cardF:    { padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 },
  label:    { fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 },
  req:      { color: '#ef4444' },
  hint:     { fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'block' },
  input:    { width: '100%', boxSizing: 'border-box', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', fontSize: 13, background: '#fff', color: '#0f172a', outline: 'none', fontFamily: 'inherit' },
  select:   { width: '100%', boxSizing: 'border-box', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', fontSize: 13, background: '#fff', color: '#0f172a', outline: 'none' },
  textarea: { width: '100%', boxSizing: 'border-box', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', fontSize: 13, resize: 'vertical', minHeight: 68, background: '#fff', color: '#0f172a', outline: 'none', fontFamily: 'inherit' },
  btnPri:   { padding: '9px 22px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 },
  btnSec:   { padding: '9px 22px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 },
  btnOk:    { padding: '9px 22px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 },
  btnWarn:  { padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, textDecoration: 'none' },
  grid:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  full:     { gridColumn: '1 / -1' },
  alertOk:  { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#15803d', display: 'flex', alignItems: 'flex-start', gap: 8 },
  alertInfo:{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#1d4ed8', display: 'flex', alignItems: 'flex-start', gap: 8 },
  alertErr: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'flex-start', gap: 8 },
}

function chip(active) {
  return {
    padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
    border:     active ? '2px solid #2563eb' : '1px solid #e2e8f0',
    background: active ? '#eff6ff'           : '#fff',
    color:      active ? '#1d4ed8'           : '#475569',
    fontWeight: active ? 700 : 400,
  }
}

// ─── FIX 2: helper แสดงชื่อลูกค้า — ป้องกันคำนำหน้าซ้ำ ─────────────────────
// กรณีที่ name field เก็บ "นางสาว สมชาย" แล้ว prefix = "นางสาว" จะไม่ต่อซ้ำ
function displayName(c) {
  if (!c) return ''
  const prefix = (c.prefix ?? '').trim()
  const name   = (c.name ?? '').trim()
  if (!prefix) return name
  if (name.startsWith(prefix)) return name   // มี prefix อยู่ใน name แล้ว → ไม่ต่อซ้ำ
  return `${prefix} ${name}`
}

// ─── component ────────────────────────────────────────────────────────────────

export default function NewPolicyPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const presetCustId = searchParams.get('customer_id') ?? ''
  const supabase     = createClient()

  const [authUser,   setAuthUser]   = useState(null)
  const [companies,  setCompanies]  = useState([])
  const [agentCodes, setAgentCodes] = useState([])
  const [customers,  setCustomers]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [loadErr,    setLoadErr]    = useState('')
  const [saving,     setSaving]     = useState(false)
  const [step,       setStep]       = useState(1)

  // OCR
  const [inputMode,  setInputMode]  = useState('manual')
  const [ocrFile,    setOcrFile]    = useState(null)
  const [ocrPreview, setOcrPreview] = useState(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrDone,    setOcrDone]    = useState(false)
  const [ocrErr,     setOcrErr]     = useState('')
  const [docPath,    setDocPath]    = useState('')
  const fileRef = useRef(null)

  // customer
  const [custQ,       setCustQ]       = useState('')
  const [showDrop,    setShowDrop]    = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newCust, setNewCust] = useState({ prefix: 'นาย', name: '', phone: '', channel: 'LINE', inbox_name: '' })
  const [addingCust,  setAddingCust]  = useState(false)

  // installment
  const [instCount,   setInstCount]   = useState(4)
  const [instAmounts, setInstAmounts] = useState([])

  // payment details (Step 2)
  const [isPaid, setIsPaid] = useState(false)
  const [payDetails, setPayDetails] = useState({
    channel: 'โอนเข้าบริษัทประกันโดยตรง',
    amount: '',
    notes: ''
  })
  const [slipFile, setSlipFile] = useState(null)
  const [slipPreview, setSlipPreview] = useState(null)
  const slipInputRef = useRef(null)

  const [form, setForm] = useState({
    id:            genPolicyId(),
    customer_id:   presetCustId,
    policy_number: '',          // ✅ FIX 4: เพิ่มช่องเลขกรมธรรม์
    company_id:    '',
    agent_code:    '',
    coverage_type: 'Motor',
    plate:         '',
    model:         '',
    plate_province: '',
    premium:       '',
    policy_start:  '',
    policy_end:    '',
    pay_mode:      'cash',
    notes:         '',
    vehicle_class: '1',
    vehicle_year:  '',
    destination:   '',
    property_addr: '',
    sum_insured:   '',
    travel_start:  '',
    travel_end:    '',
    travelers:     '1',
  })

  const setF  = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setNC = (k, v) => setNewCust(f => ({ ...f, [k]: v }))

  // Sync ยอดชำระงวดแรก
  useEffect(() => {
    if (form.pay_mode === 'installment' && instAmounts.length > 0) {
      setPayDetails(prev => ({ ...prev, amount: instAmounts[0] }))
    } else {
      setPayDetails(prev => ({ ...prev, amount: form.premium }))
    }
  }, [form.pay_mode, instAmounts, form.premium])

  // ─── load ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setLoadErr('')
      try {
        const { data: { user }, error: ae } = await supabase.auth.getUser()
        if (ae || !user) { setLoadErr('ไม่พบ session — กรุณา login ใหม่'); setLoading(false); return }
        setAuthUser(user)

        const [acR, cuR] = await Promise.all([
          supabase.from('agent_codes')
          .select('code, label, company_id, credit_days, cancel_after_days') 
          .eq('is_active', true).order('code'),
          supabase.from('customers')
            .select('id, prefix, name, phone, channel, inbox_name')
            .eq('user_id', user.id).order('name'),
        ])

        // ── Companies: ลอง is_enabled ก่อน → fallback is_active → fallback ทั้งหมด ──
        let cos = []
        const coActive = await supabase.from('companies').select('id, name').eq('is_active', true).order('name')
        
        if (!coActive.error && coActive.data?.length > 0) {
          cos = coActive.data
        } else {
          const coAll = await supabase.from('companies').select('id, name').order('name')
          if (!coAll.error) cos = coAll.data ?? []
          else console.warn('[companies load all]', coAll.error.message)
        }

        if (acR.error) console.warn('[agent_codes load]', acR.error.message)
        if (cuR.error) console.warn('[customers load]',   cuR.error.message)

        const acs = acR.data ?? []
        const cus = cuR.data ?? []

        setCompanies(cos)
        setAgentCodes(acs)
        setCustomers(cus)
        if (cos.length) setF('company_id', cos[0].id)

        if (presetCustId) {
          const c = cus.find(x => x.id === presetCustId)
          // ✅ FIX 2: ใช้ displayName() ป้องกันคำนำหน้าซ้ำ
          if (c) setCustQ(displayName(c))
        }
      } catch (e) { setLoadErr(e.message) }
      setLoading(false)
    })()
  }, [])

  const filteredCodes = agentCodes.filter(ac => String(ac.company_id) === String(form.company_id))

  useEffect(() => {
    if (filteredCodes.length > 0 && !filteredCodes.find(c => c.code === form.agent_code))
      setF('agent_code', filteredCodes[0].code)
    else if (filteredCodes.length === 0)
      setF('agent_code', '')
  }, [form.company_id, agentCodes])

  useEffect(() => {
    if (form.coverage_type === 'Travel' || !form.policy_start) return
    const d = new Date(form.policy_start)
    d.setFullYear(d.getFullYear() + 1); d.setDate(d.getDate() - 1)
    setF('policy_end', d.toISOString().split('T')[0])
  }, [form.policy_start])

  useEffect(() => {
    if (form.coverage_type !== 'Travel') return
    if (form.travel_start) setF('policy_start', form.travel_start)
    if (form.travel_end)   setF('policy_end',   form.travel_end)
  }, [form.travel_start, form.travel_end])

  useEffect(() => {
    const total = parseFloat(form.premium)
    if (!total || !instCount) return
    const base = Math.floor(total / instCount * 100) / 100
    const last = +(total - base * (instCount - 1)).toFixed(2)
    setInstAmounts(Array.from({ length: instCount }, (_, i) => i === instCount - 1 ? last : base))
  }, [form.premium, instCount])

  // ─── customer combobox ────────────────────────────────────────────────────

  const selectedCust = customers.find(c => c.id === form.customer_id)
  const filteredCusts = customers.filter(c => {
    const q = custQ.toLowerCase()
    return !q
      || displayName(c).toLowerCase().includes(q)
      || (c.phone ?? '').includes(q)
      || (c.inbox_name ?? '').toLowerCase().includes(q)
  }).slice(0, 10)

  function pickCust(c) {
    setF('customer_id', c.id)
    // ✅ FIX 2: ใช้ displayName() ป้องกันคำนำหน้าซ้ำใน input
    setCustQ(displayName(c))
    setShowDrop(false); setShowAddForm(false)
  }

  async function doAddCust() {
    if (!newCust.name.trim()) return alert('กรุณากรอกชื่อ')
    setAddingCust(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('customers').insert({
      prefix: newCust.prefix, name: newCust.name.trim(),
      phone: newCust.phone.trim() || null,
      channel: newCust.channel || null,
      inbox_name: newCust.inbox_name.trim() || null,
      user_id: user.id,
    }).select().single()
    if (error) { alert('เพิ่มไม่สำเร็จ: ' + error.message); setAddingCust(false); return }
    setCustomers(p => [...p, data].sort((a, b) => a.name.localeCompare(b.name, 'th')))
    pickCust(data)
    setNewCust({ prefix: 'นาย', name: '', phone: '', channel: 'LINE', inbox_name: '' })
    setShowAddForm(false); setAddingCust(false)
  }

  // ─── OCR ─────────────────────────────────────────────────────────────────

  function applyFile(file) {
    setOcrFile(file); setOcrPreview(URL.createObjectURL(file))
    setOcrDone(false); setOcrErr('')
  }

  // ✅ FIX 1: แปลง raw API error → ข้อความภาษาไทยที่เข้าใจง่าย
  function friendlyOcrError(rawMsg, httpStatus) {
    if (!rawMsg) rawMsg = ''
    if (httpStatus === 401 || rawMsg.includes('Unauthorized'))
      return 'Session หมดอายุ กรุณา Login ใหม่'
    if (rawMsg.includes('Content-Type') || rawMsg.includes('multipart') || rawMsg.includes('formData'))
      return 'รูปแบบไฟล์ไม่รองรับ กรุณาใช้ไฟล์ JPG, PNG หรือ PDF'
    if (rawMsg.includes('GEMINI_API_KEY') || rawMsg.includes('API key'))
      return 'ระบบ OCR ยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแลระบบ'
    if (httpStatus === 422 || rawMsg.includes('extract structured') || rawMsg.includes('OCR failed'))
      return 'ไม่สามารถอ่านข้อมูลจากเอกสารได้ กรุณาตรวจสอบว่าภาพชัดเจนและหันถูกทิศทาง'
    if (rawMsg.includes('All Gemini models failed') || rawMsg.includes('HTTP 5'))
      return 'ไม่สามารถเชื่อมต่อ AI ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง'
    if (rawMsg.includes('No file'))
      return 'ไม่พบไฟล์ที่อัปโหลด กรุณาเลือกไฟล์ใหม่'
    return 'อัปโหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
  }

  async function runOCR() {
    if (!ocrFile) return
    setOcrLoading(true); setOcrErr('')
    try {
      // ✅ FIX 1: ส่งเป็น FormData (ตรงกับที่ route.js ใช้ request.formData())
      // เดิมส่ง JSON + base64 ทำให้ route ฟ้อง Content-Type error
      const fd = new FormData()
      fd.append('file', ocrFile)

      const res = await fetch('/api/ocr', { method: 'POST', body: fd })
      const json = await res.json()

      if (!res.ok || json.error) {
        throw new Error(friendlyOcrError(json.error ?? '', res.status))
      }

      // route.js returns { success: true, data: { policy_number, license_plate, ... }, model }
      const d = json.data
      if (!d) throw new Error('ไม่ได้รับข้อมูลจากระบบ OCR')

      // ✅ ใช้ field names ตรงกับ OCR_PROMPT ใน route.js (license_plate, motor_class ฯลฯ)
      // ✅ FIX 4: เติม policy_number จาก OCR ด้วย
      if (d.policy_number)  setF('policy_number', d.policy_number)
      if (d.coverage_type && COVERAGE_TYPES.find(t => t.id === d.coverage_type)) setF('coverage_type', d.coverage_type)
      if (d.license_plate)  setF('plate', d.license_plate)
      if (d.plan_name)      setF('model', d.plan_name)
      if (d.premium_amount) setF('premium', String(d.premium_amount).replace(/,/g, ''))
      // ✅ FIX 1 (bonus): OCR คืน DD/MM/YYYY (CE) แต่ input ต้องการ YYYY-MM-DD
      if (d.policy_start)   setF('policy_start', ocrDateToISO(d.policy_start))
      if (d.policy_end)     setF('policy_end',   ocrDateToISO(d.policy_end))
      if (d.motor_class && VEHICLE_CLASSES.includes(d.motor_class)) setF('vehicle_class', d.motor_class)
        // ✅ ให้ OCR ดึงชื่อลูกค้ามาใส่
      if (d.insured_name) {
        const ocrName = d.insured_name.trim()
        // ค้นหาว่าชื่อนี้มีในระบบเราหรือยัง?
        const matchedCust = customers.find(c => displayName(c).includes(ocrName) || ocrName.includes(c.name))
        
        if (matchedCust) {
          // ถ้ามีลูกค้าเก่า -> เลือกให้เลย
          setF('customer_id', matchedCust.id)
          setCustQ(displayName(matchedCust))
        } else {
          // ถ้าเป็นลูกค้าใหม่ -> เอาชื่อไปหยอดใส่ฟอร์ม "เพิ่มลูกค้าใหม่" แล้วเปิดรอไว้เลย
          setCustQ(ocrName)
          setNC('name', ocrName)
          setShowDrop(false)
          setShowAddForm(true) // เปิดฟอร์มให้กดบันทึกได้ทันที!
        }
      }

      // อัปโหลดต้นฉบับ → Supabase Storage
      if (authUser) {
        const ext  = ocrFile.name.split('.').pop() || 'jpg'
        const path = `${authUser.id}/${form.id}.${ext}`
        const { error: upErr } = await supabase.storage.from('policy-docs').upload(path, ocrFile, { upsert: true })
        if (!upErr) setDocPath(path)
        else console.warn('[Storage]', upErr.message)
      }
      setOcrDone(true)
    } catch (err) {
      // แสดงข้อความที่แปลงเป็น friendly แล้ว (ถ้า throw จากด้านบน) หรือ network error
      const msg = err.message || ''
      // ตรวจ network/unknown error ที่อาจยังเป็น technical
      const isTechnical = msg.includes('fetch') || msg.includes('NetworkError') || msg.includes('Failed to')
      setOcrErr(isTechnical ? 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่' : msg)
    }
    setOcrLoading(false)
  }

  // ─── save ─────────────────────────────────────────────────────────────────

  function buildExtras() {
    const p = [], ct = form.coverage_type
    if (ct === 'Motor' || ct === 'CMI') {
      if (form.plate) p.push(`ทะเบียน ${form.plate}`)
      if (form.vehicle_class) p.push(`ชั้น ${form.vehicle_class}`)
      if (form.vehicle_year)  p.push(`ปีรถ ${form.vehicle_year}`)
      if (form.plate_province) p.push(form.plate_province) // เพิ่มจังหวัดเข้าไปใน notes
    }
    if (ct === 'Travel') {
      if (form.destination) p.push(`ปลายทาง ${form.destination}`)
      if (form.travelers)   p.push(`${form.travelers} คน`)
    }
    if (ct === 'Fire' && form.property_addr) p.push(form.property_addr)
    if (form.sum_insured) p.push(`ทุน ${fmtB(parseFloat(form.sum_insured) || 0)}`)
    return p.join(' · ')
  }

  async function save() {
    const ct = form.coverage_type
    if (!form.customer_id)   return alert('กรุณาเลือกลูกค้า')
    if (!form.company_id)    return alert('กรุณาเลือกบริษัท')
    if (!form.agent_code)    return alert('กรุณาเลือกรหัสตัวแทน')
    // ✅ FIX 4: validate เลขกรมธรรม์
    if (!form.policy_number) return alert('กรุณากรอกเลขกรมธรรม์')
    if (!form.premium)       return alert('กรุณากรอกเบี้ยประกัน')
    if (ct === 'Travel' && (!form.travel_start || !form.travel_end)) return alert('กรุณากรอกวันเดินทาง')
    if (ct !== 'Travel' && !form.policy_start) return alert('กรุณากรอกวันเริ่มคุ้มครอง')
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    const extras = buildExtras()
    // ✅ FIX 4: บันทึกเลขกรมธรรม์ไว้ใน notes (ไม่ต้องเพิ่ม column ใหม่)
    const finalNotes = [
      form.policy_number ? `[policy_no:${form.policy_number}]` : '',
      form.notes.trim(),
      extras ? `[extra: ${extras}]` : '',
      docPath ? `[doc:${docPath}]` : '',
    ].filter(Boolean).join('\n').trim()

    const { error: polErr } = await supabase.from('policies').insert({
      id: form.id, customer_id: form.customer_id,
      company_id: form.company_id, agent_code: form.agent_code,
      coverage_type: form.coverage_type,
      plate: form.plate || null, model: form.model || null,
      plate_province: form.plate_province || null,
      premium: parseFloat(form.premium),
      policy_start: form.policy_start || null, policy_end: form.policy_end || null,
      policy_status: 'active', pay_mode: form.pay_mode,
      notes: finalNotes || null, user_id: user.id,
    })
    if (polErr) { alert('บันทึกไม่สำเร็จ: ' + polErr.message); setSaving(false); return }

    // อัปโหลดสลิป (ถ้าลูกค้าจ่ายแล้วและมีการแนบไฟล์)
    let uploadedSlipUrl = null
    if (isPaid && slipFile) {
      const ext = slipFile.name.split('.').pop() || 'jpg'
      const path = `${user.id}/${form.id}-slip-inst1.${ext}`
      const { error: upErr } = await supabase.storage.from('payment-slips').upload(path, slipFile, { upsert: true })
      if (!upErr) uploadedSlipUrl = path
      else console.warn('[Storage Slip]', upErr.message)
    }

    if (form.pay_mode === 'installment') {
      const rows = instAmounts.map((amt, i) => {
        const due = new Date(form.policy_start); due.setMonth(due.getMonth() + i)
        const isFirstInstPaid = (i === 0 && isPaid);
        return { 
          policy_id: form.id, 
          installment_no: i + 1, 
          total_inst: instCount, 
          amount_due: amt, 
          due_date: due.toISOString().split('T')[0], 
          user_id: user.id,
          paid_at: isFirstInstPaid ? new Date().toISOString() : null,
          paid_amount: isFirstInstPaid ? parseFloat(payDetails.amount || amt) : null,
          payment_channel: isFirstInstPaid ? payDetails.channel : null,
          notes: isFirstInstPaid ? payDetails.notes : null,
          slip_url: isFirstInstPaid ? uploadedSlipUrl : null,
        }
      })
      await supabase.from('installments').insert(rows)
    } else {
      await supabase.from('installments').insert({
        policy_id: form.id, installment_no: 1, total_inst: 1,
        amount_due: parseFloat(form.premium), due_date: form.policy_start,
        user_id: user.id,
        paid_at: isPaid ? new Date().toISOString() : null,
        paid_amount: isPaid ? parseFloat(form.premium) : null,
        payment_channel: isPaid ? payDetails.channel : null,
        notes: isPaid ? payDetails.notes : null,
        slip_url: isPaid ? uploadedSlipUrl : null,
      })
    }
    router.push(`/policies/${form.id}`)
  }

  // ─── derived ──────────────────────────────────────────────────────────────

  const ct          = form.coverage_type
  const needVehicle = ct === 'Motor' || ct === 'CMI'
  const needTravel  = ct === 'Travel'
  const needFire    = ct === 'Fire'
  const selCo       = companies.find(c => c.id === form.company_id)
  const selAc       = agentCodes.find(c => c.code === form.agent_code)

  function step1Valid() {
    // ✅ FIX 4: รวม policy_number ใน validation
    if (!form.customer_id || !form.company_id || !form.agent_code || !form.policy_number || !form.premium) return false
    if (needTravel && (!form.travel_start || !form.travel_end)) return false
    if (!needTravel && !form.policy_start) return false
    return true
  }

  // ─── render ───────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: 'grid', placeItems: 'center', height: 280, color: '#64748b', fontSize: 14, gap: 8 }}>
      <div>⏳</div><div>กำลังโหลดข้อมูล...</div>
    </div>
  )

  if (loadErr) return (
    <div style={{ padding: 32 }}>
      <div style={S.alertErr}>⚠️ <span>{loadErr}</span></div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 28px', background: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b' }}>
          <Link href="/policies" style={{ color: '#64748b', textDecoration: 'none' }}>กรมธรรม์</Link>
          <span>/</span>
          <span style={{ color: '#0f172a', fontWeight: 600 }}>สร้างใหม่</span>
        </div>
        <div style={{ flex: 1 }} />
        <code style={{ fontSize: 11, background: '#f1f5f9', padding: '4px 10px', borderRadius: 6, color: '#475569' }}>{form.id}</code>
      </header>

      <div style={{ padding: '24px 28px', maxWidth: 820, margin: '0 auto' }}>

        {/* ── Input mode toggle ── */}
        <div style={{ ...S.card, marginBottom: 16, padding: '12px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginRight: 4 }}>วิธีกรอกข้อมูล:</span>
          {[{ id: 'manual', label: '✏️ กรอกเอง' }, { id: 'ocr', label: '📷 สแกนกรมธรรม์ (OCR)' }].map(m => (
            <button key={m.id} type="button" onClick={() => setInputMode(m.id)} style={chip(inputMode === m.id)}>
              {m.label}
            </button>
          ))}
        </div>

        {/* ── OCR Panel ── */}
        {inputMode === 'ocr' && (
          <div style={{ ...S.card, marginBottom: 16 }}>
            <div style={S.cardH}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>📷 สแกนกรมธรรม์ด้วย AI (Gemini OCR)</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  อัปโหลดรูปหน้ากรมธรรม์ → ระบบดึงข้อมูลและเติมฟอร์มให้อัตโนมัติ
                </div>
              </div>
            </div>
            <div style={S.cardB}>
              {!ocrPreview ? (
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault()
                    const f = e.dataTransfer.files?.[0]
                    if (f) applyFile(f)
                    else alert('กรุณาวางไฟล์รูปภาพหรือ PDF')
                  }}
                  onClick={() => fileRef.current?.click()}
                  style={{ border: '2px dashed #cbd5e1', borderRadius: 12, padding: '52px 24px', textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}
                >
                  <div style={{ fontSize: 44, marginBottom: 10 }}>🖼️</div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>ลากรูปมาวางที่นี่</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>หรือคลิกเพื่อเลือกไฟล์ · JPG / PNG / PDF</div>
                  {/* ✅ FIX 1: รับ PDF ด้วย ตรงกับที่ route.js รองรับ */}
                  <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) applyFile(f) }} />
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                  <img src={ocrPreview} alt="preview" style={{ width: 160, maxHeight: 220, objectFit: 'contain', borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: '#475569' }}>📄 {ocrFile?.name}</div>
                    {ocrDone && <div style={{ ...S.alertOk, marginBottom: 10 }}>✅ <span>OCR สำเร็จ — ตรวจสอบข้อมูลด้านล่างก่อนบันทึก</span></div>}
                    {docPath && <div style={{ ...S.alertInfo, marginBottom: 10 }}>🖼️ <span>บันทึกรูปต้นฉบับใน Supabase Storage แล้ว</span></div>}
                    {/* ✅ FIX 1: แสดง friendly error ภาษาไทย แทน raw technical error */}
                    {ocrErr && (
                      <div style={{ ...S.alertErr, marginBottom: 10 }}>
                        ❌ <div>
                          <div style={{ fontWeight: 600, marginBottom: 2 }}>อัปโหลดไม่สำเร็จ</div>
                          <div style={{ fontSize: 12 }}>{ocrErr}</div>
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {!ocrDone && (
                        <button type="button" style={{ ...S.btnPri, opacity: ocrLoading ? .6 : 1 }} onClick={runOCR} disabled={ocrLoading}>
                          {ocrLoading ? '⏳ กำลังวิเคราะห์...' : '🔍 อ่านกรมธรรม์'}
                        </button>
                      )}
                      {ocrDone && (
                        <button type="button" style={S.btnPri} onClick={runOCR}>
                          🔄 อ่านใหม่อีกครั้ง
                        </button>
                      )}
                      <button type="button" style={S.btnSec} onClick={() => { setOcrFile(null); setOcrPreview(null); setOcrDone(false); setOcrErr('') }}>
                        เปลี่ยนรูป
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step indicator ── */}
        <div style={{ display: 'flex', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
          {[{ n: 1, label: 'ข้อมูลกรมธรรม์' }, { n: 2, label: 'การชำระเงิน' }, { n: 3, label: 'ยืนยัน' }].map((s, i) => (
            <div key={s.n} onClick={() => step > s.n && setStep(s.n)} style={{
              flex: 1, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'center',
              borderBottom: step === s.n ? '3px solid #2563eb' : '3px solid transparent',
              cursor: step > s.n ? 'pointer' : 'default',
              borderRight: i < 2 ? '1px solid #e2e8f0' : 'none',
              background: step === s.n ? '#f8fafc' : '#fff',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center',
                fontWeight: 700, fontSize: 12, flexShrink: 0,
                background: step > s.n ? '#dcfce7' : step === s.n ? '#2563eb' : '#f1f5f9',
                color:      step > s.n ? '#16a34a' : step === s.n ? '#fff'    : '#94a3b8',
              }}>{step > s.n ? '✓' : s.n}</div>
              <div>
                <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>ขั้นที่ {s.n}</div>
                <div style={{ fontSize: 13, fontWeight: step === s.n ? 600 : 400, color: step === s.n ? '#0f172a' : '#64748b' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ══ STEP 1 ══ */}
        {step === 1 && (
          <div style={S.card}>
            <div style={S.cardH}><div style={{ fontWeight: 700, fontSize: 15 }}>ข้อมูลกรมธรรม์</div></div>
            <div style={S.cardB}>
              <div style={S.grid}>

                {/* Customer combobox */}
                <div style={S.full}>
                  <label style={S.label}>ลูกค้า <span style={S.req}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <input type="text" placeholder="พิมพ์ชื่อ เบอร์โทร หรือชื่อ LINE..."
                      value={custQ} autoComplete="off"
                      onChange={e => { setCustQ(e.target.value); setF('customer_id', ''); setShowDrop(true); setShowAddForm(false) }}
                      onFocus={() => setShowDrop(true)}
                      onBlur={() => setTimeout(() => setShowDrop(false), 200)}
                      style={{ ...S.input, borderColor: form.customer_id ? '#16a34a' : '#e2e8f0', paddingRight: form.customer_id ? 36 : 12 }}
                    />
                    {form.customer_id && (
                      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#16a34a', fontSize: 18 }}>✓</span>
                    )}
                    {showDrop && (
                      <div style={{ position: 'absolute', zIndex: 100, top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 260, overflowY: 'auto' }}>
                        {filteredCusts.length === 0 && custQ && (
                          <div style={{ padding: '10px 14px', fontSize: 12, color: '#94a3b8' }}>ไม่พบ "{custQ}"</div>
                        )}
                        {filteredCusts.map(c => (
                          <div key={c.id} onMouseDown={() => pickCust(c)}
                            style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              {/* ✅ FIX 2: ใช้ displayName() แสดงชื่อครั้งเดียว */}
                              <span style={{ fontWeight: 600 }}>{displayName(c)}</span>
                              {c.inbox_name && <span style={{ fontSize: 11, color: '#06b6d4', marginLeft: 8 }}>LINE: {c.inbox_name}</span>}
                            </div>
                            {c.phone && <span style={{ fontSize: 11, color: '#94a3b8' }}>{c.phone}</span>}
                          </div>
                        ))}
                        <div onMouseDown={() => { setShowDrop(false); setShowAddForm(true) }}
                          style={{ padding: '11px 14px', cursor: 'pointer', fontSize: 13, color: '#2563eb', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid #f1f5f9' }}>
                          <span style={{ fontSize: 16 }}>+</span>
                          <span>เพิ่มลูกค้าใหม่{custQ ? ` "${custQ}"` : ''}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Add customer inline form */}
                  {showAddForm && (
                    <div style={{ marginTop: 12, padding: 16, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#1d4ed8', marginBottom: 14 }}>➕ เพิ่มลูกค้าใหม่</div>
                      {/* Row 1 */}
                      <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr', gap: 8, marginBottom: 10 }}>
                        <div>
                          <label style={{ ...S.label, color: '#1d4ed8', fontSize: 11 }}>คำนำหน้า</label>
                          <select style={S.select} value={newCust.prefix} onChange={e => setNC('prefix', e.target.value)}>
                            {PREFIXES.map(p => <option key={p}>{p}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ ...S.label, color: '#1d4ed8', fontSize: 11 }}>ชื่อ-นามสกุล <span style={S.req}>*</span></label>
                          <input style={S.input} placeholder="สมชาย ใจดี" value={newCust.name} onChange={e => setNC('name', e.target.value)} autoFocus />
                        </div>
                        <div>
                          <label style={{ ...S.label, color: '#1d4ed8', fontSize: 11 }}>เบอร์โทรศัพท์</label>
                          <input style={S.input} placeholder="08x-xxx-xxxx" value={newCust.phone} onChange={e => setNC('phone', e.target.value)} />
                        </div>
                      </div>
                      {/* Row 2 */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                        <div>
                          <label style={{ ...S.label, color: '#1d4ed8', fontSize: 11 }}>ช่องทางติดต่อ</label>
                          <select style={S.select} value={newCust.channel} onChange={e => setNC('channel', e.target.value)}>
                            {CHANNELS.map(c => <option key={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ ...S.label, color: '#1d4ed8', fontSize: 11 }}>ชื่อ Inbox / LINE</label>
                          <input style={S.input} placeholder="ชื่อที่แสดงใน LINE หรือ Inbox" value={newCust.inbox_name} onChange={e => setNC('inbox_name', e.target.value)} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button type="button" style={{ ...S.btnSec, fontSize: 12 }} onClick={() => setShowAddForm(false)}>ยกเลิก</button>
                        <button type="button" style={{ ...S.btnPri, fontSize: 12 }} onClick={doAddCust} disabled={addingCust}>
                          {addingCust ? 'กำลังบันทึก...' : '✓ บันทึกลูกค้า'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ✅ FIX 3: Company — ส่งค่า company_id ที่ถูกต้อง (c.id UUID) */}
                <div>
                  <label style={S.label}>
                    บริษัทประกัน <span style={S.req}>*</span>
                    {companies.length === 0 && <span style={{ color: '#ef4444', fontWeight: 400, fontSize: 11, marginLeft: 4 }}>(ไม่พบ — ตั้งค่าที่ Settings)</span>}
                  </label>
                  <select
                    style={{ ...S.select, borderColor: companies.length === 0 ? '#fca5a5' : '#e2e8f0' }}
                    value={form.company_id}
                    onChange={e => setF('company_id', e.target.value)}
                    disabled={companies.length === 0}
                  >
                    {companies.length === 0
                      ? <option>— ไม่มีบริษัทในระบบ —</option>
                      : companies.map(c => (
                          // ✅ value={c.id} ส่ง UUID ไปเปรียบเทียบกับ agent_codes.company_id
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))
                    }
                  </select>
                </div>

                {/* ✅ FIX 4: เลขกรมธรรม์ — field สำคัญที่สุด วางคู่กับบริษัทประกัน */}
                <div>
                  <label style={S.label}>เลขกรมธรรม์ <span style={S.req}>*</span></label>
                  <input
                    style={{ ...S.input, borderColor: form.policy_number ? '#16a34a' : '#e2e8f0' }}
                    placeholder="706-26-11-100-10034"
                    value={form.policy_number}
                    onChange={e => setF('policy_number', e.target.value)}
                  />
                  <span style={S.hint}>เลขที่กรมธรรม์จากบริษัทประกัน (ไม่ใช่รหัสระบบ)</span>
                </div>

                {/* ✅ FIX 3: Agent code — แก้ dead-end โดยเพิ่มปุ่ม "ไปตั้งค่า" */}
                <div style={S.full}>
                  <label style={S.label}>รหัสตัวแทน <span style={S.req}>*</span></label>
                  {form.company_id && filteredCodes.length === 0 ? (
                    // Dead-end UX: แสดงปุ่มพาไปตั้งค่าแทนข้อความแดงที่ทำอะไรไม่ได้
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ ...S.alertErr, padding: '8px 12px', fontSize: 12 }}>
                        ⚠️ <div>
                          <div style={{ fontWeight: 600 }}>ยังไม่มีรหัสตัวแทนสำหรับบริษัทนี้</div>
                          <div style={{ marginTop: 2, fontWeight: 400 }}>กรุณาตั้งค่ารหัสตัวแทนก่อนสร้างกรมธรรม์</div>
                        </div>
                      </div>
                      <div>
                        <Link
                          href="/settings"
                          style={{ ...S.btnWarn, textDecoration: 'none' }}
                        >
                          ⚙️ ไปตั้งค่ารหัสตัวแทน
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <>
                      <select
                        style={S.select}
                        value={form.agent_code}
                        onChange={e => setF('agent_code', e.target.value)}
                        disabled={filteredCodes.length === 0}
                      >
                        {filteredCodes.length === 0
                          ? <option>— เลือกบริษัทก่อน —</option>
                          : filteredCodes.map(ac => (
                              <option key={ac.code} value={ac.code}>
                                {ac.code}{ac.label ? ` — ${ac.label}` : ''}
                              </option>
                            ))
                        }
                      </select>
                      {selAc && <span style={S.hint}>เครดิตส่งเงิน: {selAc.credit_days ?? '-'} วัน · เส้นตายยกเลิก: {selAc.cancel_after_days ?? '-'} วัน</span>}
                    </>
                  )}
                </div>

                {/* Coverage type */}
                <div style={S.full}>
                  <label style={S.label}>ประเภทกรมธรรม์ <span style={S.req}>*</span></label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {COVERAGE_TYPES.map(t => (
                      <button key={t.id} type="button" onClick={() => setF('coverage_type', t.id)}
                        style={{ padding: '10px 14px', borderRadius: 10, cursor: 'pointer', border: ct === t.id ? '2px solid #2563eb' : '1px solid #e2e8f0', background: ct === t.id ? '#eff6ff' : '#fff', color: ct === t.id ? '#1d4ed8' : '#475569', fontWeight: ct === t.id ? 700 : 400, fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 88 }}>
                        <span style={{ fontSize: 22 }}>{t.emoji}</span>
                        <span>{t.label}</span>
                        <span style={{ fontSize: 10, color: ct === t.id ? '#60a5fa' : '#94a3b8', fontWeight: 400 }}>{t.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Motor / CMI */}
                {needVehicle && <>
  <div style={{ ...S.full, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
    <div>
      <label style={S.label}>ทะเบียนรถ</label>
      <input style={S.input} placeholder="กข 1234" value={form.plate} onChange={e => setF('plate', e.target.value)} />
    </div>
    <div>
      <label style={S.label}>จังหวัด</label>
      <select style={S.select} value={form.plate_province} onChange={e => setF('plate_province', e.target.value)}>
        <option value="">— เลือกจังหวัด —</option>
        {THAI_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
    </div>
  </div>
  <div><label style={S.label}>ยี่ห้อ / รุ่น</label><input style={S.input} placeholder="Toyota Camry 2.5G" value={form.model} onChange={e => setF('model', e.target.value)} /></div>
                  <div><label style={S.label}>ปีรถ (ค.ศ.)</label><input style={S.input} placeholder="2022" maxLength={4} value={form.vehicle_year} onChange={e => setF('vehicle_year', e.target.value)} /></div>
                  {ct === 'Motor' && (
                    <div>
                      <label style={S.label}>ชั้นประกัน</label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {VEHICLE_CLASSES.map(c => (
                          <button key={c} type="button" onClick={() => setF('vehicle_class', c)}
                            style={{ ...chip(form.vehicle_class === c), padding: '7px 14px' }}>ชั้น {c}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </>}

                {/* Travel */}
                {needTravel && <>
                  <div><label style={S.label}>ปลายทาง</label><input style={S.input} placeholder="ญี่ปุ่น / ยุโรป" value={form.destination} onChange={e => setF('destination', e.target.value)} /></div>
                  <div><label style={S.label}>จำนวนผู้เดินทาง</label><input style={S.input} type="number" min="1" max="30" value={form.travelers} onChange={e => setF('travelers', e.target.value)} /></div>
                  <div><label style={S.label}>วันเดินทางออก <span style={S.req}>*</span></label><input style={S.input} type="date" value={form.travel_start} onChange={e => setF('travel_start', e.target.value)} /></div>
                  <div><label style={S.label}>วันกลับ <span style={S.req}>*</span></label><input style={S.input} type="date" value={form.travel_end} onChange={e => setF('travel_end', e.target.value)} /></div>
                </>}

                {/* Fire */}
                {needFire && <>
                  <div style={S.full}><label style={S.label}>ที่อยู่ทรัพย์สิน</label><input style={S.input} placeholder="บ้านเลขที่ ถนน ตำบล จังหวัด" value={form.property_addr} onChange={e => setF('property_addr', e.target.value)} /></div>
                  <div><label style={S.label}>ทุนประกัน (บาท)</label><input style={S.input} type="number" min="0" placeholder="2000000" value={form.sum_insured} onChange={e => setF('sum_insured', e.target.value)} /></div>
                </>}

                {/* PA */}
                {ct === 'PA' && (
                  <div><label style={S.label}>ทุนประกัน (บาท)</label><input style={S.input} type="number" min="0" placeholder="1000000" value={form.sum_insured} onChange={e => setF('sum_insured', e.target.value)} /></div>
                )}

                {/* Premium */}
                <div>
                  <label style={S.label}>เบี้ยประกัน (บาท) <span style={S.req}>*</span></label>
                  <input 
                  style={S.input} 
                  type="number" 
                  min="0" 
                  step="0.01" // รองรับทศนิยม 2 ตำแหน่ง
                  placeholder="28500.00" 
                  value={form.premium} 
                  onChange={e => setF('premium', e.target.value)}
                  />
                </div>

                {/* Dates */}
                {!needTravel && <>
                  <div>
                    <label style={S.label}>วันที่เริ่มคุ้มครอง <span style={S.req}>*</span></label>
                    <input style={S.input} type="date" value={form.policy_start} onChange={e => setF('policy_start', e.target.value)} />
                  </div>
                  <div>
                    <label style={S.label}>วันที่สิ้นสุดคุ้มครอง</label>
                    <input style={S.input} type="date" value={form.policy_end} onChange={e => setF('policy_end', e.target.value)} />
                    <span style={S.hint}>ระบบคำนวณ +1 ปี อัตโนมัติ · แก้ไขได้</span>
                  </div>
                </>}

                {/* Notes */}
                <div style={S.full}>
                  <label style={S.label}>หมายเหตุ</label>
                  <textarea style={S.textarea} rows={2} placeholder="ข้อมูลเพิ่มเติม..." value={form.notes} onChange={e => setF('notes', e.target.value)} />
                </div>

              </div>
            </div>
            <div style={{ ...S.cardF, justifyContent: 'flex-end' }}>
              <button type="button"
                style={{ ...S.btnPri, opacity: step1Valid() ? 1 : .5 }}
                onClick={() => {
                  if (!form.customer_id)   return alert('กรุณาเลือกลูกค้า')
                  if (!form.company_id)    return alert('กรุณาเลือกบริษัท')
                  if (!form.agent_code)    return alert('กรุณาเลือกรหัสตัวแทน')
                  // ✅ FIX 4: validate เลขกรมธรรม์ก่อนไป step 2
                  if (!form.policy_number) return alert('กรุณากรอกเลขกรมธรรม์')
                  if (!form.premium)       return alert('กรุณากรอกเบี้ยประกัน')
                  if (needTravel && (!form.travel_start || !form.travel_end)) return alert('กรุณากรอกวันเดินทาง')
                  if (!needTravel && !form.policy_start) return alert('กรุณากรอกวันเริ่มคุ้มครอง')
                  setStep(2)
                }}
              >
                ถัดไป: การชำระเงิน →
              </button>
            </div>
          </div>
        )}

        {/* ══ STEP 2 ══ */}
        {step === 2 && (
          <div style={S.card}>
            <div style={S.cardH}><div style={{ fontWeight: 700, fontSize: 15 }}>การชำระเงิน</div></div>
            <div style={S.cardB}>
              <div style={{ marginBottom: 20 }}>
                <label style={S.label}>วิธีชำระ</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => { setF('pay_mode', 'cash'); setIsPaid(false) }}
                    style={{ ...chip(form.pay_mode === 'cash'), padding: '10px 20px' }}>💵 ชำระเต็มจำนวน</button>
                  <button type="button" onClick={() => { setF('pay_mode', 'installment'); setIsPaid(false) }}
                    style={{ ...chip(form.pay_mode === 'installment'), padding: '10px 20px' }}>📅 ผ่อนชำระ</button>
                </div>
              </div>

              {/* ── ชำระเต็มจำนวน ── */}
              {form.pay_mode === 'cash' && (
                <div style={{ padding: 16, border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>ยอดที่ต้องชำระ: <b style={{ fontSize: 16, color: '#0f172a' }}>{fmtB(parseFloat(form.premium) || 0)}</b></div>
                  </div>

                  <label style={{ ...S.label, fontSize: 13, color: '#0f172a' }}>ลูกค้าชำระเงินเข้ามาหรือยัง?</label>
                  <div style={{ display: 'flex', gap: 20, marginBottom: isPaid ? 16 : 0 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                      <input type="radio" checked={!isPaid} onChange={() => setIsPaid(false)} />
                      ยังไม่ชำระ (เก็บเงินทีหลัง)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                      <input type="radio" checked={isPaid} onChange={() => setIsPaid(true)} />
                      ชำระเรียบร้อยแล้ว
                    </label>
                  </div>

                  {/* ฟอร์มข้อมูลการโอน (เต็มจำนวน) */}
                  {isPaid && (
                    <div style={{ display: 'grid', gap: 12, padding: 16, background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', marginTop: 16 }}>
                      <div style={S.grid}>
                        <div>
                          <label style={S.label}>ช่องทางโอนเงิน</label>
                          <select style={S.select} value={payDetails.channel} onChange={e => setPayDetails({ ...payDetails, channel: e.target.value })}>
                            <option>โอนเข้าบริษัทประกันโดยตรง</option>
                            <option>โอนผ่านบัญชีตัวแทน</option>
                          </select>
                        </div>
                        <div>
                          <label style={S.label}>แนบหลักฐาน (สลิป)</label>
                          <input type="file" accept="image/*" ref={slipInputRef} style={{ display: 'none' }}
                            onChange={e => {
                              const file = e.target.files?.[0]; 
                              if(file) { setSlipFile(file); setSlipPreview(URL.createObjectURL(file)) }
                            }} 
                          />
                          <button type="button" style={{ ...S.btnSec, width: '100%', justifyContent: 'center' }} onClick={() => slipInputRef.current?.click()}>
                            {slipFile ? `✅ ${slipFile.name}` : '📁 แนบสลิปโอนเงิน'}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label style={S.label}>หมายเหตุการโอน (ตัวเลือก)</label>
                        <input style={S.input} placeholder="เช่น โอนเข้า SCB ตัวแทน, ลูกค้าจ่ายเงินสด..." 
                          value={payDetails.notes} onChange={e => setPayDetails({ ...payDetails, notes: e.target.value })} />
                      </div>
                      {slipPreview && <img src={slipPreview} alt="Slip" style={{ height: 100, objectFit: 'contain', borderRadius: 8, border: '1px solid #e2e8f0' }} />}
                    </div>
                  )}
                </div>
              )}

              {/* ── ผ่อนชำระ ── */}
              {form.pay_mode === 'installment' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={S.label}>จำนวนงวด</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {[2, 3, 4, 6, 8, 10, 12].map(n => (
                        <button key={n} type="button" onClick={() => setInstCount(n)}
                          style={{ ...chip(instCount === n), padding: '7px 14px' }}>{n} งวด</button>
                      ))}
                    </div>
                  </div>
                  
                  {instAmounts.length > 0 && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['งวดที่', 'ครบกำหนด', 'ยอด (บาท)'].map((h, i) => (
                            <th key={h} style={{ padding: '10px 14px', textAlign: i === 2 ? 'right' : 'left', fontSize: 12, color: '#475569', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {instAmounts.map((amt, i) => {
                          const d = form.policy_start ? new Date(form.policy_start) : new Date()
                          d.setMonth(d.getMonth() + i)
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px 14px', fontSize: 13, color: '#64748b' }}>งวด {i + 1}/{instCount}</td>
                              <td style={{ padding: '10px 14px', fontSize: 13, color: '#64748b' }}>{d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                <input type="number" value={amt}
                                  onChange={e => { const a = [...instAmounts]; a[i] = parseFloat(e.target.value) || 0; setInstAmounts(a) }}
                                  style={{ width: 110, textAlign: 'right', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 8px', fontSize: 13 }} />
                              </td>
                            </tr>
                          )
                        })}
                        <tr style={{ background: '#f8fafc' }}>
                          <td colSpan={2} style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13 }}>รวมทั้งหมด</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: 14 }}>{fmtB(instAmounts.reduce((s, a) => s + a, 0))}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}

                  <div style={{ padding: 16, border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc' }}>
                    <label style={{ ...S.label, fontSize: 13, color: '#0f172a' }}>ลูกค้าชำระเงิน "งวดที่ 1" เข้ามาหรือยัง?</label>
                    <div style={{ display: 'flex', gap: 20, marginBottom: isPaid ? 16 : 0 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                        <input type="radio" checked={!isPaid} onChange={() => setIsPaid(false)} />
                        ยังไม่ชำระ
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                        <input type="radio" checked={isPaid} onChange={() => setIsPaid(true)} />
                        ชำระงวดแรกแล้ว
                      </label>
                    </div>

                    {/* ฟอร์มข้อมูลการโอน (งวด 1) */}
                    {isPaid && (
                      <div style={{ display: 'grid', gap: 12, padding: 16, background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', marginTop: 16 }}>
                        <div style={S.grid}>
                          <div>
                            <label style={S.label}>ยอดที่ชำระ (สามารถแก้ปัดเศษได้)</label>
                            <input style={S.input} type="number" value={payDetails.amount} 
                              onChange={e => setPayDetails({ ...payDetails, amount: e.target.value })} />
                          </div>
                          <div>
                            <label style={S.label}>ช่องทางโอนเงิน</label>
                            <select style={S.select} value={payDetails.channel} onChange={e => setPayDetails({ ...payDetails, channel: e.target.value })}>
                              <option>โอนเข้าบริษัทประกันโดยตรง</option>
                              <option>โอนผ่านบัญชีตัวแทน</option>
                            </select>
                          </div>
                        </div>
                        <div style={S.grid}>
                          <div style={S.full}>
                            <label style={S.label}>แนบหลักฐาน (สลิปงวด 1)</label>
                            <input type="file" accept="image/*" ref={slipInputRef} style={{ display: 'none' }}
                              onChange={e => {
                                const file = e.target.files?.[0]; 
                                if(file) { setSlipFile(file); setSlipPreview(URL.createObjectURL(file)) }
                              }} 
                            />
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                              <button type="button" style={{ ...S.btnSec }} onClick={() => slipInputRef.current?.click()}>
                                {slipFile ? `เปลี่ยนสลิป` : '📁 แนบสลิปโอนเงิน'}
                              </button>
                              {slipFile && <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>✅ {slipFile.name}</span>}
                            </div>
                            {slipPreview && <img src={slipPreview} alt="Slip" style={{ height: 100, marginTop: 10, objectFit: 'contain', borderRadius: 8, border: '1px solid #e2e8f0' }} />}
                          </div>
                          <div style={S.full}>
                            <label style={S.label}>หมายเหตุการโอน</label>
                            <input style={S.input} placeholder="ระบุเพิ่มเติมถ้ามี..." 
                              value={payDetails.notes} onChange={e => setPayDetails({ ...payDetails, notes: e.target.value })} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>
            <div style={{ ...S.cardF, justifyContent: 'space-between' }}>
              <button type="button" style={S.btnSec} onClick={() => setStep(1)}>← ย้อนกลับ</button>
              <button type="button" style={S.btnPri} onClick={() => setStep(3)}>ถัดไป: ยืนยัน →</button>
            </div>
          </div>
        )}

        {/* ══ STEP 3 ══ */}
        {step === 3 && (
          <div style={S.card}>
            <div style={S.cardH}><div style={{ fontWeight: 700, fontSize: 15 }}>ยืนยันการสร้างกรมธรรม์</div></div>
            <div style={S.cardB}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  ['เลขที่ในระบบ', <code key="id" style={{ fontSize: 12, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{form.id}</code>],
                  // ✅ FIX 4: แสดงเลขกรมธรรม์ในหน้ายืนยัน
                  ['เลขกรมธรรม์', form.policy_number || '—'],
                  // ✅ FIX 2: ใช้ displayName() ป้องกันคำนำหน้าซ้ำในหน้า summary
                  ['ลูกค้า', displayName(selectedCust) || '—'],
                  ['บริษัท', selCo?.name ?? '—'],
                  ['รหัสตัวแทน', form.agent_code || '—'],
                  ['ประเภท', COVERAGE_TYPES.find(t => t.id === ct)?.label ?? ct],
                  needVehicle && ['ทะเบียน', form.plate || '—'],
                  needVehicle && ['รุ่น', form.model || '—'],
                  ct === 'Motor' && ['ชั้นประกัน', form.vehicle_class ? `ชั้น ${form.vehicle_class}` : '—'],
                  needTravel && ['ปลายทาง', form.destination || '—'],
                  needFire && ['ที่อยู่ทรัพย์สิน', form.property_addr || '—'],
                  ['เบี้ยประกัน', fmtB(parseFloat(form.premium) || 0)],
                  ['วิธีชำระ', form.pay_mode === 'cash' ? 'เงินสด' : `ผ่อน ${instCount} งวด`],
                  ['วันเริ่มคุ้มครอง', form.policy_start || '—'],
                  ['วันสิ้นสุด', form.policy_end || '—'],
                ].filter(Boolean).map(([lbl, val]) => (
                  <div key={lbl} style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: .5 }}>{lbl}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 4 }}>{val}</div>
                  </div>
                ))}
              </div>
              {docPath && <div style={{ ...S.alertInfo, marginTop: 14 }}>🖼️ <span>รูปกรมธรรม์ต้นฉบับบันทึกใน Storage แล้ว</span></div>}
              {form.pay_mode === 'installment' && (
                <div style={{ ...S.alertInfo, marginTop: 12 }}>📅 <div>จะสร้าง <b>{instCount} งวด</b> อัตโนมัติ · รวม {fmtB(instAmounts.reduce((s, a) => s + a, 0))}</div></div>
              )}
            </div>
            <div style={{ ...S.cardF, justifyContent: 'space-between' }}>
              <button type="button" style={S.btnSec} onClick={() => setStep(2)}>← ย้อนกลับ</button>
              <button type="button" style={{ ...S.btnOk, opacity: saving ? .6 : 1 }} onClick={save} disabled={saving}>
                {saving ? '⏳ กำลังบันทึก...' : '✅ ยืนยันสร้างกรมธรรม์'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}