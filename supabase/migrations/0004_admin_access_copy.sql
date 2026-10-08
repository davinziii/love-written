-- Love, Written — admin-viewable copy of the customer's private link
-- Run AFTER 0001–0003. Safe to run once.
--
-- Holds the private link + recovery code ENCRYPTED (AES-256-GCM, key derived from
-- APP_HASH_PEPPER on the server). Access checks still use the one-way hashes; this
-- only lets an admin re-send the link while a surprise is unpublished.
alter table surprises add column if not exists edit_access_enc text;
