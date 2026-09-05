# UI/UX Specification

> **Status:** Draft
> **Last Updated:** 2026-08-17
> **Owner:** Design Lead

---

> ### Revision notice — 2026-09-05
>
> Domain verification changed substantially in this revision. Where anything
> below describes verification mechanics, **`16-DOMAIN-VERIFICATION-AND-TEST-MODE.md`
> is authoritative** and this document is a secondary account.
>
> What changed, in short:
> - The website method checks a homepage `<meta name="replyiq-verification">`
>   tag first, with `/.well-known/replyiq-verification.txt` and the legacy
>   `/replyiq-verification.html (legacy; the meta tag is now the primary placement)` accepted as equivalent alternatives (D-01R).
> - The DNS record is `_replyiq-verification.{domain}`; `_replyiq-verification.{domain}`
>   is still accepted but never shown.
> - Verification has **three** outcomes, not two: verified, *not found yet*
>   (pending, retryable, normal), and *found but does not match* (mismatch).
> - A third method, **`SANDBOX`**, verifies IANA-reserved test domains instantly
>   in every environment including production, and is refused for any real
>   domain (D-04R).
> - Deleting the last verified domain is **allowed with explicit
>   acknowledgement** rather than blocked (D-06R).
>
> Full rationale: `../CHANGES-2026-09-05.md`.


## 1. Information Architecture

### 1.1 Site Map

```
/
├── /login                    (public)
├── /register                 (public)
└── / (redirects to /dashboard)
    └── /dashboard            (protected, AppLayout)
    └── /onboarding           (protected, AppLayout)
    └── /dashboard
        ├── /settings         (protected, AppLayout)
        └── /domains          (protected, AppLayout)
```

### 1.2 Page Inventory

| Route                | Page Name          | Auth Required | Layout    | Purpose                                     |
|----------------------|--------------------|---------------|-----------|---------------------------------------------|
| `/login`             | Login              | No            | Standalone| Authenticate an existing user                |
| `/register`          | Register           | No            | Standalone| Create a new workspace with owner account   |
| `/dashboard`         | Dashboard          | Yes           | AppLayout | Overview of business status and quick links  |
| `/onboarding`        | Onboarding         | Yes           | AppLayout | Step-by-step business setup wizard          |
| `/dashboard/settings`| Business Settings  | Yes           | AppLayout | Edit business profile details               |
| `/dashboard/domains` | Domains            | Yes           | AppLayout | Add, verify, and manage domains             |
| `/`                  | Redirect           | --            | --        | Redirects to `/dashboard`                   |
| `/*`                 | Catch-all Redirect | --            | --        | Redirects to `/dashboard`                   |

---

## 2. Design System

### 2.1 Color Palette

| Token               | Value        | Usage                                      |
|---------------------|--------------|--------------------------------------------|
| Primary             | `blue-600`   | Buttons, links, active states, progress    |
| Primary hover       | `blue-700`   | Button hover state                         |
| Primary light       | `blue-50`    | Active step background, active link bg     |
| Primary ring        | `blue-500`   | Focus-visible ring on primary buttons      |
| Danger              | `red-600`    | Delete buttons, destructive actions        |
| Danger hover        | `red-700`    | Danger button hover                        |
| Danger light        | `red-50`     | Error banners background                   |
| Danger border       | `red-200`    | Error banner border                        |
| Danger text         | `red-700`    | Error message text                         |
| Danger input border | `red-300`    | Input error state border                   |
| Danger ring         | `red-500`    | Input error focus ring                     |
| Success             | `green-600`  | Verified badge text, completion icons      |
| Success light       | `green-50`   | Success banners, verified domain bg        |
| Success border      | `green-200`  | Success banner border, verified step border|
| Success text        | `green-700`  | Success message text, verified badge text  |
| Success step bg     | `green-100`  | Completed step circle background           |
| Warning             | `yellow-600` | Pending badge text                          |
| Warning light       | `yellow-50`  | Pending banners                            |
| Warning border      | `yellow-200` | Pending banner border                      |
| Warning text        | `yellow-700` | Pending message text                        |
| Info light          | `blue-50`    | Info banners                               |
| Info text           | `blue-700`   | Info banner text                           |
| Gray 50             | `gray-50`    | Page background (standalone and AppLayout) |
| Gray 100            | `gray-100`   | Secondary button bg, skeleton pulse, step circle bg |
| Gray 200            | `gray-200`   | Borders, skeleton base, progress bar bg    |
| Gray 300            | `gray-300`   | Input default border                       |
| Gray 400            | `gray-400`   | Placeholder text                           |
| Gray 500            | `gray-500`   | Subtitle text, labels, inactive step text  |
| Gray 600            | `gray-600`   | Body text, secondary text                  |
| Gray 700            | `gray-700`   | Primary body text, inactive nav links      |
| Gray 900            | `gray-900`   | Headings, primary text, nav active text    |
| White               | `white`      | Card backgrounds, sidebar, header          |
| Black/50 overlay    | `black/50`   | Modal backdrop, mobile sidebar backdrop    |
| Black/40 overlay    | `black/40`   | Verify modal backdrop                      |

### 2.2 Typography

| Element          | Size     | Weight    | Color       | Classes                          |
|------------------|----------|-----------|-------------|----------------------------------|
| Page title (h1)  | `text-xl`| `semibold`| `gray-900`  | `text-xl font-semibold text-gray-900` |
| Section title (h2)| `text-lg`| `semibold`| `gray-900` | `text-lg font-semibold text-gray-900` |
| Card title (h3)  | `text-sm`| `semibold`| `gray-900`  | `text-sm font-semibold text-gray-900` |
| Body text        | `text-sm`| `normal`  | `gray-600`  | `text-sm text-gray-600`          |
| Label            | `text-sm`| `medium`  | `gray-700`  | `text-sm font-medium text-gray-700` |
| Input text       | `text-sm`| `normal`  | `gray-900`  | `text-sm text-gray-900`          |
| Badge text       | `text-xs`| `medium`  | variant     | `text-xs font-medium`            |
| Small label      | `text-xs`| `medium`  | `gray-500`  | `text-xs font-medium text-gray-500 uppercase tracking-wide` |
| Helper text      | `text-xs`| `normal`  | `gray-500`  | `text-xs text-gray-500`          |
| Error text       | `text-sm`| `normal`  | `red-600`/`red-700` | `text-sm text-red-600` or `text-red-700` |
| Link text        | `text-sm`| `medium`  | `blue-600`  | `text-sm font-medium text-blue-600 hover:text-blue-500` |
| Monospace/code   | `text-xs`| `normal`  | `gray-900`  | `text-xs font-mono bg-white px-2 py-1 rounded border border-gray-200` |

### 2.3 Spacing and Layout Constants

