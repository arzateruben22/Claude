"""07 · Rebooking & Membership Scripts: what to say, and text, so clients rebook, join and come back."""

SLUG = "07-rebooking-membership-scripts"
NAME = "Rebooking & Membership Scripts"


def S(when, words):
    return ("script", when, words)


P1 = {"name": "In the room", "kicker": "Scripts", "blocks": [
    ("title", "The _Scripts_", "What to say, and what to text, so clients rebook, join your membership and come back. "
     "Word for word, in a voice that never feels pushy."),
    ("callout", "Why scripts work", "Clients decide in the moment. One clear, kind sentence at the right time does more "
     "than any ad. Read these out loud a few times, then make them yours. Words in [brackets] are yours to fill in."),
    ("h", "The rebook, in the treatment room"),
    S("Near the end, while the mask is on", "Your skin really responded today. To keep this going, I'd love to see "
      "you in four weeks, when your skin finishes its next cycle. Do mornings or evenings work better for you?"),
    S("At checkout", "Let's get your next visit in before you go. I have [Tuesday the 14th at 10] or [Thursday the "
      "16th at 5]. Which is better?"),
    S("If they hesitate", "No pressure at all. I'll hold [Tuesday at 10] for you until tomorrow evening. Just text me "
      "to confirm, or I'll let it go."),
    S("If they want to wait", "Totally fine. I'll send you a reminder in three weeks so you don't lose your spot."),
    ("p", "**Offer two times, not an open question.** “When do you want to come back?” invites “I'll let "
          "you know.” Two choices make yes the easy answer."),
    ("h", "The home-care handoff"),
    S("Recommending products", "You don't need a whole new routine. If you add one thing, make it [this serum]. It's "
      "what will keep today's results going. Want me to set one aside?"),
    S("When a client only books \u201cwhen my skin looks bad\u201d", "The best time to come in is when your skin looks "
      "great. That's how we keep it there."),
    S("If they say they have products at home", "Perfect. Send me a photo of what you're using and I'll tell you what "
      "to keep and what to skip."),
]}

P2 = {"name": "Membership", "kicker": "Scripts", "blocks": [
    ("title", "The _Membership_", "How to introduce it, and what to say to the questions everyone asks."),
    ("h", "Introducing it"),
    S("During the massage or at checkout", "Since you're coming every month anyway, you might like the [Glow Club]. "
      "It's your facial every month for [$119] instead of [$140], plus [10%] off products. Most of my regulars are on it."),
    S("For a client who comes every 6 to 8 weeks", "If you came monthly, your skin would never slide back between "
      "visits. The membership makes monthly cost about what you're spending now."),
    S("After a great result", "This is what monthly care does. The membership is how my clients keep it."),
    ("h", "The questions everyone asks"),
    S("“What if I can't come one month?”", "Your facial rolls over for [60] days, so you never lose it."),
    S("“Can I cancel?”", "Anytime, with [30] days' notice. No contract."),
    S("“It's a lot every month.”", "Totally fair. It's the facial you're already booking, for less, with perks "
      "on top. Try it for three months. If it isn't worth it, you can stop."),
    S("“Let me think about it.”", "Of course. I'll text you the details tonight so you have everything in one place."),
    S("“Can I share it?”", "The membership is just for you, but members get [$15 off] for every friend they "
      "send, and the friend gets [$15 off] too."),
    ("h", "The follow-up text"),
    S("The next day", "Hi [name]! Here are the [Glow Club] details we talked about: [link]. Happy to answer anything. "
      "Your skin looked amazing yesterday."),
]}

P3 = {"name": "Texts", "kicker": "Scripts", "blocks": [
    ("title", "Texts That Fill _Your Book_", "Copy them into your booking app's automatic messages, or save them as "
     "text replacements on your phone."),
    ("h", "Around each visit"),
    S("Booking confirmation", "You're booked! [Signature Facial], [Tue, Mar 14] at [10:00]. [Address]. Come with a clean "
      "face if you can. Reply C to confirm."),
    S("Reminder, 2 days before", "Hi [name], see you [Thursday at 5]! Need to change it? Just reply, and please give me "
      "24 hours' notice."),
    S("Day 2 check-in", "Hi [name]! How's your skin feeling after your [facial]? A little pinkness or a few spots is "
      "normal. Anything else, just text me."),
    S("Rebook nudge, week 4", "Hi [name]! It's been four weeks, the perfect time for your next [facial]. I have [Tue at "
      "10] or [Sat at 1]. Want one?"),
    ("h", "Bringing people back"),
    S("We miss you, week 10", "Hi [name], it's been a while and I'd love to see your skin again! I saved a few times "
      "this week: [link]."),
    S("A last-minute opening", "A spot just opened [today at 3]. First to reply gets it!"),
    S("Birthday", "Happy birthday, [name]! Your gift from me: [a free add-on] on any visit this month."),
    S("Gift cards before holidays", "Gift cards are ready for [Mother's Day]. Any amount, any service, sent by text in "
      "a minute: [link]."),
    ("h", "Reviews and referrals"),
    S("Review request, the evening after", "Thank you for coming in today! If you loved it, a quick review helps other "
      "people find me: [link]. It means the world."),
    S("Referral ask", "If you know someone who'd love a facial, send them my way. You'll both get [$15 off] your next visit."),
]}

