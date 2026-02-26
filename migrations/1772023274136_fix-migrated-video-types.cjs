/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  // Retype iframe-only topics from 'text' to 'video'
  // Matches: has iframe, not presto shortcode, less than 100 chars of non-iframe text
  pgm.sql(`
    UPDATE topics SET topic_type = 'video'
    WHERE topic_type = 'text'
      AND content LIKE '%<iframe%'
      AND content NOT LIKE '%presto%'
      AND length(regexp_replace(regexp_replace(content,
        '<iframe[^>]*>[^<]*</iframe>', '', 'gi'), '<[^>]+>', '', 'g')) < 100;
  `);

  // Retype iframe-only lessons from 'text' to 'video'
  pgm.sql(`
    UPDATE lessons SET lesson_type = 'video'
    WHERE lesson_type = 'text'
      AND content LIKE '%<iframe%'
      AND length(regexp_replace(regexp_replace(content,
        '<iframe[^>]*>[^<]*</iframe>', '', 'gi'), '<[^>]+>', '', 'g')) < 100;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  // Revert: set back to 'text' for records that have no video_id but have iframe content
  pgm.sql(`
    UPDATE topics SET topic_type = 'text'
    WHERE topic_type = 'video'
      AND video_id IS NULL
      AND content LIKE '%<iframe%';
  `);

  pgm.sql(`
    UPDATE lessons SET lesson_type = 'text'
    WHERE lesson_type = 'video'
      AND video_id IS NULL
      AND content LIKE '%<iframe%';
  `);
};
