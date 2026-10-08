-- Love, Written — Photobooth live view (see each other while posing)
-- Run AFTER 0005. Safe to run once.
--
-- The video itself goes directly between the two browsers (WebRTC, encrypted) — never
-- through or into our servers. The database only passes each person's connection details
-- ("session description") to the other person once, so the browsers can find each other.
alter table photobooth_participants
  add column if not exists rtc_signal jsonb
  check (rtc_signal is null or pg_column_size(rtc_signal) < 24000);
