"use client";

import { useId } from "react";
import { MATERIAL_KINDS, materialKindLabel } from "@/lib/format";
import type { MaterialKind } from "@/lib/types";

/** Material kind as visible radio buttons (2–5 exclusive options); song is the default. */
export function KindPicker({
  value,
  onChange,
  name = "kind",
  legend = "סוג",
}: {
  value: MaterialKind;
  onChange: (kind: MaterialKind) => void;
  /** Pass "" to keep it out of the submitted form data. */
  name?: string;
  legend?: string;
}) {
  const id = useId();
  return (
    <fieldset>
      <legend className="mb-1 font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-x-5">
        {MATERIAL_KINDS.map((kind) => (
          <label key={kind} htmlFor={`${id}-${kind}`} className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              id={`${id}-${kind}`}
              name={name || `${id}-kind`}
              value={kind}
              checked={value === kind}
              onChange={() => onChange(kind)}
            />
            {materialKindLabel[kind]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
