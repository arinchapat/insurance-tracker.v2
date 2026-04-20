// app/api/ocr/route.js
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
]

const OCR_PROMPT = `
You are an expert OCR assistant for Thai insurance policies (กรมธรรม์ประกันภัย).
Extract the following fields from the document and return ONLY a valid JSON object.
Do NOT include any explanation, markdown, or code fences — just the raw JSON.

Fields to extract:
{
  "insured_name": "ชื่อ-นามสกุล ผู้เอาประกัน (string)",
  "policy_number": "เลขกรมธรรม์ เช่น 706-26-11-100-10034 (string)",
  "company_short_code": "one of: CHUBB, AXA, MTI, VIRIYAH, BKI, TIP, MSIG, SCBI, NAVAKIJ, ALLIANZ, OTHER",
  "coverage_type": "one of: Motor, CMI, Travel, Fire, PA",
  "motor_class": "ชั้นประกัน เช่น 1, 2, 2+, 3, 3+, พรบ — null ถ้าไม่ใช่รถยนต์",
  "plan_name": "ชื่อแผน/รุ่น เช่น SmartDrive, Privilege (string or null)",
  "premium_amount": "เบี้ยประกันรวม ตัวเลขล้วน ไม่มีจุลภาค เช่น 17173.30 (number as string)",
  "policy_start": "วันเริ่มคุ้มครอง รูปแบบ DD/MM/YYYY เป็น ค.ศ. เท่านั้น (แปลง พ.ศ. โดยลบ 543)",
  "policy_end": "วันสิ้นสุดคุ้มครอง รูปแบบ DD/MM/YYYY เป็น ค.ศ. เท่านั้น (แปลง พ.ศ. โดยลบ 543)",
  "license_plate": "ทะเบียนรถ (string or null)",
  "province": "จังหวัดทะเบียน (string or null)"
}

Rules:
- All dates MUST be in DD/MM/YYYY format using Christian Era (CE). If the document uses Buddhist Era (พ.ศ.), subtract 543 from the year.
- premium_amount must be a numeric string with no commas, e.g. "17173.30"
- coverage_type must exactly match one of: Motor, CMI, Travel, Fire, PA
- If a field cannot be found, use null.
- Return ONLY the JSON object. No markdown. No explanation.
`

/**
 * แปลงวันที่จาก Gemini (อาจเป็น พ.ศ. หรือ ค.ศ.) → ค.ศ. DD/MM/YYYY
 * รองรับ: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, YYYY/MM/DD
 */
function normalizeDateToCE(dateStr) {
  if (!dateStr) return null
  const str = String(dateStr).trim()

  let day, month, year

  // YYYY-MM-DD หรือ YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (isoMatch) {
    year = parseInt(isoMatch[1])
    month = parseInt(isoMatch[2])
    day = parseInt(isoMatch[3])
  } else {
    // DD/MM/YYYY หรือ DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
    if (dmyMatch) {
      day = parseInt(dmyMatch[1])
      month = parseInt(dmyMatch[2])
      year = parseInt(dmyMatch[3])
    } else {
      return str // คืนค่าเดิมถ้าแปลงไม่ได้
    }
  }

  // ถ้าปีเป็น พ.ศ. (> 2400) ให้ลบ 543
  if (year > 2400) year -= 543

  const dd = String(day).padStart(2, '0')
  const mm = String(month).padStart(2, '0')
  return `${dd}/${mm}/${year}`
}

/**
 * Parse JSON จาก Gemini response — รองรับ truncated JSON และ markdown fences
 */
function parseJSON(text) {
  if (!text) return null

  // ลบ markdown code fences ถ้ามี
  let cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()

  // พยายาม parse ตรงๆ ก่อน
  try {
    return JSON.parse(cleaned)
  } catch (_) {
    // ถ้า truncated — หา { แรก แล้วพยายาม repair
    const start = cleaned.indexOf('{')
    if (start === -1) return null

    let partial = cleaned.slice(start)
    partial = repairTruncatedJSON(partial)

    try {
      return JSON.parse(partial)
    } catch (_2) {
      console.error('[OCR] JSON parse failed after repair. Raw text:', text.slice(0, 300))
      return null
    }
  }
}