| Constant             | Value   | Usage                                         |
|----------------------|---------|-----------------------------------------------|
| Sidebar width        | `w-64`  | Fixed sidebar (256px)                         |
| Content max-width    | varies  | Per page (see individual specs)               |
| Card padding         | `px-6 py-4` | CardHeader, CardBody, CardFooter          |
| Card border radius   | `rounded-lg` | All cards                                |
| Button border radius | `rounded-md` | All buttons                            |
| Input border radius  | `rounded-md` | All inputs                            |
| Badge border radius  | `rounded-full` | All badges                          |
| Page padding (main)  | `p-6`   | `<main>` inside AppLayout                     |
| Section gap          | `space-y-6` | Vertical spacing between page sections    |
| Card gap (grid)      | `gap-4` | Between grid cards                            |

### 2.4 Shadows and Borders

| Element    | Shadow             | Border                    |
|------------|--------------------|---------------------------|
| Card       | `shadow-sm`        | `border border-gray-200`  |
| Modal      | `shadow-xl`        | None (white bg on overlay)|
| Sidebar    | None               | `border-r border-gray-200`|
| Header     | None               | `border-b border-gray-200`|

---

## 3. Reusable UI Components

### 3.1 Button

**Props:**
- `variant`: `primary` | `secondary` | `danger` | `ghost` (default: `primary`)
- `size`: `sm` | `md` | `lg` (default: `md`)
- `loading`: boolean (default: `false`)
- `disabled`: boolean
- All standard HTML button attributes

**Variant Styles:**

| Variant   | Background      | Text      | Hover           | Focus Ring       |
|-----------|-----------------|-----------|-----------------|------------------|
| primary   | `bg-blue-600`   | `white`   | `hover:bg-blue-700` | `ring-blue-500` |
| secondary | `bg-gray-100`   | `gray-900`| `hover:bg-gray-200` | `ring-gray-400` |
| danger    | `bg-red-600`    | `white`   | `hover:bg-red-700`  | `ring-red-500`  |
| ghost     | `bg-transparent`| `gray-700`| `hover:bg-gray-100` | `ring-gray-400` |

**Size Styles:**

| Size | Padding        | Text Size  |
|------|----------------|------------|
| sm   | `px-3 py-1.5`  | `text-sm`  |
| md   | `px-4 py-2`    | `text-sm`  |
| lg   | `px-6 py-3`    | `text-base`|

**Shared Styles (all variants):**
- `inline-flex items-center justify-center rounded-md font-medium transition-colors`
- `focus-visible:outline-2 focus-visible:outline-offset-2`
- `disabled:opacity-50 disabled:cursor-not-allowed`

**Loading State:**
- Button is disabled during loading
- A spinning SVG icon (`animate-spin`, `h-4 w-4`) appears to the left of the button text with `-ml-1 mr-2`
- Spinner: circle with `opacity-25` + arc path with `opacity-75`, stroke color inherited from text

### 3.2 Input

**Props:**
- `label`: optional string
- `error`: optional string (error message)
- All standard HTML input attributes

**Structure:**
```
<div class="w-full">
  <label> (if label provided)
  <input />
  <p> (if error provided)
</div>
```

**Label:**
- `block text-sm font-medium text-gray-700 mb-1`
- `htmlFor` is auto-generated from label: lowercase, spaces replaced with hyphens

**Input Field:**
- `w-full rounded-md border px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400`
- Default border: `border-gray-300`
- Error border: `border-red-300`
- Focus: `focus:outline-2 focus:outline-offset-0 focus:outline-blue-500`
- Error focus: `focus:outline-red-500`
- Disabled: `disabled:cursor-not-allowed disabled:opacity-50`

**Error Message:**
- `mt-1 text-sm text-red-600`

### 3.3 Card

**Sub-components:** `Card`, `CardHeader`, `CardBody`, `CardFooter`

| Component    | Classes                                      | Purpose                    |
|--------------|----------------------------------------------|----------------------------|
| Card         | `rounded-lg border border-gray-200 bg-white shadow-sm` | Container            |
| CardHeader   | `px-6 py-4 border-b border-gray-200`         | Top section with title     |
| CardBody     | `px-6 py-4`                                  | Main content area          |
| CardFooter   | `px-6 py-4 border-t border-gray-200`         | Bottom action area         |

All accept `className` prop for extension. All use `HTMLAttributes<HTMLDivElement>`.

### 3.4 Badge

**Props:**
- `variant`: `default` | `success` | `warning` | `danger` | `info` (default: `default`)
- `children`: ReactNode
- `className`: optional string

**Variant Styles:**

| Variant   | Background       | Text           |
|-----------|------------------|----------------|
| default   | `bg-gray-100`    | `text-gray-700`|
| success   | `bg-green-100`   | `text-green-700`|
| warning   | `bg-yellow-100`  | `text-yellow-700`|
| danger    | `bg-red-100`     | `text-red-700` |
| info      | `bg-blue-100`    | `text-blue-700`|

**Base Styles:**
- `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium`

**Helper Functions:**

`domainStatusBadge(status)` returns `{ variant, label }`:
- `VERIFIED` -> `{ success, 'Verified' }`
- `PENDING` -> `{ warning, 'Pending' }`
- `DISABLED` -> `{ danger, 'Disabled' }`
- default -> `{ default, status }`

`onboardingStatusBadge(status)` returns `{ variant, label }`:
- `COMPLETED` -> `{ success, 'Complete' }`
- `IN_PROGRESS` -> `{ info, 'In Progress' }`
- `DOMAIN_PENDING` -> `{ warning, 'Domain Pending' }`
- `NOT_STARTED` -> `{ default, 'Not Started' }`
- default -> `{ default, status }`

### 3.5 Modal

**Props:**
- `open`: boolean
- `onClose`: callback
- `title`: optional string
- `children`: ReactNode

**Behavior:**
- When `open` is `true`, renders a fixed overlay at `z-50`
- Backdrop: `fixed inset-0 bg-black/50`, clicking it calls `onClose`
- Pressing `Escape` key calls `onClose`
- `document.body.style.overflow` is set to `'hidden'` when open, restored on close/unmount
- Content: `relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6`
- If `title` is provided: renders a header row with title (`text-lg font-semibold text-gray-900`) and an X close button (`text-gray-400 hover:text-gray-600`)
- Close button: SVG with `h-5 w-5`, renders an X icon
- Clicking inside the content panel does NOT close the modal (stopPropagation)

---

## 4. Layout System

### 4.1 AppLayout

**Structure:**
```
<div class="min-h-screen bg-gray-50">
  <Sidebar />              (fixed, left)
  <div class="transition-all duration-200 [margin-left based on sidebar state]">
    <Header />             (sticky, top)
    <main class="p-6">
      <Outlet />           (page content)
    </main>
  </div>
</div>
```

