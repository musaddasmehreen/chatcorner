-- =====================================================================
-- CO-WATCH AND PASSWORD-LOCK SYSTEM MIGRATION
-- Run this in the Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Update the rooms table
ALTER TABLE public.rooms 
  ADD COLUMN IF NOT EXISTS room_type TEXT DEFAULT 'chat' CHECK (room_type IN ('chat', 'iptv', 'cowatch')),
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS room_password TEXT;

-- Update existing rooms to be owned by an admin/owner or set to NULL
-- and default them to 'chat' room_type
UPDATE public.rooms SET room_type = 'chat' WHERE room_type IS NULL;

-- 2. Create the cowatch_state table for keeping track of synchronized playback
CREATE TABLE IF NOT EXISTS public.cowatch_state (
    room_id UUID PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL DEFAULT '',
    media_type TEXT NOT NULL DEFAULT 'video', -- 'video', 'hls', 'youtube'
    current_time DOUBLE PRECISION NOT NULL DEFAULT 0,
    is_playing BOOLEAN NOT NULL DEFAULT false,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on cowatch_state
ALTER TABLE public.cowatch_state ENABLE ROW LEVEL SECURITY;

-- Setup RLS policies for cowatch_state
CREATE POLICY "Allow public read access to cowatch_state" ON public.cowatch_state
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to insert/update cowatch_state" ON public.cowatch_state
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Ensure rooms publication includes cowatch_state if needed, though we will use broadcast
ALTER TABLE public.cowatch_state REPLICA IDENTITY FULL;

-- 3. Add UPDATE policy for owners on the rooms table
-- Note: Previously rooms had only SELECT and INSERT policies.
CREATE POLICY "Allow owners to update their own rooms" ON public.rooms
    FOR UPDATE USING (auth.uid() = owner_id OR (SELECT is_admin OR is_owner OR is_mod FROM public.profiles WHERE id = auth.uid()))
    WITH CHECK (auth.uid() = owner_id OR (SELECT is_admin OR is_owner OR is_mod FROM public.profiles WHERE id = auth.uid()));

-- 4. RPC Functions for Room Password Management
-- This allows verification and updating passwords securely without exposing hashes to the client.

-- Lock room RPC
CREATE OR REPLACE FUNCTION public.lock_room(
  p_room_id UUID,
  p_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of creator (bypass RLS / read private columns)
AS $$
DECLARE
  v_caller_id UUID;
  v_is_authorized BOOLEAN;
BEGIN
  -- Get user ID of caller
  v_caller_id := auth.uid();
  
  -- Check if caller is owner of the room or admin/mod
  SELECT (r.owner_id = v_caller_id OR p.is_admin OR p.is_owner OR p.is_mod)
  INTO v_is_authorized
  FROM public.rooms r
  LEFT JOIN public.profiles p ON p.id = v_caller_id
  WHERE r.id = p_room_id;

  IF NOT COALESCE(v_is_authorized, FALSE) THEN
    RAISE EXCEPTION 'Not authorized to lock this room';
  END IF;

  -- Update password and set is_locked to true
  UPDATE public.rooms
  SET room_password = crypt(p_password, gen_salt('bf', 8)),
      is_locked = TRUE
  WHERE id = p_room_id;

  RETURN TRUE;
END;
$$;

-- Unlock room RPC
CREATE OR REPLACE FUNCTION public.unlock_room(
  p_room_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID;
  v_is_authorized BOOLEAN;
BEGIN
  v_caller_id := auth.uid();
  
  SELECT (r.owner_id = v_caller_id OR p.is_admin OR p.is_owner OR p.is_mod)
  INTO v_is_authorized
  FROM public.rooms r
  LEFT JOIN public.profiles p ON p.id = v_caller_id
  WHERE r.id = p_room_id;

  IF NOT COALESCE(v_is_authorized, FALSE) THEN
    RAISE EXCEPTION 'Not authorized to unlock this room';
  END IF;

  -- Clear password and set is_locked to false
  UPDATE public.rooms
  SET room_password = NULL,
      is_locked = FALSE
  WHERE id = p_room_id;

  RETURN TRUE;
END;
$$;

-- Verify room password RPC
CREATE OR REPLACE FUNCTION public.verify_room_password(
  p_room_id UUID,
  p_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hashed_password TEXT;
BEGIN
  SELECT room_password INTO v_hashed_password
  FROM public.rooms
  WHERE id = p_room_id;

  IF v_hashed_password IS NULL THEN
    -- Room is not password-locked, allow access
    RETURN TRUE;
  END IF;

  -- Verify match
  RETURN v_hashed_password = crypt(p_password, v_hashed_password);
END;
$$;
