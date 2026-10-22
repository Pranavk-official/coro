"use client";
import { useEffect } from "react";
import { Calendar, DateField, DatePicker, Label, TimeField, type TimeValue } from "@heroui/react";
import {
  getLocalTimeZone,
  now,
  parseDateTime,
  toCalendarDateTime,
  toTime,
  type CalendarDateTime,
  type DateValue,
} from "@internationalized/date";

/** `value`/`onChange` use the same "YYYY-MM-DDTHH:mm" string a datetime-local input did, so callers keep their state. */
type Props = { label: string; value: string; onChange: (v: string) => void };

const parse = (v: string): CalendarDateTime | null => {
  try {
    return v ? parseDateTime(v) : null;
  } catch {
    return null;
  }
};
const format = (v: DateValue | null) => (v ? v.toString().slice(0, 16) : "");
const nowLocal = () => toCalendarDateTime(now(getLocalTimeZone()));
const nextHour = () => nowLocal().add({ hours: 1 }).set({ minute: 0, second: 0, millisecond: 0 });

function MonthGrid() {
  return (
    <>
      <Calendar.Header>
        <Calendar.Heading />
        <Calendar.NavButton slot="previous" />
        <Calendar.NavButton slot="next" />
      </Calendar.Header>
      <Calendar.Grid>
        <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
        <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
      </Calendar.Grid>
    </>
  );
}

function TimeInput({ value, onChange }: { value: TimeValue | null; onChange: (t: TimeValue | null) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label>Time</Label>
      <TimeField aria-label="Time" granularity="minute" value={value} onChange={onChange}>
        <TimeField.Group variant="secondary">
          <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
        </TimeField.Group>
      </TimeField>
    </div>
  );
}

type PickerState = { dateValue: DateValue | null; timeValue: TimeValue | null; setTimeValue: (t: TimeValue) => void };

/** A day picked with no time yet: fill in the next full hour, so the value commits (and stays editable) right away. */
function DefaultTime({ state }: { state: PickerState }) {
  const { dateValue, timeValue, setTimeValue } = state;
  useEffect(() => {
    if (dateValue && !timeValue) setTimeValue(toTime(nextHour()));
  }, [dateValue, timeValue, setTimeValue]);
  return null;
}

/** Date + time field (HeroUI DatePicker, minute granularity, no past times). Calendar and time live in the popover. */
export default function DateTimeField({ label, value, onChange }: Props) {
  return (
    <DatePicker
      className="w-full"
      granularity="minute"
      hideTimeZone
      // Stay open after a day is picked so the time below can be set too.
      shouldCloseOnSelect={false}
      placeholderValue={nextHour()}
      minValue={nowLocal()}
      value={parse(value)}
      onChange={(v) => onChange(format(v))}
    >
      {({ state }) => (
        <>
          <Label>{label}</Label>
          <DateField.Group fullWidth className="min-h-11">
            <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
            <DateField.Suffix>
              <DatePicker.Trigger>
                <DatePicker.TriggerIndicator />
              </DatePicker.Trigger>
            </DateField.Suffix>
          </DateField.Group>
          <DatePicker.Popover className="flex flex-col gap-3 p-3">
            <Calendar aria-label={label}>
              <MonthGrid />
            </Calendar>
            <TimeInput value={state.timeValue} onChange={(t) => t && state.setTimeValue(t)} />
            <DefaultTime state={state} />
          </DatePicker.Popover>
        </>
      )}
    </DatePicker>
  );
}

/** Same value, laid out inline (calendar + time, no popover): for inside a phone drawer, where a popover would fight its focus trap. */
export function InlineDateTime({ label, value, onChange }: Props) {
  const current = parse(value);
  const min = nowLocal();
  const base = current ?? nextHour();
  return (
    <div className="flex flex-col gap-3">
      <Calendar
        aria-label={label}
        className="mx-auto"
        minValue={min}
        value={base}
        onChange={(d) => onChange(format(base.set({ year: d.year, month: d.month, day: d.day })))}
      >
        <MonthGrid />
      </Calendar>
      <TimeInput value={toTime(base)} onChange={(t) => t && onChange(format(base.set({ hour: t.hour, minute: t.minute })))} />
    </div>
  );
}
