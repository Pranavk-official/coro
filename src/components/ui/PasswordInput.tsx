"use client";
import { useState, type ReactNode } from "react";
import { Button, Description, FieldError, InputGroup, Label, TextField } from "@heroui/react";
import { Eye, EyeOff } from "lucide-react";

/** HeroUI TextField + InputGroup with a show/hide suffix (docs: InputGroup "Password Toggle"). */
export default function PasswordInput({
  label,
  value,
  onChange,
  error,
  hint,
  autoComplete = "current-password",
  isRequired,
  minLength,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  hint?: ReactNode;
  autoComplete?: string;
  isRequired?: boolean;
  minLength?: number;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      className="w-full"
      value={value}
      onChange={onChange}
      type={visible ? "text" : "password"}
      autoComplete={autoComplete}
      isRequired={isRequired}
      minLength={minLength}
      autoFocus={autoFocus}
      isInvalid={Boolean(error)}
      // aria, not native: a native-invalid field blocks form submit, so a shown error could never be retried
      validationBehavior="aria"
    >
      <Label>{label}</Label>
      <InputGroup fullWidth className="min-h-11">
        <InputGroup.Input />
        <InputGroup.Suffix className="pe-1">
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={visible ? "Hide password" : "Show password"}
            onPress={() => setVisible((v) => !v)}
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        </InputGroup.Suffix>
      </InputGroup>
      {hint ? <Description>{hint}</Description> : null}
      <FieldError>{error}</FieldError>
    </TextField>
  );
}
