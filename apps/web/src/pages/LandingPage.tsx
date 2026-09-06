import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import { ThemeToggle } from '../components/ui/ThemeToggle';

/**
 * The public front page.
 *
 * ── Why the demo is the hero ──────────────────────────────────────────────
 * Everything about this product is a claim that has to be believed: that it
 * answers accurately, that it admits ignorance, that it takes a minute to set
 * up. A screenshot cannot establish any of that, and a signup form asks
 * someone to take it on faith before they have seen anything.
 *
 * So the real widget is on this page, answering questions about ReplyIQ, and
 * the page tells visitors to try asking it something it does NOT know. The
 * strongest thing this product does is say "I don't know" — showing that is
 * more persuasive than any sentence claiming it.
 *
 * It is also honest dogfooding: the demo is the actual product, on an actual
 * verified domain, using the same origin check every customer gets. Nothing
 * here is special-cased.
 */

/** The business the demo widget answers as. Configured, not hard-coded, so
 *  a staging deploy can point at its own demo data. */
const DEMO_BUSINESS_ID = import.meta.env.VITE_DEMO_BUSINESS_ID as string | undefined;

export function LandingPage() {
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken));

  /**
   * The widget is loaded by injecting its own script tag, exactly as a
   * customer would — rather than importing the module. If the real install
   * path breaks, this page breaks with it, which is the point.
   */
  useEffect(() => {
    if (!DEMO_BUSINESS_ID) return;
    const script = document.createElement('script');
    script.src = '/widget.js';
    script.defer = true;
    script.dataset.businessId = DEMO_BUSINESS_ID;
    document.body.append(script);
    return () => {
      script.remove();
      // The widget mounts a shadow host on body and guards against mounting
      // twice; both have to go or navigating back leaves a dead bubble.
      document.querySelectorAll('body > div').forEach((el) => {
        if (el.shadowRoot?.querySelector('.launcher')) el.remove();
      });
      delete (window as unknown as Record<string, unknown>).__replyiqWidgetMounted;
    };
  }, []);

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-fill to-brand-fill-deep shadow-raised">
          <span className="text-sm font-bold text-white">RQ</span>
        </div>
        <span className="text-title text-lg font-semibold text-ink-900">ReplyIQ</span>
        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="interactive rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium text-ink-700 hover:text-ink-900"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="interactive rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-24">
        <section className="animate-rise py-14 sm:py-20">
          <p className="text-overline text-xs font-semibold text-brand-700">
            AI receptionist for small businesses
          </p>
          <h1 className="text-display mt-3 max-w-3xl text-4xl font-semibold text-ink-900 sm:text-5xl">
            It answers your customers using your words — and says “I don’t know”
            when it doesn’t.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-ink-600">
            Prove you own your website and ReplyIQ reads it, so your receptionist knows your
            hours, services and prices before you’ve written a thing. It never invents an
            answer, because a confident wrong answer costs you the customer.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/register"
              className="interactive rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-raised"
            >
              Set it up free
            </Link>
            {DEMO_BUSINESS_ID && (
              <span className="text-sm text-ink-600">
                — or ask the assistant in the corner anything about ReplyIQ.
              </span>
            )}
          </div>
        </section>

        {/* The claim that is hardest to believe, made checkable on the spot. */}
        {DEMO_BUSINESS_ID && (
          <section className="stagger grid gap-4 sm:grid-cols-3">
            {[
              {
                title: 'Try asking something it knows',
                body: '“How does verification work?” It will answer from what we published, and show you where the answer came from.',
              },
              {
                title: 'Then ask something it can’t know',
                body: '“What’s the weather in Delhi?” It will tell you it doesn’t know rather than making something up. That is the whole product.',
              },
              {
                title: 'That is the real widget',
                body: 'Not a mock-up. It is the same script our customers paste into their site, answering on a domain we verified.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="animate-rise rounded-card border border-ink-200 bg-surface p-5 shadow-card"
              >
                <h2 className="text-title text-sm font-semibold text-ink-900">{card.title}</h2>
                <p className="mt-2 text-sm text-ink-600">{card.body}</p>
              </div>
            ))}
          </section>
        )}

        <section className="mt-20">
          <h2 className="text-display text-2xl font-semibold text-ink-900 sm:text-3xl">
            Three steps, about a minute
          </h2>
          <ol className="stagger mt-8 grid gap-5 sm:grid-cols-3">
            {[
              {
                n: '1',
                title: 'Prove the site is yours',
                body: 'A DNS record or a line of HTML. This is what stops anyone else putting your receptionist on their site — and what lets us read yours.',
              },
              {
                n: '2',
                title: 'We read your website',
                body: 'Your services, hours and prices become answers you can edit. Most competitors ask you to upload documents; that is the step where people give up.',
              },
              {
                n: '3',
                title: 'Paste one line',
                body: 'A 4kB script, no framework, no cookie banner. It works on your site and nowhere else.',
              },
            ].map((step) => (
              <li key={step.n} className="animate-rise">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-sm font-semibold text-brand-700">
                  {step.n}
                </div>
                <h3 className="text-title mt-4 text-base font-semibold text-ink-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-ink-600">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-20 rounded-card border border-ink-200 bg-surface p-8 shadow-card sm:p-10">
          <h2 className="text-display text-2xl font-semibold text-ink-900">
            Why it refuses to guess
          </h2>
          <p className="mt-4 max-w-2xl text-ink-600">
            If a receptionist tells a caller you’re open on Sunday and you’re not, you wear
            it — and you find out from an annoyed customer rather than from us. So every
            answer here comes from something you published, word for word, and anything else
            is an honest “I don’t know, here’s how to reach the team”.
          </p>
          <p className="mt-4 max-w-2xl text-ink-600">
            You see every question it couldn’t answer, so the gaps become a short list of
            things to write rather than a mystery.
          </p>
          <Link
            to="/register"
            className="interactive mt-7 inline-block rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-raised"
          >
            Set it up free
          </Link>
        </section>
      </main>

      <footer className="border-t border-ink-200 py-8">
        <p className="mx-auto max-w-5xl px-5 text-sm text-ink-500">
          © {new Date().getFullYear()} ReplyIQ
        </p>
      </footer>
    </div>
  );
}
