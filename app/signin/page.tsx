import type { Metadata } from "next";
import Link from "next/link";
import { Field, PrimaryButton } from "@/components/editorial";
import { signIn } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: "Sign in",
};

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
          <Field
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            required
          />

          <Field
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            required
          />

          {error ? (
            <p className="font-sans text-sm text-oxblood" role="alert">
              {error}
            </p>
          ) : null}

          <PrimaryButton>Sign in</PrimaryButton>
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
