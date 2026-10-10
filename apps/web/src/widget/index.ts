/**
 * The embeddable receptionist widget.
 *
 * This is the only code ReplyIQ ships onto someone else's website, which
 * changes the rules completely:
 *
 *   * NO FRAMEWORK. Every visitor to the customer's site downloads this. React
 *     would be ~45kB gzipped before we wrote a line, paid by a small business's
 *     visitors on mobile data, to render a button and a list of messages.
 *
 *   * SHADOW DOM, not prefixed classes. The host page's CSS is unknown and
 *     hostile by default - a `* { box-sizing: content-box }` or a global
 *     `button { width: 100% }` would wreck an unprotected widget, and our
 *     styles could just as easily wreck their page. A shadow root is the only
 *     mechanism that actually stops both directions.
 *
 *   * NOTHING GLOBAL. No window properties beyond one namespaced guard, no
 *     styles on document, no listeners that outlive the widget.
 *
 * Installed with one tag:
 *
 *   <script src="https://.../widget.js" data-business-id="..." defer></script>
 */

interface WidgetConfig {
  businessName: string;
  mode: 'LIVE' | 'TEST';
  greeting: string;
  /** Real headings from the owner's knowledge base — never generated. An
   *  older deployment may not send them, hence optional. */
  suggestions?: string[];
}

interface AskResponse {
  confidence: 'answered' | 'unsure' | 'unknown';
  text: string;
  citations: Array<{ id: string; title: string | null; url: string | null }>;
  mode: 'LIVE' | 'TEST';
}

/** Only ever mounted once, however many times the tag is pasted. */
const GUARD = '__replyiqWidgetMounted';

/**
 * A random key grouping one visit's questions, so the owner reads a
 * conversation rather than unrelated lines.
 *
 * Deliberately per page load and held in memory only - no cookie, no
 * localStorage, nothing that survives the tab. It exists to group, never to
 * recognise anyone: a returning visitor is a new session and that is correct.
 * Storing it would turn a grouping key into tracking and drag every customer's
 * site into a consent conversation it does not need to have.
 */
const SESSION_KEY = Math.random().toString(36).slice(2) + Date.now().toString(36);

