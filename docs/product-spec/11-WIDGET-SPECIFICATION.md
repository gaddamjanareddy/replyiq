# 11 - Widget Specification

> **Status:** Draft
> **Last Updated:** 2026-08-17
> **Owner:** Tech Lead

This document defines the embeddable AI receptionist widget for ReplyIQ. The widget is a self-contained chat interface that businesses embed on their websites to let visitors interact with the AI Knowledge Receptionist (see [10-AI-KNOWLEDGE-RECEPTIONIST.md](./10-AI-KNOWLEDGE-RECEPTIONIST.md)).

---

## 1. Current State

**Current:** The widget package exists as a scaffold at `apps/widget/`. `src/main.tsx` exports nothing (`export {}`). Build is TypeScript compilation only (Vite not yet configured). The package depends on `@replyiq/types` and `@replyiq/ui` workspace packages. No UI, no API integration, no initialization logic exists.

**Planned:** Full widget implementation for Milestone 7 (see [15-ROADMAP.md](./15-ROADMAP.md)).

---

## 2. Installation

### 2.1 Script Tag (CDN)

**[PLANNED]**

The primary installation method. A single `<script>` tag added to any HTML page:

```html
<script
  src="https://cdn.replyiq.com/widget.js"
  data-business-id="YOUR_BUSINESS_ID"
  defer
></script>
```

The script loads asynchronously and self-initializes using the `data-business-id` attribute. No additional HTML elements are required. The widget creates its own DOM container.

### 2.2 NPM Package

**[PLANNED]**

For applications that use a build tool (React, Vue, etc.):

```bash
npm install @replyiq/widget
```

```typescript
import { initWidget } from '@replyiq/widget';

initWidget({
  businessId: 'YOUR_BUSINESS_ID',
});
```

### 2.3 Data Attributes

**[PLANNED]**

All configuration can be passed via `data-*` attributes on the script tag:

| Attribute | Required | Description |
|---|---|---|
| `data-business-id` | Yes | The business's public widget key |
| `data-position` | No | `bottom-right` (default) or `bottom-left` |
| `data-theme` | No | `light` (default) or `dark` |
| `data-api-url` | No | Override API base URL (for self-hosted) |

---

## 3. Embedding Approach

### 3.1 Chosen Approach: Web Component (Custom Element)

**[PLANNED]**

The widget renders as a Web Component (`<replyiq-widget>`) using Shadow DOM for style isolation. This is the preferred approach because:

- Styles do not conflict with the host page
- DOM is encapsulated and cannot be accidentally modified by the host page
- Works across any framework or vanilla HTML
- No iframe overhead for simple pages

### 3.2 Fallback: iframe

**[PLANNED]**

An iframe-based embed is available as a fallback for environments where Shadow DOM is not supported or where maximum isolation is required:

```html
<iframe
  src="https://cdn.replyiq.com/widget-frame.html?businessId=YOUR_BUSINESS_ID"
  style="position:fixed;bottom:0;right:0;border:none;width:0;height:0;"
></iframe>
```

The iframe communicates with the parent page via `postMessage` for resize events.

### 3.3 React Component (SDK)

**[PLANNED]**

For React applications, a React component wrapper is provided:

```tsx
import { ReplyIQWidget } from '@replyiq/widget/react';

function App() {
  return <ReplyIQWidget businessId="YOUR_BUSINESS_ID" />;
}
```

This renders the widget directly into the React tree without Shadow DOM (the host application is expected to handle style isolation).

---

## 4. Initialization

### 4.1 Bootstrap Sequence

**[PLANNED]**

1. Script loads and executes.
2. Widget reads `data-business-id` from the script tag (or receives config via JS API).
3. Widget creates a Shadow DOM container and attaches it to `document.body`.
4. Widget fetches configuration from `GET /widget/config?businessId=xxx`.
5. Widget renders the floating chat bubble using the business's configured theme.
6. Widget is ready for visitor interaction.

### 4.2 JavaScript API

**[PLANNED]**

```typescript
// Programmatic initialization
import { initWidget } from '@replyiq/widget';

initWidget({
  businessId: 'b_abc123',
  position: 'bottom-right',
  theme: 'light',
  apiBaseUrl: 'https://api.replyiq.com',
});

// Open/close programmatically
import { openWidget, closeWidget, destroyWidget } from '@replyiq/widget';

openWidget();
closeWidget();
destroyWidget(); // Remove widget from DOM
```

