import { ToastProvider, useToast } from '@core-ui/react';
function Action() { const { add } = useToast(); return <button type="button" onClick={() => add('Saved')}>Save</button>; }
export function BasicToastExample() { return <ToastProvider><Action /></ToastProvider>; }