**Main Content Margin:**
- Sidebar open: `lg:ml-64 ml-64` (256px offset on all viewports when sidebar is toggled open)
- Sidebar closed: `ml-0`
- Transition: `transition-all duration-200`

**Responsive Behavior:**
- Desktop (>= 1024px): Sidebar is always open, margin always applied
- Mobile/Tablet (< 1024px): Sidebar hidden by default, toggled via hamburger. When open, sidebar slides in from left with overlay backdrop

### 4.2 Sidebar

**Structure:**
```
<aside class="fixed top-0 left-0 z-40 h-full w-64 bg-white border-r border-gray-200 transition-transform duration-200">
  [Logo section]
  [Navigation]
  [User section (absolute bottom)]
</aside>
```

**Logo Section (top):**
- `flex items-center gap-2 px-6 py-5 border-b border-gray-200`
- Logo: `h-8 w-8 rounded-lg bg-blue-600` with white "RQ" text (`text-sm font-bold`)
- Brand name: `text-lg font-semibold text-gray-900` reading "ReplyIQ"

**Navigation:**
- Container: `px-3 py-4 space-y-1`
- Each item is a `NavLink` with:
  - `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors`
  - Active state: `bg-blue-50 text-blue-700`
  - Inactive state: `text-gray-700 hover:bg-gray-100`
  - Icon: `h-5 w-5 shrink-0` SVG, inline stroke icons
- Navigation items:
  1. **Dashboard** -> `/dashboard` (exact match, `end` prop)
  2. **Settings** -> `/dashboard/settings`
  3. **Domains** -> `/dashboard/domains`

**User Section (bottom):**
- Positioned: `absolute bottom-0 left-0 right-0 border-t border-gray-200 p-4`
- User avatar: `h-8 w-8 rounded-full bg-gray-200` with first letter of name (`text-sm font-medium text-gray-600`)
- User name: `text-sm font-medium text-gray-900 truncate`
- User email: `text-xs text-gray-500 truncate`
- Sign out button: `w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors`

**Mobile Behavior:**
- Overlay: When sidebar is open on mobile, a `fixed inset-0 bg-black/50 z-30 lg:hidden` overlay appears; clicking it closes the sidebar
- Sidebar visibility: controlled by `translate-x-0` (open) or `-translate-x-full` (closed)
- Auto-close: Clicking any navigation link on mobile (< 1024px) closes the sidebar

### 4.3 Header

**Structure:**
```
<header class="sticky top-0 z-20 bg-white border-b border-gray-200 px-6 py-4">
  <div class="flex items-center gap-4">
    [Hamburger button (mobile only)]
    <h1 class="text-xl font-semibold text-gray-900">{pageTitle}</h1>
  </div>
</header>
```

**Page Titles Map:**
| Route                | Title              |
|----------------------|--------------------|
| `/dashboard`         | Dashboard          |
| `/onboarding`        | Setup              |
| `/dashboard/settings`| Business Settings  |
| `/dashboard/domains` | Domains            |
| (unmatched)          | ReplyIQ            |

**Hamburger Button:**
- Visible only on mobile: `lg:hidden`
- `text-gray-500 hover:text-gray-700`
- SVG icon: `h-6 w-6`, three horizontal lines (hamburger)
- `aria-label="Toggle sidebar"`
- Toggles sidebar open/close state

---

## 5. Page Specifications

---

### 5.1 Login Page

**Route:** `/login`
**Auth:** Not required (redirects to dashboard if already authenticated -- handled by route guard)
**Layout:** Standalone (no sidebar, no header)

**Purpose:** Allow existing users to authenticate with email and password.

**Overall Layout:**
- Full viewport height, centered content
- `min-h-screen flex items-center justify-center bg-gray-50`
- Content wrapper: `w-full max-w-sm px-6`

**Logo and Header Section (top of card, outside white card):**
- Centered: `text-center mb-8`
- Logo mark: `mx-auto h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center mb-4`
  - White text "RQ" inside: `text-white font-bold text-lg`
- Title: `ReplyIQ` -- `text-2xl font-bold text-gray-900`
- Subtitle: `Sign in to your dashboard` -- `mt-1 text-sm text-gray-500`

**Form Card:**
- `bg-white rounded-lg shadow-sm border border-gray-200 p-6`

**Error Banner (conditional):**
- Shown when `error` state is non-empty
- `role="alert"` for accessibility
- `mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700`

**Form Fields (vertical stack, `space-y-4`):**

1. **Email Input**
   - Label: "Email"
   - Type: `email`
   - Required: yes
   - Placeholder: "you@company.com"
   - `autoComplete="email"`

2. **Password Input**
   - Label: "Password"
   - Type: `password`
   - Required: yes
   - Placeholder: "Enter your password"
   - `autoComplete="current-password"`

**Submit Button:**
- Text: "Sign in"
- Variant: `primary` (default)
- Width: `w-full` (full width of card)
- Loading state: shows spinner, button disabled

**Footer (below card):**
- `mt-6 text-center text-sm text-gray-500`
- Text: "Don't have an account? " with link "Get started"
- Link: routes to `/register`, `font-medium text-blue-600 hover:text-blue-500`

**Validation:**
- HTML5 required attribute on both fields
- Browser-native email validation via `type="email"`
- No custom client-side validation beyond HTML5

**Error States:**
- API error: displayed in the red error banner at top of card
- Network error: displays "An error occurred. Please try again."

**Success State:**
- On successful login, user is navigated to `/dashboard` with `replace: true`

---

### 5.2 Register Page

**Route:** `/register`
**Auth:** Not required
**Layout:** Standalone (no sidebar, no header)

**Purpose:** Allow new users to create a workspace with business and owner information.

**Overall Layout:**
- Identical to Login page: `min-h-screen flex items-center justify-center bg-gray-50`
- Content wrapper: `w-full max-w-sm px-6`

**Logo and Header Section:**
- Same as Login page
- Subtitle: `Create your workspace`

**Form Card:**
- Same container as Login: `bg-white rounded-lg shadow-sm border border-gray-200 p-6`

**Error Banner:**
- Same as Login page

**Form Fields (vertical stack, `space-y-4`):**

1. **Business Name**
   - Label: "Business name"
   - Type: `text`
   - Required: yes
   - Placeholder: "Acme Inc."
   - `autoComplete="organization"`

2. **Your Name**
   - Label: "Your name"
   - Type: `text`
   - Required: yes
   - Placeholder: "Jane Smith"
   - `autoComplete="name"`

3. **Email**
   - Label: "Email"
   - Type: `email`
   - Required: yes
   - Placeholder: "you@company.com"
   - `autoComplete="email"`

