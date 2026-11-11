export const meta = {
  name: 'jobfinder-sweep',
  description: 'Find real, currently open LA/OC jobs with direct employer apply links for a slice of employers, then independently try to refute each and draft honest application notes',
  phases: [
    { title: 'Find', detail: 'one finder per employer slice (fresh web search)' },
    { title: 'Verify', detail: 'independent refutation + honest tailored notes per candidate' },
  ],
}

// Budget: WebSearch is capped at 200 calls per turn, shared by every agent. The first run spent the
// whole allowance on finding and left none for checking, so this version checks first and gives
// every agent an explicit cap:  args = { today, verifyCap, findCap, leads: [...], keys: [...] }.
//   leads  - postings to re-check (e.g. bestFit + stretch + bench from data/jobs/<date>.json)
//   keys   - employer slices to search for NEW postings after the checks are done
const TODAY = (args && args.today) || '2026-11-11'
const VERIFY_CAP = (args && args.verifyCap) || 5
const FIND_CAP = (args && args.findCap) || 12

const PROFILE = `APPLICANT PROFILE (from the applicant's own stated goals; their resume has NOT been provided yet, so treat anything not listed here as unknown):
- Lives in / will work on-site in Los Angeles County or Orange County, California.
- Wants to be employed within about 90 days. Target pay: $80,000+/year (about $38.50/hour). Open to lower-paying PAID apprenticeship / trainee / helper roles when they have a defined progression toward $100K-$150K+.
- Career changer and beginner in the skilled trades: assume no journey-level card, no state electrician certification, no trade licenses, and little or no formal trade experience. Assume a high-school diploma or GED. These are working assumptions, not facts.
- Fields of interest, in priority order: electrician (apprentice / trainee / helper), elevator mechanic, commercial HVAC, industrial maintenance, building engineer / facilities, construction project coordinator, construction estimator, assistant project manager, commercial plumbing and pipefitting.
- Wants work with LOW risk of being replaced by AI: hands-on, physical, on-site, regulated or licensed work.
- May have driving-related restrictions. Never guess their license status. Record exactly what each posting says about a driver's license, DMV record, company vehicle or CDL, prefer roles that do not require driving, but still include roles that do and flag them.
- Wants to apply DIRECTLY on the employer's own website.`

