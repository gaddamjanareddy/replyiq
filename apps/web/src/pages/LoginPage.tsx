import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import { getErrorCopy } from '../api/client';
import type { ErrorCopy } from '../api/error-copy';
import { copyForCode } from '../api/error-copy';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ErrorBanner } from '../components/ui/Banner';
import { AuthShell } from '../components/auth/AuthShell';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ErrorCopy | null>(null);
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const API_URL = import.meta.env.VITE_API_URL ?? '';
      const response = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(getErrorCopy(body));
        return;
      }
      setAuth(body.data.user, body.data.accessToken, body.data.refreshToken);
      navigate(from, { replace: true });
    } catch {
      setError(copyForCode('NETWORK_ERROR'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your ReplyIQ dashboard"
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="font-medium text-brand-700 hover:text-brand-800">
            Create a workspace
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
        />
        <Input
          label="Password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          autoComplete="current-password"
        />
        <Button type="submit" loading={loading} loadingLabel="Signing in…" fullWidth size="lg">
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
