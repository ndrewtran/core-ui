const error = new Error(
  'CORE_REACT_R10_PUBLISH_FORBIDDEN: R1.0 is packable for verification but has no external publish authorization',
);
error.code = 'CORE_REACT_R10_PUBLISH_FORBIDDEN';
throw error;
