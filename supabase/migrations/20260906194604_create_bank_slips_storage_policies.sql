/*
# Storage policies for bank-slips bucket

Private bucket. Students upload to their own folder (uid/...).
Admins can read all slips. Students can read their own.
*/

DROP POLICY IF EXISTS "bank_slips_insert_own_folder" ON storage.objects;
CREATE POLICY "bank_slips_insert_own_folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'bank-slips'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "bank_slips_select_own_or_admin" ON storage.objects;
CREATE POLICY "bank_slips_select_own_or_admin"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'bank-slips'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR is_admin()
  )
);

DROP POLICY IF EXISTS "bank_slips_delete_own" ON storage.objects;
CREATE POLICY "bank_slips_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'bank-slips'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
