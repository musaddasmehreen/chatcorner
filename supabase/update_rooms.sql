-- ChatCorner Room Setup & Renaming
-- Run this in your Supabase SQL Editor if you have direct access.
-- 1. Rename Gaming room to ChatCorner
UPDATE public.rooms 
SET name = 'ChatCorner', 
    description = 'ChatCorner main lobby 💬' 
WHERE name = 'Gaming';

-- 2. Create Guest room as a proper room if it doesn't exist
INSERT INTO public.rooms (name, description, is_audio_enabled)
VALUES ('Guest', 'Welcome lounge for guests', false)
ON CONFLICT (name) DO NOTHING;
