export const meta = {
  name: 'jobfinder-apply-kit',
  description: 'For each selected opening: write a tailored resume, cover letter and outreach note strictly from the applicant resume, fact-check them against the original, and research publicly posted hiring contacts',
  phases: [
    { title: 'Write', detail: 'tailored resume, cover letter and outreach note per job (no web access)' },
    { title: 'Contact', detail: 'publicly posted hiring contacts and whether direct outreach makes sense' },
    { title: 'Fact-check', detail: 'every statement checked against the original resume' },
  ],
}

// args = { today, resume, jobs: [{ id, employer, title, city, payText, postingUrl, list, minimumRequirements,
//          preferredQualifications, requirementMatch, gaps, resumeEmphasis, doNotClaim, drivingRequirement }], contactCap, cautions }
// The resume arrives with [YOUR NAME] / [your city, CA] / [phone] / [email] in place of the applicant's
// identity. Contact researchers never see the resume at all: they search the web.
const TODAY = (args && args.today) || '2026-11-11'
const RESUME = (args && args.resume) || ''
const JOBS = (args && args.jobs) || []
const CONTACT_CAP = (args && args.contactCap) || 3
// Resume-specific warnings (for example two similar-sounding credentials that must not be merged).
// Passed in rather than written here: the repository is public.
const CAUTIONS = (args && args.cautions) || ''
if (!RESUME.trim()) throw new Error('args.resume is required')

const KIT = {
  type: 'object',
  properties: {
    resumeDoc: { type: 'string', description: 'the complete tailored resume as plain text' },
    coverLetter: { type: 'string' },
    outreachMessage: { type: 'string' },
    changes: { type: 'array', items: { type: 'string' }, description: 'exactly what was changed versus the original resume' },
    notClaimed: { type: 'array', items: { type: 'string' }, description: 'posted requirements or keywords deliberately not claimed' },
    honestyNote: { type: 'string' },
  },
  required: ['resumeDoc', 'coverLetter', 'outreachMessage', 'changes', 'notClaimed', 'honestyNote'],
}

const CHECK = {
  type: 'object',
  properties: {
    ok: { type: 'boolean', description: 'true only if no unsupported statement was found in any of the three documents' },
    unsupported: { type: 'array', items: { type: 'object', properties: { where: { type: 'string', enum: ['resume', 'cover letter', 'outreach note'] }, text: { type: 'string' }, why: { type: 'string' } }, required: ['where', 'text', 'why'] } },
    resumeDoc: { type: 'string', description: 'final resume: unchanged if clean, corrected if not' },
    coverLetter: { type: 'string' },
    outreachMessage: { type: 'string' },
  },
  required: ['ok', 'unsupported', 'resumeDoc', 'coverLetter', 'outreachMessage'],
}

const CONTACT = {
  type: 'object',
  properties: {
    contacts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: ['string', 'null'] },
          role: { type: 'string' },
          channel: { type: 'string', enum: ['email', 'phone', 'professional_profile', 'contact_form', 'office'] },
          value: { type: 'string', description: 'the address, number, profile URL, form URL or office address exactly as published' },
          sourceUrl: { type: 'string' },
          publishedBy: { type: 'string', enum: ['posting', 'employer_site', 'agency_bulletin', 'professional_profile', 'third_party'] },
          note: { type: 'string' },
        },
        required: ['role', 'channel', 'value', 'sourceUrl', 'publishedBy'],
      },
    },
    employerPolicy: { type: 'string', description: 'what the employer or posting says about contacting them, or "nothing stated"' },
    outreachVerdict: { type: 'string', enum: ['good_option', 'after_applying', 'not_recommended'] },
    reason: { type: 'string' },
    whoToAddress: { type: 'string', description: 'the role to look for when no named contact is published, e.g. "the Chatsworth branch manager"' },
    searched: { type: 'array', items: { type: 'string' } },
  },
  required: ['contacts', 'employerPolicy', 'outreachVerdict', 'reason', 'whoToAddress', 'searched'],
}

const jobBrief = (j) => JSON.stringify({
  employer: j.employer, title: j.title, city: j.city, pay: j.payText, postingUrl: j.postingUrl,
  minimumRequirements: j.minimumRequirements, preferredQualifications: j.preferredQualifications || [],
  howTheResumeMatches: j.requirementMatch || [], requirementsTheResumeDoesNotShow: j.gaps || [],
  bringForward: j.resumeEmphasis || [], doNotClaim: j.doNotClaim || [], driving: j.drivingRequirement,
}, null, 1)

