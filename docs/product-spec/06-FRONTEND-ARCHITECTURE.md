# 06 - Frontend Architecture

> **Status:** Draft
> **Last Updated:** 2026-08-17
> **Owner:** Tech Lead

This document defines the frontend architecture for the ReplyIQ web dashboard. All patterns described here are based on the current codebase implementation in `apps/web/`.

---

## 1. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | React | 19 |
| Build Tool | Vite | 6 |
| Routing | React Router DOM | 7.18 |
| Server State | TanStack React Query | 5.101 |
| Client State | Zustand | 5.0 |
| Styling | Tailwind CSS | 4.3 (Vite plugin) |
| Language | TypeScript | 5.7 |
| Package Manager | pnpm 11.13.0 (workspace monorepo) | - |

Shared workspace packages used by the web app:

- `@replyiq/types` -- shared TypeScript types
- `@replyiq/ui` -- shared UI primitives
- `@replyiq/utils` -- shared utilities

---

## 2. File Structure

```
apps/web/
├── index.html                        # SPA entry point
├── package.json                      # @replyiq/web
├── tsconfig.json                     # Extends ../../tsconfig.react.json
├── vite.config.ts                    # Vite + React + Tailwind plugins
├── .env.example                      # VITE_API_URL
└── src/
    ├── main.tsx                      # Entry point
    ├── App.tsx                       # Route definitions
    ├── index.css                     # @import "tailwindcss"
    ├── vite-env.d.ts                 # Vite client types
    ├── api/
    │   ├── client.ts                 # apiFetch, getErrorMessage
    │   └── business.ts              # Business API functions + types
    ├── hooks/
    │   └── useBusiness.ts           # All React Query hooks
    ├── pages/
    │   ├── LoginPage.tsx
    │   ├── RegisterPage.tsx
    │   ├── DashboardPage.tsx
    │   ├── OnboardingPage.tsx
    │   ├── BusinessSettingsPage.tsx
    │   └── DomainsPage.tsx
    ├── components/
    │   ├── auth/
    │   │   └── ProtectedRoute.tsx
    │   ├── layout/
    │   │   ├── AppLayout.tsx
    │   │   ├── Header.tsx
    │   │   └── Sidebar.tsx
    │   └── ui/
    │       ├── Badge.tsx
    │       ├── Button.tsx
    │       ├── Card.tsx
    │       ├── Input.tsx
    │       └── Modal.tsx
    └── stores/
        ├── auth.store.ts             # Zustand: auth state
        └── ui.store.ts              # Zustand: sidebar state
```

---

## 3. Entry Point and Bootstrap

**File:** `apps/web/src/main.tsx`

Bootstrap sequence on application load:

1. `QueryClient` is instantiated with `retry: 1` and `refetchOnWindowFocus: false` as defaults.
2. `useAuthStore.getState().loadFromStorage()` is called **before** render to restore auth tokens from `localStorage`.
3. React renders `StrictMode > QueryClientProvider > BrowserRouter > App`.

```
loadFromStorage()
  -> reads localStorage keys: accessToken, refreshToken, user
  -> if all present, sets { user, accessToken, refreshToken, isAuthenticated: true }
```

This runs synchronously outside of React render, so by the time `ProtectedRoute` checks `isAuthenticated`, the store is already hydrated.

---

## 4. Routing

**File:** `apps/web/src/App.tsx`

React Router v7 with nested route architecture.

### Route Table

| Path | Component | Auth Required | Layout |
|---|---|---|---|
| `/login` | `LoginPage` | No | None (standalone) |
| `/register` | `RegisterPage` | No | None (standalone) |
| `/dashboard` | `DashboardPage` | Yes | `AppLayout` |
| `/onboarding` | `OnboardingPage` | Yes | `AppLayout` |
| `/dashboard/settings` | `BusinessSettingsPage` | Yes | `AppLayout` |
| `/dashboard/domains` | `DomainsPage` | Yes | `AppLayout` |
| `/` | Redirect to `/dashboard` | - | - |
| `*` | Redirect to `/dashboard` | - | - |

### Route Nesting

