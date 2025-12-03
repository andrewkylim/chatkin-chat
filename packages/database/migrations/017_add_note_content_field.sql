-- Migration 017: Add Note Content Field for AI Context
-- Store full note content so AI can reference user reflections in conversations

-- Add content field to notes table for quick access
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS content TEXT;

-- Create function to extract text content from note_blocks
CREATE OR REPLACE FUNCTION extract_note_content(note_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  content_text TEXT;
BEGIN
  SELECT string_agg(
    CASE
      WHEN type = 'paragraph' THEN content->>'text'
      WHEN type = 'heading' THEN content->>'text'
      WHEN type = 'bulletList' THEN content->>'text'
      WHEN type = 'orderedList' THEN content->>'text'
      ELSE ''
    END,
    E'\n'
    ORDER BY position
  ) INTO content_text
  FROM note_blocks
  WHERE note_id = note_uuid;

  RETURN COALESCE(content_text, '');
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to auto-update note content
CREATE OR REPLACE FUNCTION update_note_content()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the parent note's content field
  UPDATE notes
  SET content = extract_note_content(NEW.note_id),
      updated_at = NOW()
  WHERE id = NEW.note_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger on note_blocks for insert/update/delete
DROP TRIGGER IF EXISTS note_blocks_update_content ON note_blocks;

CREATE TRIGGER note_blocks_update_content
  AFTER INSERT OR UPDATE OR DELETE ON note_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_note_content();

-- Backfill existing notes with content
UPDATE notes
SET content = extract_note_content(id)
WHERE content IS NULL;

-- Add index for content search (if we want full-text search on notes)
CREATE INDEX IF NOT EXISTS idx_notes_content_search ON notes USING GIN(to_tsvector('english', COALESCE(content, '')));

-- Add comment
COMMENT ON COLUMN notes.content IS 'Full text content extracted from note_blocks. Auto-updated via trigger. Used by AI to load last 15 notes for context.';
COMMENT ON FUNCTION extract_note_content IS 'Extract plain text content from note_blocks JSONB for AI context loading';

-- Verification
SELECT 'Note content field added' AS status;
SELECT id, title, LEFT(content, 100) as content_preview
FROM notes
WHERE content IS NOT NULL
LIMIT 5;
