-- =====================================================================
-- CHATCORNER - COMPLETE SUPABASE SQL SCHEMA
-- Execute this entire script in Supabase SQL Editor to initialize the database
-- =====================================================================

-- 1. TABLE: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    avatar_color TEXT,
    avatar_url TEXT,
    is_registered BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false,
    is_mod BOOLEAN DEFAULT false,
    is_owner BOOLEAN DEFAULT false,
    is_vip BOOLEAN DEFAULT false,
    is_banned BOOLEAN DEFAULT false,
    banned_at TIMESTAMP WITH TIME ZONE,
    banned_by UUID,
    ban_reason TEXT,
    ban_expires_at TIMESTAMP WITH TIME ZONE,
    kicked_until TIMESTAMP WITH TIME ZONE,
    has_2fa_enabled BOOLEAN DEFAULT false,
    two_fa_secret TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to profiles" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Allow users to update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow users to insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);


-- 2. TABLE: rooms
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    is_audio_enabled BOOLEAN DEFAULT false,
    is_locked BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for rooms
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access to rooms for all users" ON public.rooms
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.rooms
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');


-- 3. TABLE: messages
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'text',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access to messages for all users" ON public.messages
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access to messages for all users" ON public.messages
    FOR INSERT WITH CHECK (true);


-- 4. TABLE: active_users
CREATE TABLE IF NOT EXISTS public.active_users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    peer_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT peer_id_not_empty CHECK (LENGTH(peer_id) > 0),
    CONSTRAINT username_not_empty CHECK (LENGTH(username) > 0)
);

-- RLS for active_users
ALTER TABLE public.active_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for active users" ON public.active_users
    FOR SELECT USING (true);

CREATE POLICY "Enable insert/update for all users" ON public.active_users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON public.active_users
    FOR UPDATE USING (true) WITH CHECK (true);


-- 5. TABLE: app_settings
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read to app_settings" ON public.app_settings
    FOR SELECT USING (true);


-- 6. TABLE: broadcasts
CREATE TABLE IF NOT EXISTS public.broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT NOT NULL,
    sent_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for broadcasts
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access to broadcasts for all users" ON public.broadcasts
    FOR SELECT USING (true);


-- 7. TABLE: private_messages
CREATE TABLE IF NOT EXISTS public.private_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'text',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for private_messages
ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to read their own PMs" ON public.private_messages
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Allow users to send PMs" ON public.private_messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);


-- =====================================================================
-- REAL-TIME REPLICATION SETUP
-- =====================================================================
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.active_users REPLICA IDENTITY FULL;
ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.private_messages REPLICA IDENTITY FULL;

BEGIN;
    DROP PUBLICATION IF EXISTS supabase_realtime;
    CREATE PUBLICATION supabase_realtime FOR TABLE 
        public.messages, 
        public.active_users, 
        public.rooms, 
        public.profiles, 
        public.private_messages;
COMMIT;


-- =====================================================================
-- AUTOMATED MAINTENANCE: PG_CRON SCHEDULER
-- =====================================================================

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Purge inactive guest profiles created more than 2 hours ago
SELECT cron.schedule(
    'purge-guest-profiles-2h',
    '0 * * * *', -- Run every hour
    'DELETE FROM public.profiles WHERE is_registered = false AND created_at < NOW() - INTERVAL ''2 hours'''
);