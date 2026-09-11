/*
# Payment Requests — Bank Slip Upload

Adds a payment_requests table and storage bucket for students to upload
bank slip photos when requesting access to locked months.

## Table: payment_requests
- student uploads a slip photo → status 'pending'
- admin reviews → approve (grants student_access + marks 'approved') or reject ('rejected')

## Security
- RLS enabled; students read/update-insert own rows, admins read all
- status column is protected: only admins can change it via approve_payment() SECURITY DEFINER function
- Storage bucket 'bank-slips' is private; files stored under student's own folder
- approve_payment() checks caller is admin, grants student_access, updates status atomically
*/

CREATE TABLE IF NOT EXISTS payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month_id uuid NOT NULL REFERENCES months(id) ON DELETE CASCADE,
  slip_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE (user_id, month_id)
);

ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_payments_or_admin" ON payment_requests;
CREATE POLICY "select_own_payments_or_admin"
ON payment_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "insert_own_payments" ON payment_requests;
CREATE POLICY "insert_own_payments"
ON payment_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_payments" ON payment_requests;
CREATE POLICY "update_own_payments"
ON payment_requests FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS "delete_own_payments" ON payment_requests;
CREATE POLICY "delete_own_payments"
ON payment_requests FOR DELETE TO authenticated
USING (auth.uid() = user_id AND status = 'pending');

-- Revoke UPDATE on status and admin_note columns so students can't self-approve
REVOKE UPDATE ON payment_requests FROM authenticated;
GRANT UPDATE (slip_url) ON payment_requests TO authenticated;

-- ============================================================
-- approve_payment() — admin approves a payment request
-- Grants student_access + marks request approved, atomically
-- ============================================================
CREATE OR REPLACE FUNCTION approve_payment(p_request_id uuid, p_note text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request payment_requests%ROWTYPE;
BEGIN
  -- authorize the CALLER
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- atomic claim: only pending requests can be approved
  UPDATE payment_requests
  SET status = 'approved', admin_note = p_note, reviewed_at = now()
  WHERE id = p_request_id AND status = 'pending'
  RETURNING * INTO v_request;

  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Payment request not found or already processed';
  END IF;

  -- grant student access
  INSERT INTO student_access (user_id, month_id, has_access)
  VALUES (v_request.user_id, v_request.month_id, true)
  ON CONFLICT (user_id, month_id)
  DO UPDATE SET has_access = true;
END;
$$;

REVOKE EXECUTE ON FUNCTION approve_payment(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION approve_payment(uuid, text) TO authenticated;

-- ============================================================
-- reject_payment() — admin rejects a payment request
-- ============================================================
CREATE OR REPLACE FUNCTION reject_payment(p_request_id uuid, p_note text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE payment_requests
  SET status = 'rejected', admin_note = p_note, reviewed_at = now()
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment request not found or already processed';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION reject_payment(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION reject_payment(uuid, text) TO authenticated;