```
<Routes>
  ├── /login                  (public)
  ├── /register               (public)
  ├── <ProtectedRoute>        (checks isAuthenticated)
  │   └── <AppLayout>         (sidebar + header + Outlet)
  │       ├── /dashboard
  │       ├── /onboarding
  │       ├── /dashboard/settings
  │       └── /dashboard/domains
  ├── / -> redirect /dashboard
  └── * -> redirect /dashboard
```

### ProtectedRoute

**File:** `apps/web/src/components/auth/ProtectedRoute.tsx`

- Reads `isAuthenticated` from `useAuthStore`.
- If `false`, redirects to `/login` with `state.from` containing the attempted path (for post-login redirect).
- If `true`, renders `<Outlet />` to continue the nested route chain.

---

## 5. State Management

Three distinct tiers of state, each with a clear responsibility boundary.

### 5.1 Server State -- TanStack Query

All API-derived data is managed through TanStack Query hooks in `apps/web/src/hooks/useBusiness.ts`.

**QueryClient Configuration:**
- `retry: 1` -- single retry on failure
- `refetchOnWindowFocus: false` -- no automatic refetch on tab switch

**Hooks and Query Keys:**

| Hook | Query Key | Method | Endpoint |
|---|---|---|---|
| `useBusiness(businessId)` | `['business', businessId]` | GET | `/api/v1/businesses/:id` |
| `useDomains(businessId)` | `['domains', businessId]` | GET | `/api/v1/businesses/:id/domains` |
| `useVerificationInstructions(businessId, domainId, method)` | `['verification-instructions', businessId, domainId, method]` | GET | `/api/v1/businesses/:id/domains/:domainId/verification-instructions?method=` |
| `useOnboardingProgress(businessId)` | `['onboarding', businessId]` | GET | `/api/v1/businesses/:id/onboarding` |

**Mutation Hooks:**

| Hook | Invalidates On Success |
|---|---|
| `useUpdateBusiness(businessId)` | `['business', businessId]` |
| `useAddDomain(businessId)` | `['domains', businessId]`, `['onboarding', businessId]` |
| `useDeleteDomain(businessId)` | `['domains', businessId]`, `['onboarding', businessId]` |
| `useVerifyDomain(businessId)` | `['domains', businessId]`, `['onboarding', businessId]` |
| `useUpdateOnboardingStep(businessId)` | `['onboarding', businessId]`, `['business', businessId]` |

**Query Enable Pattern:**

All query hooks use the `enabled` option to prevent firing when required IDs are missing:

```typescript
enabled: !!businessId
```

Mutations that affect multiple data domains invalidate related query keys in `onSuccess` to trigger automatic refetches.

### 5.2 Client State -- Zustand

Two Zustand stores for non-server-derived client state.

#### Auth Store

**File:** `apps/web/src/stores/auth.store.ts`

```typescript
interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  setAuth: (user, accessToken, refreshToken) => void;
  setUser: (user) => void;
  logout: () => void;
  loadFromStorage: () => void;
}
```

**Persistence:** Manual `localStorage` integration.

| Action | localStorage Keys |
|---|---|
| `setAuth()` | Writes `accessToken`, `refreshToken`, `user` (JSON) |
| `setUser()` | Writes `user` (JSON) |
| `logout()` | Removes `accessToken`, `refreshToken`, `user` |
| `loadFromStorage()` | Reads all three; sets `isAuthenticated: true` if all present |

**User type:**

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string;
  businessId: string;
}
```

#### UI Store

**File:** `apps/web/src/stores/ui.store.ts`

```typescript
interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}
```

- `sidebarOpen` defaults to `window.innerWidth >= 1024`.
- `toggleSidebar()` forces `true` on desktop (>=1024px), toggles on mobile.
- Not persisted to localStorage.

### 5.3 Form State -- useState

All form inputs use local `useState` within page components. No form library (e.g., React Hook Form, Formik) is used.

Pattern observed in `BusinessSettingsPage`, `OnboardingPage`, `LoginPage`, `RegisterPage`, `DomainsPage`:

```typescript
const [form, setForm] = useState({ name: '', industry: '', ... });
```

For pages that load data from the API (settings, onboarding), a `useRef` flag (`hasSyncedForm` / `hasSyncedProfile`) prevents re-syncing form state from the server response on every render:

```typescript
const hasSyncedForm = useRef(false);

