# Launching Lumevina Studio: what's left on your side

Everything that could be done without an Etsy login is done: ten products, five listing photos
each, the titles, tags and descriptions, the shop's words and art, and a script that uploads it all.
What's left needs Evelyn's eyes, her Etsy account, or a click only a person can make.

## 1 · Evelyn reviews the products (about 2 hours)

Work through **REVIEW.md**. The listings say a licensed esthetician reviewed everything, so this step
comes first. Send over any changes; the files and photos rebuild in a minute.

## 2 · Open the Etsy shop (about 30 minutes, Evelyn)

1. Go to **etsy.com/sell** and sign up with Evelyn's email. Turn on two-factor sign-in.
2. Shop preferences: English, United States, US dollars.
3. Shop name: **LumevinaStudio** (backups are in SHOP.md).
4. Skip the first listing if Etsy lets you; otherwise make a quick placeholder and delete it later.
5. Payments: her bank account for payouts, a card on file for Etsy's fees, and her tax details.
   Etsy may charge a one-time setup fee (about $15 in the US).
6. Etsy may ask to verify her identity with a photo ID.

## 3 · Set up the shop (about 20 minutes)

From **SHOP.md**: icon (`dist/etsy/shop/icon.png`), banner (`dist/etsy/shop/banner.jpg`), shop
title, announcement, About story, policies, FAQ, and the four sections.

## 4 · Put the listings up (pick one)

**The fast way: the upload script (about 20 minutes plus Etsy's approval)**

1. At **etsy.com/developers/register**, create an app ("Lumevina Studio uploader", personal use for
   your own shop). Add the callback URL `http://localhost:3003/callback`. Etsy may take a few days to
   approve it.
2. On a computer with Python 3, in the `lumevina/pro` folder:

   ```
   export ETSY_API_KEY=the_keystring
   export ETSY_SHARED_SECRET=the_shared_secret
   python3 etsy/upload.py login
   python3 etsy/upload.py check
   python3 etsy/upload.py push --dry-run
   python3 etsy/upload.py push
   ```

   `push` creates all ten listings as **drafts** with their photos and download files.
3. If `check` can't find a category, run `python3 etsy/upload.py taxonomy template`, pick the one that
   reads like "Paper & Party Supplies > … > Templates", and put its number in `etsy/config.json`
   as `{"taxonomy": {"01": 1234, "02": 1234, ...}}`.

**By hand (about 15 minutes a listing)**

Open `dist/etsy/listings.csv` (or listings.json). For each listing: *Add a listing*, then

- Photos: the five images in `dist/<product>/images/`, in order.
- Title, description, tags and price: copy them from the file.
- About this listing: **Digital files**, **I did**, **A finished product**, **Made to order**.
- Category: Paper & Party Supplies › Paper › Stationery › Design & Templates › Templates
  (Calendars & Planners for the planner and journal).
- Section: as listed.
- Digital files: everything in `dist/<product>/files/`, Start Here first.

## 5 · Publish (Evelyn)

Open each draft in Shop Manager, check it on the phone preview, and publish. Etsy charges $0.20 per
listing, renewed every four months or when it sells.

## 6 · The first sales and reviews (the first two weeks)

- **Launch sale:** Shop Manager › Marketing › Sales and discounts: 30% off for 14 days.
- **Tell the people who'd use it:** Evelyn's esthetics school classmates, instructors, and esthetician
  friends and groups. Early honest reviews move a new shop up in search faster than anything else.
  Never trade free products for reviews; Etsy doesn't allow it.
- **Pinterest:** make a free business account called Lumevina Studio, claim the Etsy shop, and pin
  every listing photo to boards like "Esthetician Forms" and "Esthetician Business". Pinterest is the
  biggest free source of buyers for templates.

## 7 · Later: a second storefront

Once the shop has its first sales, put the same files on **Payhip** (free plan) and link it from
Instagram and Pinterest, so followers can buy directly and more of each sale stays with Evelyn.

---

## What Etsy keeps from a sale

On the $24 Intake & Consent Kit:

| | |
|---|---|
| Listing fee | $0.20 |
| Transaction fee, 6.5% | $1.56 |
| Payment processing, 3% + $0.25 | $0.97 |
| **Evelyn keeps** | **$21.27 (89%)** |

If the sale came from an Etsy offsite ad, Etsy takes another 15% ($3.60) on that sale only. Sales
tax on digital downloads is collected and paid by Etsy in most states.

## Other places to sell the same files

| Where | What they keep | Buyers come from | Best for |
|---|---|---|---|
| **Etsy** | $0.20 a listing, 6.5% + 3% + $0.25 a sale (plus 15% on offsite-ad sales) | Etsy's own search, millions of shoppers | Being found by people who don't know you yet |
| **Payhip** | 5% on the free plan (2% on the $29/month plan, 0% at $99/month), plus card fees | You bring them | Selling from Instagram and Pinterest; handles EU tax |
| **Stan Store** | $29/month, no cut of sales, plus card fees | You bring them | A link-in-bio shop that also sells coaching and courses |
| **Lemon Squeezy** | 5% + 50¢ a sale, handles sales tax worldwide | You bring them | Selling worldwide without tax paperwork |
| **Gumroad** | 10% + 50¢ a sale (30% on sales from its Discover page) | Mostly you | The simplest setup |
| **Lumevina's own site** | Stripe's 2.9% + 30¢ | Evelyn's clients | The Skin Journal and Skin School, next to her services |
| **Amazon KDP** | Print on demand; royalty is about 60% of the price minus printing | Amazon search | The Skin Journal and Planner as paperback books |

Every other platform keeps less per sale than Etsy does, but only Etsy and Amazon bring buyers who've
never heard of you. The plan is Etsy for discovery, then Payhip or the Lumevina site for the people
who already follow Evelyn.

## Growing it (the next 90 days)

1. **Month 1:** all ten listings live, the launch sale, Pinterest, and five reviews.
2. **Month 2:** look at Etsy Stats. A listing with views but no sales needs a better first photo or
   price; one with no views needs new title words and tags. Add two new products.
3. **Month 3:** Payhip storefront, the Skin Journal on the Lumevina site, and the planner and journal
   as KDP paperbacks.

**Next products, in order of demand:** lash and brow forms, a waxing-only kit, Spanish-language
versions of the intake and aftercare (translated and checked by a native speaker), state board exam
study guides for esthetics students, gift certificate templates, and Instagram post templates. Each
one is a single content file here: `build.py` makes the files and photos and `etsy/upload.py` puts
it up, so a new product takes an hour or two plus Evelyn's review.