### 4.3 Multiple Instances

**[PLANNED]**

Only one widget instance is allowed per page. If `initWidget()` is called multiple times, subsequent calls are no-ops with a console warning. The `data-business-id` must be consistent across calls.

---

## 5. Widget Configuration

### 5.1 Per-Business Configuration

**[PLANNED]**

Each business's widget is configured through the ReplyIQ dashboard. Configuration is fetched from the API and cached.

**Configuration fields:**

| Field | Type | Default | Description |
|---|---|---|---|
| `primaryColor` | `string` | `#2563EB` | Primary brand color (buttons, header) |
| `position` | `enum` | `bottom-right` | `bottom-right` or `bottom-left` |
| `greetingMessage` | `string` | `"Hi! How can I help you today?"` | First message from AI |
| `avatarUrl` | `string \| null` | `null` | Business logo/avatar URL |
| `businessName` | `string` | `"Support"` | Display name in header |
| `preChatFormFields` | `FieldConfig[]` | `[]` | Fields shown before chat starts |
| `offlineMessage` | `string` | `"We're offline. Leave a message."` | Message when outside business hours |
| `businessHours` | `HoursConfig \| null` | `null` | Business hours schedule |
| `theme` | `enum` | `light` | `light` or `dark` |
| `fontSize` | `enum` | `medium` | `small`, `medium`, `large` |
| `customCss` | `string \| null` | `null` | Custom CSS overrides (sanitized) |

### 5.2 Pre-Chat Form

**[PLANNED]**

Optional form fields displayed before the visitor can send their first message. Used to capture lead information upfront.

```typescript
interface FieldConfig {
  id: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'select';
  required: boolean;
  options?: string[]; // For select type
  placeholder?: string;
}
```

When pre-chat form is configured, the visitor must complete the form before the chat opens. Submitted values are attached to the visitor session.

### 5.3 Hours Configuration

**[PLANNED]**

```typescript
interface HoursConfig {
  timezone: string; // IANA timezone, e.g. "America/New_York"
  schedule: {
    day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
    open: string;  // "09:00"
    close: string; // "17:00"
  }[];
}
```

When `businessHours` is set and the current time is outside business hours, the widget displays the `offlineMessage` instead of connecting to the AI. Visitor messages submitted outside hours are queued as offline messages.

---

## 6. UI Components

### 6.1 Chat Bubble

**[PLANNED]**

A floating circular button fixed to the bottom corner of the viewport.

- **Size:** 60px diameter
- **Icon:** Chat bubble SVG (customizable via config)
- **Position:** `bottom: 24px; right: 24px` (or `left: 24px` if `position: bottom-left`)
- **Shadow:** `0 4px 12px rgba(0,0,0,0.15)`
- **Hover:** Scale to 1.1x with CSS transition (200ms ease)
- **Active:** Scale to 0.95x on press
- **Unread indicator:** Optional badge with unread message count (red circle, top-right of bubble)
- **Z-index:** `2147483647` (maximum 32-bit integer, always on top)

### 6.2 Chat Window

**[PLANNED]**

Expands from the chat bubble when clicked.

- **Desktop:** 400px wide, 600px tall (max), positioned above the bubble
- **Tablet:** 360px wide
- **Mobile:** Full-screen overlay (see section 7.2)
- **Animation:** Slide up + fade in (200ms ease-out)
- **Close:** Click bubble again, or click the close button in the header
- **Border radius:** 12px on desktop, 0 on mobile
- **Shadow:** `0 8px 32px rgba(0,0,0,0.2)` on desktop
- **Z-index:** Same as bubble (`2147483647`)

### 6.3 Chat Header

**[PLANNED]**

Fixed header at the top of the chat window.

- Business avatar (or default icon) on the left
- Business name text
- Online status indicator (green dot)
- Close/minimize button on the right
- Background color: `primaryColor` from config
- Text color: auto contrast (white on dark backgrounds, black on light)
- Height: 56px

### 6.4 Message List

**[PLANNED]**

