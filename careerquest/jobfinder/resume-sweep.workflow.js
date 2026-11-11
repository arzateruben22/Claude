export const meta = {
  name: 'jobfinder-resume-sweep',
  description: 'Find LA/OC openings that match the applicant resume, with direct employer apply links, then independently try to refute each and score it requirement by requirement against the resume',
  phases: [
    { title: 'Find', detail: 'one finder per role family (fresh web search)' },
    { title: 'Verify', detail: 'independent refutation + requirement-by-requirement resume match' },
  ],
}

// Budget: WebSearch is capped at 200 calls per turn, shared by every agent.
//   args = { today, profile, slices: { key: description }, keys: [...], findCap, verifyCap, verifyTop,
//            leads: [candidate, ...], leadOffset }
// The applicant's name and contact details are never given to these agents: they search the web,
// and nothing that identifies the applicant may appear in a query.
const TODAY = (args && args.today) || '2026-11-11'
const FIND_CAP = (args && args.findCap) || 12
const VERIFY_CAP = (args && args.verifyCap) || 4
const VERIFY_TOP = (args && args.verifyTop) || 3

// The applicant profile is passed in (args.profile) and never stored in this file: the repository is
// public, and the profile is derived from the applicant's resume.
const PROFILE = (args && args.profile) || ''
if (!PROFILE.trim()) throw new Error('args.profile is required (the anonymized applicant profile)')

const RULES = `HARD RULES:
- Today is ${TODAY}. Only REAL postings that appear to be accepting applications today. Never invent an employer, a posting, a pay figure, a date or a URL. If you cannot find evidence, leave the field null and say so.
- SEARCH CAP: you may make at most __CAP__ WebSearch calls in total. Count them. Plan the queries before you start, prefer one precise query (employer domain + requisition id or exact title + city) over several broad ones, and stop when you reach the cap even if you would like more.
- The sandbox cannot open job sites directly (page fetches are blocked). Use the WebSearch tool (load it with ToolSearch "select:WebSearch" if it is not already available), with mode "extended" for anything about current openings, pay or dates. Read the result extracts carefully: they often state the posting date, the closing date or "valid through" date. A posting whose closing/valid-through date is before ${TODAY}, or that says closed / filled / no longer accepting, is NOT open.
- The application must be made on the EMPLOYER'S OWN site: the employer's careers page, an employer-branded applicant system (Workday / iCIMS / Greenhouse / Lever / SmartRecruiters / UKG / Taleo / ADP / Paylocity / Paycom page for that employer), a public agency's own page on governmentjobs.com (NEOGOV) or its own portal. Job boards (Indeed, LinkedIn, ZipRecruiter, Glassdoor, SimplyHired, etc.) may be used to DISCOVER a posting, but the URL you return must be on the employer's own site/system.
- Work location must be in Los Angeles County or Orange County, California. Skip remote-only roles.
- California requires pay ranges in postings: quote the pay exactly as posted. Annualize hourly pay at 2,080 hours for the numeric fields.
- Record what the posting says about driving exactly (none stated / valid driver's license required / clean DMV record or company vehicle / CDL).`

const CANDS = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tier: { type: 'string', enum: ['best_fit', 'stretch'] },
          employer: { type: 'string' },
          title: { type: 'string' },
          field: { type: 'string', description: 'one of: project_coordination, dispatch_scheduling, safety_compliance, operations_logistics, construction_office, executive_admin, other_trade' },
          city: { type: 'string' },
          county: { type: 'string', enum: ['Los Angeles', 'Orange', 'unknown'] },
          payText: { type: 'string', description: 'pay exactly as posted, e.g. "$37.23 - $46.26 per hour"' },
          payMinAnnual: { type: ['number', 'null'] },
          payMaxAnnual: { type: ['number', 'null'] },
          employmentType: { type: 'string' },
          postingUrl: { type: 'string', description: 'URL of the posting on the employer own site/system' },
          applyHost: { type: 'string' },
          requisitionId: { type: ['string', 'null'] },
          postedDate: { type: ['string', 'null'] },
          closingDate: { type: ['string', 'null'] },
          minimumRequirements: { type: 'array', items: { type: 'string' } },
          preferredQualifications: { type: 'array', items: { type: 'string' } },
          drivingRequirement: { type: 'string', enum: ['none stated', 'valid driver license required', 'clean DMV record or company vehicle', 'CDL required', 'unknown'] },
          unionOrProgram: { type: ['string', 'null'] },
          progression: { type: ['string', 'null'] },
          whyFit: { type: 'string', description: 'which resume facts match which posted requirements' },
          evidence: { type: 'array', items: { type: 'object', properties: { quote: { type: 'string' }, sourceUrl: { type: 'string' } }, required: ['quote', 'sourceUrl'] } },
          openConfidence: { type: 'number', description: '0..1 that it is accepting applications today' },
          notes: { type: 'string' },
        },
        required: ['tier', 'employer', 'title', 'field', 'city', 'county', 'payText', 'postingUrl', 'applyHost', 'minimumRequirements', 'drivingRequirement', 'whyFit', 'evidence', 'openConfidence'],
      },
    },
    searched: { type: 'array', items: { type: 'string' } },
    notFound: { type: 'array', items: { type: 'string' } },
  },
  required: ['candidates', 'searched', 'notFound'],
}

