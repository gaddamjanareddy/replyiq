import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import { useConversations, useRateAnswer } from '../hooks/useConversations';
import type { Conversation, Turn, Verdict } from '../api/conversations';
import { Card, CardBody } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { PageSkeleton } from '../components/ui/Skeleton';
import { PageHeader } from '../components/layout/PageHeader';
import { ErrorBanner } from '../components/ui/Banner';
import { getErrorCopy } from '../api/client';
import { relativeTime } from '../lib/relative-time';
import { pluralize } from '../lib/plural';

/**
 * What the receptionist actually said, visit by visit.
 *
 * ── Why this replaced a flat list ─────────────────────────────────────────
 * Questions were logged individually and shown that way, so three rows stood
 * where there had been one conversation. The sequence is what carries the
 * meaning: "what are your hours" → "do you do emergencies" → "I don't have an
 * answer for that one" is the product working and then running out of road,
 * and split into three lines it reads as nothing at all.
 *
 * ── Laid out the way the visitor saw it ──────────────────────────────────
 * Visitor on the right, receptionist on the left, mirroring the widget. The
 * owner is being asked to judge whether an answer was right, and they can
 * only do that against what the person actually experienced — including the
 * hedge, which changes the meaning of an answer completely and is invisible
 * in a list of question/answer pairs.
 *
 * ── The line that is missing on purpose ──────────────────────────────────
 * Whether this visitor went on to leave their number. The page says so rather
 * than leaving a hole: an owner who thinks it is a missing feature will ask
 * for it, and the refusal is easier to hold if the reason is written down
 * where they can read it. See CLAUDE.md rule 7.
 */
