// lib/domains/policy/repository.js
// DB access only.

const SELECT_BASE = `
  id, customer_id, company_id, agent_code, coverage_type,
  plate, plate_province, model, premium,
  policy_start, policy_end, policy_status, pay_mode,
  notes, ocr_data, created_at, updated_at, user_id
`

export async function getById(supabase, id) {
  const { data, error } = await supabase
    .from('policies')
    .select(`${SELECT_BASE}, customers(id, name, phone), companies(name, color)`)
    .eq('id', id).single()
  if (error) throw error
  return data
}

export async function listByCustomer(supabase, customerId) {
  const { data, error } = await supabase
    .from('policies')
    .select(`${SELECT_BASE}, companies(name,color), agent_codes(code,label)`)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function listForRemit(supabase, userId, agentCode) {
  const { data, error } = await supabase
    .from('policies')
    .select(`
      id, policy_start, policy_end, premium, pay_mode, coverage_type,
      plate, model, policy_status,
      customers(name),
      installments(id, installment_no, total_inst, amount_due, paid_at, paid_amount, slip_url, due_date)
    `)
    .eq('agent_code', agentCode)
    .eq('user_id', userId)
    .in('policy_status', ['active', 'reinstated'])
    .order('policy_start', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function insert(supabase, payload) {
  const { error } = await supabase.from('policies').insert(payload)
  if (error) throw error
}

export async function updateStatus(supabase, id, status) {
  const { error } = await supabase
    .from('policies').update({ policy_status: status }).eq('id', id)
  if (error) throw error
}

export async function remove(supabase, id) {
  const { error } = await supabase.from('policies').delete().eq('id', id)
  if (error) throw error
}