P4 = {"name": "Protecting your time", "kicker": "Scripts", "blocks": [
    ("title", "Protecting _Your Time_", "Warm, firm words for deposits, late cancellations and no-shows. Kind to the "
     "client, fair to you."),
    ("h", "Deposits"),
    S("Asking for a deposit", "To hold your spot, I take a [$25] deposit that goes toward your service. Here's the link: [link]."),
    S("If they push back", "I understand. The deposit protects the time I set aside just for you, and it comes off your "
      "total on the day."),
    ("h", "Cancellations and no-shows"),
    S("A first late cancellation", "No worries, life happens! I've waived the fee this time. Want me to find you a new time?"),
    S("A second late cancellation", "Sorry to miss you! As a heads-up, cancellations within 24 hours are [50%] of the "
      "service, so I've applied that. Let's find a time that works better."),
    S("A no-show", "Hi [name], I missed you at [10] today. I hope everything's okay. As per my policy, the deposit covers "
      "the missed visit. Let me know when you'd like to rebook."),
    S("When a client is running late", "No problem! I'll still see you, but I'll need to shorten the treatment so the "
      "next client starts on time. See you soon."),
    ("h", "When you need to change things"),
    S("You're running late", "Hi [name], I'm running about [10] minutes behind. So sorry! You'll still get your full "
      "treatment. See you soon."),
    S("You need to reschedule", "Hi [name], I'm so sorry, but I need to move your visit on [Thursday]. Could [Friday at "
      "4] or [Saturday at 11] work? [A free add-on] is on me for the trouble."),
    S("Announcing new prices", "A quick note: from [March 1], some prices will change. Book before then to keep today's "
      "prices, and members keep their rate for [three months]. Thank you for being here."),
]}

P5 = {"name": "Messages", "kicker": "Scripts", "cls": "last", "blocks": [
    ("title", "DMs and _Questions_", "Replies for the messages that come in every week, including the ones that are "
     "outside what you do."),
    ("h", "Inquiries"),
    S("“How much is a facial?”", "Hi! My facials start at [$75] for a 30-minute express and [$125] for my "
      "Signature. Tell me a little about your skin and I'll suggest the best fit."),
    S("“Any openings today?”", "I have [3:00] today or [10:00] tomorrow. Want one? Here's the link to grab it: [link]."),
    S("“I have acne. Can you help?”", "Yes, I'd love to. Acne takes a plan, not one facial, so let's start "
      "with a [Clear Skin Facial] and I'll build you a routine to go with it."),
    S("“Is a Brazilian painful?”", "Honestly, the first one stings a little, and every one after is easier. I "
      "work quickly, use a gentle wax, and talk you through it."),
    ("h", "Outside your services"),
    S("“Do you do Botox or fillers?”", "I don't, but I work with [a great nurse injector] I trust, and a facial "
      "a week or two before or after pairs beautifully."),
    S("Something that needs a doctor", "That's something a dermatologist should look at before we treat it. Once "
      "you've been seen, I'd love to help with the rest."),
    ("h", "Reviews"),
    S("Thanking a five-star review", "Thank you, [name]! It's such a joy to see your skin glow. See you next month."),
    S("Answering a negative review", "I'm sorry your visit wasn't what you hoped, [name]. I'd like to make it right. "
      "Please call or text me at [number] so we can talk."),
    ("h", "What's working"),
    ("p", "Try one new script a week. Keep count, and keep the ones that work."),
    ("table", ["Script", "Times used", "Said yes", "Notes"], [34, 14, 14, 38], 5, "track", 20),
]}

DOC = {"title": NAME, "header": "brand", "foot": "Lumevina Studio · Rebooking & membership scripts",
       "pages": [P1, P2, P3, P4, P5]}

START = {
    "inside": [
        ("Scripts guide", "Five pages of scripts: in the room, the membership, texts that fill your book, protecting "
                          "your time, and DMs and questions. About 45 in all."),
        ("Word file", "The same scripts, editable, so you can change the wording, prices and policies to yours."),
    ],
    "tips": [
        "Replace everything in [brackets] with your own prices, policies, links and service names.",
        "Paste the texts into your booking app's automatic messages (confirmation, reminder, follow-up).",
        "Save the ones you send by hand as text replacements on your phone (Settings, General, Keyboard).",
        "Practice the in-room scripts out loud until they sound like you.",
    ],
    "legal": False,
    "fillable": False,
}


CSS = """
.script{margin:0 0 13pt}.script .say{font-size:13.4pt;line-height:1.32}.script .when{margin-bottom:2.5pt}
.script::before{top:8pt;font-size:30pt}
.h{margin:17pt 0 10pt}
.last .script{margin-bottom:9pt}.last .script .say{font-size:12.6pt}.last .h{margin:13pt 0 8pt}
"""


def build(c):
    c.pdf(DOC, "Rebooking & Membership Scripts - US Letter.pdf", "letter", extra_css=CSS)
    c.pdf(DOC, "Rebooking & Membership Scripts - A4.pdf", "a4", extra_css=CSS)
    c.docx(DOC, "Rebooking & Membership Scripts - Editable Word.docx")
    c.start_here()