const VERDICT = {
  type: 'object',
  properties: {
    isReal: { type: 'boolean', description: 'true only if you independently found the posting on the employer own site/system' },
    stillOpenConfidence: { type: 'number' },
    directEmployerApply: { type: 'boolean' },
    inLaOrOc: { type: 'boolean' },
    problems: { type: 'array', items: { type: 'string' } },
    verdictReason: { type: 'string' },
    corrected: {
      type: 'object',
      description: 'only fields you found to be different from the candidate; leave out what you confirmed',
      properties: {
        title: { type: 'string' }, city: { type: 'string' }, payText: { type: 'string' },
        payMinAnnual: { type: ['number', 'null'] }, payMaxAnnual: { type: ['number', 'null'] },
        postingUrl: { type: 'string' }, postedDate: { type: ['string', 'null'] }, closingDate: { type: ['string', 'null'] },
        drivingRequirement: { type: 'string' },
        minimumRequirements: { type: 'array', items: { type: 'string' } },
      },
    },
    independentEvidence: { type: 'array', items: { type: 'object', properties: { quote: { type: 'string' }, sourceUrl: { type: 'string' } }, required: ['quote', 'sourceUrl'] } },
    requirementMatch: {
      type: 'array',
      description: 'every posted minimum requirement, judged against the resume',
      items: {
        type: 'object',
        properties: {
          requirement: { type: 'string' },
          status: { type: 'string', enum: ['met', 'partly', 'not_shown'] },
          resumeEvidence: { type: 'string', description: 'the resume fact that meets it, or what is missing' },
        },
        required: ['requirement', 'status', 'resumeEvidence'],
      },
    },
    resumeFit: { type: 'number', description: '0..1: share of the posted minimum requirements the resume demonstrably meets, weighted by importance' },
    resumeFitReason: { type: 'string', description: 'one sentence' },
    gapsForApplicant: { type: 'array', items: { type: 'string' }, description: 'ONLY requirements the resume does not show, each prefixed HARD: or SOFT:' },
    aiExposure: { type: 'object', properties: { level: { type: 'string', enum: ['low', 'medium', 'high'] }, reason: { type: 'string' } }, required: ['level', 'reason'] },
    resumeEmphasis: { type: 'array', items: { type: 'string' } },
    doNotClaim: { type: 'array', items: { type: 'string' } },
  },
  required: ['isReal', 'stillOpenConfidence', 'directEmployerApply', 'inLaOrOc', 'problems', 'verdictReason', 'independentEvidence', 'requirementMatch', 'resumeFit', 'resumeFitReason', 'gapsForApplicant', 'aiExposure', 'resumeEmphasis', 'doNotClaim'],
}

// Role families to search, as { key: description }. Passed in (args.slices) for the same reason.
const SLICES = (args && args.slices) || {}

function findPrompt(key) {
  return `You are a recruiting researcher finding REAL, currently open jobs for one applicant. Work only from fresh web search results.

${PROFILE}

${RULES.replace('__CAP__', String(FIND_CAP))}

YOUR SLICE (${key}): ${SLICES[key]}

TASK: Search by ROLE first, not employer by employer: site-restricted queries on applicant-system domains surface live postings fastest (for example myworkdayjobs.com, icims.com, boards.greenhouse.io, jobs.lever.co, paylocity.com, ultipro.com or governmentjobs.com with an exact role title and a city such as "Chatsworth", "Van Nuys", "Burbank", "Los Angeles", "Long Beach", "Irvine"). Then spend what is left of your cap on the named employers. Return at most 5 candidates, ORDERED from best resume match to worst:
- "best_fit": every posted MINIMUM requirement is shown on the resume, or the posting accepts equivalent experience for the one that is not (for example "degree or equivalent experience"). The years asked for must be covered by the years of related work the profile shows.
- "stretch": one or two posted requirements are not on the resume (a named software tool, more years, an industry), but none is a legally mandatory credential or a degree with no experience alternative.
Do NOT return postings that require a bachelor's degree with no equivalent-experience wording, a professional license the applicant lacks, or pay whose top of range is below the applicant's rule for that distance.
Quality over quantity: return fewer rather than include anything you could not tie to the employer's own site with a pay figure. For each candidate give direct quotes from the search extracts as evidence (pay, location, dates, requirements) with the URL each came from, the posting date and closing date when stated, an honest openConfidence, and in whyFit name the resume facts that match. List what you searched and which named employers had nothing suitable.`
}

