# Plan: Reservoir Raid — Event Objectives Assignment Page

## Context

Implement the full "Reservoir Raid" page described in PLAN.md. This is a new dashboard event page under `/dashboard/events/reservoir-raid` where R4/R5 alliance members can assign active members to map objectives, view assignments on an interactive map, and export a formatted plan message. R3 and below see a read-only view.

---

## What Exists vs What Needs Building

**Already exists:**

- `/dashboard/events/` hub page with Alliance Siege and Exploration cards
- `AllianceMember` model with `id`, `username`, `active`, `currentRank (AllianceRank enum)`
- `@base-ui/react` (has Dialog + Checkbox), `next-intl` v4, `lucide-react`, design tokens in globals.css
- Server action pattern (`"use server"` in `actions.ts`), auth via `auth.api.getSession()`

**Needs to be built:**

- 2 new Prisma models + migration
- 3 new generic UI components (Checkbox, Sheet, Skeleton)
- 10 feature components + 2 hooks + types + static data
- Translation keys in all 3 locale files
- Server page + actions + loading skeleton
- Card added to events hub

---

## Step-by-Step Execution Order

### 1. Database — new Prisma models

Add to `packages/database/prisma/schema.prisma`:

```prisma
model ReservoirRaidPlan {
  id          String   @id @default("primary")
  lockedBy    String?  @map("locked_by")   // AllianceMember.id
  lockedAt    DateTime? @map("locked_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  assignments ReservoirRaidAssignment[]

  @@map("reservoir_raid_plan")
}

model ReservoirRaidAssignment {
  id          String @id @default(cuid())
  planId      String @map("plan_id")
  objectiveId String @map("objective_id")
  memberId    String @map("member_id")
  plan        ReservoirRaidPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  member      AllianceMember    @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@unique([planId, objectiveId, memberId])
  @@index([planId, objectiveId])
  @@map("reservoir_raid_assignments")
}
```

Also add `raidAssignments ReservoirRaidAssignment[]` relation to `AllianceMember`.

Run `prisma migrate dev --name add_reservoir_raid_plan` from the database package.

### 2. Install panzoom

```bash
cd apps/web && npm install @panzoom/panzoom
```

Also add `"@types/panzoom"` if available, otherwise rely on the library's own types.

### 3. TypeScript types — `apps/web/src/types/objectives.ts`

Mirrors PLAN.md Section 2. `AllianceMember` type uses fields from actual DB schema — no `lang` field (not in DB). Derive `avatarInitials` and `avatarColor` in the page server component before passing to client, not stored in DB.

### 4. Static data

- `apps/web/src/data/tilessurvive-objectives.ts` — 15 objectives with pinX/pinY from PLAN.md Section 3
- `apps/web/src/data/objective-names.ts` — static name record keyed by objective id, three locales, for export generation (no React hook dependency)

### 5. Translation keys — all 3 locale files simultaneously

Add `"objectives"` key block to:

- `apps/web/messages/en.json`
- `apps/web/messages/ru.json`
- `apps/web/messages/tr.json`

Follow PLAN.md Section 13 exactly. **Critical adaptation:** `next-intl` v4 uses `{variable}` for interpolation, NOT `{{variable}}`. Replace all `{{x}}` from PLAN.md with `{x}`.

Example:

- PLAN.md: `"assignedCount": "{{count}} of {{total}} assigned"`
- Actual: `"assignedCount": "{count} of {total} assigned"`

### 6. New generic UI components

**`apps/web/src/components/ui/checkbox.tsx`**
Uses `@base-ui/react/checkbox`. Styled to match design tokens: unchecked = border-border-default, checked = bg-cn-cyan text-void.

**`apps/web/src/components/ui/sheet.tsx`**
Built on `@base-ui/react/dialog`. Adds a `side` prop (`"bottom"` | `"right"`). Bottom variant: `Popup` fixed to bottom, full width, slide-up animation. Right variant: fixed right, full height, slide-left animation. Same backdrop as existing Dialog.

**`apps/web/src/components/ui/skeleton.tsx`**
Simple: `<div className={cn("animate-pulse rounded bg-raised", className)} />`.

### 7. Hooks

**`apps/web/src/hooks/useObjectiveAssignments.ts`**

- State: `Map<objectiveId, Set<memberId>>`
- On mount: call `getPlan()` server action, populate state from returned assignments
- `toggleAssignment(objectiveId, memberId)`: if locked → no-op. Otherwise update state then debounce `savePlan()` call at 800ms.
- Exposes: `assignments`, `locked`, `lastSaved`, `saving`, `saveError`, `toggleAssignment`, `getObjectivesForMember`, `getMemberLoad`, `lockPlan`, `unlockPlan`

