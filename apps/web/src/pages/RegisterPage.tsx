import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import { getErrorCopy } from '../api/client';
import type { ErrorCopy } from '../api/error-copy';
import { copyForCode } from '../api/error-copy';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ErrorBanner } from '../components/ui/Banner';
import { AuthShell } from '../components/auth/AuthShell';
import {
  PasswordRequirements,
  isPasswordAcceptable,
} from '../components/auth/PasswordRequirements';
import { PasswordInput } from '../components/ui/PasswordInput';
import { getFieldErrors, type FieldErrorMap } from '../api/field-errors';

export function RegisterPage() {
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [error, setError] = useState<ErrorCopy | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const passwordOk = isPasswordAcceptable(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);

    try {
      const API_URL = import.meta.env.VITE_API_URL ?? '';
      const response = await fetch(`${API_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName, ownerName, email, password }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const fields = getFieldErrors(body);
        setFieldErrors(fields);
        // A banner repeating what is already sitting under each field is
        // noise. It is kept for failures that belong to no single field, such
        // as the address already being taken.
        if (Object.keys(fields).length === 0) setError(getErrorCopy(body));
        return;
      }

      // Registration uses the standard { success, message, data } envelope
      // (D-03R) - the same shape as every other endpoint.
      const { session, user, organization, business } = body.data;
      setAuth(
        { ...user, organizationId: organization.id, businessId: business.id },
        session.accessToken,
        session.refreshToken,
      );
      navigate('/onboarding', { replace: true });
    } catch {
      setError(copyForCode('NETWORK_ERROR'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your workspace"
      subtitle="Two minutes, and your AI receptionist starts taking shape"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-700 hover:text-brand-800">
            Sign in
          </Link>
        </>
      }
    >
      {error && <ErrorBanner copy={error} className="mb-4" />}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Business name"
          required
          value={businessName}
          maxLength={200}
          error={fieldErrors.businessName}
          onChange={(e) => {
            setBusinessName(e.target.value);
            setFieldErrors(({ businessName: _drop, ...rest }) => rest);
          }}
          placeholder="Northgate Plumbing"
          autoComplete="organization"
        />
        <Input
          label="Your name"
          required
          value={ownerName}
          maxLength={150}
          error={fieldErrors.ownerName}
          onChange={(e) => {
            setOwnerName(e.target.value);
            setFieldErrors(({ ownerName: _drop, ...rest }) => rest);
          }}
          placeholder="Sam Reeves"
          autoComplete="name"
        />
        <Input
          label="Email"
          type="email"
          required
          value={email}
          error={fieldErrors.email}
          onChange={(e) => {
            setEmail(e.target.value);
            setFieldErrors(({ email: _drop, ...rest }) => rest);
          }}
          placeholder="you@company.com"
          autoComplete="email"
        />
        <div>
          <PasswordInput
            label="Password"
            required
            value={password}
            error={fieldErrors.password}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors(({ password: _drop, ...rest }) => rest);
            }}
            onBlur={() => setPasswordTouched(true)}
            placeholder="Choose a strong password"
            autoComplete="new-password"
          />
          {/* Shown as soon as they start typing, so the rules arrive before the
              rejection rather than after it. */}
          {(password.length > 0 || passwordTouched) && (
            <PasswordRequirements password={password} />
          )}
        </div>
        <Button
          type="submit"
          loading={loading}
          loadingLabel="Creating…"
          fullWidth
          size="lg"
          disabled={!passwordOk}
        >
          Create workspace
        </Button>
      </form>
    </AuthShell>
  );
}
