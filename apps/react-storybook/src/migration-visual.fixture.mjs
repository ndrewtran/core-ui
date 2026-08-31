import React from 'react';
import { renderFamily, stateArgsForBinding, storyArgsForBinding } from './storybook-factory.mjs';
import { applicableMigrationRecords, migrationCases, migrationFixtureSymbol, sharedFixtureInput } from './visual-migration-contract.mjs';

const records = new Map(applicableMigrationRecords.map((record) => [record.family, record]));
const caseStyle = {
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  padding: '12px',
  background: 'var(--muxui-migration-frame-background)',
};

function Case({ entry, children }) {
  const wide = ['TextField', 'Autocomplete', 'ComboBox', 'Select'].includes(entry.component);
  const viewport = entry.component === 'Virtualizer' ? entry.fixture.frame.virtualizer : undefined;
  return React.createElement('div', {
    'data-muxui-migration-case': `${entry.slug}-${entry.state}`,
    className: 'migration-component',
    style: {
      ...caseStyle,
      padding: viewport ? 0 : caseStyle.padding,
      width: viewport ? `${viewport.width}px` : wide ? '340px' : 'max-content',
      height: viewport ? `${viewport.height}px` : undefined,
    },
  }, children);
}

function renderCase(entry) {
  const record = records.get(entry.component);
  const fixture = sharedFixtureInput(entry);
  const baseArgs = storyArgsForBinding(record.binding, 'default', entry.component);
  Object.defineProperty(baseArgs, migrationFixtureSymbol, { value: fixture });
  const args = {
    ...stateArgsForBinding(record.binding, entry.state, entry.component, baseArgs),
    className: 'migration-component',
  };
  Object.defineProperty(args, migrationFixtureSymbol, { value: fixture });
  return React.createElement(Case, { entry }, React.createElement('div', {
    className: 'migration-equivalent-frame migration-component',
    style: entry.component === 'Virtualizer'
      ? { boxSizing: 'border-box', width: `${entry.fixture.frame.virtualizer.width}px`, height: `${entry.fixture.frame.virtualizer.height}px` }
      : { display: 'contents', boxSizing: 'border-box' },
  }, renderFamily(entry.component, args)));
}

export function MigrationFixture({ runToken }) {
  const selectedCase = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('muxui-migration-case')
    : undefined;
  const entries = selectedCase ? migrationCases.filter((entry) => entry.id === selectedCase) : migrationCases;
  return React.createElement('div', {
    'data-muxui-migration-run-token': runToken ?? '',
    style: {
      display: 'grid',
      gridTemplateColumns: 'max-content',
      gap: '8px',
      width: 'max-content',
      padding: 0,
      margin: 0,
      background: 'var(--muxui-migration-frame-background)',
    },
  }, entries.map((entry) => React.createElement(React.Fragment, { key: entry.id }, renderCase(entry))));
}
