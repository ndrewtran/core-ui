export function tokenSource() {
  return {
    schemaVersion: '1.0.0',
    id: 'core:token:button-minimum',
    kind: 'token',
    name: 'Button minimum tokens',
    summary: 'The minimum token source used by the G0.1 proof artifact.',
    lifecycle: 'experimental',
    tokenContractVersion: '1.0.0',
    tokens: {
      'semantic.action.background': { type: 'color', value: '#000000' },
    },
  };
}

function webBinding() {
  return {
    schemaVersion: '1.0.0',
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
    tokenSources: ['core:token:button-minimum'],
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
      'web.html': webBinding(),
      'web.react': webBinding(),
      'native.react-native': {
        ...webBinding(),
        strategy: 'adapted',
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
