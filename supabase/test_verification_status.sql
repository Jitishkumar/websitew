-- This script is for testing and debugging verification status issues

-- 1. Check if the verified_accounts table exists and has the correct structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'verified_accounts';

-- 2. Check if RLS is enabled on the verified_accounts table
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'verified_accounts';

-- 3. Check existing RLS policies on the verified_accounts table
SELECT * 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'verified_accounts';

-- 4. Check if there are any records in the verified_accounts table
SELECT id, username, verified, created_at, updated_at 
FROM public.verified_accounts;

-- 5. Check if there are any verified accounts
SELECT id, username, verified, created_at, updated_at 
FROM public.verified_accounts 
WHERE verified = TRUE;

-- 6. For a specific user, check if they have a record in the verified_accounts table
-- Replace 'user_id_here' with the actual user ID you want to check
-- SELECT p.id, p.username, va.verified, va.created_at, va.updated_at 
-- FROM public.profiles p
-- LEFT JOIN public.verified_accounts va ON p.id = va.id
-- WHERE p.id = 'user_id_here';

-- 7. For testing, you can manually set a user's verification status to true
-- Replace 'user_id_here' with the actual user ID you want to verify
-- UPDATE public.verified_accounts
-- SET verified = TRUE, updated_at = timezone('utc'::text, now())
-- WHERE id = 'user_id_here';

-- 8. If a user doesn't have a record in the verified_accounts table, you can insert one
-- Replace 'user_id_here' and 'username_here' with the actual user ID and username
-- INSERT INTO public.verified_accounts (id, username, document_url, selfie_url, verified)
-- SELECT id, username, 'placeholder_document_url', 'placeholder_selfie_url', TRUE
-- FROM public.profiles
-- WHERE id = 'user_id_here'
-- ON CONFLICT (id) DO NOTHING;