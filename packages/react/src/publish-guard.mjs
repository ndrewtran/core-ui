const error = new Error(
  'CORE_REACT_R12_PUBLISH_FORBIDDEN: R1.2 is packable for verification but has no external publish authorization',
);
error.code = 'CORE_REACT_R12_PUBLISH_FORBIDDEN';
throw error;