Scrollable area containing the conversation history.

- **Visitor messages:** Right-aligned, colored background (primaryColor), white text, max-width 80%
- **AI messages:** Left-aligned, light gray background, dark text, with AI avatar, max-width 80%
- **Timestamps:** Shown on hover or after 60 seconds of inactivity between messages
- **Auto-scroll:** Scrolls to bottom on new messages
- **Typing indicator:** Three animated dots shown while AI is processing
- **Empty state:** Shows welcome message or pre-chat form
- **Padding:** 16px horizontal, 12px vertical between messages

### 6.5 Input Field

**[PLANNED]**

Fixed at the bottom of the chat window.

- Text input with placeholder: "Type a message..."
- Send button (arrow icon) on the right, enabled only when input is non-empty
- Enter key sends message (Shift+Enter for newline)
- Multiline support: input grows up to 4 lines, then scrolls
- Disabled state: grayed out during AI processing
- Character limit: 2000 characters
- Height: 48px (single line), grows with content

### 6.6 Typing Indicator

**[PLANNED]**

Displayed while the AI processes a response.

- Three dots in a row, each animating with staggered bounce
- Shows below the last AI message
- Duration: until API response is received or timeout (15 seconds)
- On timeout: replaced with "Sorry, I'm having trouble. Please try again."

### 6.7 Pre-Chat Form

**[PLANNED]**

Displayed in the message area before the chat opens, when configured.

- Form fields rendered vertically with labels
- "Continue" button at the bottom (uses `primaryColor`)
- Button is disabled until all required fields are filled
- On submit, values are sent with the session creation request
- Form validation is client-side (required fields, email format)

---

## 7. Responsive Behavior

### 7.1 Breakpoints

**[PLANNED]**

| Breakpoint | Width | Chat Window Behavior |
|---|---|---|
| Desktop | >= 768px | 400px wide, positioned in corner |
| Tablet | 600px - 767px | 360px wide, positioned in corner |
| Mobile | < 600px | Full-screen overlay |

### 7.2 Mobile Full-Screen

**[PLANNED]**

On viewports under 600px:

- Chat window expands to fill the entire viewport (`100vw x 100vh`)
- Chat bubble is hidden (the window is the entry point)
- Header includes a back button instead of minimize
- Safe area insets respected for devices with notches (`env(safe-area-inset-bottom)`)
- Input field sticks above the keyboard (using `visualViewport` API)

### 7.3 Positioning Rules

**[PLANNED]**

- Chat window always stays within viewport bounds
- On narrow viewports, the window may shift horizontally to remain fully visible
- Minimum margin from viewport edges: 16px
- On iOS Safari, the widget accounts for the bottom bar by respecting `env(safe-area-inset-bottom)`

### 7.4 Animation

**[PLANNED]**

- Open: Slide up from bubble position + fade in (200ms ease-out)
- Close: Slide down to bubble + fade out (150ms ease-in)
- On mobile: Slide up from bottom (250ms ease-out)
- Respects `prefers-reduced-motion` media query: instant open/close without animation

---

## 8. Chat Experience

### 8.1 Visitor Opens Widget

**[PLANNED]**

1. Visitor clicks the chat bubble.
2. Chat window slides open.
3. If pre-chat form is configured, it is displayed.
4. If no pre-chat form, the greeting message appears from the AI.
5. Input field is focused automatically.

### 8.2 AI Greeting

**[PLANNED]**

- Configured via `greetingMessage` in widget config
- Displayed as an AI message with avatar
- Timestamp shown
- No typing indicator for the greeting (appears immediately)

### 8.3 Visitor Sends Message

**[PLANNED]**

1. Visitor types in the input field.
2. Visitor presses Enter or clicks Send.
3. Message appears in the message list (right-aligned, visitor style).
4. Input field clears.
5. Typing indicator appears.
6. `POST /widget/messages` is called with the message.
7. AI response is received and displayed (left-aligned, AI style).
8. Typing indicator disappears.

### 8.4 Conversation Continues

**[PLANNED]**

- Messages accumulate in the message list
- Conversation history is maintained in the session
- AI has access to the full conversation context
- Visitor can scroll up to review previous messages

### 8.5 Lead Capture

**[PLANNED]**

