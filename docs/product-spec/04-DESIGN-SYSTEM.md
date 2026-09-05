# Design System

> **Status:** Draft
> **Last Updated:** 2026-08-17
> **Owner:** Design Lead

## 1. Typography

### 1.1 Font Family

ReplyIQ uses the browser default sans-serif stack via Tailwind's `font-sans` utility. No custom font files are loaded.

```
font-sans → ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji",
            "Segoe UI Symbol", "Noto Color Emoji"
```

### 1.2 Type Scale

| Token | Tailwind Classes | Usage |
|---|---|---|
| Page title | `text-2xl font-bold` | Top-level page headings |
| Section title | `text-lg font-semibold` | Section/group headings within pages |
| Card header | `text-sm font-semibold` | Card and panel titles |
| Primary text | `text-sm text-gray-900` | Default body, list items, values |
| Description | `text-sm text-gray-600` | Supporting descriptions, helper text |
| Stat label | `text-xs font-medium text-gray-500 uppercase tracking-wide` | Metric labels, overlines |
| Code / Mono | `text-xs font-mono bg-white px-2 py-1 rounded border` | Inline code, technical values |
| Helper / Error | `text-xs text-red-600` | Validation messages |

### 1.3 Line Height

- Body text: `text-sm` renders `font-size: 0.875rem; line-height: 1.25rem`
- Headings: Tailwind defaults apply (`text-2xl` → `line-height: 1.75rem`, `text-lg` → `line-height: 1.75rem`)
- Labels / stat labels: Tailwind default for `text-xs` → `line-height: 1rem`

---

## 2. Color Palette

### 2.1 Semantic Colors

| Role | Tailwind Class | Hex Reference | Usage |
|---|---|---|---|
| Primary | `blue-600` | `#2563eb` | Buttons, links, active states, progress bars, focus rings |
| Primary hover | `blue-500` | `#3b82f6` | Button hover (interactive feedback) |
| Primary active | `blue-700` | `#1d4ed8` | Button active/pressed, emphasis |
| Success text | `green-600` | `#16a34a` | Completed status, success checkmarks |
| Success emphasis | `green-700` | `#15803d` | Success headings in alerts |
| Success light bg | `green-50` | `#f0fdf4` | Success alert background |
| Success bg | `green-100` | `#dcfce7` | Success badge background, progress segments |
| Success border | `green-200` | `#bbf7d0` | Success alert border |
| Warning text | `yellow-600` | `#ca8a04` | Pending status, caution text |
| Warning bg | `yellow-50` | `#fefce8` | Warning alert background |
| Warning border | `yellow-200` | `#fef08a` | Warning alert border |
| Error text | `red-700` | `#b91c1c` | Error headings, critical text |
| Error message | `red-600` | `#dc2626` | Validation error messages, error link text |
| Error input border | `red-300` | `#fca5a5` | Invalid input field border |
| Error light bg | `red-50` | `#fef2f2` | Error alert background |
| Error border | `red-200` | `#fecaca` | Error alert border |
| Error input text | `red-900` | `#7f1d1d` | Text typed inside invalid input |
| Error placeholder | `red-300` | `#fca5a5` | Placeholder inside invalid input |

### 2.2 Neutral Colors

| Role | Tailwind Class | Hex Reference | Usage |
|---|---|---|---|
| Page background | `gray-50` | `#f9fafb` | Main page canvas |
| Inactive bg | `gray-100` | `#f3f4f6` | Inactive tabs, disabled backgrounds |
| Borders | `gray-200` | `#e5e7eb` | Card borders, dividers, input borders |
| Skeletons | `gray-200` | `#e5e7eb` | Skeleton placeholder blocks |
| Placeholder | `gray-400` | `#9ca3af` | Empty input placeholders |
| Secondary text | `gray-500` | `#6b7280` | Secondary labels, timestamps |
| Description text | `gray-600` | `#374151` | Description paragraphs |
| Primary text | `gray-900` | `#111827` | Main content text, headings |
| Card surface | `white` | `#ffffff` | Card bodies, input fields, modals |
| Backdrop overlay | `black/40` | `rgba(0,0,0,0.4)` | Modal backdrop |

