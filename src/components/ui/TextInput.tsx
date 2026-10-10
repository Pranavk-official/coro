"use client";
import type { ReactNode } from "react";
import { Description, FieldError, Input, Label, TextField } from "@heroui/react";

/** HeroUI TextField: label, input, optional hint, and an error shown + announced when `error` is set. */
export default function TextInput({
  label,
  value,
  onChange,
  error,
  hint,
  className,
  ...input
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  hint?: ReactNode;
  className?: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  isRequired?: boolean;
  minLength?: number;
  autoFocus?: boolean;
}) {
  const { type, placeholder, autoComplete, isRequired, minLength, autoFocus } = input;
  return (
    <TextField
      className={className ?? "w-full"}
      value={value}
      onChange={onChange}
      type={type}
      autoComplete={autoComplete}
      isRequired={isRequired}
      minLength={minLength}
      autoFocus={autoFocus}
      isInvalid={Boolean(error)}
      // aria, not native: a native-invalid field blocks form submit, so a shown error could never be retried
      validationBehavior="aria"
    >
      <Label>{label}</Label>
      <Input placeholder={placeholder} className="min-h-11" />
      {hint ? <Description>{hint}</Description> : null}
      <FieldError>{error}</FieldError>
    </TextField>
  );
}
