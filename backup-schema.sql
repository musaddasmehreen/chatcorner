-- =====================================================================
-- CHATCORNER - BACKUP TRACKING SCHEMA
-- Add to your Supabase SQL Editor
-- =====================================================================

-- TABLE: Backup Logs (Track all uploads to Terabox)
CREATE TABLE IF NOT EXISTS public.backup_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'image', 'video', 'voice', 'gif', 'text'
    file_name TEXT NOT NULL,
    file_size BIGINT,
    terabox_path TEXT,
    terabox_status TEXT DEFAULT 'pending', -- 'pending', 'uploaded', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_at TIMESTAMP WITH TIME ZONE,
    original_created_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_file_type CHECK (file_type IN ('image', 'video', 'voice', 'gif', 'text'))
);

CREATE INDEX idx_backup_logs_username ON public.backup_logs(username);
CREATE INDEX idx_backup_logs_file_type ON public.backup_logs(file_type);
CREATE INDEX idx_backup_logs_created_at ON public.backup_logs(created_at DESC);
CREATE INDEX idx_backup_logs_status ON public.backup_logs(terabox_status);

-- TABLE: Message Archives (For text backup)
CREATE TABLE IF NOT EXISTS public.message_archives (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_id TEXT NOT NULL,
    username TEXT NOT NULL,
    message_text VARCHAR(500) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    backup_status TEXT DEFAULT 'pending'
);

CREATE INDEX idx_archives_username ON public.message_archives(username);
CREATE INDEX idx_archives_created_at ON public.message_archives(created_at DESC);

-- TABLE: User Reference (Keep forever)
CREATE TABLE IF NOT EXISTS public.user_references (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    avatar_url TEXT,
    peer_id TEXT,
    room_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_refs_username ON public.user_references(username);

-- FUNCTION: Auto-backup messages before deletion
CREATE OR REPLACE FUNCTION backup_old_messages()
RETURNS void AS $$
BEGIN
    INSERT INTO public.message_archives 
    (room_id, username, message_text, avatar_url, created_at, backup_status)
    SELECT room_id, username, message_text, avatar_url, created_at, 'pending'
    FROM public.messages
    WHERE created_at < NOW() - INTERVAL '3 days'
    ON CONFLICT DO NOTHING;
    
    DELETE FROM public.messages WHERE created_at < NOW() - INTERVAL '3 days';
    RAISE NOTICE 'Backup and cleanup complete';
END;
$$ LANGUAGE plpgsql;

-- FUNCTION: Export archived messages as JSON
CREATE OR REPLACE FUNCTION export_message_archives_json()
RETURNS TEXT AS $$
DECLARE
    json_data TEXT;
BEGIN
    SELECT json_agg(row_to_json(t))::TEXT INTO json_data
    FROM (
        SELECT id, room_id, username, message_text, avatar_url, created_at, archived_at
        FROM public.message_archives
        WHERE backup_status = 'pending'
        ORDER BY archived_at DESC
        LIMIT 10000
    ) t;
    
    RETURN COALESCE(json_data, '[]');
END;
$$ LANGUAGE plpgsql;

-- FUNCTION: Mark backup as complete
CREATE OR REPLACE FUNCTION mark_backup_complete(backup_id BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE public.backup_logs 
    SET terabox_status = 'uploaded', uploaded_at = NOW()
    WHERE id = backup_id;
END;
$$ LANGUAGE plpgsql;

-- UPDATED CLEANUP JOB: Backup first, then delete old media (3 months)
DO $$
BEGIN
    PERFORM cron.unschedule('backup-and-cleanup');
    PERFORM cron.unschedule('terabox-backup-cleanup');
EXCEPTION WHEN OTHERS THEN
    NULL;
END;
$$;

SELECT cron.schedule(
    'terabox-backup-cleanup',
    '0 0,12 * * *',  -- Every 12 hours at 00:00 and 12:00 UTC
    $$
    DO $cron$
    BEGIN
        PERFORM backup_old_messages();
        -- Delete only GIFs, videos, voices older than 3 months (keep images & usernames forever)
        DELETE FROM public.backup_logs 
        WHERE file_type IN ('video', 'voice', 'gif')
        AND created_at < NOW() - INTERVAL '3 months'
        AND terabox_status = 'uploaded';
        
        RAISE NOTICE 'Scheduled backup triggered';
    END;
    $cron$;
    $$
);

-- =====================================================================
-- END OF BACKUP SCHEMA
-- =====================================================================