The AI captures lead information when the conversation qualifies:

- **Trigger:** The AI determines the visitor is a potential lead based on conversation signals (e.g., asking about pricing, services, scheduling).
- **Method:** The AI asks for name and email naturally within the conversation.
- **Storage:** Captured information is stored in the visitor session and synced to the business's lead list in the dashboard.
- **Disclosure:** The visitor is informed that their information will be used to follow up.
- **Opt-out:** The visitor can decline to provide information.

### 8.6 Human Handoff

**[PLANNED]**

When the AI determines a conversation requires human assistance:

1. AI sends a message: "Let me connect you with someone who can help."
2. A `human_handoff` event is emitted.
3. If a human agent is available, the conversation is transferred.
4. If no agent is available, the visitor is offered to leave a message.
5. The business owner is notified of the handoff request.

---

## 9. API Communication

### 9.1 REST API

**[PLANNED]**

The widget communicates with the ReplyIQ backend via REST API. All endpoints use the `/widget` prefix (separate from the main `/api/v1` business dashboard endpoints). The widget API is public-facing and does not require user authentication.

### 9.2 Endpoints

**[PLANNED]**

| Endpoint | Method | Purpose |
|---|---|---|
| `GET /widget/config` | GET | Fetch widget configuration for a business |
| `POST /widget/sessions` | POST | Create a new visitor session |
| `POST /widget/messages` | POST | Send a message and receive AI response |
| `GET /widget/messages/:sessionId` | GET | Fetch conversation history |
| `POST /widget/sessions/:sessionId/lead` | POST | Submit lead information |
| `POST /widget/sessions/:sessionId/handoff` | POST | Request human handoff |

### 9.3 Request/Response Shapes

**[PLANNED]**

#### GET /widget/config

```
Query: businessId=b_abc123

Response 200:
{
  "success": true,
  "data": {
    "primaryColor": "#2563EB",
    "position": "bottom-right",
    "greetingMessage": "Hi! How can I help you today?",
    "avatarUrl": "https://cdn.replyiq.com/avatars/b_abc123.png",
    "businessName": "Acme Corp",
    "preChatFormFields": [],
    "offlineMessage": "...",
    "businessHours": null,
    "theme": "light",
    "fontSize": "medium",
    "customCss": null
  }
}
```

#### POST /widget/sessions

```
Body:
{
  "businessId": "b_abc123",
  "visitorFingerprint": "hashed-visitor-id",
  "preChatData": { "name": "Jane", "email": "jane@example.com" }
}

Response 201:
{
  "success": true,
  "data": {
    "sessionId": "sess_xyz789",
    "createdAt": "2026-08-17T10:00:00Z"
  }
}
```

#### POST /widget/messages

```
Body:
{
  "sessionId": "sess_xyz789",
  "content": "What are your business hours?",
  "role": "visitor"
}

Response 200:
{
  "success": true,
  "data": {
    "message": {
      "id": "msg_abc",
      "content": "We're open Monday through Friday, 9 AM to 5 PM EST.",
      "role": "assistant",
      "createdAt": "2026-08-17T10:00:02Z"
    }
  }
}
```

#### GET /widget/messages/:sessionId

```
Response 200:
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "msg_abc",
        "content": "Hi! How can I help you today?",
        "role": "assistant",
        "createdAt": "2026-08-17T10:00:00Z"
      }
    ]
  }
}
```

### 9.4 WebSocket (Future)

**[PLANNED]**

WebSocket support is planned for real-time responses and typing indicators:

```
wss://api.replyiq.com/widget/ws?sessionId=sess_xyz789
```

Events:

| Event | Direction | Payload |
|---|---|---|
| `message` | Server -> Client | AI response message |
| `typing` | Server -> Client | `{ isTyping: true/false }` |
| `handoff` | Server -> Client | Handoff request details |
| `ping` / `pong` | Bidirectional | Keepalive |

WebSocket is a future enhancement. Initial implementation uses REST only.

---

## 10. Authentication and Security

### 10.1 Widget Key Authentication

**[PLANNED]**

- The widget authenticates using a **public widget key** (the `businessId`), not a user JWT.
- The widget key is a public identifier. It is safe to expose in client-side code.
- The widget key is rate-limited per visitor session (see section 10.3).
- No sensitive business data is exposed through the widget key.