useEffect(() => {
  if (business && !hasSyncedForm.current) {
    hasSyncedForm.current = true;
    setForm({ name: business.name, ... });
  }
}, [business]);
```

---

## 6. API Client

**File:** `apps/web/src/api/client.ts`

### apiFetch

Central HTTP client wrapping `fetch`. Used by all API functions in `apps/web/src/api/business.ts`.

```
apiFetch<T>(path, options) -> Promise<T>
```

**Behavior:**

1. Reads `accessToken` from `useAuthStore.getState()`.
2. Sets `Content-Type: application/json` and `Authorization: Bearer <token>` headers.
3. Prepends `VITE_API_URL` environment variable to the path.
4. On **401 response**: attempts token refresh, then retries the request once.
5. If refresh fails or second 401: calls `logout()` and redirects to `/login`.
6. On non-OK responses: parses error body and throws it.
7. On success: unwraps and returns `response.data` from the `ApiResponse<T>` envelope.

### API Response Envelope

```typescript
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
```

### Token Refresh

- Uses a singleton `refreshPromise` pattern to prevent concurrent refresh requests.
- Calls `POST /api/v1/auth/refresh` with the current refresh token.
- On success, updates the auth store with new tokens via `setAuth()`.
- On failure, returns `false` and the caller handles logout.

### Error Extraction

```typescript
getErrorMessage(error: unknown): string
```

Handles two API error shapes:
- `{ message: string }` -- single error string
- `{ message: [{ message: string }] }` -- array of validation errors (returns first)

Falls back to `"An error occurred. Please try again."`.

### API Functions

**File:** `apps/web/src/api/business.ts`

All functions use the `/api/v1` prefix and return typed responses:

| Function | Method | Endpoint |
|---|---|---|
| `getBusiness(businessId)` | GET | `/api/v1/businesses/:id` |
| `updateBusiness(businessId, data)` | PATCH | `/api/v1/businesses/:id` |
| `getDomains(businessId)` | GET | `/api/v1/businesses/:id/domains` |
| `addDomain(businessId, domain, isPrimary?)` | POST | `/api/v1/businesses/:id/domains` |
| `deleteDomain(businessId, domainId)` | DELETE | `/api/v1/businesses/:id/domains/:domainId` |
| `verifyDomain(businessId, domainId, method)` | POST | `/api/v1/businesses/:id/domains/:domainId/verify` |
| `getVerificationInstructions(businessId, domainId, method)` | GET | `/api/v1/businesses/:id/domains/:domainId/verification-instructions?method=` |
| `getOnboardingProgress(businessId)` | GET | `/api/v1/businesses/:id/onboarding` |
| `updateOnboardingStep(businessId, step)` | PATCH | `/api/v1/businesses/:id/onboarding/steps` |

---

## 7. Authentication Flow

### Registration

1. `RegisterPage` submits `{ businessName, ownerName, email, password }` to `POST /api/v1/auth/register`.
2. Response contains `data.user`, `data.organization`, `data.business`, `data.session`.
3. `setAuth()` is called with merged user data (adding `organizationId` and `businessId`).
4. Navigates to `/onboarding`.

### Login

1. `LoginPage` submits `{ email, password }` to `POST /api/v1/auth/login`.
2. Response contains `data.user`, `data.accessToken`, `data.refreshToken`.
3. `setAuth()` stores tokens and user.
4. Navigates to `/dashboard`.

### Session Persistence

- On app load, `loadFromStorage()` reads tokens from `localStorage`.
- If tokens exist, `isAuthenticated` is set to `true` and the user can access protected routes immediately.
- The backend validates the token on the first API call; if invalid, the 401 handler triggers logout.

### Token Refresh

- Transparent to the user. On 401, `apiFetch` attempts refresh before redirecting.
- Uses a deduplication pattern (`refreshPromise`) to avoid multiple concurrent refresh attempts.

### Logout

1. `Sidebar` calls `POST /api/v1/auth/logout` (best-effort, failure is swallowed).
2. `logout()` clears `localStorage` and resets the auth store.
3. User is no longer able to access protected routes.

---

## 8. Component Architecture

### 8.1 Layout Components

#### AppLayout

**File:** `apps/web/src/components/layout/AppLayout.tsx`

- Renders `Sidebar`, `Header`, and `<Outlet />` for child routes.
- Listens to `window.resize` to auto-open sidebar on desktop (>=1024px) and close on mobile.
- Main content area shifts with `ml-64` when sidebar is open, `ml-0` when closed.

#### Sidebar

**File:** `apps/web/src/components/layout/Sidebar.tsx`

- Fixed left sidebar, 256px wide (`w-64`).
- Navigation items defined as a static array with route paths, labels, and SVG icon paths.
- Uses `NavLink` with `end` prop on `/dashboard` for exact matching.
- Shows user avatar (first letter of name), name, email, and sign-out button.
- On mobile: overlay backdrop with `bg-black/50` and slide-in/out via `translate-x`.
- Auto-closes on nav click when viewport < 1024px.

#### Header

**File:** `apps/web/src/components/layout/Header.tsx`

- Sticky header with page title derived from `location.pathname` via a lookup map.
- Mobile hamburger button toggles sidebar via `toggleSidebar()`.
- Title map: `/dashboard` -> "Dashboard", `/onboarding` -> "Setup", `/dashboard/settings` -> "Business Settings", `/dashboard/domains` -> "Domains".

### 8.2 UI Primitives

All UI components are in `apps/web/src/components/ui/`.

#### Button

- Variants: `primary` (blue), `secondary` (gray), `danger` (red), `ghost` (transparent).
- Sizes: `sm`, `md`, `lg`.
- Supports `loading` state with an inline SVG spinner.
- Uses `forwardRef` for ref forwarding.
- Automatically disabled when `loading` is true.

#### Input

- Optional `label` and `error` props.
- Auto-generates `id` from label text for accessibility (`htmlFor` binding).
- Error state applies red border and shows error message below input.
- Uses `forwardRef`.

#### Card

- Compound component: `Card`, `CardHeader`, `CardBody`, `CardFooter`.
- All accept `className` for composition.
- Standard styling: rounded-lg, border, white background, shadow-sm.

#### Badge

- Variants: `default` (gray), `success` (green), `warning` (yellow), `danger` (red), `info` (blue).
- Helper functions `domainStatusBadge()` and `onboardingStatusBadge()` map API status strings to badge variants and labels.

#### Modal

- Controlled component with `open`/`onClose` props.
- Escape key closes modal.
- Overlay click closes modal.
- Locks body scroll when open (`overflow: hidden`).
- Renders null when `open` is false (no DOM presence).

---

## 9. Page Architecture

### LoginPage / RegisterPage

- Standalone pages (no `AppLayout` wrapping).
- Centered card layout with brand logo, form fields, and footer link.
- Local `useState` for each form field plus `error` and `loading` state.
- Direct `fetch` calls (not using `apiFetch`) to `POST /api/v1/auth/login` and `POST /api/v1/auth/register`.
- On success: `setAuth()` + navigation.

### DashboardPage

- Reads `businessId` from auth store.
- Fetches business data and onboarding progress via `useBusiness()` and `useOnboardingProgress()`.
- Displays: welcome message, onboarding status badge, progress bar, step list, business info cards, quick links.
- Loading state: `animate-pulse` skeleton placeholders.

### OnboardingPage

- Multi-step wizard (4 steps) driven by onboarding progress from the API.
- Steps are derived from the `steps` array in `OnboardingProgress`; `firstPendingIndex` determines the active step.
- Step 0: Profile form (industry, description, website URL) -> `useUpdateBusiness` + `useUpdateOnboardingStep('PROFILE')`.
- Step 1: Domain input with existing domain list -> `useAddDomain` + `useUpdateOnboardingStep('FIRST_DOMAIN')`.
- Step 2: Domain verification (DNS TXT or HTML Meta) -> `useVerifyDomain` + `useUpdateOnboardingStep('DOMAIN_VERIFICATION')`.
- Step 3: Completion -> `useUpdateOnboardingStep('COMPLETE')`.
- If already completed, shows a success card with link to dashboard.
- Progress bar at top shows step completion with color coding (green/blue/gray).

### BusinessSettingsPage

- Form to edit business name, industry, description, website URL.
- Uses `useBusiness()` to load current data, syncs to local state via `useRef` guard.
- `useUpdateBusiness()` mutation with success/error feedback.
- Loading skeleton while data loads.

### DomainsPage

- Two-card layout: "Add Domain" form and "Your Domains" list.
- Domain input with client-side validation: regex pattern `^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z]{2,}$`.
- Domain normalization: strips `https://`, `www.`, trailing slashes, lowercases.
- Domain list shows status badges (Verified/Pending) and action buttons (Verify/Delete).
- `VerifyModal` component (inline, not using `Modal.tsx`): radio selection for DNS_TXT or HTML_META, fetches verification instructions, shows instructions, handles verify attempt with pending/success states.

