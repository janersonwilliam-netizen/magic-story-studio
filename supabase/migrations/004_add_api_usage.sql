-- Migration: Create api_usage table for tracking API usage
-- This helps enforce free tier limits and prevent abuse

CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    service TEXT NOT NULL, -- 'gemini_nanobanana', 'gemini_text', 'google_tts'
    operation TEXT NOT NULL, -- 'generate_image', 'generate_text', 'generate_audio'
    story_id UUID REFERENCES stories(id) ON DELETE SET NULL,
    scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'success', -- 'success', 'error', 'quota_exceeded'
    error_message TEXT,
    images_generated INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    characters_processed INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast user daily usage queries
CREATE INDEX IF NOT EXISTS idx_api_usage_user_date 
ON api_usage(user_id, created_at);

-- Index for service-specific queries
CREATE INDEX IF NOT EXISTS idx_api_usage_service 
ON api_usage(service, created_at);

-- Enable RLS
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own usage
CREATE POLICY "Users can view own api_usage"
ON api_usage FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own usage records
CREATE POLICY "Users can insert own api_usage"
ON api_usage FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Function to get daily image generation count for a user
CREATE OR REPLACE FUNCTION get_daily_image_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COALESCE(SUM(images_generated), 0)::INTEGER
        FROM api_usage
        WHERE user_id = p_user_id
        AND service = 'gemini_nanobanana'
        AND operation = 'generate_image'
        AND status = 'success'
        AND created_at >= CURRENT_DATE
        AND created_at < CURRENT_DATE + INTERVAL '1 day'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can generate more images today
CREATE OR REPLACE FUNCTION can_generate_image(p_user_id UUID, p_daily_limit INTEGER DEFAULT 5)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_daily_image_count(p_user_id) < p_daily_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
