import { canonicalJson } from '@core-ui/schema';
import { DeliveryWorkflowError } from './delivery-profile.mjs';

function escapePointer(value) {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

function leafChanges(before, after, pointer = '') {
  if (Object.is(before, after)) return [];
  if (before !== undefined && after !== undefined && canonicalJson(before) === canonicalJson(after)) return [];
  const beforeObject = before !== null && typeof before === 'object';
  const afterObject = after !== null && typeof after === 'object';
  if (!beforeObject || !afterObject || Array.isArray(before) !== Array.isArray(after)) return [pointer];
  if (Array.isArray(before)) {
    const changes = [];
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) changes.push(...leafChanges(before[index], after[index], `${pointer}/${index}`));
    return changes;
  }
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys.flatMap((key) => leafChanges(before[key], after[key], `${pointer}/${escapePointer(key)}`));
}

function schemaPointerForInstance(schema, instancePointer) {
  let contract = schema.$defs.workflowRecord;
  let pointer = '/$defs/workflowRecord';
  for (const raw of instancePointer.split('/').slice(1)) {
    const key = raw.replaceAll('~1', '/').replaceAll('~0', '~');
    if (contract.$ref) {
      pointer = contract.$ref.slice(1);
      contract = pointer.slice(1).split('/').reduce((node, part) => node?.[part.replaceAll('~1', '/').replaceAll('~0', '~')], schema);
    }
    if (Array.isArray(contract.oneOf)) {
      const branches = contract.oneOf
        .map((branch, index) => ({ branch, index }))
        .filter(({ branch }) => branch.properties?.[key]);
      if (branches.length !== 1) throw new DeliveryWorkflowError('DELIVERY_POINTER_UNMAPPED', `cannot resolve ${instancePointer}`);
      pointer = `${pointer}/oneOf/${branches[0].index}`;
      contract = branches[0].branch;
    }
    if (contract.type === 'array') {
      contract = contract.items;
      pointer = `${pointer}/items`;
    } else {
      contract = contract.properties?.[key];
      pointer = `${pointer}/properties/${escapePointer(key)}`;
    }
    if (!contract) throw new DeliveryWorkflowError('DELIVERY_POINTER_UNMAPPED', `cannot resolve ${instancePointer}`);
    if (contract['x-core-ui-field-id']) return pointer;
  }
  return pointer;
}

export { leafChanges, schemaPointerForInstance };

export function classifyDeliveryInvalidation(contract, before, after) {
  const changedPointers = leafChanges(before, after).sort();
  const domains = new Set();
  for (const instancePointer of changedPointers) {
    const schemaPointer = schemaPointerForInstance(contract.schema, instancePointer);
    const domain = contract.profile.fieldDomainMap[schemaPointer];
    if (!domain) throw new DeliveryWorkflowError('DELIVERY_POINTER_UNMAPPED', `no invalidation domain for ${schemaPointer}`);
    domains.add(domain);
  }
  const routes = [...domains].sort().map((domain) => ({ domain, route: contract.profile.invalidationRoutes[domain] }));
  const lifecycleOrder = contract.profile.localStates;
  const earliestRewind = routes.map(({ route }) => route[0]).sort((left, right) => lifecycleOrder.indexOf(left) - lifecycleOrder.indexOf(right))[0] ?? null;
  return {
    changedPointers,
    domains: routes.map(({ domain }) => domain),
    earliestRewind,
    invalidatedIdentities: [...new Set(routes.flatMap(({ route }) => route.slice(1)))].sort(),
  };
}
