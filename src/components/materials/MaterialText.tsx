import { materialActionLabel, materialKindLabel, materialUrl } from "@/lib/format";
import type { Material } from "@/lib/types";

/**
 * Title and artist as bidi-isolated text: <bdi> (implicit dir="auto") keeps
 * English titles like "Can't Stop the Feeling!" from reordering the
 * surrounding RTL text, and lang lets screen readers pronounce them correctly.
 */
export function MaterialTitle({ material }: { material: Material }) {
  return <bdi lang={material.titleLang}>{material.title}</bdi>;
}

export function MaterialArtist({ material }: { material: Material }) {
  return <bdi lang={material.artistLang}>{material.artist}</bdi>;
}

/** Kind label as text (never conveyed by an icon or color alone). */
export function KindBadge({ material }: { material: Material }) {
  return <span className="chip">{materialKindLabel[material.kind]}</span>;
}

/**
 * The material's action: listen (song) / watch (video) / open (link, note
 * with a link). Notes without a link have no action and render nothing.
 */
export function MaterialAction({ material, className }: { material: Material; className: string }) {
  const href = materialUrl(material);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {materialActionLabel(material)}
      <span className="visually-hidden">
        {" "}
        — <MaterialTitle material={material} /> (נפתח בלשונית חדשה)
      </span>
    </a>
  );
}