**`apps/web/src/hooks/useMapPanzoom.ts`**
Verbatim from PLAN.md Section 7.1. Returns `containerRef` and `resetView`.

### 8. Server actions — `apps/web/src/app/dashboard/events/reservoir-raid/actions.ts`

```ts
"use server";

async function requireMemberSession() {
  // get session, look up AllianceMember by username, return member + session
  // throws if not found or not verified
}

export async function getPlan(): Promise<SerializedPlan>;
// getOrCreate ReservoirRaidPlan with id="primary" + include assignments

export async function savePlan(
  assignments: { objectiveId: string; memberId: string }[],
): Promise<{ ok: boolean }>;
// check rank R4+, check not locked (unless R5), delete all existing assignments,
// createMany new ones, return ok

export async function lockPlan(): Promise<{ ok: boolean }>;
// R5 only; update lockedBy + lockedAt

export async function unlockPlan(): Promise<{ ok: boolean }>;
// R5 only; clear lockedBy + lockedAt
```

### 9. Feature components (in `apps/web/src/components/objectives/`)

Build in this order — each is usable independently before wiring the full page:

1. **`MapPin.tsx`** — SVG `<g>` element, renders at `cx={objective.pinX} cy={objective.pinY}` within viewBox 0 0 100 100. Tier colors, count badge, pulse ring for unassigned high-tier. `pointerEvents="all"` for click.

2. **`MapPanel.tsx`** — Map image + SVG overlay via `useMapPanzoom`. Language switcher (independent from page locale, state local to this component). Zoom controls + reset button. Legend. Map image path from `MAP_IMAGES[mapLang]`.

3. **`PlayerChecklist.tsx`** — List of members with Checkbox, avatar initials, username, objective count badge. Amber count text if member has ≥3 objectives. Search input filters list in memory. Clicking the name (not checkbox) calls `onPlayerNameClick(memberId)`.

4. **`AssignmentPanel.tsx`** — Desktop right panel. Shows selected objective header (name + rate), wraps PlayerChecklist. "Done" button deselects objective. Placeholder text when no objective selected. "X of Y assigned here" count at bottom.

5. **`ObjectiveCard.tsx`** — Mobile card: objective name, rate, assigned player chips (`[username]`), `[+ add]` chip. Amber left border if unassigned. `onClick` opens sheet.

6. **`ObjectiveListView.tsx`** — Scrollable stack of ObjectiveCards, sorted by `ratePerMin` desc.

7. **`PlayerDrawer.tsx`** — Uses Sheet (side="right" desktop / side="bottom" mobile). Shows member's assigned objectives with `[×]` remove button. Shows available objectives with `[+]` add button. Triggered by clicking a player's name.

8. **`ViewToggle.tsx`** — Two Button variant="ghost" components with active state. `"List"` / `"Map"`.

9. **`ExportModal.tsx`** — Uses Dialog. Four format cards (discord / plaintext / per-player / table). Output language selector (single `<select>` or button group). Live preview textarea. Copy button with checkmark feedback. Generate output client-side via a pure function in `apps/web/src/lib/generate-output.ts` using `objective-names.ts`.

10. **`ObjectivesPage.tsx`** — `"use client"` orchestrator. Receives members, plan, `userMemberRank` as props. Assembles responsive layout:
    - Mobile `< md`: ViewToggle → (list: ObjectiveListView + Sheet assignment) / (map: MapPanel + Sheet assignment)
    - Desktop `md–xl`: MapPanel full width + bottom-anchored AssignmentPanel drawer
    - Desktop `xl+`: side-by-side MapPanel (60%) + AssignmentPanel (40%)

### 10. Server page — `apps/web/src/app/dashboard/events/reservoir-raid/page.tsx`

```ts
export const dynamic = "force-dynamic";
```

- Get session, look up AllianceMember by username
- If no matching member: redirect to `/dashboard/events` (or show read-only)
- Fetch active members (ordered by currentRank then username)
- Call `getPlan()` to get current plan
- Derive `avatarInitials` (first 2 chars of username, uppercase) and `avatarColor` (deterministic from username hash — one of 6 preset colors from design tokens)
- Pass serialized data to `<ObjectivesPage>`
- Use `getTranslations("objectives")` for server-rendered strings (page title in `<title>`)

