import { Table } from '@core-ui/react';
export function BasicTableExample() { return <Table aria-label="People" columns={[{ id: 'name', label: 'Name' }]} rows={[{ id: '1', name: 'Ada' }]} />; }