const STYLES = `
:host { all: initial; }
*, *::before, *::after { box-sizing: border-box; }

.root {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 2147483000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 15px;
  line-height: 1.5;
  color: #101828;
}

.launcher {
  display: flex; align-items: center; justify-content: center;
  width: 56px; height: 56px;
  border: 0; border-radius: 999px;
  background: linear-gradient(160deg, #2563eb, #1d4ed8);
  color: #fff; cursor: pointer;
  box-shadow: 0 8px 24px rgba(16,24,40,.24);
  transition: transform 160ms cubic-bezier(.16,1,.3,1), box-shadow 160ms ease;
}
.launcher:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(16,24,40,.3); }
.launcher:active { transform: translateY(0) scale(.97); }
.launcher:focus-visible { outline: 3px solid #93c5fd; outline-offset: 3px; }

.panel {
  position: absolute; right: 0; bottom: 72px;
  display: flex; flex-direction: column;
  width: min(380px, calc(100vw - 40px));
  height: min(560px, calc(100vh - 120px));
  background: #fff;
  border: 1px solid #e4e7ec;
  border-radius: 16px;
  box-shadow: 0 24px 48px rgba(16,24,40,.18);
  overflow: hidden;
  animation: rise 220ms cubic-bezier(.16,1,.3,1);
}
@keyframes rise { from { opacity: 0; transform: translateY(8px) scale(.98); } }

.header { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid #e4e7ec; }
.title { font-weight: 600; font-size: 15px; margin: 0; }
.sub { margin: 0; font-size: 12px; color: #667085; }
.close { margin-left: auto; border: 0; background: none; cursor: pointer; color: #667085; padding: 4px; border-radius: 6px; }
.close:hover { background: #f2f4f7; color: #101828; }
.close:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }

.log { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.msg { max-width: 85%; padding: 10px 12px; border-radius: 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
.msg.them { background: #f2f4f7; border-bottom-left-radius: 4px; align-self: flex-start; }
.msg.you { background: #2563eb; color: #fff; border-bottom-right-radius: 4px; align-self: flex-end; }
.msg.unsure { background: #fffaeb; border: 1px solid #fedf89; }
.msg.problem { background: #fef3f2; border: 1px solid #fecdca; }

.cites { margin: 6px 0 0; padding: 0; list-style: none; font-size: 12px; color: #667085; }
.cites a { color: #1d4ed8; }

.composer { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #e4e7ec; }
.input {
  flex: 1; min-width: 0; padding: 10px 12px; font: inherit; font-size: 14px;
  border: 1px solid #d0d5dd; border-radius: 10px; background: #fff; color: inherit;
}
.input:focus-visible { outline: 2px solid #2563eb; outline-offset: -1px; border-color: #2563eb; }
.send { border: 0; border-radius: 10px; padding: 0 14px; background: #2563eb; color: #fff; font: inherit; font-weight: 600; font-size: 14px; cursor: pointer; }
.send:disabled { background: #d0d5dd; cursor: not-allowed; }
.send:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }

.notice { margin: 0; padding: 8px 16px; font-size: 12px; background: #f4f3ff; color: #5925dc; border-bottom: 1px solid #e9d7fe; }

.capture { align-self: stretch; padding: 12px; border: 1px solid #b2ddff; border-radius: 12px; background: #f5fbff; }
.capture p { margin: 0 0 10px; font-size: 13px; }
.capture .field { width: 100%; margin-bottom: 8px; padding: 9px 10px; font: inherit; font-size: 14px; border: 1px solid #d0d5dd; border-radius: 8px; background: #fff; color: #101828; }
.capture .field:focus-visible { outline: 2px solid #2563eb; outline-offset: -1px; border-color: #2563eb; }
.capture .row { display: flex; align-items: center; gap: 8px; }
.capture .err { margin: 0 0 8px; font-size: 12px; color: #b42318; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; align-self: flex-start; max-width: 100%; }
.chip {
  border: 1px solid #d0d5dd; border-radius: 999px; background: #fff; color: #1d4ed8;
  font: inherit; font-size: 13px; padding: 6px 12px; cursor: pointer; text-align: left;
  transition: background 120ms ease, border-color 120ms ease;
}
.chip:hover { background: #f5faff; border-color: #84caff; }
.chip:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }

.ghost { border: 0; background: none; padding: 8px 4px; font: inherit; font-size: 13px; color: #667085; cursor: pointer; text-decoration: underline; }
.ghost:hover { color: #101828; }
.ghost:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; border-radius: 4px; }

.dots { display: inline-flex; gap: 3px; }
.dots i { width: 6px; height: 6px; border-radius: 50%; background: #98a2b3; animation: blink 1.2s infinite; }
.dots i:nth-child(2) { animation-delay: .2s; }
.dots i:nth-child(3) { animation-delay: .4s; }
@keyframes blink { 0%, 80%, 100% { opacity: .3; } 40% { opacity: 1; } }

.sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

@media (prefers-reduced-motion: reduce) {
  .panel, .launcher { animation: none; transition: none; }
  .dots i { animation: none; opacity: .6; }
}

@media (prefers-color-scheme: dark) {
  .root { color: #f5f6f7; }
  .panel { background: #1c1f26; border-color: #333844; }
  .header, .composer { border-color: #333844; }
  .sub, .cites, .close { color: #98a2b3; }
  .close:hover { background: #262a33; color: #f5f6f7; }
  .msg.them { background: #262a33; }
  .msg.unsure { background: #2a2418; border-color: #5c4813; }
  .msg.problem { background: #2c1d1d; border-color: #6b2b26; }
  .input { background: #14171d; border-color: #333844; }
  .chip { background: #1c1f26; border-color: #333844; color: #93c5fd; }
  .chip:hover { background: #262a33; border-color: #3f5573; }
  .notice { background: #241f36; color: #c3b5fd; border-color: #3d3357; }
  .capture { background: #16202c; border-color: #1e4a73; }
  .capture .field { background: #14171d; border-color: #333844; color: #f5f6f7; }
  .capture .err { color: #fda29b; }
  .ghost { color: #98a2b3; }
  .ghost:hover { color: #f5f6f7; }
}
`;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {},
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = String(value);
    else if (key in node) (node as unknown as Record<string, unknown>)[key] = value;
    else node.setAttribute(key, String(value));
  }
  for (const child of children) node.append(child);
  return node;
}

