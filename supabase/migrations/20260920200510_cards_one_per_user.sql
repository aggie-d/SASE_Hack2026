-- One virtual card per user, enforced by the database.
--
-- POST /api/v1/cards does a select-then-insert to prevent a second card, but
-- two concurrent requests can both pass the select and both create a Lithic
-- card. This index makes the second insert fail with 23505 instead.
--
-- The unique index also serves every lookup the old non-unique index did,
-- so that one is dropped rather than kept alongside it.

DROP INDEX IF EXISTS cards_user_id_idx;

CREATE UNIQUE INDEX cards_user_id_uidx ON cards(user_id);
