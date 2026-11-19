import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { getLessonCounts, getProjects, getSpaces } from "@/lib/data/queries";
import { activeStudents } from "@/lib/lookup";

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

      {/* The hero above is static (instant); the cards read the database. */}
      <Suspense fallback={<SpaceCardsSkeleton />}>
        <SpaceCards />
      </Suspense>
    </>
  );
}

async function SpaceCards() {
  const [spaces, lessonCounts, projects] = await Promise.all([getSpaces(), getLessonCounts(), getProjects()]);
  return (
    <>
      {/* One column on phones, all three spaces in a row once there's room
          (no 2+1 in-between that leaves one card alone). */}
      <ul className="grid gap-5 md:grid-cols-3" role="list">
        {spaces.map((space) => {
          return (
            <li key={space.id}>
              <Link href={`/spaces/${space.id}`} className="card card-link h-full">
                <h2 className="text-brand-strong">{space.name}</h2>
                <p className="mt-1 text-muted">{space.description}</p>
                <p className="mt-3 text-sm">
                  {activeStudents(space.students).length} תלמידות ·{" "}
                  {space.kind === "studio"
                    ? `${space.groups.length} קבוצות · ${lessonCounts[space.id] ?? 0} שיעורים`
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

function SpaceCardsSkeleton() {
  return (
    <ul className="grid gap-5 md:grid-cols-3" role="list" aria-busy="true" aria-label="טוען מרחבים">
      {[0, 1, 2].map((i) => (
        <li key={i} className="card h-36 animate-pulse" />
      ))}
    </ul>
  );
}
