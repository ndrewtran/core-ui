export default {
  stories: ['generated/**/*.stories.mjs'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    reactDocgen: false,
  },
  docs: {
    autodocs: 'tag',
  },
};
