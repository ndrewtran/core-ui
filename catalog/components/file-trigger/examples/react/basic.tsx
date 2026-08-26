import { FileTrigger } from '@core-ui/react';
export function BasicFileTriggerExample() { return <FileTrigger onSelect={(files) => console.log(files)}>Choose a file</FileTrigger>; }