const RULES = `HARD RULES:
- Today is ${TODAY}. Only REAL postings that appear to be accepting applications today. Never invent an employer, a posting, a pay figure, a date or a URL. If you cannot find evidence, leave the field null and say so.
- SEARCH CAP: you may make at most __CAP__ WebSearch calls in total. Count them. Plan the queries before you start, prefer one precise query (employer domain + requisition id or exact title + city) over several broad ones, and stop when you reach the cap even if you would like more.
- The sandbox cannot open job sites directly (page fetches are blocked). Use the WebSearch tool (load it with ToolSearch "select:WebSearch" if it is not already available), with mode "extended" for anything about current openings, pay or dates. Read the result extracts carefully: they often state the posting date, the closing date or "valid through" date. A posting whose closing/valid-through date is before ${TODAY}, or that says closed / filled / no longer accepting, is NOT open.
- The application must be made on the EMPLOYER'S OWN site: the employer's careers page, an employer-branded applicant system (Workday / iCIMS / Greenhouse / Lever / SmartRecruiters / UKG / Taleo / ADP page for that employer), a public agency's own page on governmentjobs.com (NEOGOV) or its own portal, or a union/JATC apprenticeship program's own site. Job boards (Indeed, LinkedIn, ZipRecruiter, Glassdoor, SimplyHired, talents.vaia.com, etc.) may be used to DISCOVER a posting, but the URL you return must be on the employer's own site/system.
- Work location must be in Los Angeles County or Orange County, California.
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
          field: { type: 'string', description: 'one of: electrical, elevator, hvac, industrial_maintenance, building_engineer, construction_office, plumbing_pipefitting, utilities_operations, other_trade' },
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
          progression: { type: ['string', 'null'], description: 'for trainee/apprentice roles: the documented path and pay it leads to, with source' },
          whyFit: { type: 'string' },
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
    gapsForBeginner: { type: 'array', items: { type: 'string' }, description: 'posted requirements a career-changing beginner probably does not meet; mark each as HARD (legally or explicitly mandatory) or SOFT (preferred / years of experience)' },
    aiExposure: { type: 'object', properties: { level: { type: 'string', enum: ['low', 'medium', 'high'] }, reason: { type: 'string' } }, required: ['level', 'reason'] },
    coverLetter: { type: 'string' },
    resumeEmphasis: { type: 'array', items: { type: 'string' } },
    doNotClaim: { type: 'array', items: { type: 'string' } },
  },
  required: ['isReal', 'stillOpenConfidence', 'directEmployerApply', 'inLaOrOc', 'problems', 'verdictReason', 'independentEvidence', 'gapsForBeginner', 'aiExposure', 'coverLetter', 'resumeEmphasis', 'doNotClaim'],
}

const SLICES = {
  'city-utilities': 'City of Los Angeles and its departments and other big public utilities/transport in LA County: LADWP (Utility Pre-Craft Trainee, Electrical Craft Helper, Maintenance and Construction Helper, Steam Plant Assistant, Electric Distribution Mechanic Trainee, Water Utility Worker), City of LA Personnel exams open now on governmentjobs.com/careers/lacity (Electrical Craft Helper, Building Repairer, Elevator Mechanic Helper, Air Conditioning Mechanic helper classes, Maintenance Laborer, Mechanical Helper), LA Metro (jobs.metro.net / governmentjobs: Service Attendant, Facilities Maintainer, Rail Electronic Communications Inspector Trainee, Traction Power Electrician trainee, Elevator/Escalator), Los Angeles World Airports, Port of Los Angeles, Port of Long Beach, Metrolink.',
  'counties-districts': 'Counties, cities and special districts in LA County and Orange County: County of Los Angeles (governmentjobs.com/careers/lacounty: Electrician Helper, General Maintenance Worker, Refrigeration Mechanic helper, Building Crafts Helper, Power Plant Operator trainee), County of Orange (governmentjobs.com/careers/oc), cities with their own utilities and facilities (Anaheim Public Utilities, Long Beach incl. Long Beach Utilities, Pasadena Water and Power, Burbank Water and Power, Glendale Water and Power, Vernon, Santa Ana, Irvine, Huntington Beach, Torrance, Santa Monica), water/sanitation districts (LA County Sanitation Districts apprenticeships and trainee classes, Orange County Sanitation District, Irvine Ranch Water District, Metropolitan Water District apprenticeship (electrical / mechanical), Orange County Water District, Municipal Water District of OC, South Coast Water District), OCTA, school and college districts facilities trades.',
  'campus-hospital': 'Universities, colleges and hospitals in LA/OC that hire facilities trades directly: UCLA and UCLA Health, UC Irvine and UCI Health, USC and Keck Medicine, CSU campuses (Long Beach, Fullerton, LA, Northridge, Dominguez Hills, Cal Poly Pomona), Caltech, community college districts, LAUSD and Long Beach USD maintenance, Kaiser Permanente, Providence, Cedars-Sinai, Hoag, MemorialCare, CHOC, City of Hope, Dignity/CommonSpirit. Roles: facilities mechanic, maintenance mechanic, building engineer / stationary engineer (incl. apprentice or utility engineer), HVAC or refrigeration mechanic trainee, electrician apprentice/helper, plant operator, skilled trades apprentice programs.',
  'electrical-contractors': 'Electrical work with private employers: large electrical contractors with LA/OC offices that post on their own career sites (Rosendin, Bergelectric, Morrow-Meadows, CSI Electrical Contractors, Helix Electric, Sturgeon Electric / MYR Group, Baker Electric, Cupertino Electric, Comet Electric, Taft Electric, Sasco, Berg, Dynalectric / EMCOR, Faith Technologies), roles such as electrician apprentice, electrical trainee, material handler leading to apprenticeship, pre-apprentice, low-voltage / fire alarm / security / controls technician trainee (Johnson Controls, Siemens, Honeywell, Convergint, ADT Commercial, Pavion), EV charger and solar installers, and Southern California Edison (edisoncareers / sce.com careers: groundman, apprentice lineman, meter technician, substation trainee, system operator trainee) and SoCalGas / Sempra entry field roles.',
  'elevator-hvac-pipe': 'Elevator, commercial HVAC and piping: Otis, Schindler, KONE, TK Elevator, Mitsubishi Electric Elevators (apprentice, helper, elevator technician trainee, service sales that lead to the field), elevator inspector trainee roles; IUEC / NEIEP recruitment for Southern California if open; commercial HVAC and mechanical contractors and manufacturers (Trane Technologies, Carrier, Johnson Controls, Daikin Applied, Lennox Commercial, ACCO Engineered Systems, Southland Industries, EMCOR Services Mesa Energy, Air Control Systems, Xcel Mechanical, Control Air, Murray Company, Pan-Pacific Mechanical): HVAC apprentice, service technician trainee, controls technician trainee, pipefitter or plumber apprentice, and UA Local 250 / Local 78 / Local 582 / Local 398 apprenticeship application windows published on their own JATC sites.',
  'industrial-plants': 'Industrial maintenance, plants and operations in LA/OC with direct employer career sites: Amazon Reliability Maintenance Engineering (RME technician, Mechatronics and Robotics apprentice), refineries and energy (Chevron El Segundo, Marathon Carson/Wilmington, Phillips 66, Valero Wilmington, PBF Torrance: process operator trainee, maintenance helper), aerospace and manufacturing (Boeing, Northrop Grumman, SpaceX Hawthorne facilities/maintenance technician, Anduril Costa Mesa, Relativity Space Long Beach, Rocket Lab Long Beach, Raytheon/RTX, Parker Hannifin, Howmet), food and beverage plants (Niagara Bottling, PepsiCo/Frito-Lay, Coca-Cola / Reyes, Anheuser-Busch Van Nuys, Nestle, Kroger/Ralphs manufacturing), logistics (UPS plant engineering/automotive mechanic helper, FedEx), theme parks (Disneyland Resort facilities and engineering services incl. apprenticeships, Universal Studios Hollywood technical services), power plants and terminal operators at the ports. Roles: maintenance technician/mechanic I, facilities technician, operator trainee, apprentice.',
  'construction-office': 'Construction office-track roles at general contractors and trade contractors with LA/OC offices that post on their own sites: Swinerton, Turner, Clark, McCarthy, PCL, Hensel Phelps, Suffolk, Webcor, Skanska, Kiewit, Snyder Langston, C.W. Driver, Bernards, KPRS, Shawmut, Pankow, Morley Builders, Balfour Beatty, plus subcontractors (Rosendin, Morrow-Meadows, Southland, ACCO, Murray). Roles: project coordinator, construction project coordinator, project engineer (entry), assistant project manager, junior estimator / estimator trainee, field engineer, project administrator. Prefer postings whose minimum requirements a career changer could meet (0-2 years, degree "or equivalent experience"). Note honestly that these roles involve more computer work than field trades, so their AI exposure is higher.',
  'building-engineering': 'Building engineering and critical facilities in LA/OC: property/facility service firms and owners that post on their own career sites (JLL, CBRE, Cushman and Wakefield / C&W Services, ABM, Able / ABM Engineering, Lincoln Property, Hines, Irvine Company, Brookfield, Kilroy, Hudson Pacific, Related, Westfield/URW, Caruso), IUOE Local 501 stationary engineer apprenticeship (apply window on local501.org), hotels and venues (Marriott, Hilton, Hyatt, Disneyland hotels, SoFi Stadium, Crypto.com Arena / AEG, Intuit Dome, Honda Center, Angel Stadium, LA Convention Center, Anaheim Convention Center), data centers (CoreSite, Equinix El Segundo/LA, Digital Realty, Aligned, Prime, Serverfarm: critical facilities technician / data center technician / facilities operations), studios (Disney, Warner Bros., Paramount, Sony, NBCUniversal facilities). Roles: apprentice engineer, utility engineer, building engineer I, maintenance engineer, critical facilities technician, facilities technician.',
}

function findPrompt(key) {
  return `You are a recruiting researcher finding REAL, currently open jobs for one applicant. Work only from fresh web search results.

