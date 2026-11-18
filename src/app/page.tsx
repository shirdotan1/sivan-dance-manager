import Image from "next/image";
import Link from "next/link";
import { getLessonsForSpace, projects, spaces } from "@/data/demo";

export default function HomePage() {
  return (
    <>
      <section className="card mb-10 px-5 py-8 text-center sm:py-10">
        <div className="hero-logo mb-6">
          <Image
            src="/logo.jpeg"
            alt="LYRICAL JAZZ with Sivan"
            lang="en"
            width={1198}
            height={896}
            loading="eager"
            fetchPriority="high"
            sizes="(max-width: 30rem) 140vw, 36rem"
          />
        </div>
        <h1 className="mb-2">שלום סיון 👋</h1>
        <p className="text-lg text-muted">לאן נכנסים היום?</p>
      </section>

      <ul className="grid gap-5 sm:grid-cols-2" role="list">
        {spaces.map((space) => {
          return (
            <li key={space.id}>
              <Link href={`/spaces/${space.id}`} className="card card-link h-full">
                <h2 className="text-brand-strong">{space.name}</h2>
                <p className="mt-1 text-muted">{space.description}</p>
                <p className="mt-3 text-sm">
                  {space.students.length} תלמידות ·{" "}
                  {space.kind === "studio"
                    ? `${space.groups.length} קבוצות · ${getLessonsForSpace(space.id).length} שיעורים`
                    : `${projects.length} פרויקטים · כולל מעקב תשלומים`}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
