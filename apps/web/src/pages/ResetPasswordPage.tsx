import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from '../components/auth/AuthShell';
import { PasswordRequirements } from '../components/auth/PasswordRequirements';
import { Button } from '../components/ui/Button';
import { PasswordInput } from '../components/ui/PasswordInput';
import { Banner, ErrorBanner } from '../components/ui/Banner';
import { resetPassword } from '../api/auth';
import { getErrorCopy } from '../api/client';
import type { ErrorCopy } from '../api/error-copy';

/**
 * Choose a new password using the token from the emailed link.
 *
 * Completing this revokes every session on every device, so the user is sent
 * to sign in rather than straight into the app. That is not friction for its
 * own sake: if the account had been taken over, this is the moment the other
 * party is ejected, and silently signing this browser in would blur what just
 * happened.
 */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorCopy | null>(null);
  const [mismatch, setMismatch] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    // Checked here rather than server-side: the confirmation field exists to
    // catch a typo before it becomes a password nobody knows.
    if (password !== confirm) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    setLoading(true);
    setError(null);
    try {
      await resetPassword(token, password);
      navigate('/login?reset=1', { replace: true });
    } catch (err) {
      setError(getErrorCopy(err));
    } finally {
      setLoading(false);
    }
  };

  // A link with no token at all never came from us. Say so immediately rather
  // than letting someone type a password into a form that cannot work.
  if (!token) {
    return (
      <AuthShell
        title="This link is incomplete"
        subtitle="It's missing the part that proves it came from us."
        footer={
          <Link to="/login" className="font-medium text-brand-700 hover:text-brand-800">
            Back to sign in
          </Link>
        }
      >
        <Banner tone="warning" title="Try requesting a new link">
          Some email clients cut long links in half. Copying the whole link from the message
          usually fixes it.{' '}
          <Link to="/forgot-password" className="font-medium underline">
            Request a new one
          </Link>
          .
        </Banner>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="You'll sign in with this from now on."
      footer={
        <Link to="/login" className="font-medium text-brand-700 hover:text-brand-800">
          Back to sign in
        </Link>
      }
    >
      {error && <ErrorBanner copy={error} className="mb-4" />}

      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordInput
          label="New password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          autoFocus
        />
        <PasswordRequirements password={password} />
        <PasswordInput
          label="Confirm new password"
          required
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            if (mismatch) setMismatch(false);
          }}
          autoComplete="new-password"
          error={mismatch ? 'Both passwords need to match.' : undefined}
        />
        <Button type="submit" loading={loading} loadingLabel="Saving…" fullWidth size="lg">
          Save new password
        </Button>
      </form>

      <p className="mt-4 text-xs text-ink-500">
        Changing your password signs you out everywhere else.
      </p>
    </AuthShell>
  );
}