### 11. Loading skeleton — `apps/web/src/app/dashboard/events/reservoir-raid/loading.tsx`

Uses Skeleton component. Mimics the two-panel desktop layout and the list-view mobile layout.

### 12. Wire up navigation

In `apps/web/src/app/dashboard/events/page.tsx`, add a third card:

```tsx
<Link href="/dashboard/events/reservoir-raid">
  <DataCard
    title="Reservoir Raid"
    description="Assign members to map objectives for the Tiles Survive event."
    className="..."
  >
    <Droplets className="text-cn-cyan" />
  </DataCard>
</Link>
```

---

## Key Adaptations from PLAN.md

| PLAN.md assumption               | Actual in this project                                             |
| -------------------------------- | ------------------------------------------------------------------ |
| API endpoints (GET/PUT/POST)     | Server actions in `actions.ts`                                     |
| `AllianceMember.lang` field      | Not in DB — per-player export uses selected output language        |
| `[locale]` in URL                | No locale in URL; cookie-based via `NEXT_LOCALE`                   |
| shadcn Sheet, Checkbox, Skeleton | Not installed — create from `@base-ui/react`                       |
| `{{variable}}` interpolation     | `{variable}` (next-intl v4 syntax)                                 |
| `eventId` dynamic route          | Singleton plan with `id = "primary"`                               |
| Alliance Role from session       | Looked up via `AllianceMember.findUnique({ where: { username } })` |

---

## Files Modified / Created

**New files:**

- `packages/database/prisma/schema.prisma` (modified, +2 models)
- `packages/database/prisma/migrations/[timestamp]_add_reservoir_raid_plan/`
- `apps/web/src/types/objectives.ts`
- `apps/web/src/data/tilessurvive-objectives.ts`
- `apps/web/src/data/objective-names.ts`
- `apps/web/src/lib/generate-output.ts`
- `apps/web/src/components/ui/checkbox.tsx`
- `apps/web/src/components/ui/sheet.tsx`
- `apps/web/src/components/ui/skeleton.tsx`
- `apps/web/src/hooks/useObjectiveAssignments.ts`
- `apps/web/src/hooks/useMapPanzoom.ts`
- `apps/web/src/components/objectives/MapPin.tsx`
- `apps/web/src/components/objectives/MapPanel.tsx`
- `apps/web/src/components/objectives/PlayerChecklist.tsx`
- `apps/web/src/components/objectives/AssignmentPanel.tsx`
- `apps/web/src/components/objectives/ObjectiveCard.tsx`
- `apps/web/src/components/objectives/ObjectiveListView.tsx`
- `apps/web/src/components/objectives/PlayerDrawer.tsx`
- `apps/web/src/components/objectives/ViewToggle.tsx`
- `apps/web/src/components/objectives/ExportModal.tsx`
- `apps/web/src/components/objectives/ObjectivesPage.tsx`
- `apps/web/src/app/dashboard/events/reservoir-raid/page.tsx`
- `apps/web/src/app/dashboard/events/reservoir-raid/actions.ts`
- `apps/web/src/app/dashboard/events/reservoir-raid/loading.tsx`

**Modified files:**

- `apps/web/messages/en.json` (+objectives namespace)
- `apps/web/messages/ru.json` (+objectives namespace)
- `apps/web/messages/tr.json` (+objectives namespace)
- `apps/web/src/app/dashboard/events/page.tsx` (+Reservoir Raid card)
- `apps/web/package.json` (+@panzoom/panzoom)

---

## Verification

1. Run `npm run dev` from repo root (via turbo). Navigate to `/dashboard/events` — Reservoir Raid card appears.
2. Open `/dashboard/events/reservoir-raid` — page loads with member list from DB. Map image loads (after assets are placed in `public/maps/`).
3. Click a map pin → assignment panel shows member list. Check/uncheck members → "Saving…" indicator appears, fades to "Saved".
4. Switch locale (EN→RU→TR) — all UI strings update. Map language switcher is independent.
5. Export modal opens, all four formats generate a non-empty preview string.
6. Copy button copies text and shows checkmark.
7. R5 user sees Lock plan button. After locking, R4 user sees lock banner and no edit controls.
8. Run `npm run typecheck` from `apps/web` — zero errors.

**Note on map image assets:** The three `.webp` files (`tiles-survive-en.webp`, `tiles-survive-ru.webp`, `tiles-survive-tr.webp`) must be placed in `apps/web/public/maps/` before the map renders. This is a manual asset step outside of code.
