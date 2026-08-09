import { platformSafetyFixture as webFixture } from '@core-ui/web/testing';

export const reactPlatformSafetyFixture = Object.freeze({
  ...webFixture.profiles['web.react'],
  stylesheet: webFixture.stylesheet,
  stylesheetDigest: webFixture.stylesheetDigest,
  sourcePackage: '@core-ui/web/button.css',
  componentSupportClaim: 'none',
});
