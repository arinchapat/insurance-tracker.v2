// DB access for payments. RLS scopes by user_id.

const SELECT_BASE = `
  id, installment_id, user_id, amount, channel,
  slip_path, paid_at, notes, created_at
`

export async function insert(supabase, row) {
  const { error } = await supabase.from('payments').insert(row)
  if (error) throw error
}

export async function listForInstallment(supabase, installmentId) {
  const { data, error } = await supabase
    .from('payments')
    .select(SELECT_BASE)
    .eq('installment_id', installmentId)
    .order('paid_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function remove(supabase, id) {
  const { error } = await supabase.from('payments').delete().eq('id', id)
  if (error) throw error
}
