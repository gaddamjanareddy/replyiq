import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import { useBusiness } from '../hooks/useBusiness';
import {
  useCreateFaq,
  useDeleteKnowledgeItem,
  useDeleteKnowledgeSource,
  useIngestSite,
  useKnowledge,
  useSearchKnowledge,
  useUpdateKnowledgeItem,
} from '../hooks/useKnowledge';
import type { KnowledgeItem, KnowledgeSource } from '../api/knowledge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Banner, ErrorBanner } from '../components/ui/Banner';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { Modal } from '../components/ui/Modal';
import { getErrorCopy } from '../api/client';
import type { ErrorCopy } from '../api/error-copy';

export function KnowledgePage() {
  const user = useAuthStore((s) => s.user);
  const businessId = user?.businessId ?? '';

  const { data: businessData } = useBusiness(businessId);
  const { data, isLoading } = useKnowledge(businessId);
  const ingest = useIngestSite(businessId);

  const [error, setError] = useState<ErrorCopy | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<KnowledgeItem | null>(null);

  const summary = data?.summary;
  const sources = data?.sources ?? [];
  const serviceMode = businessData?.business.serviceMode ?? 'INACTIVE';

  const handleIngest = async () => {
    setError(null);
    try {
      await ingest.mutateAsync();
    } catch (err) {
      setError(getErrorCopy(err));
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">What your receptionist knows</h1>
          <p className="mt-1 text-sm text-ink-600">
            Everything here is something it can answer. Correct anything that looks wrong — it
            learns from you, not the other way round.
          </p>
        </div>
        {summary && summary.itemCount > 0 && (
          <Badge variant="info">{summary.itemCount} answers</Badge>
        )}
      </header>

      {error && <ErrorBanner copy={error} />}

      {summary?.isIngesting && (
        <Banner tone="info" title="Reading your website…" live>
          Pages appear below as we finish each one. You can leave this page — it keeps going.
        </Banner>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : sources.length === 0 ? (
        <FirstRun
          serviceMode={serviceMode}
          busy={ingest.isPending}
          onIngest={handleIngest}
          onAddManually={() => setShowAdd(true)}
        />
      ) : (
        <>
          <SearchPanel businessId={businessId} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink-900">Sources</h2>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowAdd(true)}>
                Add an answer
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={ingest.isPending}
                loadingLabel="Starting…"
                onClick={handleIngest}
              >
                Re-read my website
              </Button>
            </div>
          </div>

          <div className="space-y-4 stagger">
            {sources.map((source) => (
              <SourceCard
                key={source.id}
                businessId={businessId}
                source={source}
                onEdit={setEditing}
              />
            ))}
          </div>
        </>
      )}

      <AddAnswerDialog
        businessId={businessId}
        open={showAdd}
        onClose={() => setShowAdd(false)}
      />
      <EditAnswerDialog
        businessId={businessId}
        item={editing}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

/**
 * The first-run screen, and the whole product wedge in one button.
 *
 * Competitors open onboarding with "upload your documents", which is where
 * trials die: the owner has never written their FAQs down. Because they proved
 * they own the domain, we can offer to do it for them instead.
 */
function FirstRun({
  serviceMode,
  busy,
  onIngest,
  onAddManually,
}: {
  serviceMode: string;
  busy: boolean;
  onIngest: () => void;
  onAddManually: () => void;
}) {
  if (serviceMode === 'INACTIVE') {
    return (
      <Card>
        <CardBody>
          <EmptyState
            title="Verify your website first"
            description="Once you've proved the website is yours, we can read it and set your receptionist up automatically — you won't have to write anything."
            action={
              <Link to="/dashboard/domains">
                <Button size="lg">Verify a website</Button>
              </Link>
            }
            icon={<LockIcon />}
          />
        </CardBody>
      </Card>
    );
  }

  if (serviceMode === 'TEST') {
    return (
      <Card>
        <CardBody className="space-y-4">
          <Banner tone="test" title="Test addresses have no website to read">
            You've verified a test address, which isn't a real site. Add your real website and
            we'll read it for you — or write a few answers by hand to try things out.
          </Banner>
          <div className="flex flex-wrap gap-2">
            <Link to="/dashboard/domains">
              <Button>Add your real website</Button>
            </Link>
            <Button variant="secondary" onClick={onAddManually}>
              Write an answer instead
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <div className="py-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <SparkIcon />
          </div>
          <h2 className="text-base font-semibold text-ink-900">
            Let us read your website
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-600">
            You've already proved this website is yours, so we can read it and work out your
            services, hours and prices. It takes about a minute, and you can correct anything we
            get wrong.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button size="lg" loading={busy} loadingLabel="Starting…" onClick={onIngest}>
              Read my website
            </Button>
            <Button size="lg" variant="secondary" onClick={onAddManually}>
              I'd rather write it myself
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * "What would my receptionist find?" — the retrieval loop, made visible.
 *
 * Today this is Postgres full-text ranking. Showing it now, before there is an
 * AI answering, is deliberate: the owner can see exactly which of their content
 * would be used for a given question, which is the thing they need to trust
 * before they will trust an answer built on it.
 */
function SearchPanel({ businessId }: { businessId: string }) {
  const search = useSearchKnowledge(businessId);
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);

  const run = async () => {
    if (!query.trim()) return;
    setSearched(true);
    await search.mutateAsync(query).catch(() => undefined);
  };

  const hits = search.data?.hits ?? [];

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-ink-900">Try a question</h2>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="What might someone ask?"
              placeholder="e.g. what time do you close on Saturdays?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void run();
                }
              }}
            />
          </div>
          <Button onClick={run} loading={search.isPending} loadingLabel="Looking…" size="lg">
            Search
          </Button>
        </div>

        {searched && !search.isPending && hits.length === 0 && (
          <Banner tone="warning" title="Nothing in your knowledge answers that" live>
            That's exactly the kind of gap worth filling — add an answer for it and your
            receptionist will handle it next time.
          </Banner>
        )}

        {hits.length > 0 && (
          <ul className="space-y-2 stagger">
            {hits.map((hit) => (
              <li
                key={hit.id}
                className="animate-rise rounded-lg border border-ink-200 bg-ink-50/60 p-3"
              >
                {hit.question && (
                  <p className="text-sm font-medium text-ink-900">{hit.question}</p>
                )}
                <p className="mt-0.5 line-clamp-3 text-sm text-ink-600">{hit.content}</p>
                {hit.sourceTitle && (
                  <p className="mt-1.5 text-xs text-ink-500">From {hit.sourceTitle}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function SourceCard({
  businessId,
  source,
  onEdit,
}: {
  businessId: string;
  source: KnowledgeSource;
  onEdit: (item: KnowledgeItem) => void;
}) {
  const removeSource = useDeleteKnowledgeSource(businessId);
  const removeItem = useDeleteKnowledgeItem(businessId);
  const isOwnerAuthored = source.type === 'FAQ';

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-ink-900">
                {source.title ?? source.url ?? 'Untitled'}
              </h3>
              {isOwnerAuthored ? (
                <Badge variant="info">Your words</Badge>
              ) : (
                <SourceStatusBadge status={source.status} />
              )}
            </div>
            {source.url && !isOwnerAuthored && (
              <p className="mt-0.5 truncate text-xs text-ink-500">{source.url}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            loading={removeSource.isPending}
            onClick={() => removeSource.mutate(source.id)}
          >
            Remove
          </Button>
        </div>
      </CardHeader>
      <CardBody>
        {source.status === 'FAILED' ? (
          <Banner tone="warning" title="We couldn't read this page">
            {source.failureReason ?? 'We could not load this page.'}
          </Banner>
        ) : source.items.length === 0 ? (
          <p className="text-sm text-ink-500">Nothing readable here yet.</p>
        ) : (
          <ul className="divide-y divide-ink-200">
            {source.items.map((item) => (
              <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  {item.question && (
                    <p className="text-sm font-medium text-ink-900">{item.question}</p>
                  )}
                  <p className="mt-0.5 whitespace-pre-line text-sm text-ink-600">
                    {item.content}
                  </p>
                  {item.isEdited && !isOwnerAuthored && (
                    <p className="mt-1 text-xs text-ink-500">
                      Edited by you — a re-read won't overwrite this.
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={removeItem.isPending}
                    onClick={() => removeItem.mutate(item.id)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function SourceStatusBadge({ status }: { status: KnowledgeSource['status'] }) {
  switch (status) {
    case 'READY':
      return <Badge variant="success" dot>Ready</Badge>;
    case 'FETCHING':
      return <Badge variant="info" dot pulse>Reading…</Badge>;
    case 'PENDING':
      return <Badge variant="default" dot>Queued</Badge>;
    case 'FAILED':
      return <Badge variant="warning" dot>Couldn’t read</Badge>;
  }
}

function AddAnswerDialog({
  businessId,
  open,
  onClose,
}: {
  businessId: string;
  open: boolean;
  onClose: () => void;
}) {
  const createMutation = useCreateFaq(businessId);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<ErrorCopy | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await createMutation.mutateAsync({ question, answer });
      setQuestion('');
      setAnswer('');
      onClose();
    } catch (err) {
      setError(getErrorCopy(err));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add an answer"
      description="Write it the way you'd say it to someone on the phone."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            loading={createMutation.isPending}
            loadingLabel="Saving…"
            disabled={question.trim().length < 3 || answer.trim().length === 0}
          >
            Save answer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="What might someone ask?"
          placeholder="Do you take NHS patients?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <div>
          <label htmlFor="answer" className="mb-1.5 block text-sm font-medium text-ink-700">
            How should we answer?
          </label>
          <textarea
            id="answer"
            rows={5}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Yes — we have NHS availability for children, and a short waiting list for adults."
            className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 hover:border-ink-400"
          />
        </div>
        {error && <ErrorBanner copy={error} />}
      </div>
    </Modal>
  );
}

function EditAnswerDialog({
  businessId,
  item,
  onClose,
}: {
  businessId: string;
  item: KnowledgeItem | null;
  onClose: () => void;
}) {
  const updateMutation = useUpdateKnowledgeItem(businessId);
  const [question, setQuestion] = useState('');
  const [content, setContent] = useState('');
  const [loaded, setLoaded] = useState<string | null>(null);
  const [error, setError] = useState<ErrorCopy | null>(null);

  // Seed the form once per item rather than on every render, so typing is not
  // overwritten by a background refetch landing mid-edit.
  if (item && loaded !== item.id) {
    setLoaded(item.id);
    setQuestion(item.question ?? '');
    setContent(item.content);
  }

  const submit = async () => {
    if (!item) return;
    setError(null);
    try {
      await updateMutation.mutateAsync({ itemId: item.id, question, content });
      onClose();
    } catch (err) {
      setError(getErrorCopy(err));
    }
  };

  return (
    <Modal
      open={item !== null}
      onClose={onClose}
      title="Edit answer"
      description="Your version wins — re-reading your website won't overwrite it."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            loading={updateMutation.isPending}
            loadingLabel="Saving…"
            disabled={content.trim().length === 0}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Question or heading"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <div>
          <label htmlFor="edit-content" className="mb-1.5 block text-sm font-medium text-ink-700">
            Answer
          </label>
          <textarea
            id="edit-content"
            rows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 hover:border-ink-400"
          />
        </div>
        {error && <ErrorBanner copy={error} />}
      </div>
    </Modal>
  );
}

function SparkIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.6" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}
