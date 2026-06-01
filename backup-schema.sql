-- =====================================================================
-- CHATCORNER - TERABOX BACKUP & ARCHIVE SCHEMA
-- Apply in Supabase SQL Editor
-- =====================================================================

-- TABLE: Backup Logs (Track all uploads to Terabox)
CREATE TABLE IF NOT EXISTS public.backup_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'image', 'video', 'voice', 'gif', 'text'
    file_name TEXT NOT NULL,
    file_size BIGINT,
    terabox_path TEXT,
    terabox_status TEXT DEFAULT 'pending', -- 'pending', 'uploaded', 'failed', 'deleted'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_at TIMESTAMP WITH TIME ZONE,
    original_created_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_file_type CHECK (file_type IN ('image', 'video', 'voice', 'gif', 'text'))
);

CREATE INDEX IF NOT EXISTS idx_backup_logs_username ON public.backup_logs(username);
CREATE INDEX IF NOT EXISTS idx_backup_logs_file_type ON public.backup_logs(file_type);
CREATE INDEX IF NOT EXISTS idx_backup_logs_created_at ON public.backup_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_logs_status ON public.backup_logs(terabox_status);

-- TABLE: Backup cycle attempts (monitoring)
CREATE TABLE IF NOT EXISTS public.backup_attempts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cycle_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT NOT NULL,
    details TEXT
);

-- TABLE: Message Archives (for text backup before cleanup)
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

CREATE INDEX IF NOT EXISTS idx_archives_username ON public.message_archives(username);
CREATE INDEX IF NOT EXISTS idx_archives_created_at ON public.message_archives(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_archives_status ON public.message_archives(backup_status);

-- TABLE: User reference (keep usernames & avatars forever)
CREATE TABLE IF NOT EXISTS public.user_references (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    avatar_url TEXT,
    peer_id TEXT,
    room_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_refs_username ON public.user_references(username);

-- Trigger function: keep user references up to date
CREATE OR REPLACE FUNCTION public.upsert_user_reference_from_message()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_references (username, avatar_url, room_id, updated_at)
    VALUES (NEW.username, NEW.avatar_url, NEW.room_id, NOW())
    ON CONFLICT (username)
    DO UPDATE SET
        avatar_url = EXCLUDED.avatar_url,
        room_id = EXCLUDED.room_id,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_reference_from_message ON public.messages;
CREATE TRIGGER trg_user_reference_from_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.upsert_user_reference_from_message();

-- Trigger function: archive message before delete
CREATE OR REPLACE FUNCTION public.archive_message_before_delete()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.message_archives (
        room_id,
        username,
        message_text,
        avatar_url,
        created_at,
        archived_at,
        backup_status
    )
    VALUES (
        OLD.room_id,
        OLD.username,
        OLD.message_text,
        OLD.avatar_url,
        OLD.created_at,
        NOW(),
        'pending'
    );

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_archive_message_before_delete ON public.messages;
CREATE TRIGGER trg_archive_message_before_delete
BEFORE DELETE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.archive_message_before_delete();

-- Function: cleanup workflow (run every 12h)
CREATE OR REPLACE FUNCTION public.run_backup_cleanup()
RETURNS void AS $$
BEGIN
    -- Delete messages older than 3 days (trigger archives each row)
    DELETE FROM public.messages
    WHERE created_at < NOW() - INTERVAL '3 days';

    -- Remove old transient media log entries after 3 months
    DELETE FROM public.backup_logs
    WHERE file_type IN ('video', 'voice', 'gif')
      AND created_at < NOW() - INTERVAL '3 months'
      AND terabox_status IN ('uploaded', 'deleted');

    INSERT INTO public.backup_attempts (status, details)
    VALUES ('success', 'Scheduled cleanup completed');
EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.backup_attempts (status, details)
    VALUES ('failed', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- Function: export pending archive batch as JSON (up to 5000)
CREATE OR REPLACE FUNCTION public.export_message_archives_json()
RETURNS TEXT AS $$
DECLARE
    json_data TEXT;
BEGIN
    SELECT COALESCE(json_agg(row_to_json(t))::TEXT, '[]')
    INTO json_data
    FROM (
        SELECT id, room_id, username, message_text, avatar_url, created_at, archived_at
        FROM public.message_archives
        WHERE backup_status = 'pending'
        ORDER BY archived_at ASC
        LIMIT 5000
    ) t;

    RETURN json_data;
END;
$$ LANGUAGE plpgsql;

-- Schedule every 12 hours at 00:00 and 12:00 UTC
SELECT cron.unschedule('terabox-backup-cleanup')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'terabox-backup-cleanup');

SELECT cron.schedule(
    'terabox-backup-cleanup',
    '0 0,12 * * *',
    $$ SELECT public.run_backup_cleanup(); $$
);

-- =====================================================================
-- END OF BACKUP SCHEMA
-- =====================================================================
