# ReplyIQ - Next Steps

> Immediate work only. Update this file when tasks change.

**Last Updated:** 2026-07-23

---

## Current Milestone

**Milestone 4A: Business Onboarding** -- Complete

Business profile, domain management, domain verification (DNS TXT + HTML meta), onboarding wizard, dashboard, and all frontend-backend integration working.

---

## Next Milestone

**Milestone 4B: Team Management & Polish**

- User invitation system
- Team member management (invite, roles, remove)
- Business logo upload
- Additional profile fields

---

## Immediate Next Task

Design the user invitation flow. Plan the endpoints, email templates, and UI for inviting team members to a business workspace.

---

## Blocked Items

None currently.

---

## Future Tasks

1. Login rate limiting (throttler decorator)
2. Password change endpoint
3. CORS restriction to specific origins
4. Extract `parseTtlToSeconds()` to shared utility
5. Populate `.env.example` with all required variables
6. Business logo upload (S3/local storage)
7. User invitation emails
8. Role-based access control beyond JWT payload
9. Begin Milestone 5: Knowledge Engine
