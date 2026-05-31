-- =====================================================================
-- CHATCORNER - COMPLETE SUPABASE SQL SCHEMA
-- Execute this entire script in Supabase SQL Editor
-- =====================================================================

-- =====================================================================
-- TABLE 1: PUBLIC.MESSAGES
-- Core messaging table for storing chat messages across rooms
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_id TEXT NOT NULL,
    username TEXT NOT NULL,
    message_text VARCHAR(500) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT message_length_check CHECK (LENGTH(message_text) <= 500)
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_room_created ON public.messages(room_id, created_at DESC);

-- Enable Row Level Security (optional but recommended for multi-user safety)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create a policy allowing anyone to read messages
CREATE POLICY "Enable read access for all users" ON public.messages
    FOR SELECT USING (true);

-- Create a policy allowing insert for authenticated users
CREATE POLICY "Enable insert for all users" ON public.messages
    FOR INSERT WITH CHECK (true);

-- =====================================================================
-- TABLE 2: PUBLIC.ACTIVE_USERS
-- Registry of active peers connected to each chatroom
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.active_users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    peer_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT peer_id_not_empty CHECK (LENGTH(peer_id) > 0),
    CONSTRAINT username_not_empty CHECK (LENGTH(username) > 0)
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_active_users_room_id ON public.active_users(room_id);
CREATE INDEX IF NOT EXISTS idx_active_users_peer_id ON public.active_users(peer_id);
CREATE INDEX IF NOT EXISTS idx_active_users_updated_at ON public.active_users(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE public.active_users ENABLE ROW LEVEL SECURITY;

-- Create read policy
CREATE POLICY "Enable read access for active users" ON public.active_users
    FOR SELECT USING (true);

-- Create insert/update policy
CREATE POLICY "Enable insert/update for all users" ON public.active_users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON public.active_users
    FOR UPDATE USING (true) WITH CHECK (true);

-- =====================================================================
-- REAL-TIME SETUP: Enable Replication for WebSocket Streaming
-- =====================================================================

-- Step 1: Set messages table to FULL replica identity (required for real-time)
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Step 2: Set active_users table to FULL replica identity
ALTER TABLE public.active_users REPLICA IDENTITY FULL;

-- Step 3: Add both tables to replication publication
-- This enables PostgreSQL to broadcast changes via WebSocket
BEGIN;
    -- Drop existing publication if it exists
    DROP PUBLICATION IF EXISTS supabase_realtime;
    
    -- Create new publication for real-time events
    CREATE PUBLICATION supabase_realtime FOR TABLE public.messages, public.active_users;
COMMIT;

-- Verify replication is enabled
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- =====================================================================
-- AUTOMATED MAINTENANCE: PG_CRON SCHEDULER
-- Automatically purge old messages to keep database lean
-- =====================================================================

-- Enable pg_cron extension (must be done by superuser)
-- Note: Contact Supabase support if pg_cron extension is not available
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create scheduled job: Daily cleanup at midnight UTC
-- Deletes all messages older than 3 days
SELECT cron.schedule(
    'flush-stale-logs',           -- Job name (unique identifier)
    '0 0 * * *',                  -- Cron expression: every day at 00:00 UTC
    'DELETE FROM public.messages WHERE created_at < NOW() - INTERVAL ''3 days'''
);

-- View all scheduled jobs
-- SELECT * FROM cron.job;

-- View job run history
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- Alternative: If pg_cron is unavailable, use application-level cleanup
-- (commented out for reference)
/*
CREATE OR REPLACE FUNCTION cleanup_old_messages()
RETURNS void AS $$
BEGIN
    DELETE FROM public.messages 
    WHERE created_at < NOW() - INTERVAL '3 days';
    RAISE NOTICE 'Cleaned up old messages';
END;
$$ LANGUAGE plpgsql;
*/

-- =====================================================================
-- ADDITIONAL HELPER FUNCTIONS (Optional)
-- =====================================================================

-- Function to get active user count per room (for analytics)
CREATE OR REPLACE FUNCTION get_room_user_count(room_name TEXT)
RETURNS INT AS $$
SELECT COUNT(*) FROM public.active_users WHERE room_id = room_name;
$$ LANGUAGE SQL;

-- Function to get message count per room (for UI display)
CREATE OR REPLACE FUNCTION get_room_message_count(room_name TEXT)
RETURNS INT AS $$
SELECT COUNT(*) FROM public.messages WHERE room_id = room_name AND created_at > NOW() - INTERVAL '1 day';
$$ LANGUAGE SQL;

-- Function to remove inactive users (older than 10 minutes)
CREATE OR REPLACE FUNCTION remove_inactive_users()
RETURNS void AS $$
BEGIN
    DELETE FROM public.active_users 
    WHERE updated_at < NOW() - INTERVAL '10 minutes';
    RAISE NOTICE 'Removed inactive users';
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================================

-- Insert sample message
INSERT INTO public.messages (room_id, username, message_text, avatar_url, created_at)
VALUES (
    'General',
    'System',
    '✨ Welcome to ChatCorner! This is a real-time decoupled chatroom application.',
    'https://ui-avatars.com/api/?name=System&background=667eea&color=fff',
    NOW()
) ON CONFLICT DO NOTHING;

-- Insert sample active user
INSERT INTO public.active_users (username, peer_id, room_id, updated_at)
VALUES (
    'Demo_User',
    'demo-peer-12345',
    'General',
    NOW()
) ON CONFLICT (username) DO UPDATE SET updated_at = NOW();

-- =====================================================================
-- VERIFICATION QUERIES
-- =====================================================================

-- Check messages table structure
-- SELECT * FROM information_schema.columns WHERE table_name = 'messages';

-- Check active_users table structure
-- SELECT * FROM information_schema.columns WHERE table_name = 'active_users';

-- Verify publication exists
-- SELECT * FROM pg_publication WHERE pubname = 'supabase_realtime';

-- Check indexes
-- SELECT schemaname, tablename, indexname FROM pg_indexes 
-- WHERE schemaname = 'public' AND tablename IN ('messages', 'active_users');

-- =====================================================================
-- CLEANUP COMMANDS (Use cautiously!)
-- =====================================================================

-- To drop all scheduled jobs:
-- SELECT cron.unschedule('flush-stale-logs');

-- To truncate messages table (WARNING: This deletes all messages!)
-- TRUNCATE TABLE public.messages CASCADE;

-- To drop all tables (WARNING: Destructive!)
-- DROP TABLE IF EXISTS public.active_users CASCADE;
-- DROP TABLE IF EXISTS public.messages CASCADE;

-- =====================================================================
-- END OF SCHEMA SETUP
-- =====================================================================