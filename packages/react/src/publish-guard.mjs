const error = new Error(
  'CORE_REACT_R11_PUBLISH_FORBIDDEN: R1.1 is packable for verification but has no external publish authorization',
);
error.code = 'CORE_REACT_R11_PUBLISH_FORBIDDEN';
throw error;