### 10.2 CORS Configuration

**[PLANNED]**

The API server is configured with CORS headers to accept requests from:

- Any origin (widget is embedded on arbitrary third-party sites)
- The `Origin` header is logged for audit purposes
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, X-Widget-Key`

### 10.3 Rate Limiting

**[PLANNED]**

Rate limits are applied per visitor session:

| Resource | Limit | Window |
|---|---|---|
| Messages | 30 | per minute |
| Session creation | 5 | per hour per IP |
| Lead submission | 3 | per session |

When rate limited, the API returns `429 Too Many Requests` with a `Retry-After` header. The widget displays "Please wait a moment before sending another message."

### 10.4 Input Sanitization

**[PLANNED]**

- All visitor input is sanitized before display (strip HTML tags, escape special characters)
- Messages are truncated at 2000 characters
- Pre-chat form fields are validated (email format, required fields)
- The widget does not execute any visitor-provided scripts or code

### 10.5 Content Security Policy

**[PLANNED]**

The widget is compatible with strict CSP environments:

- No `eval()` or `new Function()` usage
- No inline scripts (all scripts are bundled)
- Styles are injected via Shadow DOM (not inline `<style>` tags in the host document)
- No external font loading (uses system fonts or fallbacks)

### 10.6 Data Exposure

**[PLANNED]**

- The widget never exposes business internal IDs, API tokens, or configuration secrets
- Visitor data (messages, session ID) is only sent to the ReplyIQ API
- No third-party analytics or tracking scripts are loaded by the widget
- Session data is not stored in `localStorage` or `sessionStorage` (kept in memory only)

---

## 11. Conversation Lifecycle

### 11.1 Full Lifecycle

**[PLANNED]**

```
Widget Load
    |
    v
[1] Fetch Config (GET /widget/config)
    |
    v
[2] Render Chat Bubble
    |
    v
Visitor Clicks Bubble
    |
    v
[3] Show Pre-Chat Form (if configured)
    |
    v
[4] Create Session (POST /widget/sessions)
    |
    v
[5] Display Greeting Message
    |
    v
[6] Visitor Sends Message (POST /widget/messages)
    |
    v
[7] AI Responds
    |
    v
[8] Conversation Continues (loop [6]-[7])
    |
    v
[9] Lead Capture (if conversation qualifies)
    |
    v
[10] Human Handoff (if needed)
    |
    v
