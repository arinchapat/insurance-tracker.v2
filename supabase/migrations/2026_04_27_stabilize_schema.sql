-- ============================================================================
-- 2026-04-27 · Stabilize schema (safe, incremental)
-- Run section-by-section. NO drops of tables or critical columns.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RLS · remove redundant / overly-permissive policies
-- ----------------------------------------------------------------------------

-- Permissive INSERT policy bypasses user_id check → drop it.
DROP POLICY IF EXISTS "Allow authenticated inserts" ON public.installments;

-- Duplicate of own_data with looser role grant ({public}) → drop it.
DROP POLICY IF EXISTS "Users can manage their own agent codes" ON public.agent_codes;

-- Verify the canonical policy is in place on every table:
--   ALL · authenticated · USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())
-- (already exists as own_data on policies, customers, contact_logs,
--  installments, agent_codes, companies — keep them.)

-- ----------------------------------------------------------------------------
-- 2. installments · constraint sanity check
-- ----------------------------------------------------------------------------
-- Composite UNIQUE(policy_id, installment_no) is correct.
-- The pg_indexes report confirmed exactly one index:
--   installments_policy_id_installment_no_key
-- No standalone UNIQUE on policy_id or installment_no exists.
-- → No change required. If a stray standalone UNIQUE is later observed:
--   ALTER TABLE public.installments DROP CONSTRAINT <name>;
-- and recreate the composite via:
--   ALTER TABLE public.installments
--     ADD CONSTRAINT installments_policy_id_installment_no_key
--     UNIQUE (policy_id, installment_no);

-- ----------------------------------------------------------------------------
-- 3. Helpful indexes (idempotent)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_installments_user_due
  ON public.installments (user_id, due_date);

CREATE INDEX IF NOT EXISTS idx_installments_policy
  ON public.installments (policy_id);

CREATE INDEX IF NOT EXISTS idx_policies_user_status
  ON public.policies (user_id, policy_status);

CREATE INDEX IF NOT EXISTS idx_policies_customer
  ON public.policies (customer_id);

CREATE INDEX IF NOT EXISTS idx_policies_agent
  ON public.policies (agent_code);

CREATE INDEX IF NOT EXISTS idx_contact_logs_customer
  ON public.contact_logs (customer_id, contacted_at DESC);

-- ----------------------------------------------------------------------------
-- 4. Columns to consider removing (DO NOT DROP without a backup verification)
-- ----------------------------------------------------------------------------
-- The columns below appear in agent_codes but are not referenced by any code
-- path after this audit. Inspect & confirm before dropping in a future
-- migration. Leaving them in place is harmless.
--
--   public.agent_codes.bill_cycle_day        -- still read by dashboard +
--                                            --   policies/[id] remittance calc
--                                            --   → KEEP (used)
--   public.agent_codes.remit_earliest        -- not referenced → candidate
--   public.agent_codes.notes                 -- not referenced → candidate
--
-- When ready, in a separate migration:
--   ALTER TABLE public.agent_codes DROP COLUMN remit_earliest;
--   ALTER TABLE public.agent_codes DROP COLUMN notes;
--
-- (left as comments — NOT executed here.)

-- ----------------------------------------------------------------------------
-- 5. Policy_number · stays embedded in policies.notes as `[policy_no:...]`
--    (no schema change). All readers parse via parsePolicyNotes().
-- ----------------------------------------------------------------------------
-- No SQL change required.

-- ----------------------------------------------------------------------------
-- 6. Payment channel · stays embedded in installments.notes as `[ch:...]`
--    (no schema change). The previous code wrote to a non-existent
--    `payment_channel` column — that has been removed in code.
-- ----------------------------------------------------------------------------
-- No SQL change required.

-- ============================================================================
-- end of migration
-- ============================================================================
