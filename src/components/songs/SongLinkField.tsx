"use client";

import { useId, useState } from "react";
import { SONG_LINK_PATTERN } from "@/lib/format";

/**
 * Optional YouTube/Spotify link input. The error is shown only after the
 * user leaves the field (or submits), cleared as soon as it's fixed, and
 * linked via aria-describedby only while visible.
 */
export function SongLinkField({
  name = "link",
  className = "",
  defaultValue,
}: {
  name?: string;
  className?: string;
  defaultValue?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [invalid, setInvalid] = useState(false);

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="font-medium">
        לינק <span className="font-normal text-muted">(לא חובה)</span>
      </label>
      <span id={hintId} className="text-sm text-muted">
        קישור מיוטיוב או מספוטיפיי
      </span>
      <input
        id={id}
        name={name}
        type="url"
        inputMode="url"
        dir="ltr"
        pattern={SONG_LINK_PATTERN}
        defaultValue={defaultValue}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="https://youtu.be/…"
        aria-invalid={invalid}
        aria-describedby={invalid ? `${hintId} ${errorId}` : hintId}
        onBlur={(e) => setInvalid(!e.currentTarget.validity.valid)}
        onInvalid={() => setInvalid(true)}
        onInput={(e) => {
          if (invalid && e.currentTarget.validity.valid) setInvalid(false);
        }}
      />
      {invalid && (
        <p id={errorId} className="text-sm font-medium text-danger">
          <span role="img" aria-label="שגיאה">⚠️</span> יש להדביק קישור מלא מיוטיוב או מספוטיפיי, למשל{" "}
          <bdi dir="ltr">https://youtu.be/…</bdi>
        </p>
      )}
    </div>
  );
}
