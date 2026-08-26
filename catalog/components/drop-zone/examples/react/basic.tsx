import { DropZone } from '@core-ui/react';
export function BasicDropZoneExample() { return <DropZone aria-label="Upload files" onDrop={(event) => console.log(event.items)}>Drop files here</DropZone>; }
