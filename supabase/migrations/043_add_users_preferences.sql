-- consumer/settings.tsx has run `supabase.from('users').select('preferences')`
-- (and `.update({ preferences: ... })`) since the Notifications section was
-- built, but no migration from 001 through 042 ever added a `preferences`
-- column to `users` -- flagged as a real, unresolved finding in 042's header
-- comment rather than guessed at there. Confirmed directly against
-- production (information_schema.columns returned zero rows for
-- users.preferences) rather than assumed: the column genuinely doesn't
-- exist, so every consumer hitting Settings has been getting the
-- Notifications section's load-error state, and every save attempt has
-- been failing with "Failed to save preferences" -- a real, live bug, not
-- a hypothetical one.
--
-- This is the only place in the entire app (mobile, backend, or any other
-- migration) that reads or writes this column -- it backs exactly one
-- toggle (Email Notifications, `{ email: boolean }`), not a general
-- preferences blob with other fields hiding behind it.
--
-- NOT NULL DEFAULT '{}'::jsonb rather than a nullable column: the client
-- already tolerates a missing/null value gracefully (`if (data?.preferences)`
-- just skips the merge, leaving its own `{ email: true }` default), but a
-- settings blob that's never actually NULL is one less case for any future
-- reader of this column to handle. Postgres backfills the default for
-- existing rows as part of the same ALTER TABLE, so this needs no separate
-- UPDATE.

ALTER TABLE users
  ADD COLUMN preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
