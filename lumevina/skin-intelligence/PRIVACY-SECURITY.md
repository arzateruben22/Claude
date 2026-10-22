# Skin Intelligence: privacy, security and compliance

This is an engineering assessment and a checklist for counsel, not legal advice. **No real client is enrolled until every item under "Before the pilot" is done.**

## What is held, and how sensitive it is

| Data | Where | Who sees it |
|---|---|---|
| Facial and close-up skin photographs (originals, untouched) | Supabase Storage, private bucket `skin-images`, no storage policies | The client and the practitioner caring for them, through 5-minute signed links; every link issued is audited |
| Measurements, quality checks, difference maps | Postgres, RLS on, no browser policies | Practitioner; the client sees values the practitioner hasn't rejected, without her notes |
| Treatment records (settings, private notes, reactions) | Postgres, RLS on, no browser policies | Practitioner only; the client sees the summary line she writes |
| Skin profile, routine, check-ins, reports, consents | Postgres, RLS on, client read-only policies on their own rows | Client and practitioner |
| Who looked at or changed what | `audit_log`, append-only | Admins |

Identifiable facial images with treatment history are treated as highly sensitive health-adjacent data under every regime below, whether or not a regime technically applies.

## Controls in place (built and tested)

* **Authorization on the server, from the verified token.** Clients act only on their own record (no client id or email is taken from a request body). Staff need an active staff row **and** a multifactor sign-in (aal2). The shared `STUDIO_KEY` is refused. Practitioners open only clients the clinic's assignment mode allows; admin-only actions refuse practitioners. 92 Node tests include client-to-client isolation, studio-key refusal, MFA refusal, assignment and admin checks, all against real Postgres with Supabase's default grants.
* **Row-level security** on every table in `public` (a test fails if any table lacks it). Clinical tables have no browser policies at all; the anon key reads nothing but published consent texts. Migration 0010 also closed three existing gaps (`reward_balances` exposed every client's email and points to the anon key; `flash_slots` and `notifications` had no RLS).
* **Private images**: no public bucket, no storage policies, single-object signed upload URLs, 5-minute signed view URLs (60–900 s, admin setting), the service worker never caches them.
* **Immutability** enforced by database triggers: originals, measurements, approved reports, signed treatment records, consents (withdrawal only), the audit log. A retention run is the only exception.
* **Audit log** of every image link, record opening, change, refusal, export and deletion; addresses stored only as a salted hash; never note text or images.
* **Rate limits** (Postgres token bucket) on every client and staff action that writes or issues links.
* **Consent**: four separate, versioned consents with the exact text and its hash; a yes needs a typed signature; a no is recorded as clearly as a yes; withdrawal is one tap and takes effect immediately.
* **No external AI** in Skin Intelligence. The chat's existing photo path now sends photos to the assistant only with the separate AI-processing consent; without it Evelyn still sees them.
* **Wording guard** on every built-in label and message (tests), and on what the practitioner writes for a client (summary lines and reports are checked when saved; approval is refused until it reads safely).
* **Data rights**: the client can download a copy (JSON, plus each photo) and ask for deletion; an admin completes it (`purge_skin_profile` removes photos and everything derived, keeps signed treatment records if retention requires, keeps consents and the audit log as the record).
* **Synthetic data only** in the repository and the demo.

## Regulatory reading (for counsel to confirm)

* **HIPAA.** Likely not a covered entity: a solo esthetician who doesn't bill health plans electronically. If counsel says it applies (for instance under physician supervision), BAAs are needed with Supabase (its HIPAA add-on is on the Team plan, about $599/month; verify current pricing), Resend, Twilio and Google; Anthropic is outside the imaging path by design.
* **California CMIA.** Applies to "providers of health care"; whether an esthetician's treatment records qualify is for counsel. The design already meets CMIA's core expectations (confidentiality, authorization to disclose, access logging).
* **CCPA/CPRA.** Facial images and skin data are sensitive personal information. The small-business thresholds may exempt Lumevina, but the consent, access, deletion and retention mechanics satisfy the obligations either way. The system never does face recognition or identification; images are compared only within one client's own record.
* **FTC Health Breach Notification Rule** can reach non-HIPAA services holding health information: the incident plan below includes notification.
* **FDA.** Documenting and comparing the visible appearance of skin for cosmetic tracking, with no diagnosis or treatment recommendation, is the general-wellness kind of use that stays outside device regulation. The wording guard, the "what photographs can't measure" panel, and the refusal to suggest needle depth, energy or eligibility are what keep it there; any feature that would diagnose, screen moles, or recommend settings must go back to counsel first.
* **Scope of practice.** Every label says "visible" or "apparent"; the state board's limits for estheticians apply to what is said in reports.

## Before the pilot (blocking)

- [ ] Counsel reviews this document and the four consent texts; approved wording is published as version `1` (`consent_texts`), replacing `1-draft`.
- [ ] Counsel decides HIPAA/CMIA applicability and the **retention periods** (treatment records, images after a deletion request, audit log); set them in Admin → Settings → retention.
- [ ] Vendor list confirmed with what each sees: Supabase (all of it), the worker host (images, transiently), Resend/Twilio/Google (no skin data: alerts say where to look, never who or what), Anthropic (chat only, photos only with consent), the static host (no data).
- [ ] Supabase on a paid plan with daily backups (point-in-time recovery recommended once real records exist); encryption at rest is Supabase's default; confirm the region.
- [ ] Auth: MFA (TOTP) enabled; staff accounts created; Evelyn's authenticator set up and a recovery factor stored safely.
- [ ] `privacy.html` rewritten for Skin Intelligence (draft below) and the chat photo consent.
- [ ] A security pass on the live project with synthetic data: try another client's ids, an expired token, the anon key, a client token on the studio function, a password-only staff token; confirm each is refused and audited.
- [ ] The repeatability protocol run (VALIDATION.md) before any change detection is shown.

## Incident response (short form)

1. **Contain**: revoke sessions (Supabase Auth → sign out all users for the affected accounts), rotate the service role key and `AUDIT_SALT`, disable the worker.
2. **Assess** from `audit_log`: which profiles, which records, which actor, when.
3. **Notify**: affected clients without unreasonable delay; regulators as counsel advises (California's breach law; the FTC rule if applicable; HIPAA if applicable).
4. **Record** what happened and what changed, in this folder.

## Retention run (when counsel has set the periods)

Run as the service role in one transaction: `select set_config('lumevina.purge', 'on', true);` then delete audit rows older than the audit period, and complete open deletion requests older than the images period with `purge_skin_profile`. The triggers refuse these deletes outside that setting.

## Draft privacy-page section (for counsel)

> **My Skin.** If you choose to keep a skin record with us, we store photographs of your skin taken at your visits (and any you add), measurements made from them, and records of your treatments. They are stored privately in our database provider's secure storage, seen only by you and the practitioner caring for you, and every viewing is logged. They are never posted, never shared, and never sent to an AI service. Measurements describe how your skin looks in a photograph; they are not a medical assessment. You can download a copy or ask us to delete your skin record at any time in My Skin → Privacy; we may need to keep signed treatment records for a period the law requires, and we will tell you what was kept.
