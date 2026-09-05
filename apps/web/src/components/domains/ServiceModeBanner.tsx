import { Link } from 'react-router-dom';
import { Banner } from '../ui/Banner';
import type { ServiceMode } from '../../api/business';

/**
 * Tells the user the truth about whether their receptionist is actually
 * working (Goal G7).
 *
 * `INACTIVE` is the case this exists for. A business that completed onboarding
 * and later removed its only verified website is, from the product's point of
 * view, switched off — and the old dashboard said nothing at all, showing a
 * cheerful "setup complete" state for a receptionist that could not answer
 * anyone. Onboarding completion is history; this is the present.
 *
 * `LIVE` renders nothing: a banner that says "everything is fine" on every
 * page load is noise, and noise is what people learn to ignore right before
 * the one banner that mattered.
 */
export function ServiceModeBanner({
  mode,
  context,
}: {
  mode: ServiceMode;
  /** Where it is shown, so the call to action points somewhere useful. */
  context: 'dashboard' | 'domains';
}) {
  if (mode === 'LIVE') return null;

  const link =
    context === 'dashboard' ? (
      <Link
        to="/dashboard/domains"
        className="font-medium underline underline-offset-2 hover:no-underline"
      >
        Manage websites
      </Link>
    ) : null;

  if (mode === 'TEST') {
    return (
      <Banner tone="test" title="You’re in test mode">
        <p>
          The only website you’ve verified is a test address, so your AI receptionist isn’t
          answering real visitors yet. Everything else works exactly as it will when you go live.
        </p>
        <p className="mt-1.5">Add and verify your real website to switch on. {link}</p>
      </Banner>
    );
  }

  return (
    <Banner tone="warning" title="Your AI receptionist is offline">
      <p>
        There’s no verified website on your account right now, so there’s nowhere for it to answer.
        Add a website and verify it to switch back on. {link}
      </p>
    </Banner>
  );
}
