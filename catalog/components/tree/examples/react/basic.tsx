import { Tree } from '@muxui/react';
export function BasicTreeExample() { return <Tree aria-label="Files" items={[{ id: 'root', label: 'Root', children: [{ id: 'child', label: 'Child' }] }]} />; }
