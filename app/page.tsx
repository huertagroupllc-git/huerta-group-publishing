import type { Metadata } from "next";
import Link from "next/link";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  siteUrl,
} from "@/lib/site";

const PROMISE = "Develop books, not just manuscripts.";

export const metadata: Metadata = {
  title: {
    absolute: `${SITE_NAME} — ${PROMISE}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  keywords: [
    "book development software",
    "writing software for authors",
    "manuscript development",
    "manuscript revision software",
    "editorial workflow",
    "editorial software for authors",
    "nonfiction writing software",
    "author publishing platform",
  ],
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${PROMISE}`,
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${PROMISE}`,
    description: SITE_DESCRIPTION,
  },
};

// --- house presentational primitives, as links (navigations, not forms) ---

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-block bg-oxblood px-6 py-3 font-sans text-sm tracking-wide text-paper hover:bg-oxblood-deep ${focusRing} focus-visible:outline-ink`}
    >
      {children}
    </Link>
  );
}

function QuietLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-block border border-rule px-6 py-3 font-sans text-sm tracking-wide text-ink hover:border-oxblood hover:text-oxblood ${focusRing} focus-visible:outline-oxblood`}
    >
      {children}
    </Link>
  );
}

const navLink =
  "font-sans text-xs tracking-wide underline-offset-4 hover:text-oxblood hover:underline focus-visible:text-oxblood focus-visible:underline focus-visible:outline-none";

// --- content ---

const JOURNEY: { title: string; body: string }[] = [
  {
    title: "Discovery",
    body: "Before the writing, the thinking: what the book is for, who it serves, and what it must not become.",
  },
  {
    title: "Book Memory",
    body: "The book's own constitution, outline, and vocabulary — its stated intentions, kept where the work can always answer to them.",
  },
  {
    title: "The Manuscript",
    body: "Written one chapter at a time, each a complete unit with its own purpose, then assembled into the reader's experience.",
  },
  {
    title: "Editorial Review",
    body: "A senior editorial reading of the finished draft against the book's own constitution — what it honors, and where it has drifted.",
  },
  {
    title: "Deliberation",
    body: "Judgment between observation and revision: the author weighs each finding and records the decision behind it.",
  },
  {
    title: "Revision",
    body: "The manuscript improves through the same deliberate versions it was written in — nothing overwritten, nothing lost.",
  },
  {
    title: "Publication",
    body: "The end the whole process is built toward: a book brought to completion and readiness, on the author's terms.",
  },
];

const DESK: { name: string; body: string }[] = [
  {
    name: "Author Memory",
    body: "Who the author is and how they sound, preserved across every book they will ever write.",
  },
  {
    name: "Book Memory",
    body: "Why this particular book exists, and the boundaries it agreed to keep.",
  },
  {
    name: "The Writing Room",
    body: "Where a chapter is written, its purpose and the book's memory always in the margin.",
  },
  {
    name: "Reading Copy",
    body: "The manuscript assembled for continuous reading, exactly as a reader would meet it.",
  },
  {
    name: "Editorial Findings",
    body: "Observations that guide revision, each citing the book's own words — never a rewrite.",
  },
  {
    name: "Editorial Deliberation",
    body: "A place to reason about a finding and decide, before a single word changes.",
  },
  {
    name: "Version History",
    body: "Every draft numbered and kept; the permanent record only grows.",
  },
  {
    name: "Constitution Review",
    body: "A reading of the whole manuscript against the book's founding intent.",
  },
];

const PRINCIPLES: { title: string; body: string }[] = [
  {
    title: "Authorship is the foundation.",
    body: "Automation serves the author's voice; it is never the source of it. The platform will not write a book for you, and would not be worth using if it did.",
  },
  {
    title: "Complete before perfect.",
    body: "Finish the thought before polishing the sentence. A whole draft can be judged and matured; a fragment can only be fussed over.",
  },
  {
    title: "Revision is deliberate.",
    body: "Every change is a decision, worded as one — and the reasoning is kept, so a book always remembers how it became itself.",
  },
];

export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: SITE_NAME,
        url: `${siteUrl()}/`,
        description: SITE_DESCRIPTION,
        slogan: PROMISE,
      },
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url: `${siteUrl()}/`,
        description: SITE_DESCRIPTION,
        inLanguage: "en-US",
      },
    ],
  };

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:bg-paper focus:px-4 focus:py-2 focus:font-sans focus:text-sm focus:text-oxblood focus:outline focus:outline-2 focus:outline-oxblood"
      >
        Skip to content
      </a>

      <div className="mx-auto max-w-5xl px-6 sm:px-8">
        <header className="rule flex flex-wrap items-baseline justify-between gap-4 pt-5">
          <Link href="/" className={`eyebrow ${focusRing} focus-visible:outline-oxblood hover:text-oxblood`}>
            {SITE_NAME}
          </Link>
          <nav aria-label="Primary" className="flex items-baseline gap-6">
            <Link href="/workspace" className={`${navLink} text-ink-soft`}>
              The Workspace
            </Link>
            <Link href="/signin" className={`${navLink} text-oxblood`}>
              Sign in
            </Link>
          </nav>
        </header>

        <main id="main">
          {/* Hero */}
          <section
            aria-labelledby="hero-heading"
            className="py-20 sm:py-28 lg:py-32"
          >
            <p className="eyebrow">{SITE_TAGLINE}</p>
            <h1
              id="hero-heading"
              className="mt-5 max-w-4xl font-display text-[2.5rem] leading-[1.06] tracking-tight text-ink sm:text-6xl sm:leading-[1.05] lg:text-7xl"
            >
              Develop books,
              {/* Forced break only where the line comfortably fits; on
                  narrow screens the title wraps naturally instead. */}
              <br className="hidden sm:block" />{" "}
              not just manuscripts.
            </h1>
            <p className="mt-8 max-w-2xl text-xl leading-relaxed text-ink-soft sm:text-2xl">
              Most writing software helps you produce text. Huerta Group
              Publishing is an editorial house with a memory — a place to
              understand what a book is trying to say, draft it to completion,
              weigh it against its own intentions, and bring it to maturity
              with the author&rsquo;s voice intact.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
              <PrimaryLink href="/signin">Sign in</PrimaryLink>
              <a
                href="#the-journey"
                className={`${navLink} text-sm text-ink-soft`}
              >
                See how a book develops
              </a>
            </div>
          </section>

          {/* The difference */}
          <section
            aria-labelledby="difference-heading"
            id="the-difference"
            className="rule scroll-mt-8 py-16 sm:py-20"
          >
            <p className="eyebrow">The difference</p>
            <h2
              id="difference-heading"
              className="mt-4 max-w-3xl font-display text-3xl leading-tight tracking-tight sm:text-4xl"
            >
              Software ends at the sentence. A book needs more.
            </h2>
            <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink">
              A sentence can be generated in an instant. A book cannot. It has
              to know its own purpose, keep faith with the reader, and hold
              together from first page to last. That is editorial work — and it
              is the work this platform is built around.
            </p>

            <div className="mt-12 grid gap-10 sm:grid-cols-2 sm:gap-0">
              <div className="sm:border-r sm:border-rule sm:pr-10">
                <p className="eyebrow">Ordinary writing tools</p>
                <ul className="mt-5 space-y-3 leading-relaxed text-ink-soft">
                  <li>Produce and polish text on demand.</li>
                  <li>Autocomplete the next line.</li>
                  <li>Rewrite your words into a house style.</li>
                  <li>Keep no memory of why you began.</li>
                </ul>
              </div>
              <div className="border-t border-rule pt-8 sm:border-t-0 sm:pt-0 sm:pl-10">
                <p className="eyebrow">Huerta Group Publishing</p>
                <ul className="mt-5 space-y-3 leading-relaxed text-ink">
                  <li>Preserves who the author is and why the book exists.</li>
                  <li>Develops the manuscript chapter by chapter.</li>
                  <li>Reads the finished work against its own intent.</li>
                  <li>Keeps every version and every decision on the record.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* The journey */}
          <section
            aria-labelledby="journey-heading"
            id="the-journey"
            className="rule scroll-mt-8 py-16 sm:py-20"
          >
            <p className="eyebrow">The book-development journey</p>
            <h2
              id="journey-heading"
              className="mt-4 max-w-3xl font-display text-3xl leading-tight tracking-tight sm:text-4xl"
            >
              From a first idea to a finished book.
            </h2>
            <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink">
              The platform reveals the right tools for the stage the author is
              in, and a book matures through each in turn — never all at once.
            </p>

            <ol className="mt-10">
              {JOURNEY.map((step, i) => (
                <li
                  key={step.title}
                  className="rule grid gap-2 py-7 sm:grid-cols-[8rem_1fr] sm:gap-8"
                >
                  <p className="eyebrow pt-1.5">
                    Stage {String(i + 1).padStart(2, "0")}
                  </p>
                  <div>
                    <h3 className="font-display text-2xl tracking-tight">
                      {step.title}
                    </h3>
                    <p className="mt-2 max-w-prose leading-relaxed text-ink-soft">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* The working environment */}
          <section
            aria-labelledby="desk-heading"
            id="the-desk"
            className="rule scroll-mt-8 py-16 sm:py-20"
          >
            <p className="eyebrow">The editorial desk</p>
            <h2
              id="desk-heading"
              className="mt-4 max-w-3xl font-display text-3xl leading-tight tracking-tight sm:text-4xl"
            >
              The rooms of a working editorial office.
            </h2>
            <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink">
              Not a grid of features — the spaces an author actually works in,
              each doing one thing well.
            </p>

            <div className="mt-8 grid sm:grid-cols-2 sm:gap-x-12">
              {DESK.map((room) => (
                <div key={room.name} className="rule py-6">
                  <h3 className="font-display text-xl tracking-tight">
                    {room.name}
                  </h3>
                  <p className="mt-1.5 max-w-prose leading-relaxed text-ink-soft">
                    {room.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Editorial intelligence */}
          <section
            aria-labelledby="review-heading"
            id="editorial-review"
            className="rule scroll-mt-8 py-16 sm:py-20"
          >
            <p className="eyebrow">Editorial review</p>
            <h2
              id="review-heading"
              className="mt-4 max-w-3xl font-display text-3xl leading-tight tracking-tight sm:text-4xl"
            >
              An editorial reader that observes — and never overwrites.
            </h2>
            <div className="mt-6 max-w-prose space-y-5 text-lg leading-relaxed text-ink">
              <p>
                When a manuscript is ready, it can be read against the very
                document that defined it: the book&rsquo;s constitution. The
                reading returns findings — precise observations that quote the
                book&rsquo;s own words and explain where the manuscript keeps
                its promises and where it has wandered.
              </p>
              <p>
                It proposes no replacement text. It changes nothing. Every
                decision that follows belongs to the author. This is the role
                the platform gives to automation: an editorial department that
                reads and advises, never an author that takes the pen.
              </p>
            </div>
            <p className="mt-8 max-w-prose border-l-2 border-rule pl-5 font-display text-2xl leading-snug tracking-tight text-ink">
              It reads like an editor. It never writes like one.
            </p>
          </section>

          {/* Historical integrity */}
          <section
            aria-labelledby="record-heading"
            id="the-record"
            className="rule scroll-mt-8 py-16 sm:py-20"
          >
            <p className="eyebrow">The permanent record</p>
            <h2
              id="record-heading"
              className="mt-4 max-w-3xl font-display text-3xl leading-tight tracking-tight sm:text-4xl"
            >
              Nothing worth keeping is ever lost.
            </h2>
            <div className="mt-6 max-w-prose space-y-5 text-lg leading-relaxed text-ink">
              <p>
                Every version is numbered and preserved. Editing writes the
                next version; it never erases the last. Findings stay anchored
                to the exact draft that prompted them, aging in plain sight as
                the work moves on. The judgments behind each revision remain on
                the record.
              </p>
              <p>
                A book&rsquo;s history here is not a changelog to be pruned. It
                is part of the book — the account of how a finished work came to
                be, kept for as long as the work itself.
              </p>
            </div>
          </section>

          {/* Philosophy */}
          <section
            aria-labelledby="philosophy-heading"
            id="philosophy"
            className="rule scroll-mt-8 py-16 sm:py-20"
          >
            <p className="eyebrow">What we believe</p>
            <h2
              id="philosophy-heading"
              className="mt-4 max-w-3xl font-display text-3xl leading-tight tracking-tight sm:text-4xl"
            >
              A publishing house before it is software.
            </h2>
            <div className="mt-10">
              {PRINCIPLES.map((p) => (
                <div
                  key={p.title}
                  className="rule grid gap-2 py-7 sm:grid-cols-[1fr_1.4fr] sm:gap-10"
                >
                  <h3 className="font-display text-2xl leading-snug tracking-tight">
                    {p.title}
                  </h3>
                  <p className="max-w-prose text-lg leading-relaxed text-ink-soft">
                    {p.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Closing */}
          <section
            aria-labelledby="begin-heading"
            id="begin"
            className="rule scroll-mt-8 py-20 sm:py-28"
          >
            <p className="eyebrow">Begin</p>
            <h2
              id="begin-heading"
              className="mt-4 max-w-3xl font-display text-4xl leading-tight tracking-tight sm:text-5xl"
            >
              A place where a book can be developed.
            </h2>
            <p className="mt-6 max-w-prose text-xl leading-relaxed text-ink-soft">
              Huerta Group Publishing is built for authors who mean to finish —
              and to keep faith with what they set out to write.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
              <QuietLink href="/signin">Sign in</QuietLink>
            </div>
            <p className="mt-6 max-w-prose font-sans text-xs leading-relaxed text-ink-faint">
              Access is arranged with the publisher; there is no public
              sign-up. Authors with an account can sign in above.
            </p>
          </section>
        </main>

        <footer className="rule flex flex-col gap-6 py-8 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <p className="eyebrow">{SITE_NAME}</p>
            <p className="mt-2 font-sans text-xs text-ink-faint">
              © 2026 {SITE_NAME}. {SITE_TAGLINE}.
            </p>
          </div>
          <nav
            aria-label="Footer"
            className="flex flex-wrap gap-x-6 gap-y-2 text-ink-soft"
          >
            <a href="#the-difference" className={navLink}>
              The difference
            </a>
            <a href="#the-journey" className={navLink}>
              The journey
            </a>
            <a href="#the-desk" className={navLink}>
              The desk
            </a>
            <a href="#editorial-review" className={navLink}>
              Editorial review
            </a>
            <Link href="/signin" className={`${navLink} text-oxblood`}>
              Sign in
            </Link>
          </nav>
        </footer>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}