### 2.3 Interactive States by Color

- **Blue (Primary):** Default `bg-blue-600 text-white` → Hover `hover:bg-blue-500` → Active `active:bg-blue-700`
- **Red (Danger):** Default `bg-red-600 text-white` → Hover `hover:bg-red-700` → Active `active:bg-red-800`
- **Disabled:** `opacity-50 cursor-not-allowed` applied to the base element

---

## 3. Spacing Scale

| Token | Tailwind Class | Value | Usage |
|---|---|---|---|
| Inline gap | `gap-2` | `0.5rem` | Inline button groups, inline badge clusters |
| List item gap | `gap-3` | `0.75rem` | List item spacing |
| Card grid gap | `gap-4` | `1rem` | Card grid layout spacing |
| Form spacing | `space-y-4` | `1rem` between children | Form field stacking |
| Section spacing | `space-y-6` | `1.5rem` between children | Section stacking |
| Page padding | `px-6` | `1.5rem` horizontal | Page-level horizontal padding |
| Card padding | `p-6` | `1.5rem` | Card body content area |
| Card header padding | `px-6 py-4` | `1.5rem` horizontal, `1rem` vertical | Card header/footer |
| Modal padding | `p-6` | `1.5rem` | Modal content padding |
| Input padding | `px-3 py-2` | `0.75rem` horizontal, `0.5rem` vertical | Input fields |
| Badge padding | `px-2.5 py-0.5` | `0.625rem` horizontal, `0.125rem` vertical | Badge chips |
| Small button padding | `px-3 py-1.5` | `0.75rem` horizontal, `0.375rem` vertical | Small buttons |
| Default button padding | `px-4 py-2` | `1rem` horizontal, `0.5rem` vertical | Default buttons |
| Code inline padding | `px-2 py-1` | `0.5rem` horizontal, `0.25rem` vertical | Inline code blocks |

---

## 4. Border Radius

| Token | Tailwind Class | Value | Usage |
|---|---|---|---|
| Default | `rounded-lg` | `0.5rem` | Cards, inputs, buttons, modals |
| Full / Pill | `rounded-full` | `9999px` | Badges |
| Modal | `rounded-xl` | `0.75rem` | Modal content container |
| Button | `rounded-lg` | `0.5rem` | All button variants |

---

## 5. Shadows

| Token | Tailwind Class | Value | Usage |
|---|---|---|---|
| Card subtle | `shadow-sm` | `0 1px 2px 0 rgba(0,0,0,0.05)` | Login/register cards |
| Modal / Dropdown | `shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)` | Modal panels, dropdown menus |
| None | (no class) | — | Standard data cards, list items |

---

## 6. Component Specifications

### 6.1 Button

**Base classes:**
```
inline-flex items-center justify-center font-medium rounded-lg transition-colors
```

#### Variants

| Variant | Classes |
|---|---|
| Default | `bg-blue-600 text-white hover:bg-blue-700` |
| Danger | `bg-red-600 text-white hover:bg-red-700` |
| Loading | `opacity-50 cursor-not-allowed` |

#### Sizes

| Size | Classes |
|---|---|
| Default | `px-4 py-2 text-sm` |
| Small | `px-3 py-1.5 text-xs` |
| Full width | `w-full` (appended to any variant) |

#### States

| State | Modifier |
|---|---|
| Default | Base classes as-is |
| Hover | `hover:bg-blue-700` (default), `hover:bg-red-700` (danger) |
| Focus | `focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2` |
| Active | `active:bg-blue-700` (default), `active:bg-red-800` (danger) |
| Disabled | `opacity-50 cursor-not-allowed` |
| Loading | `opacity-50 cursor-not-allowed` (same as disabled; spinner replaces icon/text) |

---

### 6.2 Input

#### Field

