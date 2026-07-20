# Lumevina — App Store launch checklist

Everything is staged: the site is the app (`app/` wraps it with Capacitor),
the server blueprint is in `server/`, the icon and splash are drawn, and the
privacy policy page exists. What remains needs two accounts (Apple, Stripe)
and a Mac — this file is the exact order to do it in.

## 0. Accounts (do these first — Apple's takes a day or two)

- [ ] **Apple Developer Program** — enroll at
      [developer.apple.com/programs](https://developer.apple.com/programs)
      ($99/year). Enroll as an individual or as the business (a business
      enrollment shows "Lumevina" as the seller but requires a D-U-N-S number).
- [ ] **Stripe** — [stripe.com](https://stripe.com); activate the account with
      the spa's business details so live payments are enabled.
- [ ] **Supabase** — free account; follow `server/README.md` end to end.
      The app is approvable without the server, but bookings/rewards would
      stay device-local — do the server first.

## 1. Make the backend real (server/README.md)

- [ ] Apply `schema.sql`, deploy both edge functions, set the Stripe secrets.
- [ ] Swap the four client integration points listed in `server/README.md`
      (payments, availability, rewards, sign-in).
- [ ] Host the site (Netlify or GitHub Pages) so `privacy.html` has a public
      URL — App Store Connect requires one.

## 2. Build the iOS project (on a Mac)

```sh
# prerequisites: Xcode from the App Store, then: xcode-select --install
cd lumevina/app
npm install
npm run build          # copies the site into www/
npx cap add ios        # generates the Xcode project (first time only)
npm run assets         # generates all icon/splash sizes from resources/
npx cap sync
npm run ios            # opens Xcode
```

In Xcode:

- [ ] Select the **App** target → *Signing & Capabilities* → set the Team to
      your Apple Developer account. Bundle ID is already `com.lumevina.spa`.
- [ ] Add the **Push Notifications** capability, and **Background Modes →
      Remote notifications**.
- [ ] Plug in an iPhone, select it as the run target, press ▶ — the site
      should appear as a native app. (Safari cache issues disappear here:
      each build ships its own copy.)

## 3. Native niceties (small, high-impact)

- [ ] **Apple Pay** — in Stripe: Settings → Payment methods → Apple Pay →
      register the merchant ID; in Xcode add the Apple Pay capability with
      that merchant ID. The PaymentIntent from `create-deposit-intent`
      already enables it (`automatic_payment_methods`).
- [ ] **Push notifications for flash openings** — create an APNs key in the
      Apple Developer portal (Keys → +, enable APNs), upload it to your push
      provider (Supabase edge function with APNs, or OneSignal), and register
      tokens via `@capacitor/push-notifications` (already a dependency).
- [ ] **Haptics on the mystery petal** — one line where the petal reveals:
      `Haptics.impact({ style: ImpactStyle.Light })` from `@capacitor/haptics`.

## 4. TestFlight (real phones, before review)

- [ ] In Xcode: Product → Archive → Distribute App → App Store Connect.
- [ ] In [App Store Connect](https://appstoreconnect.apple.com): create the
      app (name **Lumevina**, bundle `com.lumevina.spa`), then add the build
      to **TestFlight** and invite Evelyn + a few clients by email.
- [ ] Fix what they find; repeat archive → upload (takes ~10 minutes once
      you've done it twice).

## 5. The listing

Draft copy (edit to taste):

- **Name:** Lumevina Aesthetics Spa
- **Subtitle:** Facials, waxing & Glow Rewards
- **Keywords:** facial, esthetician, waxing, skincare, spa, woodland hills,
  brazilian wax, acne, dermaplaning, peel
- **Description:** Book bespoke facials and waxing at Lumevina Aesthetics
  Spa in Woodland Hills — and let every visit give back. Reserve your time
  in seconds with a 50% deposit (Apple Pay ready), stack services back to
  back, and earn Glow Points on everything: double points on Wax Wednesday,
  bonuses for rebooking, your birthday month, and referrals. Flash openings
  go out to the app first — one starred time each day at 10% off, first tap
  wins. 🌹
- **Category:** Lifestyle (secondary: Health & Fitness)
- **Age rating:** 4+ · **Price:** Free
- **Privacy policy URL:** `https://<your-site>/privacy.html`
- **App Privacy questionnaire:** collects Name, Email, Purchases (booking
  history) — all "linked to you," none used for tracking. Payment data is
  handled by Stripe.

Screenshots (required sizes: 6.9" and 6.5" iPhones — take them in the iOS
Simulator via Xcode): hero, booking calendar with the ⚡ flash slot, the
session builder with clock times, Glow Rewards modal, booking success with
the mystery petal.

## 6. Submit for review

- [ ] **Review notes:** include a demo sign-in (any email works with magic
      link in test mode) and a Stripe **test card** (4242 4242 4242 4242) so
      the reviewer can complete a booking without a real charge. Say
      explicitly: "Booking a service requires a 50% deposit; test mode is
      enabled for review."
- [ ] Guideline notes you already satisfy: native features beyond the
      website (push, Apple Pay, haptics, rewards) for 4.2; guest booking
      without an account for 5.1.1; no third-party login so 4.8 (Sign in
      with Apple) does not apply; physical services are correctly sold via
      Stripe rather than In-App Purchase per 3.1.5(a).
- [ ] Typical review time: 1–2 days. Rejections come with a message — fix,
      re-archive, resubmit.

## 7. After launch

- [ ] Go live on the site: the Glow Rewards section already shows a
      "Coming soon to the App Store" badge — wrap it in a link to your App
      Store page (`https://apps.apple.com/app/id...` from App Store Connect)
      and change the top line to "Download on the", or swap it for Apple's
      official badge artwork from
      [developer.apple.com/app-store/marketing/guidelines](https://developer.apple.com/app-store/marketing/guidelines/)
      (the HTML comment above the badge in index.html has the steps).
- [ ] Post the referral codes push on Instagram (@lumevina).
- [ ] Watch Supabase's table editor for the first real bookings, and Stripe's
      dashboard for deposits.

## Ongoing updates

The site remains the single codebase. To ship an app update:

```sh
cd lumevina/app && npm run sync && npm run ios
# then in Xcode: bump the version, Archive → upload
```
