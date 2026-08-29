/**
 * The renderer-neutral projection of the canonical migration fixture.
 *
 * Core and the retained one-time Tale adapter both consume this model. It is
 * intentionally free of React, Storybook, and renderer-package imports so it
 * can be unit-tested without a browser or either renderer installed.
 */
export const fixtureMapSourcePath = 'src/visual-migration-fixture-map.mjs';

function firstIdentity(items, fallback) {
  if (!Array.isArray(items) || items.length === 0) return fallback;
  const item = items[0];
  if (item && typeof item === 'object') return item.id ?? item.value ?? item.key ?? fallback;
  return item;
}

function firstColor(items, fallback) {
  const item = Array.isArray(items) ? items[0] : undefined;
  return item && typeof item === 'object' ? item.color ?? fallback : item ?? fallback;
}

export function fixtureRenderModel(fixture) {
  if (!fixture || typeof fixture !== 'object' || !fixture.data || typeof fixture.data !== 'object') {
    throw new Error('visual migration fixture must provide a data object');
  }
  const data = fixture.data;
  const children = data.children ?? {};
  const values = data.values ?? {};
  return {
    copy: fixture.copy,
    data: {
      label: data.label,
      placeholder: data.placeholder,
      items: data.items,
      options: data.options,
      choices: data.choices,
      children,
      columns: data.columns,
      rows: data.rows,
      date: data.date,
      dateRange: data.dateRange,
      time: data.time,
      color: data.color,
      values,
    },
    selected: {
      item: firstIdentity(data.items, 'Melbourne'),
      itemId: firstIdentity(data.items, 'Melbourne'),
      option: firstIdentity(data.options, 's'),
      choice: firstIdentity(data.choices, 'email'),
      rowId: firstIdentity(data.rows, 'ada'),
      disclosureId: firstIdentity(children.disclosureGroup, 'one'),
      toggleId: firstIdentity(children.toggleButtonGroup, 'bold'),
      treeId: firstIdentity(data.items, 'src'),
      color: firstColor(data.items, data.color ?? '#ff0000'),
    },
  };
}

/**
 * Return canonical field props for either renderer adapter. The wrappers have
 * different anatomy, but these values are shared fixture inputs.
 */
export function fixtureFieldPropsFor(fixture, family) {
  const model = fixtureRenderModel(fixture);
  if (!['Autocomplete', 'ComboBox', 'SearchField', 'Select', 'TextField'].includes(family)) {
    throw new Error(`visual migration fixture has no field mapping for ${family}`);
  }
  return family === 'TextField'
    ? { label: model.data.label, placeholder: model.data.placeholder }
    : { label: model.copy, placeholder: model.data.placeholder };
}
