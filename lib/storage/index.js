// Single source of truth for storage paths and uploads.
// Pages MUST NOT call supabase.storage.from(...).upload() directly.

export const BUCKETS = {
  policyDoc: 'policy-docs',
  slip:      'payment-slips',
}

const MIME_ALLOW = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES  = 10 * 1024 * 1024

const EXT_BY_MIME = {
  'application/pdf': 'pdf',
  'image/jpeg':      'jpg',
  'image/png':       'png',
  'image/webp':      'webp',
}

function extOf(file) {
  return EXT_BY_MIME[file.type] ?? (file.name?.split('.').pop()?.toLowerCase() || 'bin')
}

function validate(file) {
  if (!file)                 throw new Error('ไม่พบไฟล์')
  if (file.size > MAX_BYTES) throw new Error(`ไฟล์ใหญ่เกิน ${MAX_BYTES / 1024 / 1024} MB`)
  if (file.type && !MIME_ALLOW.includes(file.type))
    throw new Error(`ประเภทไฟล์ไม่รองรับ (${file.type})`)
}

// ─── Path builders — deterministic, derivable from row IDs ──────────────────

export function policyDocPath(userId, policyId, file) {
  return `${userId}/policies/${policyId}/document.${extOf(file)}`
}

export function slipPath(userId, paymentId, file) {
  return `${userId}/payments/${paymentId}.${extOf(file)}`
}

// ─── Uploaders — return canonical path. Never URLs. ─────────────────────────

export async function uploadPolicyDoc(supabase, { userId, policyId, file }) {
  validate(file)
  const path = policyDocPath(userId, policyId, file)
  const { error } = await supabase.storage
    .from(BUCKETS.policyDoc)
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  return path
}

export async function uploadSlip(supabase, { userId, paymentId, file }) {
  validate(file)
  const path = slipPath(userId, paymentId, file)
  const { error } = await supabase.storage
    .from(BUCKETS.slip)
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  return path
}

// ─── Reader — always signed. Public URLs are not used. ──────────────────────

export async function getSlipUrl(supabase, path, ttlSec = 3600) {
  return signedUrl(supabase, BUCKETS.slip, path, ttlSec)
}

export async function getPolicyDocUrl(supabase, path, ttlSec = 3600) {
  return signedUrl(supabase, BUCKETS.policyDoc, path, ttlSec)
}

async function signedUrl(supabase, bucket, path, ttl) {
  if (!path) return null
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttl)
  if (error) throw error
  return data?.signedUrl ?? null
}

// ─── Cleanup — call from delete flows so storage doesn't accumulate orphans ──

export async function removeSlip(supabase, path) {
  if (!path) return
  await supabase.storage.from(BUCKETS.slip).remove([path])
}

export async function removePolicyDoc(supabase, path) {
  if (!path) return
  await supabase.storage.from(BUCKETS.policyDoc).remove([path])
}
