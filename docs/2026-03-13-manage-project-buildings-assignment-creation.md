# Title
Enable assignment creation from Manage Project Buildings tab

# Context
Users could only create assignments from the Detail Plan flow. In Manage Project > Buildings, users could view and edit assignments but not place and create new ones directly on floor plans.

# Scope
- Add assignment creation flow to Buildings tab when a floor is selected.
- Reuse existing assignment creation server action and access control.
- Keep building placement behavior unchanged on master plan.

# Implementation Summary
- Added a placement flow in Buildings tab for selected floors:
  - New "Place Activity" action in view mode.
  - "Exact Point" placement for activities on floor plans.
  - Create form shown in right-side details panel while creating assignments.
- Added new local form state and create handler in Buildings tab.
- Wired creation to existing server action used in Detail Plan.
- Updated server action type to accept optional polygon payload (non-breaking).
- Fixed map click handler to capture coordinates while in floor + placing mode.
- Updated helper text to reflect floor activity placement versus master building placement.
- Activity list is temporarily replaced by the creation form only while assignment placement mode is active.
- Removed status input from assignment creation UI; new assignments now rely on backend default status Pending.

# Files Updated
- src/app/manage-project/tabs/BuildingsTab.tsx
- src/app/detail/[floorId]/actions.ts

# Validation
- npm run lint
- npx tsc --noEmit

# Pending Work
- Optional: support free-draw polygon activity creation from Buildings tab (currently point placement only).
- Optional: add automated integration test for activity creation from Manage Project > Buildings.

# Change Log
- 2026-03-13: Initial implementation of assignment creation flow from Buildings tab.
- 2026-03-13: UX follow-up moved assignment creation form from map overlay to right panel, temporarily replacing the activities list while placing.
- 2026-03-13: Removed status field from create form to enforce Pending as default at creation time.