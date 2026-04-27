-- ============================================================================
-- 2026-04-28 · Payments table + promote tagged data to columns
--
-- Strategy: ADDITIVE. Old columns and notes-tags are NOT dropped here so
-- existing readers keep working. A follow-up migration will drop them once
-- every reader has switched to the new columns/views.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Promote `[policy_no:...]` → policies.policy_number
-- ----------------------------------------------------------------------------
ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS policy_number text;

UPDATE public.policies
SET    policy_number = (regexp_match(notes, '\[policy_no:(.*?)\]'))[1]
WHERE  policy_number IS NULL
  AND  notes ~ '\[policy_no:.*?\]';

CREATE INDEX IF NOT EXISTS idx_policies_user_policy_no
  ON public.policies (user_id, policy_number);

-- ----------------------------------------------------------------------------
-- 2. Promote `[doc:...]` → policies.doc_path
-- ----------------------------------------------------------------------------
ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS doc_path text;

UPDATE public.policies
SET    doc_path = (regexp_match(notes, '\[doc:(.*?)\]'))[1]
WHERE  doc_path IS NULL
  AND  notes ~ '\[doc:.*?\]';

-- ----------------------------------------------------------------------------
-- 3. Lookup table for payment channels (replaces `[ch:...]` free-text tag)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_channels (
  code  text PRIMARY KEY,
  label text NOT NULL,
  sort  int  NOT NULL DEFAULT 0
);

INSERT INTO public.payment_channels (code, label, sort) VALUES
  ('insurer_transfer', 'โอนเข้าบริษัทประกันโดยตรง', 1),
  ('cash',             'เงินสด',                     2),
  ('credit_card',      'บัตรเครดิต',                 3),
  ('agent_transfer',   'โอนเข้าตัวแทน',              4),
  ('other',            'อื่นๆ',                       5)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.payment_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS read_all ON public.payment_channels;
CREATE POLICY read_all ON public.payment_channels
  FOR SELECT TO authenticated USING (true);

-- ----------------------------------------------------------------------------
-- 4. payments table — first-class payment events
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id  uuid          NOT NULL REFERENCES public.installments(id) ON DELETE CASCADE,
  user_id         uuid          NOT NULL,
  amount          numeric(12,2) NOT NULL CHECK (amount >= 0),
  channel         text          REFERENCES public.payment_channels(code),
  slip_path       text,
  paid_at         timestamptz   NOT NULL DEFAULT now(),
  notes           text,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_installment ON public.payments (installment_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_paidat ON public.payments (user_id, paid_at DESC);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS own_data ON public.payments;
CREATE POLICY own_data ON public.payments
  FOR ALL TO authenticated
  USING       (user_id = auth.uid())
  WITH CHECK  (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 5. Backfill payments from installments
--    For every installment with paid_at + paid_amount, create one payments row.
--    - channel: parse from installments.notes `[ch:...]`, map free-text to canonical code
--    - slip_path: extract path from slip_url (legacy values may be full public URLs)
-- ----------------------------------------------------------------------------
INSERT INTO public.payments (
  installment_id, user_id, amount, channel, slip_path, paid_at, notes, created_at
)
SELECT
  i.id,
  i.user_id,
  i.paid_amount,
  CASE (regexp_match(i.notes, '\[ch:(.*?)\]'))[1]
    WHEN 'โอนเข้าบริษัทประกันโดยตรง' THEN 'insurer_transfer'
    WHEN 'เงินสด'                     THEN 'cash'
    WHEN 'บัตรเครดิต'                 THEN 'credit_card'
    WHEN 'โอนเข้าตัวแทน'              THEN 'agent_transfer'
    ELSE CASE WHEN (regexp_match(i.notes, '\[ch:(.*?)\]'))[1] IS NOT NULL
              THEN 'other' END
  END,
  CASE
    WHEN i.slip_url IS NULL                        THEN NULL
    WHEN i.slip_url LIKE 'http%/payment-slips/%'   THEN regexp_replace(i.slip_url, '^.*?/payment-slips/', '')
    WHEN i.slip_url LIKE 'http%/policy-docs/%'     THEN regexp_replace(i.slip_url, '^.*?/policy-docs/',   '')
    ELSE i.slip_url
  END,
  i.paid_at,
  NULLIF(regexp_replace(COALESCE(i.notes, ''), '\[ch:.*?\]\s*', ''), ''),
  i.created_at
FROM   public.installments i
WHERE  i.paid_at IS NOT NULL
  AND  i.paid_amount IS NOT NULL
  AND  NOT EXISTS (
    SELECT 1 FROM public.payments p WHERE p.installment_id = i.id
  );

-- ----------------------------------------------------------------------------
-- 6. Drop unused agent_codes columns (audited as dead in 2026_04_27 migration)
-- ----------------------------------------------------------------------------
ALTER TABLE public.agent_codes DROP COLUMN IF EXISTS remit_earliest;
ALTER TABLE public.agent_codes DROP COLUMN IF EXISTS notes;

-- ----------------------------------------------------------------------------
-- 7. View: aggregate payments per installment
--    Single source of truth for "how much has been paid against this installment".
--    Date-based health (prep/due/overdue/critical) still computes in JS for now;
--    will move into the view once readers migrate.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_installment_status AS
SELECT
  i.id,
  i.policy_id,
  i.user_id,
  i.installment_no,
  i.total_inst,
  i.amount_due,
  i.due_date,
  COALESCE(p.paid_total, 0)                                AS paid_total,
  GREATEST(i.amount_due - COALESCE(p.paid_total, 0), 0)    AS outstanding,
  p.last_paid_at,
  p.last_slip_path,
  (COALESCE(p.paid_total, 0) >= i.amount_due)              AS is_paid
FROM public.installments i
LEFT JOIN LATERAL (
  SELECT
    SUM(amount)                                          AS paid_total,
    MAX(paid_at)                                         AS last_paid_at,
    (ARRAY_AGG(slip_path ORDER BY paid_at DESC))[1]      AS last_slip_path
  FROM public.payments
  WHERE installment_id = i.id
) p ON TRUE;

GRANT SELECT ON public.v_installment_status TO authenticated;

COMMIT;

-- ============================================================================
-- After this migration:
--   ✓ policies.policy_number / .doc_path populated (notes tags still present)
--   ✓ payments rows backfilled for every paid installment
--   ✓ slip paths normalized (URLs stripped where present)
--   ✓ agent_codes.remit_earliest / .notes removed
--   ✓ v_installment_status available
--
-- NOT done here (deferred to post-writer-migration):
--   ✗ Drop installments.{paid_at, paid_amount, slip_url}
--   ✗ Strip [policy_no:] / [doc:] / [ch:] from notes columns
--   ✗ Drop policy_status='overdue' (replace with view)
-- ============================================================================