${PROFILE}

${RULES.replace('__CAP__', String(FIND_CAP))}

YOUR SLICE (${key}): ${SLICES[key]}

TASK: Search by ROLE first, not employer by employer: site-restricted queries on applicant-system domains surface live postings fastest (for example governmentjobs.com "trainee" OR "apprentice" OR "helper" with a city name; myworkdayjobs.com, icims.com, boards.greenhouse.io, jobs.lever.co with "apprentice" OR "trainee" OR "technician I" and Los Angeles / Anaheim / Irvine / Long Beach). Then spend what is left of your cap on the named employers. Find postings in this slice and return:
- up to 4 "best_fit" postings: minimum requirements a beginner / career changer can plausibly meet (trainee, apprentice, helper, entry-level, "no experience required", or about one year of general mechanical / construction / customer-facing work, HS diploma or GED). Prefer pay whose range reaches $80,000+/year; a paid apprenticeship or trainee class below that is fine when you can cite its progression.
- up to 2 "stretch" postings: in the applicant's fields, paying $80,000+ at the top of the range, where the gap is years of experience or preferred skills. Do NOT return stretch roles whose gap is a legally mandatory credential the applicant lacks (for example a role that requires a current California electrician certification, a journey-level card, or a professional license to do the work at all).
Quality over quantity: return fewer rather than include anything you could not tie to the employer's own site with a pay figure. For each candidate give direct quotes from the search extracts as evidence (pay, location, dates, requirements) with the URL each came from, the posting date and closing date when stated, and an honest openConfidence. List what you searched and which named employers had nothing suitable.`
}

