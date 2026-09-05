import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/auth.store';
import { useBusiness, useUpdateBusiness } from '../hooks/useBusiness';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
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
    try {
      await updateMutation.mutateAsync(form);
      setSaved(true);
    } catch (err) {
      setError(getErrorCopy(err));
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
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                setSaved(false);
              }}
            />
            <Input
              label="What you do"
              placeholder="e.g. Plumbing, dental practice, design agency"
              value={form.industry}
              onChange={(e) => {
                setForm({ ...form, industry: e.target.value });
                setSaved(false);
              }}
            />
            <Input
              label="Anything else worth knowing"
              placeholder="e.g. Family-run since 1998, emergency callouts across Leeds"
              hint="Your receptionist uses this for tone."
              value={form.description}
              onChange={(e) => {
                setForm({ ...form, description: e.target.value });
                setSaved(false);
              }}
            />
            <Input
              label="Website"
              type="url"
              placeholder="https://acme.com"
              // Says plainly what the old UI left users to guess: this field is
              // informational and changing it does not touch verification.
              hint="For reference only — verifying a website is done from the Websites page."
              value={form.websiteUrl}
              onChange={(e) => {
                setForm({ ...form, websiteUrl: e.target.value });
                setSaved(false);
              }}
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