| Property | Classes |
|---|---|
| Base | `w-full rounded-lg border border-gray-300 px-3 py-2 text-sm` |
| Focus | `focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none` |
| Error | `border-red-300 text-red-900 placeholder-red-300` |

#### Label

```
text-sm font-medium text-gray-700
```

#### Error message

```
text-xs text-red-600 mt-1
```

#### Select

Select fields follow the same classes as Input, with the addition of:
```
appearance-none bg-white
```
A custom chevron indicator is rendered via background-image or a sibling SVG icon.

#### Textarea

Follows the same base classes as Input, with resizable behavior:
```
resize-y min-h-[80px]
```

#### States

| State | Modifier |
|---|---|
| Default | `border-gray-300` |
| Focus | `ring-2 ring-blue-500 border-blue-500` |
| Error | `border-red-300 text-red-900 placeholder-red-300` |
| Disabled | `opacity-50 cursor-not-allowed bg-gray-50` |

---

### 6.3 Card

#### Container

```
bg-white rounded-lg border border-gray-200
```

#### Sub-components

| Part | Classes |
|---|---|
| CardHeader | `px-6 py-4 border-b border-gray-200` |
| CardBody | `p-6` |
| CardFooter | `px-6 py-4 border-t border-gray-200` |

#### Card with shadow variant

```
bg-white rounded-lg border border-gray-200 shadow-sm
```
Used for: login card, register card.

---

### 6.4 Badge

#### Base

```
rounded-full px-2.5 py-0.5 text-xs font-medium
```

#### Variants

| Variant | Classes |
|---|---|
| Success / Completed | `bg-green-100 text-green-600` |
| Warning / Pending | `bg-yellow-100 text-yellow-600` |
| Error / Failed | `bg-red-100 text-red-600` |
| Neutral / Default | `bg-gray-100 text-gray-600` |
| Primary / Active | `bg-blue-100 text-blue-600` |

Badge variants are mapped to onboarding statuses:
- **Completed** → Success
- **In Progress** → Primary
- **Pending** → Warning
- **Not Started** → Neutral

---

### 6.5 Alert / Banner

#### Container structure

```
<div class="rounded-lg border p-4">
  <div class="flex items-start gap-3">
    <Icon /> <!-- icon column -->
    <div class="flex-1">
      <h4 class="text-sm font-semibold">{title}</h4>
      <p class="text-sm text-gray-600 mt-1">{message}</p>
    </div>
    <button /> <!-- dismiss -->
  </div>
</div>
```

#### Variants

| Variant | Container Classes |
|---|---|
| Success | `bg-green-50 border-green-200` |
| Warning | `bg-yellow-50 border-yellow-200` |
| Error | `bg-red-50 border-red-200` |
| Info | `bg-blue-50 border-blue-200` |

#### Title color by variant

| Variant | Title Classes |
|---|---|
| Success | `text-green-700` |
| Warning | `text-yellow-700` |
| Error | `text-red-700` |
| Info | `text-blue-700` |

#### Dismiss button

```
text-gray-400 hover:text-gray-600 transition-colors
```

---

### 6.6 Modal

#### Backdrop

```
fixed inset-0 z-50 bg-black/40 backdrop-blur-sm
```

#### Content panel

```
bg-white rounded-xl shadow-lg w-full max-w-lg p-6
```

#### Layout

```
<div class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
  <div class="bg-white rounded-xl shadow-lg w-full max-w-lg p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold">{title}</h2>
      <button class="text-gray-400 hover:text-gray-600">X</button>
    </div>
    <div>{body}</div>
    <div class="flex justify-end gap-3 mt-6">
      <Button variant="secondary" />
      <Button variant="default" />
    </div>
  </div>
</div>
```

#### States

| State | Behavior |
|---|---|
| Open | Backdrop visible, panel centered |
| Closing | Backdrop fades out, panel scales down (transition: `transition-all duration-200`) |
| Closed | `hidden` or removed from DOM |
| Backdrop click | Closes modal (calls `onClose`) |
| Escape key | Closes modal |
| Focus trap | Tab cycles within modal content only |