4. **Password**
   - Label: "Password"
   - Type: `password`
   - Required: yes
   - Placeholder: "Min 12 characters"
   - `autoComplete="new-password"`

**Submit Button:**
- Text: "Create workspace"
- Width: `w-full`
- Loading state: shows spinner, button disabled

**Footer:**
- Text: "Already have an account? " with link "Sign in"
- Link: routes to `/login`

**Validation:**
- HTML5 required on all fields
- Email validation via `type="email"`
- Password minimum 12 characters enforced server-side (placeholder hints at this)

**Error States:**
- Same pattern as Login: API errors in red banner, network errors generic message

**Success State:**
- On successful registration, user data is stored, user is navigated to `/onboarding` with `replace: true`

---

### 5.3 Dashboard Page

**Route:** `/dashboard`
**Auth:** Required
**Layout:** AppLayout (sidebar + header)

**Purpose:** Overview of business status, onboarding progress, and quick access to settings.

**Page Title (in Header):** "Dashboard"

**Layout Container:** `space-y-6` (vertical stack of cards)

**Loading State:**
- Skeleton: single card placeholder
- `bg-white rounded-lg border border-gray-200 p-6 animate-pulse`
- Contains: title bar (`h-5 w-48`), subtitle (`h-4 w-72`), two buttons (`h-9 w-28`, `h-9 w-36`)
- All skeleton elements: `bg-gray-200 rounded`

**Section 1: Welcome Card**

- Component: `Card` > `CardBody`
- Content:
  - Top row: `flex items-center justify-between mb-2`
    - Greeting: `Welcome, {userName}` -- `text-lg font-semibold text-gray-900`
    - Status badge: uses `onboardingStatusBadge()` helper
  - Description text (`text-sm text-gray-600 mb-4`):
    - If status is `COMPLETED`: "Your business is set up and ready for knowledge ingestion."
    - Otherwise: "Complete your business setup to get started with your AI Receptionist."
  - Conditional button:
    - If status is NOT `COMPLETED`: "Continue Setup" button wrapped in a `Link` to `/onboarding`
    - Button variant: `primary` (default), no size override

**Section 2: Setup Progress Card (conditional)**

- Only shown when onboarding data exists AND status is NOT `COMPLETED`
- Component: `Card` > `CardHeader` + `CardBody`
- CardHeader title: "Setup Progress" (`text-sm font-semibold text-gray-900`)

**Progress Bar:**
- Container: `flex items-center gap-3 mb-3`
- Track: `flex-1 bg-gray-200 rounded-full h-2`
- Fill: `bg-blue-600 h-2 rounded-full transition-all`
  - Width set via inline `style={{ width: '{percent}%' }}`
- Percentage label: `{percent}%` -- `text-sm font-medium text-gray-600`

**Step List:**
- Container: `space-y-2`
- Each step row: `flex items-center gap-3`
- Step circle:
  - Size: `h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium`
  - Completed: `bg-green-100 text-green-700` with checkmark SVG (`h-3.5 w-3.5`)
  - Not completed: `bg-gray-100 text-gray-500` with step number
- Step label: `text-sm`
  - Completed: `text-gray-500`
  - Not completed: `text-gray-900`

**Section 3: Stats Grid (conditional)**

- Only shown when business data is loaded
- Grid: `grid grid-cols-1 md:grid-cols-3 gap-4`
- 3 cards:

**Card 1: Business Info**
- Label: "BUSINESS" (`text-xs font-medium text-gray-500 uppercase tracking-wide`)
- Business name: `mt-1 text-sm font-semibold text-gray-900`
- Industry (if present): `mt-0.5 text-xs text-gray-500`

**Card 2: Website**
- Label: "WEBSITE"
- If URL exists: link (`mt-1 text-sm font-semibold text-blue-600 hover:text-blue-700 truncate block`), opens in new tab
- If no URL: `mt-1 text-sm text-gray-400` reading "Not set"

**Card 3: Quick Links**
- Label: "QUICK LINKS"
- Links list: `mt-2 space-y-1`
  - "Business Settings" -> `/dashboard/settings`
  - "Manage Domains" -> `/dashboard/domains`
- Each link: `block text-sm text-blue-600 hover:text-blue-700`

---

### 5.4 Onboarding Page

**Route:** `/onboarding`
**Auth:** Required
**Layout:** AppLayout (sidebar + header)

**Purpose:** Step-by-step wizard to complete business setup (profile, domain, verification, completion).

**Page Title (in Header):** "Setup"

**Layout Container:** `max-w-2xl mx-auto space-y-6`

**Loading State:**
- Skeleton: 3 stacked card placeholders
- Each: `bg-white rounded-lg border border-gray-200 p-6 animate-pulse`
- Content: title bar (`h-5 w-40`), body (`h-4 w-64`)

**Completed State (all steps done):**
- Single centered card: `max-w-2xl mx-auto`
- CardBody: `text-center py-12`
- Green circle: `mx-auto h-16 w-16 rounded-full bg-green-100` with checkmark SVG (`h-8 w-8 text-green-600`)
- Title: "Onboarding Complete" (`text-lg font-semibold text-gray-900 mb-2`)
- Description: "Your business is set up and ready for knowledge ingestion." (`text-sm text-gray-600 mb-6`)
- Button: "Go to Dashboard" -- navigates to `/dashboard`

**Active Onboarding Layout:**

**Header Section:**
- Title: "Business Setup" (`text-lg font-semibold text-gray-900`)
- Subtitle: "Complete the steps below to get your business ready." (`text-sm text-gray-600`)

**Step Progress Bar:**
- Container: `flex gap-2`
- 4 segments (one per step), each: `h-1.5 flex-1 rounded-full`
  - Completed: `bg-green-500`
  - Active (current): `bg-blue-500`
  - Pending: `bg-gray-200`

**Step List:**
- Container: `space-y-3`
- Each step card: `flex items-center gap-3 p-3 rounded-lg border transition-colors`
  - Active: `border-blue-300 bg-blue-50`
  - Completed: `border-green-200 bg-green-50`
  - Pending: `border-gray-200`
- Step circle: `h-7 w-7 rounded-full` (slightly larger than dashboard version)
  - Completed: `bg-green-100 text-green-700` with checkmark
  - Active: `bg-blue-100 text-blue-700` with step number
  - Pending: `bg-gray-100 text-gray-500` with step number
- Step label: `text-sm font-medium text-gray-900`

**Error Banner (conditional):**
- `p-3 rounded-lg bg-red-50 border border-red-200`
- `text-sm text-red-700`

**Active Step Card:**
- Component: `Card` > `CardHeader` + `CardBody`
- CardHeader: shows label of the current step
- CardBody: renders step-specific content

---

#### Step 0: Profile

