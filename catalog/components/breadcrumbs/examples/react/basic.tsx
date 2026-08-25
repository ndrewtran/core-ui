import { Breadcrumbs } from '@core-ui/react';

export function BasicBreadcrumbsExample() {
  return <Breadcrumbs aria-label="Breadcrumb" items={[{ id: 'home', label: 'Home', href: '/' }, { id: 'docs', label: 'Docs' }]} />;
}