---

## 10. Form Handling

### Pattern

All forms use controlled components with `useState`:

```typescript
const [email, setEmail] = useState('');
// ...
<Input value={email} onChange={(e) => setEmail(e.target.value)} />
```

### Validation

- **HTML5 native validation:** `required`, `type="email"`, `type="password"`, `type="url"` attributes on `Input` components.
- **Client-side regex:** Domain validation uses a regex pattern directly in `handleAddDomain()`.
- **No form library:** No React Hook Form, Formik, or Zod schemas.
- **Server-side validation:** Errors returned in the `message` array are displayed via `getErrorMessage()`.

### Error Display

Two patterns used:

1. **Page-level error banner:** Red background div above the form, set via `setError()` state.
2. **Field-level error:** Passed as `error` prop to `Input` component, rendered below the input with red text.

---

## 11. Loading States

### Pattern

All pages use the same skeleton loading pattern:

```typescript
if (isLoading) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-48 mb-3" />
        <div className="h-4 bg-gray-200 rounded w-72" />
      </div>
    </div>
  );
}
```

- Uses Tailwind's `animate-pulse` class for the pulsing effect.
- Gray placeholder bars simulate content structure.
- Each page defines its own skeleton layout (not a shared component).

### Mutation Loading

- Button components receive `loading={mutation.isPending}` to show spinner and disable interaction.
- Some pages show inline status messages during async operations (e.g., "Verifying... Please wait.").