function kitPrompt(j) {
  return `You are writing application documents for ONE applicant and ONE job posting. Do not use any tools and do not search the web: work only from the text in this message.

ORIGINAL RESUME (the ONLY source of facts about the applicant):
<<<
${RESUME}
>>>

POSTING (already verified by someone else):
${jobBrief(j)}

RULES - these are absolute:
1. Every fact in what you write must already be in the original resume: employers, job titles, dates, places, numbers, certifications, software, education. Do not add, upgrade, round up or combine anything. Do not add a skill, tool, duty, credential, degree, language, industry or metric that is not there. Do not change a job title.${CAUTIONS ? ' ' + CAUTIONS : ''}
2. You MAY: reorder sections and bullets; drop the least relevant bullets (keep every job, employer and date range); reword a bullet with the posting's vocabulary ONLY when the reworded sentence states the same fact; rewrite the professional summary as 2-3 plain sentences aimed at this posting; reorder the core competencies (items already present, or stated in the bullets).
3. Keep the header placeholders exactly: first line "[YOUR NAME]", second line "[your city, CA]  |  [phone]  |  [email]".
4. resumeDoc: plain text, section headings in capitals, bullets starting with "- ", about 350-450 words, one page.
5. coverLetter: 180-240 words. Start with "[your name]" and "[your city, CA] | [phone] | [email]" lines, then "Dear Hiring Team at <employer>,". Lead with the two resume facts that best match the top posted requirements, with their numbers. If the posting asks for something the resume does not show (see requirementsTheResumeDoesNotShow), say so in ONE honest sentence and name the nearest true experience; never imply it is met. Plain language, no flattery, no "I am writing to express", no cliches. Sign "[your name]".
6. outreachMessage: 70-110 words the applicant could send to a recruiter or hiring manager AFTER submitting the application: one line on who they are (true facts), the exact role applied for, one matching result with its number, and one specific ask (confirmation the application arrived, or a ten-minute call). Sign "[your name]" and "[phone]".
7. changes: 3-7 short items telling the applicant exactly what you changed versus their original (what moved, what was reworded and from what, what was dropped).
8. notClaimed: posted requirements or keywords you deliberately did not claim because the resume does not show them.
9. honestyNote: one or two sentences to the applicant. If something is missing: "You may not meet: <what>. The letter handles it by: <how>." If nothing is missing: "Your resume shows every posted minimum."`
}

function checkPrompt(j, kit) {
  return `You are a fact-checker. Do not use any tools. An assistant tailored a resume, cover letter and outreach note for a job application. Your only job is to find statements that the ORIGINAL resume does not support, and to return clean final versions.

ORIGINAL RESUME:
<<<
${RESUME}
>>>

JOB: ${j.title} at ${j.employer}

TAILORED RESUME:
<<<
${kit.resumeDoc}
>>>

COVER LETTER:
<<<
${kit.coverLetter}
>>>

OUTREACH NOTE:
<<<
${kit.outreachMessage}
>>>

Check every sentence, bullet, number, date, title, certification, tool and claim in the three documents against the original resume. Flag as unsupported: a new skill, tool, duty, credential, degree, industry or metric; a changed number, date or job title; a stronger claim than the original makes (for example "managed" where the original says "scheduled");${CAUTIONS ? ' also: ' + CAUTIONS : ''} any statement that a posted requirement is met when the resume does not show it. Statements about the employer or the posting, the applicant's intentions, and bracketed placeholders are not facts about the applicant and are fine.
If you find none, set ok=true and return the three documents exactly as given. If you find any, list each one, set ok=false, and return corrected documents with each unsupported statement removed or restored to the original resume's wording. Change nothing else.`
}

function contactPrompt(j) {
  return `You are researching how an applicant could reach the people hiring for one job. You may make at most ${CONTACT_CAP} WebSearch calls (load the tool with ToolSearch "select:WebSearch" if needed; use mode "extended"). The sandbox cannot open web pages, so work from search result extracts. Today is ${TODAY}.

JOB: ${j.title} at ${j.employer}, ${j.city}, California. Posting: ${j.postingUrl}

FIND, in this order:
1. A recruiter, talent-acquisition contact, hiring manager or analyst NAMED ON THE POSTING or on the employer's careers page for it, and any contact route printed there.
2. The employer's published recruiting or HR contact route (a careers or HR email address, a recruiting phone line, the local office or branch that the role reports to, with its published phone and address).
3. For a public agency: the analyst or department contact printed on the job bulletin, and what the bulletin says about contacting them.
4. What the employer says about being contacted ("no phone calls", "applications accepted online only", civil-service rules, a referral program).

STRICT RULES:
- Report ONLY contact details that are publicly posted by the employer, by the posting, or by the person in a professional capacity (a staff directory, a press release, a professional profile that shows their name and title). Give the URL where each was published.
- NEVER guess or construct an email address from a naming pattern. If no address is published, say so and give the published route instead (form, office phone, profile page).
- NEVER report personal email addresses, personal phone numbers, home addresses or personal social media accounts.
- Do not contact anyone. You have no information about the applicant and must not put any in a query.

THEN JUDGE whether writing to a person directly is a good idea for THIS employer:
- "good_option": a named recruiter or hiring contact is published for this role, or the employer is a small or mid-sized private firm where the local manager hires directly.
- "after_applying": a private employer with a formal applicant system; a short note to the recruiter or local manager after the online application is normal and can help.
- "not_recommended": a public agency or civil-service process, a union referral list, or an employer that says not to contact them; outreach cannot influence selection and questions go only to the contact printed on the bulletin.
Give the reason in two sentences, and in whoToAddress name the role the applicant should look for when no named contact is published.`
}

const results = await pipeline(
  JOBS,
  (j) => parallel([
    () => agent(kitPrompt(j), { label: `kit:${j.id}`, phase: 'Write', schema: KIT }),
    () => agent(contactPrompt(j), { label: `contact:${j.id}`, phase: 'Contact', schema: CONTACT, agentType: 'general-purpose' }),
  ]),
  (pair, j) => {
    const kit = pair && pair[0]
    const contact = pair && pair[1]
    if (!kit) { log(`${j.employer}: no documents were written`); return { id: j.id, kit: null, check: null, contact } }
    return agent(checkPrompt(j, kit), { label: `check:${j.id}`, phase: 'Fact-check', schema: CHECK })
      .then((check) => ({ id: j.id, kit, check, contact }))
  },
)
const done = results.filter(Boolean)
log(`${done.filter((r) => r.kit).length} of ${JOBS.length} application kits written; ${done.filter((r) => r.check && !r.check.ok).length} needed a correction`)
return done
