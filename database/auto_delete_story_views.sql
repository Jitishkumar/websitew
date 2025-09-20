-- Auto-delete story views when story expires/gets deleted
-- This ensures story view data is cleaned up automatically

-- Create function to delete story views when story is deleted
CREATE OR REPLACE FUNCTION delete_story_views_on_story_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete all views for the deleted story
    DELETE FROM story_views WHERE story_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-delete story views when story is deleted
DROP TRIGGER IF EXISTS trigger_delete_story_views ON stories;
CREATE TRIGGER trigger_delete_story_views
    AFTER DELETE ON stories
    FOR EACH ROW
    EXECUTE FUNCTION delete_story_views_on_story_delete();

-- Also create a function to clean up expired story views
CREATE OR REPLACE FUNCTION cleanup_expired_story_views()
RETURNS void AS $$
BEGIN
    -- Delete views for stories that have expired (older than 24 hours)
    DELETE FROM story_views 
    WHERE story_id IN (
        SELECT id FROM stories 
        WHERE expires_at < NOW()
    );
    
    -- Also delete views for stories that no longer exist
    DELETE FROM story_views 
    WHERE story_id NOT IN (
        SELECT id FROM stories
    );
END;
$$ LANGUAGE plpgsql;

-- You can run this function manually or set up a cron job
-- To run manually: SELECT cleanup_expired_story_views();

-- Optional: Create a trigger to clean up views when stories expire
-- This runs whenever the delete_expired_stories function runs
CREATE OR REPLACE FUNCTION cleanup_views_after_story_cleanup()
RETURNS TRIGGER AS $$
BEGIN
    -- Clean up orphaned story views after story cleanup
    PERFORM cleanup_expired_story_views();
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- This trigger runs after the existing story cleanup
DROP TRIGGER IF EXISTS trigger_cleanup_story_views ON stories;
CREATE TRIGGER trigger_cleanup_story_views
    AFTER DELETE ON stories
    FOR EACH STATEMENT
    EXECUTE FUNCTION cleanup_views_after_story_cleanup();
