"use client";

type ReplyBoxProps = {
  value: string;
  onChange(value: string): void;
  onSubmit(): void;
  rows?: number;
  buttonText?: string;
  disabled?: boolean;
};

export function ReplyBox({
  value,
  onChange,
  onSubmit,
  rows = 3,
  buttonText = "post reply",
  disabled = false,
}: ReplyBoxProps) {
  return (
    <>
      <textarea
        rows={rows}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />

      <button
        type="button"
        disabled={disabled || !value.trim()}
        onClick={onSubmit}
      >
        {buttonText}
      </button>
    </>
  );
}