function verifyPrompt(c) {
  return `You are an independent verifier for a job-search service. A researcher claims the posting below is real, accepting applications today, and a match for the applicant's resume. Your job is to try to REFUTE it, then, only if it survives, judge it requirement by requirement against the resume.

${PROFILE}

${RULES.replace('__CAP__', String(VERIFY_CAP))}

CLAIMED POSTING:
${JSON.stringify(c, null, 1)}

STEP 1 - VERIFY INDEPENDENTLY (do your own searches; do not trust the researcher's quotes):
a) Does this exact posting exist on the employer's own site/system? Search the employer domain for the title, requisition id and city.
b) Is it still open on ${TODAY}? Look for the posting date, closing / valid-through / final filing date, "closed", "filled", "no longer accepting", "expired". If the closing date has passed, or the only evidence is older than about 75 days with no sign it is still listed, set stillOpenConfidence low and say why.
c) Is the work location in Los Angeles County or Orange County?
d) Is the pay as claimed? Are the minimum requirements and the driving requirement as claimed?
e) Is the application direct on the employer's own site/system (not a job board)?
Set isReal=false if you cannot independently find the posting on the employer's site/system. Put anything you found to be different in "corrected". Give your own evidence quotes with URLs.

STEP 2 - MATCH AGAINST THE RESUME (strictly from the profile above; never credit the applicant with anything not listed there):
- requirementMatch: list EVERY posted minimum requirement with status "met" (name the resume fact), "partly" (say what is and is not covered) or "not_shown" (say what is missing).
- resumeFit: 0..1, and resumeFitReason in one sentence.
- gapsForApplicant: ONLY the requirements that are "partly" or "not_shown", each prefixed "HARD:" (a legally mandatory credential, a professional license, or a degree required with no experience alternative) or "SOFT:" (years, tools, industry exposure, preferred items). If driving is required, list it as "SOFT: valid driver's license required (applicant's status unknown)".
- aiExposure: low / medium / high for THIS role, with a one-sentence reason grounded in what the job physically involves day to day.
- resumeEmphasis: 3-5 bullets naming which TRUE resume facts to move to the top for this posting and which exact posting keywords to mirror only where true.
- doNotClaim: the specific requirements or keywords from this posting the applicant must not claim because the resume does not show them.`
}

// Leads to check without a finder (for example postings a finder saw only on a job board). Their
// verdicts are labelled "recheck:<n>", matching position n in the leads file given to the build.
const leads = (args && args.leads) || []
const leadOffset = (args && args.leadOffset) || 0
const rechecked = await parallel(leads.map((c, i) => () =>
  agent(verifyPrompt(c), { label: `recheck:${leadOffset + i + 1}`, phase: 'Verify', schema: VERDICT, agentType: 'general-purpose' })
    .then((v) => ({ ...c, slice: 'recheck', verdict: v }))
))
if (leads.length) log(`${rechecked.filter(Boolean).length} of ${leads.length} leads checked`)

const keys = (args && args.keys) || Object.keys(SLICES)
const results = await pipeline(
  keys,
  (key) => agent(findPrompt(key), { label: `find:${key}`, phase: 'Find', schema: CANDS, agentType: 'general-purpose' }),
  (found, key) => {
    const all = found && found.candidates ? found.candidates : []
    const list = all.slice(0, VERIFY_TOP)
    if (all.length > list.length) log(`${key}: ${all.length} found, verifying the top ${list.length}; the rest stay "found once"`)
    else log(`${key}: ${list.length} candidates to verify`)
    return parallel(list.map((c, i) => () =>
      agent(verifyPrompt(c), { label: `verify:${key}:${i + 1}`, phase: 'Verify', schema: VERDICT, agentType: 'general-purpose' })
        .then((v) => ({ ...c, slice: key, verdict: v }))
    )).then((rows) => ({ key, searched: found ? found.searched : [], notFound: found ? found.notFound : [], rows: rows.filter(Boolean) }))
  },
)
return { rechecked: rechecked.filter(Boolean), found: results.filter(Boolean) }