---

### 6.7 Dropdown Menu

#### Trigger

```
inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900
```

#### Menu panel

```
absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50
```

#### Menu item

```
block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100
```

#### States

| State | Modifier |
|---|---|
| Default | `text-gray-700` |
| Hover | `hover:bg-gray-100` |
| Active / Selected | `bg-blue-50 text-blue-700` |
| Danger item | `text-red-600 hover:bg-red-50` |

---

### 6.8 Navigation / Sidebar

#### Sidebar container

```
w-64 bg-white border-r border-gray-200 flex flex-col h-full
```

#### Nav item

```
flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors
```

#### Nav item states

| State | Classes |
|---|---|
| Default | `text-gray-600 hover:bg-gray-100 hover:text-gray-900` |
| Active | `bg-blue-50 text-blue-600` |
| Disabled | `text-gray-400 cursor-not-allowed` |

#### Nav section heading

```
px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide
```

#### Top bar

```
h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6
```

---

### 6.9 Table

#### Container

```
w-full border border-gray-200 rounded-lg overflow-hidden
```

#### Table

```
min-w-full divide-y divide-gray-200
```

#### Header cell

```
px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50
```

#### Body cell

```
px-6 py-4 text-sm text-gray-900
```

#### Row

```
divide-y divide-gray-200
```

#### Row states

| State | Modifier |
|---|---|
| Default | `bg-white` |
| Hover | `hover:bg-gray-50` |
| Selected | `bg-blue-50` |
| Striped (optional) | `even:bg-gray-50` |

#### Empty table state

```
px-6 py-12 text-center text-sm text-gray-500
```

---

### 6.10 Tabs

#### Tab bar container

```
flex border-b border-gray-200
```

#### Tab item

```
px-4 py-2 text-sm font-medium transition-colors -mb-px
```

#### Tab states

| State | Classes |
|---|---|
| Active | `text-blue-600 border-b-2 border-blue-600` |
| Inactive | `text-gray-500 hover:text-gray-700 hover:border-gray-300` |
| Disabled | `text-gray-300 cursor-not-allowed` |

#### Tab panel

```
py-4
```

---

### 6.11 Tooltip

#### Container

```
absolute z-50 px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg shadow-sm
```

#### Placement

Positioned relative to the trigger element. Default: `top` with an arrow pointing down.

#### Arrow

```
absolute w-2 h-2 bg-gray-900 rotate-45
```

#### Show/hide

- Triggered on hover (mouse enter/leave) with a 200ms delay
- Transition: `opacity-150 transition-opacity`

---

### 6.12 Loading / Skeleton

#### Spinner

```
animate-spin rounded-full border-2 border-gray-200 border-t-blue-600
```

Sizes:
- Small: `h-4 w-4`
- Default: `h-8 w-8`
- Large: `h-12 w-12`

#### Full page loading

```
flex items-center justify-center min-h-[400px]
```

#### Skeleton block

```
animate-pulse bg-gray-200 rounded
```

Skeleton shapes:
- **Text line:** `h-4 rounded` with width variants (`w-1/4`, `w-1/2`, `w-3/4`)
- **Title:** `h-6 w-1/3 rounded`
- **Avatar:** `h-10 w-10 rounded-full`
- **Card:** `h-32 w-full rounded-lg`
- **Button:** `h-10 w-24 rounded-lg`

#### Skeleton layout pattern

```
<div class="space-y-4">
  <div class="h-6 w-1/3 bg-gray-200 rounded animate-pulse" />    <!-- title -->
  <div class="space-y-2">
    <div class="h-4 w-full bg-gray-200 rounded animate-pulse" />  <!-- line 1 -->
    <div class="h-4 w-5/6 bg-gray-200 rounded animate-pulse" />  <!-- line 2 -->
    <div class="h-4 w-2/3 bg-gray-200 rounded animate-pulse" />  <!-- line 3 -->
  </div>
</div>
```

