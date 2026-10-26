import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PublicShell } from '../components/layout/PublicShell';

/**
 * The questions a business owner asks before they sign up.
 *
 * ── Why this is not a marketing page ─────────────────────────────────────
 * Every answer here describes something the product already does. That is a
 * hard rule and not a stylistic one: a product whose entire pitch is "it will
 * not tell your customers something that is not true" cannot have a public
 * page that tells its own customers something that is not true. The first
 * person to find the gap would be right to assume the rest is the same.
 *
 * So there is no roadmap written in the present tense, no number nobody has
 * measured, and no price nobody has decided. Where the honest answer is
 * uncomfortable — what we do when we cannot answer, what happens to a
 * visitor's phone number — it is the one that is given, because those are the
 * answers that are actually worth reading.
 */

interface Entry {
  q: string;
  a: React.ReactNode;
}

const ENTRIES: Entry[] = [
  {
    q: 'What does it actually do?',
    a: (
      <>
        It answers your website visitors’ questions using the words you already published. You
        prove you own a website, we read it into a set of answers you can edit, and one line of
        code puts a chat panel on your site. Someone asks what time you open, and they get what
        your site says about opening hours.
      </>
    ),
  },
  {
    q: 'What happens when it does not know?',
    a: (
      <>
        It says so. Not a guess dressed up as an answer — “I don’t have an answer for that one.
        I’d rather say so than guess.” Then it offers to take the visitor’s number so you can
        call them back, and emails you that somebody is waiting. The question they could not get
        answered is saved too, so you can write the answer once and nobody has to ask again.
      </>
    ),
  },
  {
    q: 'Will it make things up?',
    a: (
      <>
        No, and not because we asked it nicely. It does not write answers at all: it finds the
        closest thing you published and returns it word for word. There is nothing in the path
        that composes a new sentence, so there is nothing that can invent one. When it is less
        than certain it has found the right passage, it says so before showing it rather than
        presenting a guess in a confident voice.
      </>
    ),
  },
  {
    q: 'How long does it take to set up?',
    a: (
      <>
        Three things: prove you own your website, let it read the site, and paste one line before
        the closing <code className="text-ink-700">&lt;/body&gt;</code> tag. You can try it inside
        the dashboard before you put it anywhere near a real visitor — that is the order the
        product is built in, because pasting a script onto a live customer-facing site is a
        commitment and nobody should make it before they have seen what the thing says.
      </>
    ),
  },
  {
    q: 'Do I need a developer?',
    a: (
      <>
        For the one line of code, probably whoever looks after your website — most site builders
        have a box for exactly this. After that, no. You edit your answers in the dashboard and
        the widget picks them up; the line of code never changes again.
      </>
    ),
  },
  {
    q: 'What does it cost?',
    a: (
      <>
        Nothing today. We are in early access and it is free while we are, so that the first
        people using it are people it is genuinely working for. If that changes you will hear
        about it from us, well before it affects you — not from a card being charged.
      </>
    ),
  },
  {
    q: 'What do you store about my visitors?',
    a: (
      <>
        The question they asked, how confident the answer was, and a random key that groups one
        visit together. No IP address, no browser fingerprint, no cookie, nothing that identifies
        a person. The one exception is when a visitor is asked for a phone number or email, told
        what it is for, and types it anyway — and those details are deliberately{' '}
        <em>not</em> connected to the other questions asked during that visit, so a name can
        never be attached to the rest of someone’s browsing. You can delete them permanently
        whenever you want.
      </>
    ),
  },
  {
    q: 'Could somebody else put my receptionist on their site?',
    a: (
      <>
        No. It only answers on websites you have verified you own, checked on every request. The
        ID in the code snippet is not a password and is not treated as one — it is sitting in
        your public HTML either way. What protects you is the list of websites, not the ID.
      </>
    ),
  },
  {
    q: 'Can I see what it told people?',
    a: (
      <>
        Every visit, read as the conversation it was: the questions in order, what it answered,
        and which of your passages each answer came from. If one was wrong, you say so and go
        straight to the passage that caused it. Nothing automatic can check whether an answer was
        right for the question — that is a judgement only you can make, so we show you the
        evidence and ask.
      </>
    ),
  },
  {
    q: 'What if my website does not say very much?',
    a: (
      <>
        Then it will say “I don’t know” a lot, honestly, and show you exactly which questions it
        could not answer. You can also write answers yourself without touching your website at
        all. A short list of real questions your customers asked is a much better starting point
        than guessing what to publish.
      </>
    ),
  },
];

export function FaqPage() {
  useEffect(() => {
    // Set here rather than in index.html, which can carry only one title. A
    // crawler still sees the served HTML's title; this is for the person who
    // has the tab open, and for anyone sharing the link from their address bar.
    document.title = 'Questions about ReplyIQ';
    return () => {
      document.title = 'ReplyIQ — an AI receptionist that never invents an answer';
    };
  }, []);

  return (
    <PublicShell>
      <section className="animate-rise py-12 sm:py-16">
        <p className="text-overline text-xs font-semibold text-brand-700">Questions</p>
        <h1 className="text-display mt-3 max-w-3xl text-3xl font-semibold text-ink-900 sm:text-4xl">
          What people ask before they set it up
        </h1>
        <p className="mt-4 max-w-2xl text-ink-600">
          Everything below describes what the product does today. If something here turns out not
          to be true, that is a bug and we would rather hear about it.
        </p>
      </section>

      {/* A plain list, not an accordion. There are ten answers and they are
          short; hiding them behind ten clicks makes the page look emptier
          than it is and stops anyone reading the one they did not know they
          had. It also means the browser's own find-in-page works. */}
      <div className="stagger space-y-6">
        {ENTRIES.map((entry) => (
          <article
            key={entry.q}
            className="animate-rise rounded-card border border-ink-200 bg-surface p-6 shadow-card"
          >
            <h2 className="text-title text-base font-semibold text-ink-900">{entry.q}</h2>
            <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-ink-600">{entry.a}</p>
          </article>
        ))}
      </div>

      <section className="mt-12 rounded-card border border-ink-200 bg-surface p-8 shadow-card">
        <h2 className="text-display text-xl font-semibold text-ink-900">
          Still want to see it rather than read about it?
        </h2>
        <p className="mt-3 max-w-2xl text-ink-600">
          There is a working receptionist on the front page answering questions about ReplyIQ
          itself. Try asking it something it will not know — that is the part worth seeing.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/"
            className="interactive rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-raised"
          >
            Try the demo
          </Link>
          <Link
            to="/register"
            className="interactive rounded-lg border border-ink-300 bg-surface px-5 py-2.5 text-sm font-semibold text-ink-800"
          >
            Set it up free
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
