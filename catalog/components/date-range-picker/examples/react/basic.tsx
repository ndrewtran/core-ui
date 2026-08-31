import { DateRangePicker } from '@muxui/react';

export function BasicDateRangePickerExample() {
  return <DateRangePicker label="Trip dates" startName="tripStart" endName="tripEnd" onChange={() => undefined} />;
}