**Purpose:** Collect business profile details.

**Description:** "Tell us about your business to personalize your experience." (`text-sm text-gray-600`)

**Form Fields (vertical stack, `space-y-4`):**

1. **Industry**
   - Label: "Industry"
   - Placeholder: "e.g. SaaS, Healthcare, E-commerce"
   - Optional (no `required`)

2. **Description**
   - Label: "Description"
   - Placeholder: "Brief description of your business"
   - Optional

3. **Website URL**
   - Label: "Website URL"
   - Type: `url`
   - Placeholder: "https://example.com"
   - Optional

**Action Button:**
- Text: "Save & Continue"
- Positioned: `flex justify-end` (right-aligned)
- Loading state: spinner during business update and step update mutations

---

#### Step 1: Domain

**Purpose:** Add a website domain for verification.

**Description:** "Add your website domain for verification." (`text-sm text-gray-600`)

**Domain Input:**
- Label: "Domain"
- Placeholder: "example.com"
- Error state supported (field-level validation)

**Existing Domains List (conditional):**
- Shown when `domains.length > 0`
- Label: "Existing domains" (`text-xs font-medium text-gray-500 mb-2`)
- Each domain row: `flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors`
  - Selected: `border-blue-500 bg-blue-50`
  - Unselected: `border-gray-200 hover:bg-gray-50`
- Domain name: `text-sm text-gray-900`
- Status text: `text-xs text-green-600` (Verified) or `text-xs text-yellow-600` (Pending)

**Action Button:**
- Text: "Add Domain"
- Positioned right
- Disabled when input is empty: `!domainInput.trim()`
- Loading state during mutation

**Domain Validation (client-side):**
- Must not be empty after trim
- Must match regex: `^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z]{2,}$`
- Normalization: strips `https://`, `http://`, `www.`, trailing slashes, trims and lowercases
- Error: "Please enter a valid domain name" or "Enter a domain like example.com (without https:// or www.)"

---

#### Step 2: Verification

**Purpose:** Verify ownership of the selected domain.

**Description:** "Verify ownership of **{domain}**." (domain name is bolded)

**Already Verified State:**
- Green banner: `p-3 rounded-lg bg-green-50 border border-green-200`
- Text: "Domain is already verified." (`text-sm text-green-700 font-medium`)
- Action button: "Continue" (right-aligned) -- advances to next step

**Not Verified State:**

**Method Selection (radio buttons):**
- Container: `space-y-3`

1. **DNS TXT Record**
   - Container: `flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50`
   - Radio: `h-4 w-4 text-blue-600`
   - Title: "DNS TXT Record" (`text-sm font-medium text-gray-900`)
   - Subtitle: "Add a TXT record to your DNS (recommended)" (`text-xs text-gray-500`)

2. **HTML File** (`HTML_META` method)
    - Same layout
    - Title: "HTML File"
    - Subtitle: "Upload an HTML file to your website (fallback)"
    - Reconciliation note: the implemented `HTML_META` check fetches a fixed-path verification file (`/replyiq-verification.html (legacy; the meta tag is now the primary placement)`) whose body must equal the token string exactly; it does not scan `<meta>` tags. Label reflects the actual mechanism.

**Instructions Panel (conditional, when instructions are loaded):**
- Container: `p-3 rounded-lg bg-gray-50 border border-gray-200`

For DNS TXT:
- Title: "DNS Setup Instructions" (`text-sm font-medium text-gray-900`)
- Description: "Add a TXT record with the following details:" (`text-xs text-gray-600`)
- Record Name: label (`text-xs font-medium text-gray-500`) + code block (`block text-xs bg-white px-2 py-1 rounded border border-gray-200 mt-0.5 font-mono`)
- Record Value: same layout
- Note: "DNS propagation can take up to 48 hours. You can retry verification after a few minutes." (`text-xs text-gray-500 mt-2`)

For HTML Meta:
- Title: "HTML File Instructions"
- Description: references `/{htmlFileName}` path (inline code)
- Content: `block text-xs bg-white px-2 py-1 rounded border border-gray-200 font-mono whitespace-pre-wrap`

**Verification Pending Banner (conditional):**
- Shown after verification attempt if domain is not yet verified
- `p-3 rounded-lg bg-yellow-50 border border-yellow-200`
- Current API message surfaced verbatim: "Verification pending -- challenge record not yet reachable. Retry shortly." (`text-sm text-yellow-700`)
- [PROPOSED] friendlier copy (requires stable error codes first): "We couldn't see your verification file yet. Double-check it's published at the address shown above, then try again in a few minutes."

**Verifying In-Progress Banner (conditional):**
- `p-3 rounded-lg bg-blue-50 border border-blue-200`
- Text: "Verifying domain... Please wait." (`text-sm text-blue-700`)

**Action Button:**
- Text: "Verify Domain" (or "Verifying..." during pending)
- Right-aligned
- Disabled when already verified
- Loading state during verification

---

#### Step 3: Complete

**Purpose:** Confirm onboarding is finished and transition to the dashboard.

**Layout:** Centered content within card body (`text-center py-4`)

**Success Icon:**
- Green circle: `mx-auto h-16 w-16 rounded-full bg-green-100`
- Checkmark: `h-8 w-8 text-green-600`

**Title:** "Ready for Knowledge Ingestion" (`text-lg font-semibold text-gray-900`)

**Description:** "Your business profile is complete and your domain is verified. You're ready to start adding knowledge for your AI Receptionist." (`text-sm text-gray-600`)

**Action Button:**
- Text: "Complete Onboarding"
- Centered (implied by parent `text-center`)
- Loading state during step update

---

### 5.5 Business Settings Page

**Route:** `/dashboard/settings`
**Auth:** Required
**Layout:** AppLayout (sidebar + header)

**Purpose:** Allow users to edit their business profile information.

**Page Title (in Header):** "Business Settings"

**Layout Container:** `max-w-2xl mx-auto`

**Loading State:**
- Skeleton card: `bg-white rounded-lg border border-gray-200 p-6 animate-pulse`
- Title bar: `h-5 w-40 mb-4`
- 3 field groups: each has label (`h-4 w-24 mb-2`) + input (`h-9`)

**Card Structure:**
- `Card` wrapping the entire form
- CardHeader: title "Business Settings" (`text-lg font-semibold text-gray-900`) + subtitle "Manage your business profile and details." (`text-sm text-gray-600 mt-1`)
- CardBody: `space-y-4` containing form fields
- CardFooter: `flex justify-end` with submit button

**Form Fields:**

1. **Business Name**
   - Label: "Business Name"
   - Required: yes
   - No placeholder

2. **Industry**
   - Label: "Industry"
   - Placeholder: "e.g. SaaS, Healthcare, E-commerce"
   - Optional

