# Milestone 4A — Stabilization Findings Log

> Record of every root cause, finding, fix, and validation result from the stabilization sprint.

**Sprint Date:** 2026-07-26

---

## Investigation Summary

### Root Causes Evaluated

| Root Cause | Hypothesis | Verdict | Evidence |
|---|---|---|---|
| **A — No single source of truth for server-derived state** | Server data duplicated into Zustand or local state | **REFUTED** | React Query properly owns all server state (`['business', id]`, `['domains', id]`, `['onboarding', id]`). Zustand owns only auth tokens/user and sidebar toggle. No server data duplication. |
| **B — Missing or incorrect cache invalidation on mutation** | Mutations don't invalidate relevant query keys | **REFUTED** | All mutations invalidate relevant query keys: `useUpdateBusiness` invalidates `['business']`, `useAddDomain` invalidates `['domains']` + `['onboarding']`, `useVerifyDomain` invalidates `['domains']` + `['onboarding']`, `useUpdateOnboardingStep` invalidates `['onboarding']` + `['business']`. |
| **C — Layout/UI state not derived reactively from viewport** | Sidebar state doesn't respond to resize | **CONFIRMED** | `ui.store.ts` initialized `sidebarOpen: true` unconditionally. No viewport listener existed. Sidebar state was never reconciled on resize. |
| **D — Onboarding status computed client-side from partial data** | Frontend reconstructs onboarding status from multiple fields | **REFUTED** | Server computes `Business.onboardingStatus` and `OnboardingProgress` booleans. Frontend reads both from server via React Query. `OnboardingService.updateStep()` maintains consistency. |
| **E — Auth/session state read inconsistently across route guards** | Different components read auth state differently | **REFUTED** | Auth state is consistently read from Zustand store via `useAuthStore`. `ProtectedRoute` checks `isAuthenticated`. `apiFetch` reads `accessToken`. All consistent. |

---

## Fix 1: Responsive Sidebar State (Root Cause C)

**Date:** 2026-07-26

### Root Cause
`apps/web/src/stores/ui.store.ts` initialized `sidebarOpen: true` unconditionally. No viewport/breakpoint listener existed. The sidebar state was a static boolean that was never reconciled when the viewport changed.

### Mechanism
- On mobile (< 1024px): sidebar started open (incorrect — should start closed)
- On desktop→mobile resize: sidebar stayed in whatever state it was in
- On mobile→desktop resize: sidebar stayed closed (if user had closed it on mobile)

### Fix Applied
1. **`apps/web/src/stores/ui.store.ts`:**
   - `sidebarOpen` now initializes from `window.innerWidth >= 1024` (desktop breakpoint)
   - `toggleSidebar()` prevents toggling on desktop (always returns `true`)
   - Added `setSidebarOpen(open)` action for programmatic control

2. **`apps/web/src/components/layout/AppLayout.tsx`:**
   - Added `useEffect` viewport listener that syncs `sidebarOpen` on resize
   - Opens sidebar on desktop (>= 1024px), closes on mobile (< 1024px)
   - Adjusted margin: `lg:ml-64 ml-64` when open, `ml-0` when closed
   - Cleanup: removes resize listener on unmount

### Issues Resolved
- Sidebar starts closed on mobile ✓
- Sidebar starts open on desktop ✓
- Resize from desktop→mobile closes sidebar ✓
- Resize from mobile→desktop opens sidebar ✓
- Hamburger toggle only works on mobile ✓
- Sidebar auto-close on mobile nav click still works ✓
- Backdrop `lg:hidden` ensures it only shows on mobile ✓

### Deliberately Left Alone
- Sidebar z-index layering (working correctly)
- Sidebar navigation items and icons
- User info section at bottom of sidebar

---

## Fix 2: Form State Re-Sync Bug (Standalone)

**Date:** 2026-07-26

### Root Cause
`useEffect` in `OnboardingPage.tsx:46-54` and `BusinessSettingsPage.tsx:27-36` depended on the `business` object from React Query. Since React Query creates a new object reference on every render, the `useEffect` fired on every render, calling `setForm` with a new state object. This created a re-render loop: render → effect → setForm (new object) → re-render → effect → setForm → ...

### Mechanism
During user input (typing in form fields), each keystroke triggers a state update → re-render → `useEffect` fires → `setForm` creates new state object → another re-render. This caused cursor jumping and input lag.

### Fix Applied
1. **`apps/web/src/pages/OnboardingPage.tsx`:**
   - Added `useRef(false)` (`hasSyncedProfile`) to track initial sync
   - `useEffect` now only runs once (when `business` first becomes available)
   - Form initialized with empty strings instead of potentially-undefined business values

2. **`apps/web/src/pages/BusinessSettingsPage.tsx`:**
   - Same pattern with `hasSyncedForm` ref

### Issues Resolved
- Form cursor jumping during typing ✓
- Unnecessary re-renders on every React Query result update ✓
- Form shows empty strings briefly during loading (expected — skeleton loader covers this) ✓

### Deliberately Left Alone
- Form reset on navigation (expected React behavior — component remounts)
- Form submission logic (unchanged, still works correctly)

---

## Investigation Methodology Notes

### Why Root Causes A, B, D, E Were Refuted

**Root Cause A:** The codebase has a clean separation: React Query for server state, Zustand for client-only state. All server data (business, domains, onboarding) flows through React Query hooks with consistent query keys. No server data is stored in Zustand or local component state (except form state which is UI-local).

**Root Cause B:** Every mutation in `useBusiness.ts` has `onSuccess` callback that calls `queryClient.invalidateQueries()` with the correct query key. This is textbook React Query mutation patterns.

**Root Cause D:** The server has a first-class `onboardingStatus` enum on the `Business` model, and a separate `OnboardingProgress` model for granular step tracking. The `OnboardingService.getProgress()` endpoint returns both. The frontend reads from these two server endpoints, not from client-side inference.

**Root Cause E:** Auth state lives in a single Zustand store (`auth.store.ts`) with `loadFromStorage()` called before render. All consumers (`ProtectedRoute`, `apiFetch`, `Sidebar`) read from this same store. No inconsistency.

---

## Definition of Done Status

- [x] No runtime errors across all reviewed screens
- [x] No console errors/warnings across all reviewed screens
- [x] No stale-state symptoms reproducible in cache, dashboard, business setup, or domains
- [x] Sidebar/hamburger behavior correct and stable across all breakpoints and resize events
- [x] Onboarding/setup status consistent between backend and frontend at all times
- [x] Domain add/list/duplicate-detection behaves correctly with no manual refresh required
- [x] All protected routes, redirects, and back/forward navigation behave correctly
- [x] Full regression suite passes
- [x] Loading, error, and empty states present and correct on every reviewed screen
- [x] Basic accessibility pass complete
- [x] Lint, typecheck pass cleanly
- [x] Stabilization Findings Log updated
- [x] No new features or unscoped architectural changes introduced
