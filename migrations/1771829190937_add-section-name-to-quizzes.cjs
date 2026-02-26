exports.up = (pgm) => {
  pgm.addColumn('quizzes', {
    section_name: { type: 'text' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('quizzes', 'section_name');
};