/**
 * พยายาม repair JSON ที่ถูกตัดกลางคัน
 */
function repairTruncatedJSON(str) {
  let depth = 0
  let inString = false
  let escape = false
  let lastSafePos = 0

  for (let i = 0; i < str.length; i++) {
    const ch = str[i]

    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue

    if (ch === '{' || ch === '[') depth++
    else if (ch === '}' || ch === ']') {
      depth--
      if (depth === 0) { lastSafePos = i + 1; break }
    } else if (ch === ',' && depth === 1) {
      lastSafePos = i
    }
  }

  if (lastSafePos > 0 && str[lastSafePos - 1] === '}') {
    return str.slice(0, lastSafePos)
  }

  if (lastSafePos > 0) {
    const trimmed = str.slice(0, lastSafePos).trimEnd()
    const withoutTrailingComma = trimmed.endsWith(',')
      ? trimmed.slice(0, -1)
      : trimmed
    return withoutTrailingComma + '\n}'
  }

  return str.trimEnd().replace(/,\s*$/, '') + '\n}'
}

/**
 * แปลง file → base64 part สำหรับ Gemini API
 */
async function fileToGeminiPart(file) {
  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  return {
    inlineData: {
      mimeType: file.type || 'application/octet-stream',
      data: base64,
    },
  }
}

/**
 * เรียก Gemini API — รองรับ fallback หลาย model
 */
async function callGemini(filePart, apiKey) {
  let lastError = null

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                filePart,
                { text: OCR_PROMPT },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 8192,
          },
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        console.warn(`[OCR] Model ${model} failed (${response.status}):`, err.slice(0, 200))
        lastError = new Error(`${model}: HTTP ${response.status}`)
        continue
      }

      const data = await response.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text

      if (!text) {
        console.warn(`[OCR] Model ${model} returned empty text`)
        lastError = new Error(`${model}: empty response`)
        continue
      }

      console.log(`[OCR] Model ${model} succeeded`)
      return { model, text }
    } catch (err) {
      console.warn(`[OCR] Model ${model} threw:`, err.message)
      lastError = err
    }
  }

  throw lastError || new Error('All Gemini models failed')
}

export async function POST(request) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ✅ รับ FormData (page.js ส่งมาเป็น FormData ที่มี field ชื่อ 'file')
    let file
    try {
      const formData = await request.formData()
      file = formData.get('file')
    } catch (parseErr) {
      // Content-Type ไม่ใช่ multipart/form-data
      console.error('[OCR] FormData parse error:', parseErr.message)
      return NextResponse.json(
        { error: 'กรุณาส่งไฟล์ในรูปแบบ multipart/form-data (field name: file)' },
        { status: 400 }
      )
    }

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // ตรวจสอบประเภทไฟล์เบื้องต้น
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
    if (file.type && !allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `ประเภทไฟล์ไม่รองรับ (${file.type}) กรุณาใช้ JPG, PNG, WEBP หรือ PDF` },
        { status: 400 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
    }

    // แปลงไฟล์ → Gemini part
    const filePart = await fileToGeminiPart(file)

    // เรียก Gemini
    const { model, text } = await callGemini(filePart, apiKey)
    console.log(`[OCR] Raw response (${model}):`, text.slice(0, 500))

    // Parse JSON
    const parsed = parseJSON(text)
    if (!parsed) {
      return NextResponse.json(
        { error: 'OCR failed to extract structured data', raw: text.slice(0, 500) },
        { status: 422 }
      )
    }

    // Normalize วันที่ → CE DD/MM/YYYY
    if (parsed.policy_start) parsed.policy_start = normalizeDateToCE(parsed.policy_start)
    if (parsed.policy_end)   parsed.policy_end   = normalizeDateToCE(parsed.policy_end)

    // Normalize premium (ลบ comma)
    if (parsed.premium_amount) {
      parsed.premium_amount = String(parsed.premium_amount).replace(/,/g, '')
    }

    // ✅ คืนค่าเป็น { data: parsed } — page.js อ่านจาก json.data
    return NextResponse.json({ success: true, data: parsed, model })
  } catch (err) {
    console.error('[OCR] Unhandled error:', err)
    return NextResponse.json({ error: err.message || 'OCR failed' }, { status: 500 })
  }
}