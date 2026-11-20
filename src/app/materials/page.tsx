import type { Metadata } from "next";
import { Suspense } from "react";
import { MaterialBank } from "@/components/materials/MaterialBank";
import { getMaterialUsage, getMaterials } from "@/lib/data/queries";

export const metadata: Metadata = { title: "בנק חומרים" };

export default function MaterialsPage() {
  return (
    <>
      <h1 className="mb-2">בנק חומרים</h1>
      <p className="mb-6 text-muted">שירים, סרטונים, קישורים והערות לשיעורים ולאימונים.</p>
      <Suspense fallback={<p className="text-muted">טוען חומרים…</p>}>
        <MaterialBankLoader />
      </Suspense>
    </>
  );
}

async function MaterialBankLoader() {
  const [materials, usage] = await Promise.all([getMaterials(), getMaterialUsage()]);
  return <MaterialBank materials={materials} usage={usage} />;
}