---

## 12. Error Handling

### Client-Side

- `getErrorMessage()` in `apps/web/src/api/client.ts` extracts the `message` field from API error responses. As implemented it is a **verbatim passthrough**: whatever string the backend sends (including technical copy such as "Verification failed. Ensure the challenge record is published correctly.") is displayed directly to the user. Validation arrays show only the first entry.
- Pages call `setError(getErrorMessage(err))` in catch blocks.
- Errors render as red banner divs above content.

### API-Level

- `apiFetch` throws parsed error bodies on non-OK responses (shape `{ statusCode, message, timestamp }`).
- 401 handling: single-flight refresh attempt -> retry once -> logout + redirect to `/login`.
- Network errors: catch blocks in pages return generic "An error occurred" message.

### Auth Pages

- Login and Register use direct `fetch` (not `apiFetch`) and handle errors inline with `getErrorMessage()`. Note: the register response uses the flat `{ session, user, business, organization }` shape without a `success/message/data` wrapper.

### [PROPOSED] Error Translation Layer

Once the backend emits stable machine-readable error codes (09-API-SPECIFICATION.md §1.7 note), add a client-side mapping from code -> user-friendly copy so internal jargon never renders in the UI. Tracked as R2 in 15-ROADMAP.md.

---

## 13. Code Organization

### Conventions

- **Named exports** for all components and functions (no default exports).
- **File naming:** PascalCase for components (`Button.tsx`), camelCase for utilities and hooks (`useBusiness.ts`), dot-separated for stores (`auth.store.ts`).
- **One component per file** for page components. UI primitives like `Card` export compound components from a single file.
- **Co-location:** Related types are defined alongside their API functions (`business.ts`) rather than in a separate types file.
- **No barrel files:** Components are imported directly by path.

