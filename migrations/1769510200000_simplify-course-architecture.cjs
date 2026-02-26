/**
 * Migration: Simplify course architecture (videos cleanup)
 *
 * - Removes access_type and product_id from videos (now handled at course level)
 * - Changes bunny_library_type default to 'private'
 * - Drops video_access_type enum
 */

exports.up = (pgm) => {
  // 1. Remove access_type and product_id from videos
  pgm.dropIndex('videos', 'access_type', { name: 'idx_videos_access_type', ifExists: true });
  pgm.dropColumn('videos', 'access_type');
  pgm.dropColumn('videos', 'product_id');

  // 2. Change bunny_library_type default to 'private'
  pgm.alterColumn('videos', 'bunny_library_type', { default: pgm.func("'private'::bunny_library_type") });

  // 3. Drop unused enum
  pgm.dropType('video_access_type', { ifExists: true });
};

exports.down = (pgm) => {
  // Reverse in opposite order
  pgm.createType('video_access_type', ['free', 'subscription', 'paid']);

  pgm.alterColumn('videos', 'bunny_library_type', { default: pgm.func("'public'::bunny_library_type") });

  pgm.addColumn('videos', {
    product_id: {
      type: 'uuid',
      references: 'products(id)',
      onDelete: 'SET NULL',
    },
    access_type: {
      type: 'video_access_type',
      notNull: true,
      default: 'free',
    },
  });
  pgm.createIndex('videos', 'access_type', { name: 'idx_videos_access_type' });
};
