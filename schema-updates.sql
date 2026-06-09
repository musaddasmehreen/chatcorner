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