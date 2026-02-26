/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createType('video_status', ['processing', 'ready', 'failed']);

  pgm.addColumns('videos', {
    video_status: {
      type: 'video_status',
      notNull: true,
      default: 'processing',
    },
    encode_progress: {
      type: 'smallint',
      notNull: true,
      default: 0,
    },
  });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropColumns('videos', ['encode_progress', 'video_status']);
  pgm.dropType('video_status');
};
