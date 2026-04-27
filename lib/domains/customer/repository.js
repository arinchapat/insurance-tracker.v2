// lib/domains/customer/repository.js

const SELECT_BASE = `
  id, name, prefix, phone, email, id_number, inbox_name,
  channel, tag, notes, birth_date, province,
  created_at, updated_at, user_id
`

export async function getById(supabase, id) {
  const { data, error } = await supabase
    .from('customers').select(SELECT_BASE).eq('id', id).single()
  if (error) throw error
  return data
}

export async function listForUser(supabase, userId, { search } = {}) {
  let q = supabase
    .from('customers')
    .select(`${SELECT_BASE}, policies(id, policy_status)`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (search) q = q.ilike('name', `%${search}%`)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function insert(supabase, payload) {
  const { data, error } = await supabase
    .from('customers').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function update(supabase, id, patch) {
  const { error } = await supabase.from('customers').update(patch).eq('id', id)
  if (error) throw error
}