/**
 * What a stranger is told when leaving their details fails.
 *
 * Exported and tested because this is the one place in the widget that
 * receives an error body from the API, and the rule it has to keep is the
 * product's second load-bearing rule: backend prose never reaches a screen.
 * The server's `message` field is not consulted — only its stable `code` —
 * and an unrecognised code falls through to copy that is safe to show anyone.
 *
 * It also has to be copy for a CUSTOMER rather than for the business owner.
 * This is the only error in the product a visitor to someone else's website
 * can see, so it blames the box, not the person, and says what shape of thing
 * would work.
 */
export function leadErrorMessage(status: number, code: string | undefined): string {
  if (code === 'LEAD_CONTACT_UNUSABLE') {
    return 'That does not look like a phone number or an email address.';
  }
  if (status === 429) {
    return 'That has been sent a few times already. Please try again later.';
  }
  return 'That did not go through. Please try again in a moment.';
}

function boot(): void {
  const w = window as unknown as Record<string, unknown>;
  if (w[GUARD]) return;

  const script = document.currentScript as HTMLScriptElement | null;
  const businessId = script?.dataset.businessId;
  if (!businessId) {
    // A missing id is an installation mistake on the customer's site. Say so
    // in the console - the only channel their developer will look at - and
    // render nothing rather than a broken bubble.
    console.error('[ReplyIQ] widget not started: the script tag needs data-business-id.');
    return;
  }

  w[GUARD] = true;
  mount(businessId, resolveApiBase(script?.src, script?.dataset.apiUrl));
}

/**
 * Where to send requests.
 *
 * An explicit `data-api-url` always wins, because a self-hosted or staging
 * deployment cannot be guessed. Otherwise it is derived from where the script
 * itself came from, so the common case needs no configuration at all: the
 * dashboard is served from `replyiq-web` and the API from `replyiq-api` on the
 * same host.
 *
 * That substring swap is a convention, not a rule, which is exactly why it is
 * the fallback and not the mechanism — and why it is a named, tested function
 * rather than an expression buried in boot().
 */
export function resolveApiBase(scriptSrc: string | undefined, explicit: string | undefined): string {
  const chosen =
    explicit ??
    (scriptSrc ? new URL(scriptSrc).origin.replace('replyiq-web', 'replyiq-api') : '');
  return chosen.replace(/\/+$/, '');
}

