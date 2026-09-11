/*
# Allow admins to delete any payment request

Currently only students can delete their own pending requests.
Admins need to clear processed (approved/rejected) payment history.
*/

DROP POLICY IF EXISTS "delete_own_payments" ON payment_requests;
CREATE POLICY "delete_own_or_admin_payments"
ON payment_requests FOR DELETE TO authenticated
USING (
  auth.uid() = user_id AND status = 'pending'
  OR is_admin()
);
