import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "כניסה" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <section className="card mx-auto mt-4 grid max-w-md gap-6 px-5 py-8">
      <div className="hero-logo">
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
      <div className="text-center">
        <h1 className="mb-1">כניסה</h1>
        <p className="text-muted">הכלי לניהול השיעורים של סיון</p>
      </div>
      {/* searchParams is request data: read it inside a boundary. */}
      <Suspense fallback={<LoginForm next="/" />}>
        {searchParams.then(({ next }) => (
          <LoginForm next={typeof next === "string" ? next : "/"} />
        ))}
      </Suspense>
    </section>
  );
}
