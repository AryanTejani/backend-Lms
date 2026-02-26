/**
 * Migration: Add bunny_library_type column to videos table
 *
 * Tracks which Bunny Stream library (public or private) a video belongs to.
 * This is determined at creation time based on access_type and never changes,
 * even if access_type is later modified.
 */

exports.up = (pgm) => {
  pgm.createType('bunny_library_type', ['public', 'private']);

  pgm.addColumn('videos', {
    bunny_library_type: {
      type: 'bunny_library_type',
      notNull: true,
      default: 'public',
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('videos', 'bunny_library_type');
  pgm.dropType('bunny_library_type', { ifExists: true });
};