export function ConversationsPage() {
  const user = useAuthStore((s) => s.user);
  const businessId = user?.businessId;
  const { data, isLoading, error } = useConversations(businessId);
  const rate = useRateAnswer(businessId);

  if (isLoading) return <PageSkeleton label="Loading your conversations" />;

  const conversations = data?.conversations ?? [];
  const withGaps = conversations.filter((c) => c.hasGap).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        overline="Receptionist"
        title="Conversations"
        subtitle="Every visit, read the way it happened. If an answer was wrong, say so — it is the only way anyone finds out."
        actions={
          withGaps > 0 ? (
            <Badge variant="warning">{pluralize(withGaps, 'unanswered visit')}</Badge>
          ) : undefined
        }
      />

      {error && <ErrorBanner copy={getErrorCopy(error)} />}

      {conversations.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="Nobody has asked anything yet"
              description="Once your receptionist is live on your website, every visit shows up here — the questions, the answers, and the ones it could not answer."
              action={
                <Link
                  to="/dashboard/widget"
                  className="text-sm font-semibold text-brand-700 underline"
                >
                  Add it to your website
                </Link>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <>
          <ul className="stagger space-y-4">
            {conversations.map((conversation) => (
              <ConversationCard
                key={conversation.id}
                conversation={conversation}
                onRate={(questionId, verdict) => rate.mutate({ questionId, verdict })}
              />
            ))}
          </ul>

          {/*
            Stated, not silently omitted. The first thing an owner reading a
            visit that ended in "I don't know" will want is the name of the
            person who then left their number, and we will not join those two
            things — so the page has to say why, in their language, where the
            question comes up.
          */}
          <p className="max-w-prose text-xs text-ink-500">
            Conversations are not linked to enquiries. When somebody leaves their details we keep
            the question they asked alongside them, and nothing else — so a name can never be
            attached to the rest of what that person asked. You will find them under{' '}
            <Link to="/dashboard/leads" className="font-semibold text-ink-600 underline">
              Enquiries
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}

function ConversationCard({
  conversation,
  onRate,
}: {
  conversation: Conversation;
  onRate: (questionId: string, verdict: Verdict) => void;
}) {
  const { turns } = conversation;

  return (
    <li className="animate-rise">
      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-ink-500">
              {relativeTime(conversation.startedAt)} · {pluralize(turns.length, 'question')}
            </p>
            {conversation.hasGap && <Badge variant="warning">Ran out of answers</Badge>}
          </div>

          <div className="space-y-3">
            {turns.map((turn) => (
              <TurnPair key={turn.id} turn={turn} onRate={onRate} />
            ))}
          </div>
        </CardBody>
      </Card>
    </li>
  );
}

function TurnPair({
  turn,
  onRate,
}: {
  turn: Turn;
  onRate: (questionId: string, verdict: Verdict) => void;
}) {
  const unanswered = turn.confidence === 'unknown';
  const wrong = turn.verdict === 'WRONG';
  /**
   * You can only rate an answer you can still read.
   *
   * Once the passage behind it is deleted the wording is gone, and asking
   * the owner whether it was right is asking them to guess. Those verdicts
   * are the accuracy figure in STRATEGY.md §5, so an uninformed one is not a
   * harmless extra data point — it is the measurement quietly going wrong,
   * in the same way counting unreviewed answers as good would.
   */
  const readable = turn.answeredWith !== null;

  return (
    <div className="space-y-2">
      {/* Visitor-authored text, right-aligned as the widget shows it. React
          escapes it; it is never rendered as markup. */}
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-fill px-3.5 py-2 text-sm text-white">
          {turn.question}
        </p>
      </div>

      <div className="flex justify-start">
        <div
          className={`max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2 ${
            wrong
              ? 'bg-red-50 ring-1 ring-inset ring-red-200'
              : unanswered
                ? 'bg-amber-50 ring-1 ring-inset ring-amber-200'
                : /* The ring is not decoration. In dark theme `ink-100` is
                     defined as exactly `surface`, by design — it is the
                     faintest tint above the SUNKEN page background — so on a
                     card this fill is literally invisible and the bubble
                     stops reading as a bubble. `ink-300` is the rung that
                     is visible against the card in both themes — it is what
                     the buttons below already outline themselves with;
                     `ink-200` lands a tenth of a step off `surface` in dark
                     and cannot be seen. */
                  'bg-ink-100 ring-1 ring-inset ring-ink-300'
          }`}
        >
          {/* `whitespace-pre-line` because a hedged answer is two paragraphs
              separated by a blank line, exactly as the visitor received it.
              Collapsed into one run it reads as the receptionist having said
              something it did not. */}
          <p className="whitespace-pre-line text-sm text-ink-800">{turn.answer}</p>

          {turn.answeredWith && (
            /* Attribution, not a quotation. The text above is rebuilt from
               this passage as it stands today, so if the owner has edited it
               since, naming the source is the only honest framing — and it is
               also the more useful one, because it names the thing they can
               go and change. */
            <p className="mt-1.5 text-xs text-ink-500">
              From{' '}
              <Link
                to={`/dashboard/knowledge?edit=${turn.answeredWith.id}`}
                className="font-medium text-ink-600 underline"
              >
                {turn.answeredWith.question ?? 'a passage on your site'}
              </Link>
            </p>
          )}
        </div>
      </div>

      {unanswered ? (
        /* No rating offered. The refusal was correct — it is the missing
           knowledge that is the problem, and asking the owner to grade an
           honest "I don't know" invites them to teach it to guess. */
        <div className="flex justify-start">
          <Link
            to={`/dashboard/knowledge?answer=${encodeURIComponent(turn.question)}`}
            className="text-xs font-semibold text-amber-800 underline"
          >
            Answer this one
          </Link>
        </div>
      ) : !readable ? (
        /* A verdict given while the wording was still there stays visible —
           it was informed when it was made, and silently dropping it would
           look like the rating had failed to save. */
        turn.verdict && (
          <p className="text-xs text-ink-500">
            You marked this {turn.verdict === 'WRONG' ? 'wrong' : 'a good answer'} at the time.
          </p>
        )
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <RatingButton
            active={turn.verdict === 'GOOD'}
            activeClass="bg-success-fill text-white ring-success-fill"
            onClick={() => onRate(turn.id, turn.verdict === 'GOOD' ? null : 'GOOD')}
          >
            Good answer
          </RatingButton>
          <RatingButton
            active={wrong}
            activeClass="bg-danger-fill text-white ring-danger-fill"
            onClick={() => onRate(turn.id, wrong ? null : 'WRONG')}
          >
            That is wrong
          </RatingButton>
          {wrong && (
            <Link
              to={
                turn.answeredWith
                  ? `/dashboard/knowledge?edit=${turn.answeredWith.id}`
                  : `/dashboard/knowledge?answer=${encodeURIComponent(turn.question)}`
              }
              className="ml-auto text-xs font-semibold text-red-700 underline"
            >
              {turn.answeredWith ? 'Fix this answer' : 'Write the right answer'}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function RatingButton({
  active,
  activeClass,
  onClick,
  children,
}: {
  active: boolean;
  activeClass: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`interactive rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
        active ? activeClass : 'bg-surface text-ink-700 ring-ink-300 hover:bg-ink-50'
      }`}
    >
      {children}
    </button>
  );
}
