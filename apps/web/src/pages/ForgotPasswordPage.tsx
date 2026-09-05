import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthShell } from '../components/auth/AuthShell';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Banner, ErrorBanner } from '../components/ui/Banner';
import { requestPasswordReset } from '../api/auth';
import { getErrorCopy } from '../api/client';
import type { ErrorCopy } from '../api/error-copy';

/**
 * Request a reset link.
 *
 * The confirmation deliberately does not say whether the address had an
 * account. The server refuses to distinguish them - saying "no account found"
 * here would hand back the account-enumeration oracle the API is careful not
 * to be, and it is a tempting thing to add because it feels more helpful.
 *
 * The one real error worth showing is a deployment that cannot send email at
 * all, because then "check your inbox" would be a lie.
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorCopy | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSubmitted(true);
    } catch (err) {
      // Only a genuine server-side problem lands here - most often a
      // deployment with no mailer. A missing account does not: that path
      // returns success by design, so the confirmation stays truthful without
      // confirming the address exists.
      setError(getErrorCopy(err));
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <AuthShell
        title="Check your email"
        subtitle="If that address has an account, a reset link is on its way."
        footer={
          <Link to="/login" className="font-medium text-brand-700 hover:text-brand-800">
            Back to sign in
          </Link>
        }
      >
        <Banner tone="success" title="Link sent" live>
          The link works once and expires in 30 minutes. If nothing arrives within a few
          minutes, check your spam folder — then try again.
        </Banner>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one."
      footer={
        <>
          Remembered it?{' '}
          <Link to="/login" className="font-medium text-brand-700 hover:text-brand-800">
            Sign in
          </Link>
        </>
      }
    >
      {error && <ErrorBanner copy={error} className="mb-4" />}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
          autoFocus
        />
        <Button type="submit" loading={loading} loadingLabel="Sending…" fullWidth size="lg">
          Email me a link
        </Button>
      </form>
    </AuthShell>
  );
}