3. **Description**
   - Label: "Description"
   - Placeholder: "Brief description of your business"
   - Optional

4. **Website URL**
   - Label: "Website URL"
   - Type: `url`
   - Placeholder: "https://example.com"
   - Optional

**Submit Button (in CardFooter):**
- Text: "Save Changes"
- Type: `submit`
- Loading state during mutation

**Error Banner (conditional):**
- `p-3 rounded-lg bg-red-50 border border-red-200`
- `text-sm text-red-700`

**Success Banner (conditional):**
- `p-3 rounded-lg bg-green-50 border border-green-200`
- Text: "Settings saved successfully." (`text-sm text-green-700`)
- Appears after successful save, stays visible until next submission attempt

**Behavior:**
- Form is pre-populated from server data on first load (synced via ref to avoid re-render loops)
- The `saved` flag is reset to `false` on each new submission attempt

---

### 5.6 Domains Page

**Route:** `/dashboard/domains`
**Auth:** Required
**Layout:** AppLayout (sidebar + header)

**Purpose:** Manage and verify business domains.

**Page Title (in Header):** "Domains"

**Layout Container:** `max-w-4xl space-y-6`

**Page Header:**
- Title: "Domains" (`text-lg font-semibold text-gray-900`)
- Subtitle: "Manage and verify your business domains." (`text-sm text-gray-600`)

---

#### Section 1: Add Domain Card

- Component: `Card` > `CardHeader` + `CardBody`
- CardHeader title: "Add Domain" (`text-sm font-semibold text-gray-900`)
- CardBody: `flex gap-3 items-end` (input and button aligned to bottom)
  - Input wrapper: `flex-1`
    - Label: "Domain"
    - Placeholder: "example.com"
    - Error state supported
    - `onKeyDown`: Enter key triggers add
  - Button: "Add Domain"
    - Loading state during mutation
    - Disabled when input is empty

---

#### Section 2: Error Banner (conditional)

- `p-3 rounded-lg bg-red-50 border border-red-200`
- `text-sm text-red-700`

---

#### Section 3: Your Domains Card

- Component: `Card` > `CardHeader` + `CardBody`
- CardHeader title: "Your Domains" (`text-sm font-semibold text-gray-900`)

**Loading State:**
- 2 skeleton rows: each `flex items-center justify-between p-3 rounded-lg border border-gray-200 animate-pulse`
- Left: `h-4 bg-gray-200 rounded w-40`
- Right: `h-4 bg-gray-200 rounded w-16`

**Empty State:**
- Text: "No domains added yet." (`text-sm text-gray-500`)

**Domain List:**
- Container: `space-y-3`
- Each domain row: `flex items-center justify-between p-3 rounded-lg border border-gray-200`

**Domain Row Content:**
- Left side: `flex items-center gap-3`
  - Domain info block:
    - Domain name: `text-sm font-medium text-gray-900`
    - Status: `text-xs text-gray-500` prefix "Status: " followed by colored status text
      - Verified: `text-green-600 font-medium` reading "Verified"
      - Pending: `text-yellow-600 font-medium` reading "Pending"
- Right side: `flex items-center gap-2`
  - Verify button (only for non-verified domains):
    - Size: `sm`
    - Text: "Verify"
    - Opens verify modal
  - Delete button:
    - Size: `sm`
    - Variant: `danger`
    - Text: "Delete"
    - Loading state during mutation

---

#### Verify Modal

**Trigger:** Clicking "Verify" button on a pending domain

**Structure:**
- Fixed overlay: `fixed inset-0 z-50 flex items-center justify-center bg-black/40`
  - Clicking backdrop calls `onClose`
- Content panel: `bg-white rounded-xl shadow-lg w-full max-w-lg p-6 space-y-4`
  - Clicking inside does NOT close (stopPropagation)

**Header:**
- `flex items-center justify-between`
- Title: "Verify {domain}" (`text-base font-semibold text-gray-900`)
- Close button: `&times;` character (`text-gray-400 hover:text-gray-600 text-xl leading-none`)

**Already Verified State:**
- Green banner: `p-3 rounded-lg bg-green-50 border border-green-200`
- Text: "This domain is already verified." (`text-sm text-green-700 font-medium`)

**Not Verified State:**

**Method Selection:**
- Two radio button options, same layout as onboarding Step 2
- DNS TXT Record and HTML File (`HTML_META` = fixed-path verification file; see Step 2 reconciliation note)
- Radio: `h-4 w-4 text-blue-600`
- Each option: `flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50`

**Instructions Panel:**
- Same as onboarding Step 2

**Error Banner (conditional):**
- Same red banner pattern

**Verifying In-Progress Banner:**
- Blue: `p-3 rounded-lg bg-blue-50 border border-blue-200`
- Text: "Verifying... Please wait."

**Verification Pending Banner:**
- Yellow: `p-3 rounded-lg bg-yellow-50 border border-yellow-200`
- Text (API message surfaced verbatim): "Verification pending -- challenge record not yet reachable. Retry shortly."

**Action Buttons (footer):**
- `flex justify-end gap-2`
- Cancel button: variant `secondary`, text "Cancel", calls `onClose`
- Verify button: variant `primary` (default), text "Verify", loading state during mutation

---

## 6. Global States

### 6.1 Loading States

All pages use skeleton loaders with `animate-pulse` to indicate loading.

**Skeleton Pattern:**
- Base: `bg-white rounded-lg border border-gray-200 p-6`
- Placeholder bars: `bg-gray-200 rounded` with varying widths (`w-24`, `w-40`, `w-48`, `w-64`, `w-72`)
- Heights: `h-4` for text lines, `h-5` for titles, `h-9` for buttons/inputs
- Animation: `animate-pulse` class (Tailwind default: opacity pulses between 0.5 and 1)

**Page-Specific Skeletons:**
- Dashboard: Single card with title, subtitle, two buttons
- Onboarding: 3 stacked card placeholders
- Business Settings: Card with title and 3 field groups
- Domains list: 2 row placeholders

### 6.2 Empty States

| Page          | Condition          | Message                          |
|---------------|--------------------|----------------------------------|
| Domains       | No domains         | "No domains added yet."          |
| Dashboard     | No website URL     | "Not set" (in Website card)      |

### 6.3 Error States

**Error Banner Pattern (global):**
- `p-3 rounded-lg bg-red-50 border border-red-200`
- `text-sm text-red-700`
- Appears at top of form or card content area

**Error Sources:**
- API errors: extracted via `getErrorMessage()` utility (`apps/web/src/api/client.ts`). As implemented, this surfaces the raw backend `message` string verbatim — including technical copy such as "Verification failed. Ensure the challenge record is published correctly."
- Network errors: generic "An error occurred. Please try again."

