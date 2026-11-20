"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { KindPicker } from "@/components/materials/KindPicker";
import { MaterialLinkField } from "@/components/materials/MaterialLinkField";
import { KindBadge, MaterialAction, MaterialArtist, MaterialTitle } from "@/components/materials/MaterialText";
import { guessLang, materialKindLabel, materialLinkError, titleFromLink } from "@/lib/format";
import type { Material, MaterialKind } from "@/lib/types";

/** A material: from the bank, or a new one (kind + title and/or link) created on save. */
export type MaterialEntry = { id: string } | { kind: MaterialKind; title: string; link: string; key: string };

const isExisting = (e: MaterialEntry): e is { id: string } => "id" in e;

/**
 * Materials inside the lesson/session form: pick from the bank, or add a new
 * one quickly (song pre-selected; joins the bank on save). Submitted as JSON.
 */
export function MaterialsField({ bank, initialIds, legend }: { bank: Material[]; initialIds: string[]; legend: string }) {
  const id = useId();
  const [entries, setEntries] = useState<MaterialEntry[]>(() => initialIds.map((mid) => ({ id: mid })));
  const [kind, setKind] = useState<MaterialKind>("song");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const pickRef = useRef<HTMLSelectElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLInputElement | null>(null);

  const ids = entries.filter(isExisting).map((e) => e.id);
  const available = bank.filter((m) => !ids.includes(m.id));
  /** Display shape for an entry (new materials get a provisional Material). */
  const asMaterial = (e: MaterialEntry): Material | undefined =>
    isExisting(e)
      ? bank.find((m) => m.id === e.id)
      : {
          id: e.key,
          kind: e.kind,
          title: e.title || titleFromLink(e.link, e.kind),
          artist: "",
          style: "",
          ...(e.link ? { link: e.link } : {}),
          titleLang: guessLang(e.title),
          artistLang: "he",
        };

  const addExisting = () => {
    const m = bank.find((x) => x.id === pickRef.current?.value);
    if (!m || ids.includes(m.id)) return;
    setEntries((prev) => [...prev, { id: m.id }]);
    setStatus(`״${m.title}״ נוסף.`);
  };

  const addNew = () => {
    const title = (titleRef.current?.value ?? "").trim();
    const link = (linkRef.current?.value ?? "").trim();
    if (!title && !link) {
      setError("יש להזין שם או להדביק לינק.");
      titleRef.current?.focus();
      return;
    }
    const linkError = materialLinkError(kind, link);
    if (linkError) {
      setError(linkError);
      linkRef.current?.focus();
      return;
    }
    setError("");
    setEntries((prev) => [...prev, { kind, title, link, key: crypto.randomUUID() }]);
    setStatus(`${materialKindLabel[kind]} ״${title || titleFromLink(link, kind)}״ נוסף ויישמר גם בבנק החומרים.`);
    if (titleRef.current) titleRef.current.value = "";
    if (linkRef.current) linkRef.current.value = "";
  };

  /** Enter in the quick-add fields adds the material instead of submitting the form (IME-safe). */
  const onEnter = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing && (e.target as HTMLElement).tagName === "INPUT") {
      e.preventDefault();
      addNew();
    }
  };

  const remove = (entry: MaterialEntry) => {
    setEntries((prev) => prev.filter((e) => e !== entry));
    setStatus(`״${asMaterial(entry)?.title ?? "החומר"}״ הוסר.`);
  };

  return (
    <fieldset id="materials" className="card card-section">
      <legend className="card-legend">
        {legend} ({entries.length})
      </legend>
      <input
        type="hidden"
        name="materials"
        value={JSON.stringify(entries.map((e) => (isExisting(e) ? { id: e.id } : { kind: e.kind, title: e.title, link: e.link })))}
      />

      {entries.length === 0 ? (
        <p className="empty-state mb-5">עדיין לא נבחרו חומרים. אפשר לבחור מהבנק או להוסיף חומר חדש.</p>
      ) : (
        <ul className="divider-list mb-5" role="list">
          {entries.map((entry) => {
            const m = asMaterial(entry);
            if (!m) return null;
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    <KindBadge material={m} />
                    <MaterialTitle material={m} />
                    {!isExisting(entry) && <span className="text-sm font-normal text-muted">(חדש)</span>}
                  </span>
                  {m.kind === "song" && (m.artist || m.style) && (
                    <span className="text-sm text-muted">
                      {m.artist && <MaterialArtist material={m} />}
                      {m.artist && m.style && " · "}
                      {m.style}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <MaterialAction material={m} className="tap-link text-sm text-brand-strong underline underline-offset-4" />
                  <button type="button" className="btn btn-secondary btn-compact" onClick={() => remove(entry)}>
                    הסרה
                    <span className="visually-hidden">
                      {" "}
                      של <MaterialTitle material={m} />
                    </span>
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {available.length > 0 && (
        <div className="mb-4 flex flex-col gap-1">
          <label htmlFor={`${id}-pick`} className="font-medium">
            חומר מהבנק
          </label>
          <div className="flex gap-2">
            <select ref={pickRef} id={`${id}-pick`} className="min-w-0 flex-1">
              {available.map((m) => (
                <option key={m.id} value={m.id}>
                  {`${materialKindLabel[m.kind]}: ${m.title}${m.kind === "song" && m.artist ? ` — ${m.artist}` : ""}`}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-secondary btn-compact" onClick={addExisting}>
              הוספה<span className="visually-hidden"> של חומר מהבנק</span>
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3 rounded-2xl border border-border p-4" onKeyDown={onEnter}>
        <p className="font-medium">
          חומר חדש (לא מהבנק)
          <span className="block text-sm font-normal text-muted">מספיק שם או לינק. החומר יישמר גם בבנק.</span>
        </p>
        <KindPicker value={kind} onChange={setKind} name="" legend="סוג החומר החדש" />
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-new-title`} className="font-medium">
            {kind === "song" ? "שם השיר" : "כותרת"}
          </label>
          <input ref={titleRef} id={`${id}-new-title`} dir="auto" autoComplete="off" enterKeyHint="next" />
        </div>
        <MaterialLinkField
          key={kind}
          kind={kind}
          name=""
          inputRef={(el) => {
            linkRef.current = el;
          }}
        />
        <div>
          <button type="button" className="btn btn-secondary" onClick={addNew}>
            הוספת החומר
          </button>
        </div>
        <p role="alert" className="text-sm font-medium text-danger empty:hidden">
          {error}
        </p>
      </div>

      <p role="status" className="mt-3 text-sm text-success empty:hidden">
        {status}
      </p>
    </fieldset>
  );
}
