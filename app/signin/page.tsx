import type { Metadata } from "next";
import Link from "next/link";
import { signIn } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: "Sign in",
};

const inputClasses =
  "w-full border-b border-rule bg-transparent py-2 font-serif text-lg text-ink " +
  "placeholder:text-ink-faint focus:border-oxblood focus:outline-none";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <header className="rule pt-5">
        <Link href="/" className="eyebrow hover:text-oxblood">
          Huerta Group Publishing
        </Link>
      </header>

      <main className="flex flex-1 flex-col justify-center py-16">
        <h1 className="font-display text-3xl tracking-tight">The Workspace</h1>
        <p className="mt-4 text-ink-soft">
          The editorial desk for authors and their permanent record. Sign in to
          continue.
        </p>

        <form action={signIn} className="mt-12 space-y-8">
          <div>
            <label htmlFor="email" className="eyebrow block">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={inputClasses}
            />
          </div>

          <div>
            <label htmlFor="password" className="eyebrow block">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={inputClasses}
            />
          </div>

          {error ? (
            <p className="font-sans text-sm text-oxblood" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="bg-oxblood px-6 py-2.5 font-sans text-sm tracking-wide text-paper hover:bg-oxblood-deep"
          >
            Sign in
          </button>
        </form>
      </main>

      <footer className="rule pb-2 pt-5">
        <p className="font-sans text-xs text-ink-faint">
          Access is provided by the publisher.
        </p>
      </footer>
    </div>
  );
}