**[PROPOSED] Error translation layer:** map stable machine-readable API error codes (see 09-API-SPECIFICATION.md §1.7 note and 15-ROADMAP.md) to human-friendly UI copy so internal jargon never reaches users. Not implemented; blocked on backend error-code registry.

**Pages with Error Banners:**
- Login page (inside card, `mb-4`)
- Register page (inside card, `mb-4`)
- Onboarding page (below step list, above active card)
- Business Settings (inside card body)
- Domains page (between Add Domain card and Your Domains card)
- Verify modal (inside modal content)

### 6.4 Success States

| Page              | Condition                | Display                                              |
|-------------------|--------------------------|------------------------------------------------------|
| Business Settings | After save               | Green banner: "Settings saved successfully."         |
| Onboarding        | Step 2 verified          | Green banner: "Domain is already verified."          |
| Onboarding        | All steps complete       | Full-page completion card with green circle + check  |
| Verify Modal      | Domain verified          | Green banner: "This domain is already verified."     |

### 6.5 Confirmation States

**Domain Deletion — IMPLEMENTED (hardening loop 2026-08-24):**
- A confirmation dialog (modal) opens on Delete button click; the domain name is shown in the dialog body
- Verified domains display an additional warning that deleting the last verified domain of a completed business is blocked by the server (`DOMAIN_LAST_VERIFIED_CONFIRM_REQUIRED` → translated copy via the error-code layer)
- Deletion only fires after explicit confirm; cancel dismisses with no API call
- Domain list updates after successful API response (backend performs a soft delete)

**Note:** Previously deletion fired immediately; the confirmation dialog was approved as roadmap item R10 and is now shipped in `apps/web/src/pages/DomainsPage.tsx`.

### 6.6 In-Progress / Pending States

| Page          | Condition              | Display                                           |
|---------------|------------------------|---------------------------------------------------|
| Onboarding    | Verifying domain       | Blue banner: "Verifying domain... Please wait."   |
| Onboarding    | Verification pending   | Yellow banner with retry instructions             |
| Verify Modal  | Verifying domain       | Blue banner: "Verifying... Please wait."          |
| Verify Modal  | Verification pending   | Yellow banner with retry instructions             |
| All buttons   | Loading                | Spinner icon + disabled state                     |

---

## 7. Modals

### 7.1 Generic Modal Component

- Overlay: `fixed inset-0 z-50 flex items-center justify-center`
- Backdrop: `fixed inset-0 bg-black/50`, clickable to close
- Content: `relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6`
- Optional title with close button
- Escape key closes
- Body scroll locked when open
- Click propagation stopped on content panel

### 7.2 Verify Modal (Custom Implementation)

- Uses the same visual pattern but is implemented as a standalone component (not using the generic Modal component)
- Overlay: `bg-black/40` (slightly lighter than generic)
- Content: `bg-white rounded-xl shadow-lg` (rounded-xl instead of rounded-lg)
- Close button: HTML `&times;` character instead of SVG
- Size: `max-w-lg`

---

## 8. Forms

### 8.1 Form Patterns

**Layout:**
- Vertical stacking with `space-y-4` between fields
- Labels above inputs
- Error messages below inputs
- Action buttons right-aligned (`flex justify-end`) or full-width

**Validation Approach:**
- Client-side: HTML5 required attribute, type-based validation (email, url)
- Server-side: validation errors returned in API response, displayed in error banner
- Domain validation: custom regex + normalization (strip protocol, www, trailing slashes)

**Pre-population:**
- Forms that load server data use a `useRef` flag (`hasSyncedForm`/`hasSyncedProfile`) to sync state from server only once
- Prevents infinite re-render loops

**Submission:**
- Loading state disables button and shows spinner
- Error clears on new submission attempt
- Success flags reset on new submission attempt

### 8.2 Domain Input Normalization

The `normalizeDomain()` function is shared between Onboarding and Domains pages:
1. Trim whitespace
2. Lowercase
3. Remove `https://` or `http://` prefix
4. Remove `www.` prefix
5. Remove trailing slashes

---

## 9. Tables and Lists

### 9.1 Domain List

- Not a `<table>` element -- uses stacked card-like rows
- Container: `space-y-3`
- Each row: `flex items-center justify-between p-3 rounded-lg border border-gray-200`
- Left side: domain name + status
- Right side: action buttons

### 9.2 Onboarding Step List

- Vertical stack: `space-y-3`
- Each step: bordered row with circle icon + label
- Visual state changes based on completion and active status

---

## 10. Notifications

### 10.1 Banner Notifications

All notifications in the application use inline banners (not toast notifications).

**Banner Types:**

| Type    | Background     | Border        | Text Class         | Usage                    |
|---------|----------------|---------------|--------------------|--------------------------|
| Error   | `bg-red-50`    | `border-red-200` | `text-red-700` / `text-red-600` | API errors, validation errors |
| Success | `bg-green-50`  | `border-green-200`| `text-green-700`  | Save success, already verified |
| Warning | `bg-yellow-50` | `border-yellow-200`| `text-yellow-700` | Verification pending       |
| Info    | `bg-blue-50`   | `border-blue-200` | `text-blue-700`   | In-progress operations    |

**Standard Banner Structure:**
```
<div class="p-3 rounded-lg bg-{color}-50 border border-{color}-200">
  <p class="text-sm text-{color}-700">{message}</p>
</div>
```

**Error Banners on Auth Pages:**
- Slightly different: `mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700`
- Includes `role="alert"` attribute for screen reader announcement

---

## 11. Responsive Behavior

### 11.1 Breakpoints

| Breakpoint     | Width     | Behavior                                      |
|----------------|-----------|-----------------------------------------------|
| Mobile         | < 768px   | Single column, sidebar hidden                 |
| Tablet         | 768-1023px| Single column, sidebar hidden                 |
| Desktop        | >= 1024px | Sidebar visible, multi-column where applicable|

### 11.2 Sidebar Responsive Behavior

- **Desktop (>= 1024px):**
  - Sidebar always visible (translated in)
  - Main content always offset by `ml-64`
  - Hamburger button hidden (`lg:hidden`)
  - Resize listener sets sidebar to open

- **Mobile/Tablet (< 1024px):**
  - Sidebar hidden by default (translated out)
  - Hamburger button visible
  - Tapping hamburger slides sidebar in from left
  - Dark overlay (`bg-black/50 z-30 lg:hidden`) appears behind sidebar
  - Tapping overlay closes sidebar
  - Tapping any nav link closes sidebar
  - Resize listener closes sidebar when viewport grows to desktop size

### 11.3 Content Responsive Behavior