### Import Order (observed)

1. React / third-party libraries
2. Local API functions
3. Local hooks
4. Local components
5. Local stores

---

## 14. Styling

### Tailwind CSS

- Tailwind v4 integrated via `@tailwindcss/vite` plugin (no `tailwind.config.js` -- uses v4 CSS-based configuration).
- `apps/web/src/index.css` contains only `@import "tailwindcss"`.
- All styling is inline utility classes.

### Responsive Design

- Mobile-first with Tailwind responsive prefixes (`lg:`).
- Sidebar: fixed 256px on desktop, slide-in overlay on mobile.
- Dashboard: `grid-cols-1 md:grid-cols-3` for card layouts.
- Breakpoint: 1024px (defined as `DESKTOP_BREAKPOINT` constant in both `AppLayout.tsx` and `ui.store.ts`).

---

## 15. Build Configuration

### Vite

**File:** `apps/web/vite.config.ts`

```typescript
defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
```

- Dev server proxies `/api` requests to the backend at `localhost:3000`.
- Port 5173 for development.

### TypeScript

**File:** `apps/web/tsconfig.json`

- Extends `../../tsconfig.react.json` (which extends `tsconfig.base.json`).
- `outDir: "./dist"`, `rootDir: "./src"`.
- Includes only `src/` directory.

### Environment Variables

- `VITE_API_URL` -- Backend API base URL. Defaults to empty string (relative URLs) if not set.
- Accessed via `import.meta.env.VITE_API_URL`.
- `.env.example` shows `VITE_API_URL=http://localhost:3000`.

### Scripts

| Script | Command |
|---|---|
| `dev` | `vite` |
| `build` | `tsc --project tsconfig.json && vite build` |
| `lint` | `eslint .` |
| `typecheck` | `tsc --noEmit` |
| `clean` | Removes `dist/` directory |

Build runs TypeScript compilation first, then Vite production build.

---

## 16. Testing

**Current state: No tests exist.**

- No test files (`*.test.*`, `*.spec.*`) found in `apps/web/src/`.
- No test runner configured (no vitest, jest, or similar config files).
- No test-related dependencies in `package.json`.

**Recommended approach when tests are added:**

- Vitest as the test runner (natural fit with Vite).
- React Testing Library for component tests.
- MSW (Mock Service Worker) for API mocking in integration tests.
- Key test targets: `apiFetch` (token refresh logic), `ProtectedRoute` (auth redirect), `useBusiness` hooks (query/mutation behavior), form validation in `DomainsPage`.

---

## 17. Performance Considerations

### Current Optimizations

- **QueryClient defaults:** `retry: 1` and `refetchOnWindowFocus: false` reduce unnecessary network requests.
- **Token refresh deduplication:** The `refreshPromise` singleton in `apiFetch` prevents concurrent refresh calls.
- **Conditional queries:** `enabled: !!businessId` prevents queries from firing when IDs are unavailable.
- **Mutation invalidation:** Precise query key invalidation avoids over-fetching while keeping cached data fresh.

### Areas for Future Improvement

- **Code splitting:** No `React.lazy()` usage currently; all pages load eagerly.
- **Route-level lazy loading:** Could reduce initial bundle size by splitting each page.
- **Modal rendering:** `VerifyModal` in `DomainsPage` is defined inline in the same file and always evaluated. Could be extracted and lazy-loaded.
- **Form state re-renders:** Every keystroke triggers a state update. For complex forms, this could be optimized with uncontrolled components or debouncing.
- **Query stale time:** No explicit `staleTime` configured; defaults to 0 (immediately stale). Adding `staleTime` could reduce refetch frequency for data that rarely changes.

---

## 18. Environment Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | No | `""` (empty) | Backend API base URL. Set to `http://localhost:3000` for local development. |

The empty default means `apiFetch` will use relative URLs (e.g., `/api/v1/auth/login`), which works with the Vite dev server proxy.
