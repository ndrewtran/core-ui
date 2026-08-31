const error = new Error(
  'MUXUI_REACT_R15_PUBLISH_FORBIDDEN: R1.5 is packable for verification but has no external publish authorization',
);
error.code = 'MUXUI_REACT_R15_PUBLISH_FORBIDDEN';
throw error;
