-- =====================================================================
-- SUPABASE FREE TIER OPTIMIZATION - DATABASE UPDATES
-- Execute these in Supabase SQL Editor
-- =====================================================================

-- =====================================================================
-- FIX 3: AUTO-PURGE OLD MESSAGES (24-Hour Retention)
-- =====================================================================

-- Enable pg_cron extension (required for scheduled jobs)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily message purge at midnight UTC
-- Deletes all messages older than 24 hours
SELECT cron.schedule(
    'purge-messages-24h',           -- Job name (unique identifier)
    '0 0 * * *',                    -- Cron: every day at 00:00 UTC
    'DELETE FROM public.messages WHERE created_at < NOW() - INTERVAL ''24 hours'''
);

-- Optional: Schedule daily active_users cleanup (remove inactive entries)
SELECT cron.schedule(
    'purge-inactive-users-10min',
    '*/30 * * * *',                 -- Every 30 minutes
    'DELETE FROM public.active_users WHERE updated_at < NOW() - INTERVAL ''10 minutes'''
);

-- =====================================================================
-- MONITORING QUERIES
-- =====================================================================

-- View current database size and message count
-- Run this to verify storage is staying low
-- SELECT 
--     pg_size_pretty(pg_database_size(current_database())) AS total_db_size,
--     COUNT(*) as total_messages,
--     ROUND((COUNT(*) * 5)::numeric / 1024, 2) as estimated_messages_size_mb
-- FROM public.messages;

-- Check scheduled jobs
-- SELECT * FROM cron.job;

-- View job execution history
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- =====================================================================
-- OPTIONAL: Manual Cleanup (Use Cautiously!)
-- =====================================================================

-- Manually delete messages older than 24 hours (one-time)
-- DELETE FROM public.messages WHERE created_at < NOW() - INTERVAL '24 hours';

-- Manually delete all inactive users
-- DELETE FROM public.active_users WHERE updated_at < NOW() - INTERVAL '10 minutes';

-- =====================================================================
-- VERIFICATION
-- =====================================================================

-- Verify cron job is scheduled
-- SELECT jobid, jobname, schedule, command FROM cron.job WHERE jobname LIKE 'purge%';

-- Check for any recent job failures
-- SELECT * FROM cron.job_run_details WHERE success = false ORDER BY start_time DESC LIMIT 5;


-- =====================================================================
-- UPDATE: SCHEMA SYNCHRONIZATION (MIGRATION RUN ON 2026-06-14)
-- =====================================================================

-- Add missing columns to the existing public.profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_at timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_by uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_expires_at timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_mod boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_owner boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_vip boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_2fa_enabled boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS two_fa_secret text;

-- Create app_settings table if not exists
CREATE TABLE IF NOT EXISTS public.app_settings (
    key text PRIMARY KEY,
    value text,
    updated_at timestamp with time zone DEFAULT now()
);

-- Create broadcasts table if not exists
CREATE TABLE IF NOT EXISTS public.broadcasts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message text NOT NULL,
    sent_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now()
);

-- Create private_messages table if not exists
CREATE TABLE IF NOT EXISTS public.private_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    type text DEFAULT 'text',
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on profiles and new tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;

-- Setup RLS policies for profiles
DROP POLICY IF EXISTS "Allow public read access to profiles" ON public.profiles;
CREATE POLICY "Allow public read access to profiles" ON public.profiles
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
CREATE POLICY "Allow users to update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;
CREATE POLICY "Allow users to insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Setup RLS policies for app_settings
DROP POLICY IF EXISTS "Allow public read to app_settings" ON public.app_settings;
CREATE POLICY "Allow public read to app_settings" ON public.app_settings
    FOR SELECT USING (true);

-- Setup RLS policies for private_messages
DROP POLICY IF EXISTS "Allow users to read their own PMs" ON public.private_messages;
CREATE POLICY "Allow users to read their own PMs" ON public.private_messages
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Allow users to send PMs" ON public.private_messages;
CREATE POLICY "Allow users to send PMs" ON public.private_messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);