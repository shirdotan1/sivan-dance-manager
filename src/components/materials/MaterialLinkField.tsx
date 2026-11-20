"use client";

import { useId, useState } from "react";
import { materialLinkError } from "@/lib/format";
import type { MaterialKind } from "@/lib/types";

const HINT: Record<MaterialKind, string> = {
  song: "קישור מיוטיוב או מספוטיפיי (לא חובה)",
  video: "קישור לסרטון — יוטיוב, וימאו או כל אתר",
  link: "כתובת מלאה של האתר או המסמך",
  note: "קישור נוסף (לא חובה)",
};

const PLACEHOLDER: Record<MaterialKind, string> = {
  song: "https://youtu.be/…",
  video: "https://youtu.be/…",
  link: "https://…",
  note: "https://…",
};

/**
 * Link input whose rules follow the material kind (validated with the same
 * function the server uses). The error appears after leaving the field or on
 * submit, clears as soon as it's fixed, and is described only while visible.
 */
export function MaterialLinkField({
  kind,
  name = "link",
  defaultValue,
  inputRef,
}: {
  kind: MaterialKind;
  /** Pass "" to keep the field out of the submitted form data. */
  name?: string;
  defaultValue?: string;
  /** Callback ref, e.g. to read the value from an inline "add" button. */
  inputRef?: (el: HTMLInputElement | null) => void;
}) {
  const id = useId();
  const [error, setError] = useState("");
  // A field outside the submitted data (name="", e.g. inline quick-add inside
  // a bigger form) must never block that form: no required, no custom validity.
  const inForm = name !== "";
  const required = inForm && (kind === "video" || kind === "link");

  const check = (el: HTMLInputElement) => {
    const message = el.value || required ? (materialLinkError(kind, el.value) ?? "") : "";
    if (inForm) el.setCustomValidity(message);
    return message;
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        לינק{" "}
        {kind === "video" || kind === "link" ? (
          <span aria-hidden="true">*</span>
        ) : (
          <span className="font-normal text-muted">(לא חובה)</span>
        )}
      </label>
      <span id={`${id}-hint`} className="text-sm text-muted">
        {HINT[kind]}
      </span>
      <input
        id={id}
        ref={(el) => {
          // Apply this kind's rules to a value carried over from another kind.
          if (el?.value) check(el);
          inputRef?.(el);
        }}
        name={name || undefined}
        type="url"
        inputMode="url"
        dir="ltr"
        required={required}
        defaultValue={defaultValue}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder={PLACEHOLDER[kind]}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-hint ${id}-error` : `${id}-hint`}
        onBlur={(e) => setError(check(e.currentTarget))}
        onInvalid={(e) => setError(check(e.currentTarget) || e.currentTarget.validationMessage)}
        onInput={(e) => {
          const message = check(e.currentTarget);
          if (error && !message) setError("");
        }}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-danger">
          <span role="img" aria-label="שגיאה">⚠️</span> {error}
        </p>
      )}
    </div>
  );
}
