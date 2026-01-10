-- Fix RLS policies for assets table to allow inserts
-- This script fixes the "new row violates row-level security policy" error

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own assets" ON assets;
DROP POLICY IF EXISTS "Users can manage own assets" ON assets;
DROP POLICY IF EXISTS "Users can view assets of own scenes" ON assets;
DROP POLICY IF EXISTS "Users can manage assets of own scenes" ON assets;

-- Create comprehensive policies that allow all operations
CREATE POLICY "Users can view assets of own stories"
ON assets FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM scenes
        JOIN stories ON scenes.story_id = stories.id
        WHERE assets.scene_id = scenes.id
        AND stories.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert assets for own stories"
ON assets FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM scenes
        JOIN stories ON scenes.story_id = stories.id
        WHERE assets.scene_id = scenes.id
        AND stories.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update assets of own stories"
ON assets FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM scenes
        JOIN stories ON scenes.story_id = stories.id
        WHERE assets.scene_id = scenes.id
        AND stories.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM scenes
        JOIN stories ON scenes.story_id = stories.id
        WHERE assets.scene_id = scenes.id
        AND stories.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete assets of own stories"
ON assets FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM scenes
        JOIN stories ON scenes.story_id = stories.id
        WHERE assets.scene_id = scenes.id
        AND stories.user_id = auth.uid()
    )
);