function verifyPrompt(c) {
  return `You are an independent verifier for a job-search service. A researcher claims the posting below is real and accepting applications today. Your job is to try to REFUTE it, then, only if it survives, write honest application notes.

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

STEP 2 - HONEST APPLICATION NOTES (write these even if confidence is moderate; skip quality here only if isReal is false):
- gapsForBeginner: each posted requirement a career-changing beginner probably does not meet, prefixed "HARD:" (mandatory by law or stated as required with no equivalent) or "SOFT:" (preferred, or years of experience where equivalents are accepted).
- aiExposure: low / medium / high for THIS role, with a one-sentence reason grounded in what the job physically involves.
- coverLetter: 150-200 words, plain and specific to this employer and role, written for the applicant to edit. NEVER invent experience, employers, schools, certifications, years, or achievements. Where the applicant's own facts are needed, use square-bracket placeholders such as [your most relevant hands-on experience], [years], [certification, only if you hold it]. It may truthfully state their goals (building a long-term career in the trade, pursuing the California electrician path, living in the LA/OC area, ready for physical on-site work and shift schedules if the posting asks). No flattery cliches.
- resumeEmphasis: 3-5 bullets telling the applicant which TRUE things to surface for this posting (kinds of experience, tools, safety training, reliability evidence) and which exact posting keywords to mirror only where true.
- doNotClaim: the specific requirements or keywords from this posting the applicant must not claim unless they are true for them.`
}

// 1) Re-check existing leads first (cheap, bounded), 2) then look for new postings.
const leads = (args && args.leads) || []
phase('Verify')
const rechecked = await parallel(leads.map((c, i) => () =>
  agent(verifyPrompt(c), { label: `recheck:${i + 1}`, phase: 'Verify', schema: VERDICT, agentType: 'general-purpose' })
    .then((v) => ({ ...c, slice: c.slice || 'recheck', verdict: v }))
))
log(`${rechecked.filter(Boolean).length} of ${leads.length} existing leads re-checked`)

const keys = (args && args.keys) || []
const results = await pipeline(
  keys,
  (key) => agent(findPrompt(key), { label: `find:${key}`, phase: 'Find', schema: CANDS, agentType: 'general-purpose' }),
  (found, key) => {
    const list = (found && found.candidates ? found.candidates : []).slice(0, 4)
    log(`${key}: ${list.length} candidates to verify`)
    return parallel(list.map((c, i) => () =>
      agent(verifyPrompt(c), { label: `verify:${key}:${i + 1}`, phase: 'Verify', schema: VERDICT, agentType: 'general-purpose' })
        .then((v) => ({ ...c, slice: key, verdict: v }))
    )).then((rows) => ({ key, searched: found ? found.searched : [], notFound: found ? found.notFound : [], rows: rows.filter(Boolean) }))
  },
)
return { rechecked: rechecked.filter(Boolean), found: results.filter(Boolean) }
