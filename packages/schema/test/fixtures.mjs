export function tokenSource() {
  return {
    schemaVersion: '2.1.0',
    id: 'core:token:button-minimum',
    kind: 'token',
    name: 'Button minimum tokens',
    summary: 'The minimum token source used by the G0.1 proof artifact.',
    lifecycle: 'experimental',
    tokenContractVersion: '1.1.0',
    theme: {
      name: 'default',
      modeAxes: {
        colorScheme: ['light', 'dark'],
        contrast: ['standard', 'more'],
        motion: ['full', 'reduced'],
        density: ['comfortable', 'compact'],
        direction: ['ltr', 'rtl'],
      },
      defaultModes: {
        colorScheme: 'light',
        contrast: 'standard',
        motion: 'full',
        density: 'comfortable',
        direction: 'ltr',
      },
      runtimeSwitching: 'unavailable',
    },
    tokens: {
      'reference.color.black': {
        layer: 'reference',
        type: 'color',
        unit: 'hex',
        meaning: 'Black reference value.',
        overridePolicy: 'fixed',
        value: '#000000',
      },
      'semantic.action.background': {
        layer: 'semantic',
        type: 'color',
        unit: 'hex',
        meaning: 'Immediate action background.',
        overridePolicy: 'theme',
        alias: 'reference.color.black',
      },
    },
  };
}

function required(id) {
  return { id, disposition: 'required' };
}

function notApplicable(id, reason) {
  return { id, disposition: 'not-applicable', reason };
}

export function webPlatformSafety(profile) {
  return [{
    profile,
    requirements: [
      required('system.forced-colors'),
      required('system.high-contrast'),
      notApplicable('native.dynamic-color', 'Native dynamic colors do not apply to web.'),
      notApplicable('native.font-metrics', 'Native font metrics do not apply to web.'),
      required('layout.direction'),
      required('platform.accessibility-mapping'),
    ],
  }];
}

export function nativePlatformSafety() {
  const supported = (profile, validationProfile) => ({
    profile,
    validationProfile,
    requirements: [
      notApplicable('system.forced-colors', 'Web forced colors do not apply to native.'),
      notApplicable('system.high-contrast', 'Web high contrast does not apply to native.'),
      required('native.dynamic-color'),
      required('native.font-metrics'),
      required('layout.direction'),
      required('platform.accessibility-mapping'),
    ],
  });
  return [
    supported('ios', 'native.ios'),
    supported('android', 'native.android'),
    {
      profile: 'native.react-native-web',
      validationProfile: 'native.react-native-web',
      requirements: [
        'system.forced-colors',
        'system.high-contrast',
        'native.dynamic-color',
        'native.font-metrics',
        'layout.direction',
        'platform.accessibility-mapping',
      ].map((id) => notApplicable(id, 'The runtime profile is unsupported in G1.0.')),
    },
  ];
}

function webBinding(profile = 'web.react') {
  return {
    schemaVersion: '2.0.0',
    lifecycle: 'experimental',
    strategy: 'direct',
    api: {
      props: ['disabled'],
      events: ['activate'],
      parts: ['root', 'label'],
      defaults: { disabled: false },
    },
    behavior: ['Activation requests one immediate action'],
    accessibility: ['Expose accessible name and disabled state'],
    tokenRecipe: {
      source: 'core:token:button-minimum',
      requirements: [{ token: 'semantic.action.background', requirement: 'required' }],
    },
    platformSafety: webPlatformSafety(profile),
    runtimeProfiles: {},
  };
}

export function component() {
  return {
    schemaVersion: '1.0.0',
    id: 'core:component:button',
    kind: 'component',
    name: 'Button',
    summary: 'Triggers an immediate action.',
    lifecycle: 'experimental',
    intent: {
      useWhen: ['Triggering an immediate action'],
      avoidWhen: ['Navigating to another location'],
    },
    anatomy: ['root', 'label'],
    states: ['idle', 'disabled'],
    accessibility: {
      nameRequired: true,
      obligations: ['Expose disabled state'],
    },
    bindings: {
      'web.html': webBinding('web.html'),
      'web.react': webBinding('web.react'),
      'native.react-native': {
        ...webBinding(),
        strategy: 'adapted',
        platformSafety: nativePlatformSafety(),
        runtimeProfiles: {
          ios: {
            strategy: 'adapted',
            lifecycle: 'experimental',
            validationProfile: 'native.ios',
          },
          android: {
            strategy: 'adapted',
            lifecycle: 'experimental',
            validationProfile: 'native.android',
          },
          'native.react-native-web': {
            strategy: 'unsupported',
            reason: 'No responsible implementation in the first proof artifact.',
          },
        },
      },
    },
  };
}

export function example({ guidanceImpact = 'normative', purposes = ['generation'] } = {}) {
  return {
    schemaVersion: '1.0.0',
    id: 'core:example:button-basic-react',
    kind: 'example',
    name: 'Basic React Button',
    summary: 'The minimum React Button example.',
    lifecycle: 'experimental',
    binding: {
      ref: 'core:component:button#web.react',
      guidanceImpact,
      purposes,
      preference: 0,
    },
    complexity: 'minimal',
    prerequisites: [],
    source: 'catalog/components/button/examples/react/basic.tsx',
  };
}

export function guide() {
  return {
    schemaVersion: '1.0.0',
    id: 'core:guide:button-usage',
    kind: 'guide',
    name: 'Button usage',
    summary: 'Portable usage guidance for Button.',
    lifecycle: 'experimental',
    keywords: ['action', 'button'],
    platforms: ['web.html', 'web.react', 'native.react-native'],
    source: 'catalog/guides/button-usage.md',
  };
}

export function capability() {
  return {
    schemaVersion: '1.0.0',
    id: 'core:capability:query-baseline',
    kind: 'capability',
    name: 'Query baseline',
    summary: 'Schema-only declaration; query behavior remains unavailable.',
    lifecycle: 'experimental',
    availability: 'unavailable',
    policy: { effect: 'read-only', requiresConfirmation: false },
    availableOn: ['cli'],
  };
}

export function allRecords() {
  return [component(), example(), guide(), capability(), tokenSource()];
}
