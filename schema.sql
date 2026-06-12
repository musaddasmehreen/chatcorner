-- =====================================================================
-- CHATCORNER — COMPLETE SUPABASE SCHEMA (matches js/chat.js)
-- Run this entire script in Supabase SQL Editor
-- =====================================================================

-- PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username text NOT NULL,
    email text,
    avatar_color text DEFAULT '#7c3aed',
    avatar_url text,
    is_registered boolean DEFAULT false,
    is_admin boolean DEFAULT false,
    is_mod boolean DEFAULT false,
    is_owner boolean DEFAULT false,
    is_vip boolean DEFAULT false,
    is_banned boolean DEFAULT false,
    banned_at timestamptz,
    banned_by uuid,
    ban_reason text,
    ban_expires_at timestamptz,
    kicked_until timestamptz,
    created_at timestamptz DEFAULT now()
);

-- ROOMS
CREATE TABLE IF NOT EXISTS public.rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    description text,
    is_audio_enabled boolean DEFAULT false,
    is_locked boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- MESSAGES
CREATE TABLE IF NOT EXISTS public.messages (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    username text NOT NULL,
    content text NOT NULL,
    type text NOT NULL DEFAULT 'text',
    created_at timestamptz DEFAULT now(),
    CONSTRAINT message_length_check CHECK (char_length(content) <= 5000)
);

-- PRIVATE MESSAGES
CREATE TABLE IF NOT EXISTS public.private_messages (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content text NOT NULL,
    type text NOT NULL DEFAULT 'text',
    created_at timestamptz DEFAULT now()
);

-- APP SETTINGS
CREATE TABLE IF NOT EXISTS public.app_settings (
    key text PRIMARY KEY,
    value text,
    updated_at timestamptz DEFAULT now()
);

-- BROADCASTS (admin)
CREATE TABLE IF NOT EXISTS public.broadcasts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message text,
    sent_by uuid REFERENCES public.profiles(id),
    room_id uuid REFERENCES public.rooms(id),
    created_at timestamptz DEFAULT now()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_room_created ON public.messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- SEED DEFAULT ROOMS
INSERT INTO public.rooms (name, description, is_audio_enabled)
VALUES
    ('General', 'Main public chat room', false),
    ('Voice Lounge', 'Voice and video enabled room', true)
ON CONFLICT (name) DO NOTHING;

-- ROW LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "rooms_read" ON public.rooms;
DROP POLICY IF EXISTS "messages_read" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
DROP POLICY IF EXISTS "pm_read" ON public.private_messages;
DROP POLICY IF EXISTS "pm_insert" ON public.private_messages;

CREATE POLICY "profiles_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "rooms_read" ON public.rooms FOR SELECT USING (true);

CREATE POLICY "messages_read" ON public.messages FOR SELECT USING (true);
CREATE POLICY "messages_insert_own" ON public.messages FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pm_read" ON public.private_messages FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = recipient_id
);
CREATE POLICY "pm_insert" ON public.private_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- REALTIME
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- OPTIONAL: purge messages older than 24 hours (requires pg_cron)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('purge-messages-24h', '0 0 * * *',
--   'DELETE FROM public.messages WHERE created_at < NOW() - INTERVAL ''24 hours''');

-- =====================================================================
-- AFTER FIRST LOGIN: promote your account to admin (replace email)
-- UPDATE public.profiles SET is_admin = true, is_registered = true
-- WHERE email = 'your-email@example.com';
-- =====================================================================
