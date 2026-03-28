# Baithak Roadmap

> Current focus: notification improvements for the existing app
> Direction: ship a stronger `v1.5` before committing to a full `v2`

---

## Current Position

Baithak is already past the starter-app stage.

What exists now:
- Authentication
- Admin approval flow
- Realtime chat with WebSockets
- File uploads
- Edit and delete for own messages
- Emoji support
- Windows desktop packaging path

What this means:
- We do not need a ground-up `v2` yet
- We should extend the current product carefully
- Notifications are the right next feature because they improve daily usefulness without forcing a rewrite

---

## Product Decision

### Why not jump to `v2` yet

The current app already covers the core messaging flow. The biggest need now is re-engagement and visibility, not a new architecture.

We should only start a true `v2` if one of these becomes clear:
- the current data model cannot support the next major features cleanly
- the frontend becomes difficult to extend safely
- deployment or background-job needs outgrow the current setup
- notification, room, or DM work exposes structural limits we cannot patch cleanly

Until then, the right move is `v1.5`.

---

## Notification Roadmap

### Phase 1: Unread Tracking

Goal:
- Establish a reliable unread system per user

Why this comes first:
- Every other notification feature depends on accurate unread data
- It improves the app immediately even without email or browser notifications

Scope:
- Track each user's last-read position or timestamp
- Compute unread count for each user
- Reset unread count when the user opens or reads the chat
- Show unread badge in the UI
- Update browser tab title when unread messages exist

Success criteria:
- A user can leave chat, come back, and see correct unread count
- Unread count clears only when messages are actually read
- Counts remain correct across refreshes and reconnects

Notes:
- This is the foundation for browser notifications and email summaries

---

### Phase 2: Browser Notifications

Goal:
- Notify users about new messages while the tab is hidden

Scope:
- Ask for browser notification permission only when needed
- Trigger notifications for new incoming messages while user is away
- Avoid notifying for the user's own messages
- Avoid duplicate alerts when the tab is visible and focused

Success criteria:
- New messages trigger browser notifications only in the right context
- Users are not spammed while actively chatting

Notes:
- This is lower cost than full push notifications
- It builds naturally on top of Phase 1 unread state

---

### Phase 3: 24-Hour Unread Email Summary

Goal:
- Re-engage inactive users with a gentle unread reminder

Core idea:
- Send an email after 24 hours if a user still has unread messages on Baithak

Example:
- "You have 18 unread messages on Baithak."

Scope:
- Send only if unread count is above a meaningful threshold
- Send only if the user has been inactive for at least 24 hours
- Send at most once per digest window
- Include a direct link back to chat

Dependencies:
- Reliable unread tracking
- User email preferences
- Background job or scheduled task support
- Email delivery provider

Success criteria:
- Emails are timely and accurate
- Users receive helpful reminders, not noise
- Duplicate or repeated digest sends are prevented

Risks to manage:
- Incorrect unread counts
- Over-emailing
- Missing unsubscribe or preference controls

---

### Phase 4: Notification Preferences

Goal:
- Let users control how Baithak reaches them

Scope:
- Toggle email summaries on or off
- Toggle browser notifications on or off
- Optional quiet hours later
- Optional digest frequency controls later

Success criteria:
- Notification behavior is transparent and user-controlled

---

## Suggested Build Order

1. Add unread tracking to the backend data model and message flow
2. Surface unread indicators in the frontend
3. Verify unread behavior across refresh, reconnect, and multiple users
4. Add browser notifications for hidden tabs
5. Add scheduled 24-hour unread summary emails
6. Add notification preferences

---

## Technical Planning Notes

### Backend work likely needed

- Add a per-user read state
- Update message fetch or socket flow to mark messages as read
- Expose unread count data through API
- Add scheduled task support for email summaries
- Record last-digest-sent timestamp to prevent duplicate sends

### Frontend work likely needed

- Store and display unread count
- Mark chat as read at the right time
- Update document title with unread count
- Add browser notification permission flow
- Add settings UI later for notification preferences

### Infrastructure work likely needed for email phase

- Choose an email provider
- Add a scheduler or cron-style job
- Add safe production configuration for notification jobs

---

## Open Questions

- Should unread state be timestamp-based or last-message-id-based?
- Should opening `/chat` mark everything as read immediately, or only after the view is focused?
- Should email summaries be daily only, or only after 24 hours of inactivity?
- What minimum unread count should trigger an email?
- Should admin users get the same notification behavior as regular users?

---

## Immediate Next Step

Start with `Phase 1: Unread Tracking`.

That is the smallest high-value feature in this roadmap and the cleanest base for everything after it.
