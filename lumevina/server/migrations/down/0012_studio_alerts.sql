-- Reverses 0012 (alerts of the two new kinds must be gone first, or this fails).
alter table studio_alerts drop constraint if exists studio_alerts_kind_check;
alter table studio_alerts add constraint studio_alerts_kind_check
  check (kind in ('order', 'question', 'low_stock', 'gift', 'test', 'booking', 'cancel', 'member', 'waitlist'));
