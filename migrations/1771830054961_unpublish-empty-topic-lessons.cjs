exports.up = (pgm) => {
  pgm.sql(`
    UPDATE lessons
    SET is_published = false
    WHERE title = 'Topic'
      AND (content IS NULL OR content = '')
      AND is_published = true
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    UPDATE lessons
    SET is_published = true
    WHERE title = 'Topic'
      AND (content IS NULL OR content = '')
      AND is_published = false
  `);
};
