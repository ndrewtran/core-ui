module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/test/native-host.test.js'],
  moduleNameMapper: {
    '^react-native$': '<rootDir>/test/react-native.mock.cjs',
  },
  transform: {
    '^.+\\.(js|mjs)$': 'babel-jest',
  },
};