function mount(businessId: string, apiBase: string): void {
  const host = el('div');

  /**
   * The host element itself lives in the LIGHT DOM, so the page's CSS reaches
   * it even though nothing inside the shadow root is affected. Found on a test
   * page whose `div { border: 2px dashed !important }` drew a stray mark
   * beside the launcher — the shadow root protected its contents and left its
   * own container exposed.
   *
   * `all: initial` as an important inline declaration is what wins here:
   * inline styles alone lose to the page's `!important`, and the shadow root's
   * `:host` rule loses to any light-DOM selector.
   */
  host.style.setProperty('all', 'initial', 'important');

  // Styles live inside the shadow root, so nothing here can leak onto the
  // customer's page and nothing of theirs can reach in.
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.append(el('style', { textContent: STYLES }));
  document.body.append(host);

  const root = el('div', { class: 'root' });
  shadow.append(root);

  let open = false;
  let config: WidgetConfig | null = null;
  /**
   * The last thing the visitor asked, so a follow-up like "and on Sundays?"
   * can be understood.
   *
   * One question, not a transcript. The server only consults it when the new
   * question matches nothing on its own, so more history would be weight
   * carried for no benefit — and sending a whole conversation to be searched
   * is a lot of someone's words to hand over for a feature this small.
   */
  let previousQuestion: string | null = null;
  let panel: HTMLDivElement | null = null;
  let busy = false;
  /**
   * Whether the visitor has already been asked for their details.
   *
   * Asked AT MOST ONCE per visit, and never again after they decline or send.
   * The alternative — offering on every unanswered question — turns an honest
   * handover into nagging, and somebody who said no once has answered.
   */
  let captureOffered = false;

  const launcher = el(
    'button',
    { class: 'launcher', type: 'button', ariaLabel: 'Open the chat', ariaExpanded: 'false' },
  );
  launcher.innerHTML =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-3.6-.7L3 21l1.9-5.2A8.2 8.2 0 0 1 4 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 8 8.4z"/></svg>';
  root.append(launcher);

  const say = (text: string, kind: 'you' | 'them' | 'unsure' | 'problem', cites: AskResponse['citations'] = []) => {
    const log = panel?.querySelector('.log');
    if (!log) return;
    const bubble = el('div', {
      class: `msg ${kind === 'you' ? 'you' : `them ${kind === 'them' ? '' : kind}`}`.trim(),
    });
    bubble.append(el('span', { textContent: text }));

    // Only real links are shown. The API already strips internal source keys,
    // and this is a second gate because the widget runs on someone else's page.
    const linked = cites.filter((c) => c.url && /^https?:\/\//i.test(c.url));
    if (linked.length > 0) {
      const list = el('ul', { class: 'cites' });
      for (const c of linked) {
        list.append(
          el(
            'li',
            {},
            el('a', {
              href: c.url ?? '#',
              textContent: c.title ?? c.url ?? 'Source',
              target: '_blank',
              // noopener is not optional on a link we render into a third
              // party's page: without it the opened tab can navigate ours.
              rel: 'noopener noreferrer',
            }),
          ),
        );
      }
      bubble.append(list);
    }
    log.append(bubble);
    log.scrollTop = log.scrollHeight;
  };

  const ask = async (question: string) => {
    if (busy) return;
    busy = true;
    say(question, 'you');

    const log = panel?.querySelector('.log');
    const typing = el('div', { class: 'msg them' });
    typing.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>';
    log?.append(typing);
    if (log) log.scrollTop = log.scrollHeight;

    try {
      const res = await fetch(`${apiBase}/api/v1/receptionist/${businessId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          sessionKey: SESSION_KEY,
          ...(previousQuestion ? { previousQuestion } : {}),
        }),
      });
      typing.remove();
      if (!res.ok) {
        say(
          res.status === 429
            ? 'Lots of questions at once — give me a moment and try again.'
            : "Something went wrong at my end. Please try again, or contact the team directly.",
          'problem',
        );
        return;
      }
      const answer = (await res.json()) as AskResponse;
      // `unsure` is styled differently on purpose: an answer the receptionist
      // is guessing at must not look identical to one it is certain of.
      say(answer.text, answer.confidence === 'unsure' ? 'unsure' : 'them', answer.citations);

      /**
       * The handover.
       *
       * This is the only moment it is offered: the receptionist has just said
       * it does not know, so asking for a number is plainly in the visitor's
       * interest rather than a lead-capture popup. Offering it after a good
       * answer would be the thing every other widget does — interrupting
       * somebody who has what they came for.
       *
       * `unsure` deliberately does not trigger it. The visitor was given
       * something; let them read it and ask again.
       */
      if (answer.confidence === 'unknown' && !captureOffered) {
        captureOffered = true;
        offerCapture(question);
      }
    } catch {
      typing.remove();
      say("I can't reach the network right now. Please try again in a moment.", 'problem');
    } finally {
      // Recorded whatever the outcome: a question that failed is still the
      // thing a follow-up refers to.
      previousQuestion = question;
      busy = false;
      const send = panel?.querySelector<HTMLButtonElement>('.send');
      if (send) send.disabled = false;
    }
  };

  /**
   * Three things worth asking, shown under the greeting.
   *
   * The panel used to open with an empty box, which asks somebody who arrived
   * for another reason entirely to stop and decide what they want. It also
   * made their first question a coin toss: ask something the business never
   * published and your one impression of the product is "I don't know".
   *
   * These come from the owner's own knowledge base, so the first answer is
   * guaranteed to be a good one. They are removed as soon as one is used —
   * they are a way in, not a menu to keep coming back to.
   */
  const offerSuggestions = () => {
    const log = panel?.querySelector('.log');
    const suggestions = config?.suggestions ?? [];
    if (!log || suggestions.length === 0) return;

    const chips = el('div', { class: 'chips' });
    // A list, so a screen reader announces how many there are rather than
    // reading three unrelated buttons floating after the greeting.
    chips.setAttribute('role', 'group');
    chips.setAttribute('aria-label', 'Questions you could ask');

    for (const suggestion of suggestions) {
      const chip = el('button', { class: 'chip', type: 'button', textContent: suggestion });
      chip.addEventListener('click', () => {
        chips.remove();
        void ask(suggestion);
      });
      chips.append(chip);
    }

    log.append(chips);
    log.scrollTop = log.scrollHeight;
  };

  /**
   * Ask for a way to be reached, inline in the conversation.
   *
   * Two fields, one of them optional, and a visible way out. Everything about
   * the shape of this is about not losing somebody who was already told "I
   * don't know": no modal, no required name, no "which is this, phone or
   * email?", and the decline is a plain link rather than a hidden X.
   */
  const offerCapture = (unansweredQuestion: string) => {
    const log = panel?.querySelector('.log');
    if (!log) return;

    const card = el('div', { class: 'capture' });
    const who = config?.businessName ?? 'the team';
    card.append(
      el('p', {
        textContent: `Leave your number or email and ${who} will come back to you.`,
      }),
    );

    const error = el('p', { class: 'err', hidden: true });
    error.setAttribute('role', 'alert');
    card.append(error);

    const name = el('input', {
      class: 'field',
      type: 'text',
      placeholder: 'Your name (optional)',
      maxLength: 120,
    });
    name.setAttribute('aria-label', 'Your name, optional');

    const contact = el('input', {
      class: 'field',
      type: 'text',
      placeholder: 'Phone or email',
      maxLength: 200,
    });
    contact.setAttribute('aria-label', 'Your phone number or email address');
    /**
     * `tel`, although the field takes either.
     *
     * `autocomplete` accepts one token, so a field meaning "phone or email"
     * cannot describe itself honestly. Phone wins because the market is India
     * and because on a phone this is the difference between one tap and typing
     * ten digits. It only ever OFFERS a value, so somebody typing an email
     * loses nothing.
     */
    contact.setAttribute('autocomplete', 'tel');

    const send = el('button', { class: 'send', type: 'button', textContent: 'Send' });
    const no = el('button', { class: 'ghost', type: 'button', textContent: 'No thanks' });

    const finish = (text: string) => {
      card.remove();
      say(text, 'them');
    };

    no.addEventListener('click', () => {
      card.remove();
      // Nothing is said in reply. Acknowledging a decline out loud would be
      // one more line from a receptionist that already could not help.
    });

    const submit = async () => {
      const value = contact.value.trim();
      if (!value) {
        error.hidden = false;
        error.textContent = 'Please add a phone number or an email address.';
        contact.focus();
        return;
      }
      send.disabled = true;
      error.hidden = true;
      try {
        const res = await fetch(`${apiBase}/api/v1/receptionist/${businessId}/lead`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact: value,
            ...(name.value.trim() ? { name: name.value.trim() } : {}),
            question: unansweredQuestion,
          }),
        });
        if (res.ok) {
          finish(`Thank you — ${who} will be in touch.`);
          return;
        }
        // The server decides whether a contact detail is usable; the widget
        // only maps its code to copy written for a stranger. Backend prose is
        // never shown, here least of all.
        const body = (await res.json().catch(() => ({}))) as { code?: string };
        error.hidden = false;
        error.textContent = leadErrorMessage(res.status, body.code);
        send.disabled = false;
      } catch {
        error.hidden = false;
        error.textContent = 'No connection right now. Please try again in a moment.';
        send.disabled = false;
      }
    };

    send.addEventListener('click', () => void submit());
    contact.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') void submit();
    });

    card.append(name, contact, el('div', { class: 'row' }, send, no));
    log.append(card);
    log.scrollTop = log.scrollHeight;
  };

  const buildPanel = (): HTMLDivElement => {
    const p = el('div', { class: 'panel', role: 'dialog', ariaModal: 'false' });
    p.setAttribute('aria-label', `Chat with ${config?.businessName ?? 'us'}`);

    const close = el('button', { class: 'close', type: 'button', ariaLabel: 'Close the chat' });
    close.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    close.addEventListener('click', () => toggle(false));

    p.append(
      el(
        'div',
        { class: 'header' },
        el(
          'div',
          {},
          el('p', { class: 'title', textContent: config?.businessName ?? 'Chat' }),
          el('p', { class: 'sub', textContent: 'Answers from this business' }),
        ),
        close,
      ),
    );

    // Test Mode is disclosed to the VISITOR, not just the owner. Someone
    // talking to a receptionist that is not live deserves to know.
    if (config?.mode === 'TEST') {
      p.append(
        el('p', {
          class: 'notice',
          textContent: 'Test mode — this assistant is still being set up.',
        }),
      );
    }

    // aria-live so a screen-reader user hears replies as they arrive rather
    // than having to go looking for them.
    const log = el('div', { class: 'log', role: 'log' });
    log.setAttribute('aria-live', 'polite');
    p.append(log);

    const input = el('input', {
      class: 'input',
      type: 'text',
      placeholder: 'Ask a question…',
      maxLength: 500,
    });
    input.setAttribute('aria-label', 'Your question');

    const send = el('button', { class: 'send', type: 'button', textContent: 'Send' });
    const submit = () => {
      const q = input.value.trim();
      if (!q || busy) return;
      input.value = '';
      send.disabled = true;
      void ask(q);
    };
    send.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') submit();
    });
    // Somebody who starts typing has decided what to ask. Leaving the chips
    // up competes with what they are already doing.
    input.addEventListener('input', () => {
      if (input.value.length > 0) p.querySelector('.chips')?.remove();
    });

    p.append(el('div', { class: 'composer' }, input, send));
    return p;
  };

  const toggle = async (next: boolean) => {
    open = next;
    launcher.setAttribute('aria-expanded', String(open));
    launcher.setAttribute('aria-label', open ? 'Close the chat' : 'Open the chat');

    if (!open) {
      panel?.remove();
      panel = null;
      // Closing the panel ends the conversation. Carrying context into a
      // reopened chat would let a question from ten minutes ago silently steer
      // an unrelated one.
      previousQuestion = null;
      // A new conversation may be offered the handover again. Closing the
      // panel is how somebody starts over, and carrying the refusal across
      // would mean a visitor who dismissed it once can never leave their
      // number without reloading the page.
      captureOffered = false;
      launcher.focus();
      return;
    }

    // Config is fetched on first open rather than on page load: a widget
    // nobody clicks should cost the visitor nothing.
    if (!config) {
      try {
        const res = await fetch(`${apiBase}/api/v1/receptionist/${businessId}/config`);
        if (res.ok) config = (await res.json()) as WidgetConfig;
      } catch {
        // Rendered without config below - the chat still works, and a failed
        // greeting is not a reason to show the visitor nothing.
      }
    }

    panel = buildPanel();
    root.append(panel);
    say(config?.greeting ?? 'Hi — what would you like to know?', 'them');
    offerSuggestions();
    panel.querySelector<HTMLInputElement>('.input')?.focus();
  };

  launcher.addEventListener('click', () => void toggle(!open));

  // Escape closes, which is the only dismissal a keyboard user has.
  shadow.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Escape' && open) void toggle(false);
  });
}

boot();