| Element                | Mobile              | Desktop              |
|------------------------|---------------------|----------------------|
| Stats grid (Dashboard) | Single column       | 3 columns (`md:grid-cols-3`) |
| Login/Register card    | Full width - 24px padding | Full width - 24px padding, max-w-sm |
| Onboarding container   | Full width          | max-w-2xl centered   |
| Business Settings      | Full width          | max-w-2xl centered   |
| Domains page           | Full width          | max-w-4xl            |

### 11.4 Touch Targets

- All buttons meet minimum 44x44px touch target via padding (`px-3 py-1.5` for sm, `px-4 py-2` for md)
- Navigation links have adequate padding (`px-3 py-2`)
- Radio button labels are wrapped in full-width clickable areas (`p-3` padding)

---

## 12. Accessibility Expectations

### 12.1 Keyboard Navigation

- All interactive elements must be focusable
- Focus ring: `focus-visible:outline-2 focus-visible:outline-offset-2` on buttons
- Focus ring color matches variant: `focus-visible:ring-blue-500` (primary), `focus-visible:ring-red-500` (danger), `focus-visible:ring-gray-400` (secondary/ghost)
- Modal: Escape key closes, focus trap within modal content
- Sidebar: Tab order follows visual order (logo -> nav items -> user section)

### 12.2 ARIA Attributes

| Element               | ARIA Attribute       | Value              |
|-----------------------|----------------------|--------------------|
| Error banner (auth)   | `role`               | `alert`            |
| Sidebar toggle button | `aria-label`         | `Toggle sidebar`   |
| Modal close button    | `aria-label`         | `Close`            |

### 12.3 Semantic HTML

- Pages use `<header>`, `<main>`, `<nav>`, `<aside>` elements
- Forms use `<form>` with `onSubmit`
- Labels are associated with inputs via `htmlFor` / `id`
- Input IDs are auto-generated from label text (lowercased, spaces to hyphens)

### 12.4 Color Contrast

- All text colors meet WCAG 2.1 AA contrast ratios against their backgrounds
- Gray-900 on white: ~17:1 (passes AAA)
- Gray-700 on white: ~10:1 (passes AAA)
- Gray-600 on white: ~7:1 (passes AAA)
- Gray-500 on white: ~4.6:1 (passes AA)
- Blue-600 on white: ~5.9:1 (passes AA)
- Status badge text on light backgrounds all meet AA

### 12.5 Screen Reader Considerations

- Error banners use `role="alert"` to announce errors
- Loading states should ideally include `aria-busy` or visually hidden text (current implementation relies on visual skeleton only)
- Navigation items use `NavLink` which renders `<a>` elements (semantic)
- Form inputs have associated labels

### 12.6 Reduced Motion

- `transition-colors` and `transition-all duration-200` used on interactive elements
- `animate-pulse` on skeletons, `animate-spin` on loading spinners
- No `prefers-reduced-motion` media query is currently implemented (recommended future addition)

---

## 13. UX Principles

### 13.1 Progressive Disclosure

- Dashboard only shows setup progress card when onboarding is incomplete
- Onboarding automatically advances to the first incomplete step
- Verification instructions only appear after a method is selected

### 13.2 Immediate Feedback

- Buttons show loading spinners during async operations
- Form fields show inline error messages
- Success/error banners appear immediately after operations complete
- Domain verification shows in-progress state before result

### 13.3 Consistent Patterns

- All forms use the same Input component with consistent label/error styling
- All cards use the same Card/CardHeader/CardBody/CardFooter structure
- All error banners follow the same red-50/red-200/red-700 pattern
- All success banners follow the same green-50/green-200/green-700 pattern

### 13.4 Error Recovery

- Error banners clear when user attempts a new action
- Domain input validation provides specific, actionable error messages
- Network errors display a generic but helpful message
- Users can retry failed operations without page reload

### 13.5 Data Minimization

- Forms only ask for necessary information
- Optional fields are clearly not marked as required
- Onboarding steps are minimal (3 fields for profile, 1 for domain)

### 13.6 Navigation Clarity

- Active page is highlighted in sidebar (`bg-blue-50 text-blue-700`)
- Header always shows current page title
- Quick links on dashboard provide shortcuts to common actions
- "Continue Setup" CTA when onboarding is incomplete

### 13.7 Mobile-First Adaptations

- Sidebar collapses to hamburger menu on small screens
- Grid layouts collapse to single column
- Content containers go full-width on small screens
- Touch-friendly button sizes maintained across all viewports

### 13.8 State Persistence

- Auth state persisted via Zustand store (access token, refresh token, user data)
- Form state uses React `useState` (not persisted across navigation)
- Business data fetched from server on each page load (React Query caching)
- UI state (sidebar open/closed) managed via Zustand, responsive to viewport changes

---

## 14. File and Component Reference

### 14.1 Source File Locations

| Component/File         | Path                                                     |
|------------------------|----------------------------------------------------------|
| Login Page             | `apps/web/src/pages/LoginPage.tsx`                       |
| Register Page          | `apps/web/src/pages/RegisterPage.tsx`                    |
| Dashboard Page         | `apps/web/src/pages/DashboardPage.tsx`                   |
| Onboarding Page        | `apps/web/src/pages/OnboardingPage.tsx`                  |
| Business Settings Page | `apps/web/src/pages/BusinessSettingsPage.tsx`            |
| Domains Page           | `apps/web/src/pages/DomainsPage.tsx`                     |
| App (Router)           | `apps/web/src/App.tsx`                                   |
| Button                 | `apps/web/src/components/ui/Button.tsx`                  |
| Input                  | `apps/web/src/components/ui/Input.tsx`                   |
| Card                   | `apps/web/src/components/ui/Card.tsx`                    |
| Badge                  | `apps/web/src/components/ui/Badge.tsx`                   |
| Modal                  | `apps/web/src/components/ui/Modal.tsx`                   |
| AppLayout              | `apps/web/src/components/layout/AppLayout.tsx`           |
| Sidebar                | `apps/web/src/components/layout/Sidebar.tsx`             |
| Header                 | `apps/web/src/components/layout/Header.tsx`              |
| ProtectedRoute         | `apps/web/src/components/auth/ProtectedRoute.tsx`        |
| Auth Store             | `apps/web/src/stores/auth.store.ts`                      |
| UI Store               | `apps/web/src/stores/ui.store.ts`                        |
| Business Hooks         | `apps/web/src/hooks/useBusiness.ts`                      |
| API Client             | `apps/web/src/api/client.ts`                             |

### 14.2 Technology Stack

- **Framework:** React 19 with TypeScript
- **Styling:** Tailwind CSS (via `@import "tailwindcss"`)
- **Routing:** React Router v7 (Routes, Route, NavLink, Navigate, Outlet)
- **State Management:** Zustand
- **Data Fetching:** React Query (via custom hooks)
- **Build Tool:** Vite
