const announceForAccessibility = jest.fn();
const DynamicColorIOS = jest.fn((value) => ({ dynamic: value }));
const PlatformColor = jest.fn((value) => ({ platform: value }));

module.exports = {
  AccessibilityInfo: { announceForAccessibility },
  DynamicColorIOS,
  I18nManager: { isRTL: false },
  PixelRatio: { getFontScale: jest.fn(() => 1) },
  PlatformColor,
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
};
