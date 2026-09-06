import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/auth.store';
import { useBusiness, useUpdateBusiness } from '../hooks/useBusiness';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { getFieldErrors, type FieldErrorMap } from '../api/field-errors';
import { Card, CardHeader, CardBody, CardFooter } from '../components/ui/Card';
import { Banner, ErrorBanner } from '../components/ui/Banner';
import { PageSkeleton } from '../components/ui/Skeleton';
import { getErrorCopy } from '../api/client';
import type { ErrorCopy } from '../api/error-copy';

export function BusinessSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const businessId = user?.businessId ?? '';

  const { data: businessData, isLoading } = useBusiness(businessId);
  const updateMutation = useUpdateBusiness(businessId);
  const business = businessData?.business;

  const [form, setForm] = useState({ name: '', industry: '', description: '', websiteUrl: '' });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<ErrorCopy | null>(null);
  // Per-field copy from a 422. Previously the response carried this and the
  // client discarded it, so a rejected save looked like a button that did
  // nothing at all.
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});

  /** Update one field and clear its error, so the message goes as it is fixed. */
  const update = (patch: Partial<typeof form>) => {
    setForm((current) => ({ ...current, ...patch }));
    setSaved(false);
    const touched = Object.keys(patch);
    setFieldErrors((current) => {
      if (!touched.some((key) => key in current)) return current;
      const next = { ...current };
      for (const key of touched) delete next[key];
      return next;
    });
  };

  // Load once. Re-syncing on every refetch would overwrite whatever the user
  // is currently typing, which is a genuinely maddening bug to hit.
  const loaded = useRef(false);
  useEffect(() => {
    if (business && !loaded.current) {
      loaded.current = true;
      setForm({
        name: business.name,
        industry: business.industry ?? '',
        description: business.description ?? '',
        websiteUrl: business.websiteUrl ?? '',
      });
    }
  }, [business]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setFieldErrors({});
    try {
      await updateMutation.mutateAsync(form);
      setSaved(true);
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      // With messages on the fields themselves, a banner repeating the same
      // thing at the top is noise. It is kept for failures that belong to no
      // single field.
      if (Object.keys(fields).length === 0) setError(getErrorCopy(err));
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl">
        <PageSkeleton label="Loading your business profile" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-ink-900">Business profile</h1>
        <p className="mt-1 text-sm text-ink-600">
          Your AI receptionist uses this to introduce itself and match your tone.
        </p>
      </header>

      {saved && (
        <Banner tone="success" title="Saved" live>
          Your changes are live.
        </Banner>
      )}
      {error && <ErrorBanner copy={error} />}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink-900">Details</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <Input
              label="Business name"
              required
              value={form.name}
              maxLength={200}
              error={fieldErrors.name}
              onChange={(e) => update({ name: e.target.value })}
            />
            <Input
              label="What you do"
              placeholder="e.g. Plumbing, dental practice, design agency"
              value={form.industry}
              // The label invites a description and the column allows 100
              // characters, which is how someone ends up writing a paragraph
              // here and being rejected on submit. The cap plus a visible
              // counter makes the limit apparent while typing instead.
              maxLength={100}
              showCount
              hint="A short label, not a description — there's room for detail below."
              error={fieldErrors.industry}
              onChange={(e) => update({ industry: e.target.value })}
            />
            <Input
              label="Anything else worth knowing"
              placeholder="e.g. Family-run since 1998, emergency callouts across Leeds"
              hint="Your receptionist uses this for tone."
              value={form.description}
              maxLength={2000}
              showCount
              error={fieldErrors.description}
              onChange={(e) => update({ description: e.target.value })}
            />
            <Input
              label="Website"
              type="url"
              placeholder="https://acme.com"
              // Says plainly what the old UI left users to guess: this field is
              // informational and changing it does not touch verification.
              hint="For reference only — verifying a website is done from the Websites page."
              value={form.websiteUrl}
              maxLength={500}
              error={fieldErrors.websiteUrl}
              onChange={(e) => update({ websiteUrl: e.target.value })}
            />
          </CardBody>
          <CardFooter className="flex justify-end">
            <Button
              type="submit"
              loading={updateMutation.isPending}
              loadingLabel="Saving…"
              size="lg"
            >
              Save changes
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