[11] Session Ends (visitor closes widget or times out)
```

### 11.2 Session Timeout

**[PLANNED]**

- Sessions expire after 30 minutes of inactivity
- On expiry, the visitor sees "Your session has expired. Click to start a new conversation."
- Clicking the bubble creates a new session
- Previous conversation history is preserved and accessible by the business

### 11.3 Session Persistence

**[PLANNED]**

- Session ID is stored in memory (not cookies or localStorage)
- On page refresh, a new session is created
- Conversation history for the previous session is not restored in the widget (it is preserved server-side)
- The business can view all historical conversations in the dashboard

### 11.4 Visitor Fingerprinting

**[PLANNED]**

To provide session continuity across page refreshes without using cookies:

- A visitor fingerprint is generated from a combination of: user agent string, screen resolution, timezone, and a random salt
- The fingerprint is hashed (SHA-256) before being sent to the API
- The API uses the fingerprint to associate sessions from the same visitor
- Fingerprinting is optional and can be disabled by the business

---

## 12. Error Handling

### 12.1 Network Failure

**[PLANNED]**

When the widget cannot reach the API:

1. Show a brief "Reconnecting..." message below the input field.
2. Retry the request with exponential backoff: 1s, 2s, 4s, 8s, 16s (max 5 retries).
3. If all retries fail, show "Connection lost. Please check your internet connection and try again."
4. The input field remains active so the visitor can continue typing.
5. Messages sent during disconnection are queued and sent when the connection is restored.

### 12.2 API Error

**[PLANNED]**

When the API returns a non-success response:

- **400 Bad Request:** Display "Sorry, something went wrong. Please try again."
- **403 Forbidden:** Display "This chat is not available at this time."
- **429 Too Many Requests:** Display "Please wait a moment before sending another message." Show retry-after time if available.
- **500+ Server Error:** Display "We're experiencing technical difficulties. Please try again later."
- Errors are logged to the widget's internal error buffer (no external reporting).

### 12.3 Timeout

**[PLANNED]**

- API request timeout: 30 seconds
- If the AI does not respond within 30 seconds, show "The AI is taking longer than expected. Please try again."
- Typing indicator is dismissed on timeout
- Visitor can resend their message

### 12.4 Configuration Failure

**[PLANNED]**

If the widget fails to load its configuration:

- The chat bubble is not rendered
- A fallback link is displayed: "Chat is temporarily unavailable."
- No errors are thrown to the host page console (silent failure)

---

## 13. Offline Behavior

### 13.1 Offline Detection

**[PLANNED]**

The widget monitors the browser's online/offline status:

- Listens to `window.addEventListener('online')` and `window.addEventListener('offline')`
- Also detects API-level failures as implicit offline state

### 13.2 Offline State

**[PLANNED]**

When the visitor is offline:

- The chat bubble remains visible and clickable
- The chat window opens normally
- Messages are accepted from the visitor but queued (not sent immediately)
- A banner appears: "You appear to be offline. Messages will be sent when you reconnect."
- When connection is restored, queued messages are sent in order
- AI responses for queued messages are displayed when received

### 13.3 Business Hours Offline

**[PLANNED]**

When the business is outside configured hours:

- The widget displays the `offlineMessage` from configuration
- The visitor can leave a message (name, email, message)
- The message is stored as an offline message in the business's dashboard
- The visitor sees: "Thanks! We'll get back to you during business hours."

---

## 14. Performance

### 14.1 Bundle Size

**[PLANNED]**

| Metric | Target |
|---|---|
| Gzipped bundle size | < 25KB |
| First paint (bubble visible) | < 200ms after script load |
| Time to interactive | < 500ms after script load |

### 14.2 Loading Strategy

**[PLANNED]**

- Script loads with `defer` attribute (does not block page rendering)
- Widget initializes after `DOMContentLoaded` event
- Configuration is fetched lazily (only when the bubble is first rendered)
- React is code-split: the core bubble is loaded first, the full chat window is loaded on first open

### 14.3 Caching

**[PLANNED]**

- Widget configuration is cached in memory for the duration of the page session
- Configuration is refetched on each new page load (no localStorage caching)
- Conversation history is not cached in the widget (fetched from API as needed)
- CDN assets are served with appropriate cache headers (`Cache-Control: max-age=3600`)

### 14.4 Memory

**[PLANNED]**

- Maximum messages retained in memory: 100 (older messages are virtualized/removed from DOM)
- Message list uses virtual scrolling when conversation exceeds 50 messages
- `destroyWidget()` cleans up all event listeners, timers, and DOM elements
- No memory leaks on repeated open/close cycles (verified via automated testing)

### 14.5 Accessibility

**[PLANNED]**

- Chat bubble has `aria-label="Open chat"` and `role="button"`
- Chat window has `role="dialog"` and `aria-label="Chat window"`
- Messages are announced to screen readers via `aria-live="polite"` region
- Input field has proper `label` association
- Focus is trapped within the chat window when open
- Escape key closes the chat window
- Keyboard navigation: Tab cycles through interactive elements (input, send button, close button)

---

## 15. Versioning

### 15.1 Script Version

**[PLANNED]**

- CDN URL includes a version: `https://cdn.replyiq.com/widget@1.0.0/widget.js`
- Latest version available at: `https://cdn.replyiq.com/widget.js` (always points to latest stable)
- Major version pinned to avoid breaking changes: `https://cdn.replyiq.com/widget@1/widget.js`

### 15.2 API Version

**[PLANNED]**

- Widget API endpoints are versioned separately from the dashboard API
- Current prefix: `/widget/` (implicit v1)
- Future versions: `/widget/v2/` if breaking changes are introduced
- Widget sends its version in the `X-Widget-Version` header

### 15.3 Backward Compatibility

**[PLANNED]**

- The widget API maintains backward compatibility within a major version
- Deprecated endpoints are supported for 6 months after replacement
- Widget configuration schema is additive (new fields have defaults)

