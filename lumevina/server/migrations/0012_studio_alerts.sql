-- 0012 · Two kinds of alert for Evelyn's feed
--
-- consult  functions/_shared/notify.ts has sent alerts of kind 'consult' since
--          the consult gate (Oct 21), but the table only allowed nine kinds,
--          so those inserts failed and consult requests never reached the
--          dashboard's feed (the push and email still went out).
-- skin     Skin Intelligence: images ready for review, a recovery check-in a
--          client asked her to look at, a data request. The text never names
--          the client or describes their skin: it says where to look.

alter table studio_alerts drop constraint if exists studio_alerts_kind_check;
alter table studio_alerts add constraint studio_alerts_kind_check
  check (kind in ('order', 'question', 'low_stock', 'gift', 'test', 'booking', 'cancel', 'member', 'waitlist', 'consult', 'skin'));
