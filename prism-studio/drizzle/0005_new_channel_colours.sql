-- The two new channels: final colours (Outer Layer: water #00685F; Back of the Envelope: marker #EB63FF).
-- Data only: a row still on its old seeded default is updated; a colour set by hand is left alone.
UPDATE "channels" SET "color" = '#00685F', "color_ink" = '#00685F', "updated_at" = now() WHERE "slug" = 'skincare' AND "color" = '#D99A92';--> statement-breakpoint
UPDATE "channels" SET "color" = '#EB63FF', "color_ink" = '#A21CAF', "updated_at" = now() WHERE "slug" = 'whatif' AND "color" = '#F2A93B';
--> statement-breakpoint
-- Both names are final (owner, 2026-10-30): the screens stop calling them working names.
UPDATE "channels" SET "name_provisional" = false, "updated_at" = now() WHERE ("slug" = 'skincare' AND "name" = 'Outer Layer') OR ("slug" = 'whatif' AND "name" = 'Back of the Envelope');