---

## 16. Customization

### 16.1 Theme Customization

**[PLANNED]**

Businesses can customize the widget appearance through the dashboard:

| Property | What It Controls |
|---|---|
| `primaryColor` | Header background, visitor message bubbles, send button |
| `theme` | Overall light/dark mode |
| `fontSize` | Base font size for all widget text |
| `customCss` | Arbitrary CSS overrides (sanitized, applied within Shadow DOM) |
| `avatarUrl` | Business logo in the header and AI avatar |
| `businessName` | Display name in the header |

### 16.2 CSS Custom Properties

**[PLANNED]**

For advanced customization via the React SDK, the widget exposes CSS custom properties:

```css
replyiq-widget {
  --riq-primary: #2563EB;
  --riq-bg: #ffffff;
  --riq-text: #1f2937;
  --riq-border: #e5e7eb;
  --riq-radius: 12px;
  --riq-font: system-ui, sans-serif;
}
```

### 16.3 Event Callbacks

**[PLANNED]**

For the React SDK and JS API, event callbacks allow host applications to react to widget events:

```typescript
initWidget({
  businessId: 'b_abc123',
  onOpen: () => console.log('Widget opened'),
  onClose: () => console.log('Widget closed'),
  onMessage: (message) => console.log('New message:', message),
  onLeadCaptured: (lead) => console.log('Lead captured:', lead),
  onError: (error) => console.error('Widget error:', error),
});
```

---

## 17. Tenant Isolation

### 17.1 Data Isolation

**[PLANNED]**

- Each business's widget configuration is isolated by `businessId`
- Visitor sessions are scoped to a single `businessId`
- Messages from one business's visitors are never visible to another business
- The widget key (`businessId`) only grants access to that business's public configuration and chat functionality

### 17.2 Session Isolation

**[PLANNED]**

- Session IDs are globally unique (UUID v4)
- A session created with one `businessId` cannot be used with another
- API endpoints validate that the session belongs to the business identified by the widget key
- Cross-tenant session access returns `403 Forbidden`

### 17.3 Rate Limit Isolation

**[PLANNED]**

- Rate limits are tracked per visitor session AND per business
- A business cannot use the widget API to attack another business's rate limits
- Each `businessId` has independent rate limit buckets

---

## 18. File Structure (Planned)

**[PLANNED]**

```
apps/widget/
├── package.json
├── tsconfig.json
├── vite.config.ts                    # Vite library mode build
├── index.html                        # Dev server entry / iframe frame
├── src/
│   ├── main.tsx                      # Entry point (CDN script)
│   ├── widget.ts                     # Widget class (lifecycle management)
│   ├── components/
│   │   ├── ChatBubble.tsx
│   │   ├── ChatWindow.tsx
│   │   ├── ChatHeader.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── InputField.tsx
│   │   ├── TypingIndicator.tsx
│   │   └── PreChatForm.tsx
│   ├── hooks/
│   │   ├── useWidgetConfig.ts        # Fetch and cache widget config
│   │   ├── useSession.ts             # Session creation and management
│   │   └── useMessages.ts            # Message send/receive
│   ├── api/
│   │   └── widget-client.ts          # API client for widget endpoints
│   ├── styles/
│   │   └── widget.css                # Shadow DOM styles
│   ├── utils/
│   │   ├── sanitize.ts               # Input sanitization
│   │   ├── fingerprint.ts            # Visitor fingerprinting
│   │   └── throttle.ts               # Rate limiting utilities
│   └── types/
│       └── widget.ts                 # Widget-specific types
└── dist/                             # Build output
    ├── widget.js                     # UMD bundle for CDN
    ├── widget-frame.html             # iframe fallback
    └── widget.esm.js                 # ESM bundle for npm
```

---

## 19. Open Questions

| # | Question | Status |
|---|---|---|
| OQ-001 | Should the widget use Shadow DOM or iframe by default? See OD-002. | Open |
| OQ-002 | What is the maximum number of concurrent sessions per business for the AI Receptionist? See OD-004. | Open |
| OQ-003 | Should offline messages be stored in the database or sent via email notification only? | Open |
| OQ-004 | Does the widget need to support right-to-left (RTL) languages in the initial release? | Open |