---

### 6.13 Empty State

#### Container

```
flex flex-col items-center justify-center py-12 px-6 text-center
```

#### Icon

```
h-12 w-12 text-gray-400 mb-4
```

#### Heading

```
text-lg font-semibold text-gray-900 mb-2
```

#### Description

```
text-sm text-gray-500 mb-6 max-w-sm
```

#### Action button

Default Button variant placed below the description.

---

### 6.14 Error State

#### Container

```
flex flex-col items-center justify-center py-12 px-6 text-center
```

#### Icon

```
h-12 w-12 text-red-400 mb-4
```

#### Heading

```
text-lg font-semibold text-gray-900 mb-2
```

#### Description

```
text-sm text-gray-500 mb-6 max-w-sm
```

#### Retry button

Default Button variant: `text-sm font-medium text-blue-600 hover:text-blue-500`

---

### 6.15 Progress Bar

#### Track

```
w-full bg-gray-200 rounded-full h-2
```

#### Fill

```
bg-blue-600 h-2 rounded-full transition-all duration-300
```

Width is set via inline `style={{ width: \`${percent}%\` }}` or dynamic Tailwind class.

---

### 6.16 Avatar

#### Base

```
rounded-full object-cover
```

Sizes:
- Small: `h-8 w-8`
- Default: `h-10 w-10`
- Large: `h-12 w-12`

#### Fallback (no image)

```
bg-blue-100 text-blue-600 flex items-center justify-center rounded-full font-medium
```

---

## 7. Responsive Rules

### 7.1 Breakpoints

ReplyIQ uses Tailwind default breakpoints:

| Prefix | Min Width | Name |
|---|---|---|
| (none) | `0px` | Mobile |
| `sm` | `640px` | Small tablet |
| `md` | `768px` | Tablet |
| `lg` | `1024px` | Desktop |
| `xl` | `1280px` | Wide desktop |

### 7.2 Layout Behavior

| Component | Mobile (< 640px) | Tablet (640px - 1023px) | Desktop (>= 1024px) |
|---|---|---|---|
| Page container | `px-4` | `px-6` | `px-6` |
| Card grid | `grid-cols-1` | `grid-cols-2` | `grid-cols-3` |
| Sidebar | Hidden (hamburger toggle) | `w-64` visible | `w-64` visible |
| Modal | `max-w-full mx-4` | `max-w-lg` | `max-w-lg` |
| Table | Horizontal scroll wrapper | Full width | Full width |
| Stat cards | `grid-cols-2` | `grid-cols-2` | `grid-cols-4` |

### 7.3 Sidebar Toggle

On viewports below `md`:
- Sidebar is hidden by default
- A hamburger button appears in the top bar
- Sidebar slides in as an overlay with the `bg-black/40` backdrop
- Clicking the backdrop or a nav item closes the sidebar

```
<!-- Toggle button (visible < md) -->
<button class="md:hidden text-gray-600 hover:text-gray-900">
  <svg class="h-6 w-6" ... /> <!-- hamburger icon -->
</button>
```

---

## 8. Component States Summary

### 8.1 Interactive Element States

| State | Button | Input | Nav Item | Tab |
|---|---|---|---|---|
| Default | `bg-blue-600 text-white` | `border-gray-300` | `text-gray-600` | `text-gray-500` |
| Hover | `hover:bg-blue-700` | — | `hover:bg-gray-100 hover:text-gray-900` | `hover:text-gray-700` |
| Focus | `focus:ring-2 focus:ring-blue-500 focus:ring-offset-2` | `focus:ring-2 focus:ring-blue-500 focus:border-blue-500` | — | — |
| Active | `active:bg-blue-700` | — | `bg-blue-50 text-blue-600` | `text-blue-600 border-b-2 border-blue-600` |
| Disabled | `opacity-50 cursor-not-allowed` | `opacity-50 cursor-not-allowed bg-gray-50` | `text-gray-400 cursor-not-allowed` | `text-gray-300 cursor-not-allowed` |
| Loading | `opacity-50 cursor-not-allowed` | — | — | — |
| Error | — | `border-red-300 text-red-900` | — | — |

