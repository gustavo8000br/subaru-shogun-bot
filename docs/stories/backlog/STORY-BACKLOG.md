---
type: story-backlog
source: Story 0.3 PO review
updated_at: 2026-09-28
---

# Story Backlog

Follow-ups tracked at the configured `storyBacklog.location` (`docs/stories/backlog`).

## High Priority

#### [STORY-0.3-F1] Complete Story 1.4 permission setup and edge-case UX
- **Source**: @po review of Story 0.3 against ADR-003 and Human Decisions 002/003
- **Priority**: 🔴 HIGH
- **Effort**: 1–2 hours for story refinement
- **Status**: 📋 TODO
- **Assignee**: @po
- **Sprint**: Before Story 1.4 validation
- **Risk**: HIGH — incomplete user-facing handling can leave administrators unsure how to safely configure staff access or recover broken role configuration.
- **Description**: Refine Story 1.4 so its acceptance criteria cover the approved product/architecture contract without adding permissions: independent per-guild, default-off staff visibility in squad text and connection to voice; role-ID/capability configuration; the bootstrap-only `Administrator`/`ManageGuild` fallback and its audit event; deleted/unresolvable staff roles reported through `/diagnostics` without fail-open access; and actionable handling when the bot lacks effective Discord permissions. Cover revalidation at action time and preserve guild boundaries.
- **Success Criteria**:
  - [ ] Story 1.4 maps each behavior above to an observable acceptance criterion and a responsible role/action.
  - [ ] The UI/command behavior does not contradict Decisions 002/003 or ADR-003 and does not grant broader Discord permissions.
  - [ ] QA can derive positive and negative cases for opt-in toggles, bootstrap fallback, deleted roles, missing bot permissions, stale components, and cross-guild interactions.
  - [ ] Architect reviews the refined story; QA validates it before any implementation status transition.
- **Acceptance**: Story 1.4 is updated and passes its AIOX validation/readiness workflow; the follow-up is then marked DONE.
