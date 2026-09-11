/*
# Storage policies for videos bucket

Public read bucket (videos need to be streamable by signed-in students).
Only admins can upload/update/delete video files.
*/

DROP POLICY IF EXISTS "videos_public_read" ON storage.objects;
CREATE POLICY "videos_public_read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'videos');

DROP POLICY IF EXISTS "videos_admin_insert" ON storage.objects;
CREATE POLICY "videos_admin_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'videos' AND is_admin());

DROP POLICY IF EXISTS "videos_admin_update" ON storage.objects;
CREATE POLICY "videos_admin_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'videos' AND is_admin())
WITH CHECK (bucket_id = 'videos' AND is_admin());

DROP POLICY IF EXISTS "videos_admin_delete" ON storage.objects;
CREATE POLICY "videos_admin_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'videos' AND is_admin());