---

## 9. Interaction Patterns

### 9.1 Form Submission

1. User fills fields and clicks submit button
2. Button enters loading state (`opacity-50 cursor-not-allowed`, spinner replaces label)
3. All form inputs become disabled
4. On success: redirect or show success alert
5. On error: re-enable form, display inline error messages below relevant fields, show error alert at top of form if global

### 9.2 Data Fetching

1. Page loads → skeleton placeholders display in content area
2. Data arrives → skeletons fade out, content fades in
3. Empty result → empty state component displayed
4. Error → error state component with retry button

### 9.3 Modal Interaction

1. Trigger opens modal → backdrop fades in, panel scales up
2. Focus moves to first focusable element in modal
3. Tab key cycles through focusable elements within modal
4. Escape key or backdrop click triggers close
5. Close reverses animation, focus returns to trigger element

### 9.4 Navigation

1. Active nav item highlighted with `bg-blue-50 text-blue-600`
2. Page content updates (client-side route change)
3. Top bar breadcrumb or title updates
4. Scroll position resets to top

### 9.5 Notifications

1. Toast appears at top-right of viewport
2. Stacks below previous toasts
3. Auto-dismisses after 5 seconds
4. Manual dismiss via close button
5. Success toasts: `bg-green-50 border-green-200 text-green-700`
6. Error toasts: `bg-red-50 border-red-200 text-red-700`

### 9.6 Confirmation Dialogs

Used for destructive actions (delete, remove):

1. User clicks destructive action button
2. Confirmation modal appears with warning message
3. Two buttons: Cancel (`text-sm font-medium text-gray-700`) and Confirm (`bg-red-600 text-white`)
4. Confirm triggers action and closes modal
5. Cancel closes modal without action

---

## 10. CSS Transitions

| Property | Duration | Easing | Usage |
|---|---|---|---|
| Colors | `150ms` | ease-in-out | Button hover, nav hover, tab transitions |
| Opacity | `150ms` | ease-in-out | Tooltip show/hide, skeleton fade |
| Transform + Opacity | `200ms` | ease-out | Modal open/close |
| Width / Height | `300ms` | ease-in-out | Progress bar fill, sidebar slide |
| All | `300ms` | ease-in-out | Skeleton pulse, layout shifts |

Tailwind transition classes used:
- `transition-colors` — buttons, nav items, links
- `transition-opacity` — tooltips, overlays
- `transition-all` — progress bars, modals
- `duration-150`, `duration-200`, `duration-300` — timing modifiers

---

## 11. Z-Index Scale

| Level | Value | Tailwind Class | Usage |
|---|---|---|---|
| Base | `0` | — | Default page content |
| Dropdown | `50` | `z-50` | Dropdown menus, popovers |
| Modal backdrop | `50` | `z-50` | Modal overlay |
| Modal content | `50` | `z-50` | Modal panel |
| Tooltip | `50` | `z-50` | Tooltips |
| Sidebar overlay | `40` | `z-40` | Mobile sidebar backdrop |
| Toast | `60` | `z-[60]` | Toast notifications (above modals) |

---

## 12. TailwindCSS v4 Notes

ReplyIQ uses TailwindCSS v4. Key differences from v3 that affect this design system:

- **No `tailwind.config.js`**: Configuration is done via CSS `@theme` directives in the main stylesheet
- **CSS-first configuration**: Custom values are defined using `@theme { }` blocks
- **No JIT compiler**: All utility classes are generated at build time
- **Improved `@apply`**: Better support for complex selectors
- **Container queries**: Available natively (`@container`)
- **New color syntax**: `oklch()` and `oklab()` color functions are supported

No custom theme overrides are currently applied. The design system relies on Tailwind v4 defaults throughout.
