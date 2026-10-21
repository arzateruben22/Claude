# California Electrician Certification & SoCal Apprenticeship Research
Verified on: 2026-10-21

## How this was verified (read first)
In this sandbox, direct fetches (WebFetch and curl) to dir.ca.gov, cslb.ca.gov, bls.gov, laett.com, ocett.org, goweca.com, abcsocal.org and every other external host were refused by the environment's network policy. Every fact below was therefore confirmed through web-search extracts (quoted snippets) of the cited official pages rather than by reading the full page. Anything that only appeared on a third-party page is marked UNVERIFIED. Re-check fees, dates and wages on the live official URLs before shipping seed data.

## 1. DIR / DLSE Electrician Certification - what was verified
- Classifications and OJT hours (8 CCR 291.1; DIR pages 1a-1e; DIR trainee guide): General 8,000; Residential 4,800; Fire/Life Safety 4,000; Voice Data Video 4,000; Non-Residential Lighting 2,000. Per-area caps recorded in the JSON.
- Alternative route: completion of a CAC/federal/state-approved apprenticeship in the classification (8 CCR 291.1), or a registered trainee who completes an Approved Curriculum (8 CCR 291.2(g); DIR page 2a: 8,000 OJT hours + 720 hours related instruction). "Education credit" toward hours: NOT FOUND - unverified.
- Electrician Trainee: must be enrolled in/completed an Approved Curriculum at a DIR-listed school; direct on-site supervision by a certified electrician supervising only one trainee (8 CCR 296.3); at least 150 classroom hours/year (8 CCR 296.2); $25 initial fee (8 CCR 292.0(d)); renewed annually with proof of enrollment and transcript; no fee for annual renewal (DIR renewal form; Labor Code).
- Fees (8 CCR 292.0 and DIR fee page): application $75; exam/retake $100; renewal $100; trainee registration $25; lapsed/expired renewal $200 and replacement card $30 (fee page only).
- Exam: historically PSI; DIR test-info page says exams on/after June 1, 2026 are scheduled through CPS HR Consulting and delivered via Pearson VUE. Minimum scaled score 70 (PSI bulletin on dir.ca.gov). General exam 100 questions; time stated as 4 hours (FAQ) vs 4.5 hours (test-info page) - conflicting. One year from eligibility notice to test; 60-day wait + $100 for retest. 2023 first-time pass rate 51.22%.
- Renewal (8 CCR 291.5): every 3 years; 32 hours CE from an approved provider; ~2,000 hours of industry work in the prior 3 years; $100. Lapsed-card guidance conflicts between the fee/forms page and the regulation (see JSON).
- Law: Labor Code Division 1, Chapter 4.5, Sections 108-108.5 (formerly 3099-3099.5; renumbered by AB 1087, 2002). 108.2 requires certification for persons performing work as electricians for C-10 contractors; exempts registered apprentices; C-7/C-45 scope not covered. AB 1707 (2025-26) would move the program to CSLB; enrolled Sept 4, 2026 - signing/chaptering NOT verified from an official source.
- CSLB C-10 (separate contractor license): 4 years journey-level-or-higher experience in the last 10 years (up to 3 years credit for school/apprenticeship); Law & Business + C-10 trade exams; $450 application; $200/$350 initial license; $25,000 contractor's bond; fingerprinting; C-10 renewal $470.

## 2. Apprenticeships - what was verified / not
| Program | Verified | Not verified |
|---|---|---|
| IBEW 11 / ETI (laett.com), Commerce | 5-yr Inside Wireman; 18+, HS/GED, algebra C+, SSN, photo ID; online-only application, aptitude test at Commerce; min 240 class hrs/yr; wage 40% = $26.00/hr (01/26/2026 notice); 2026 windows Jan 5, Apr 6, Jul 6, Oct 5-9 all passed -> CLOSED; address/phone | Driver's license, drug test, fees, interview step, next window |
| IBEW 441 / OCETT-OCETI (ocett.org), Santa Ana | 60-month Inside Wireman; 18+, HS/GED, 2 yrs HS math incl. algebra (C), color vision, written + oral + physical + drug test (DAS listing); in-person/call-in process; phone (714) 245-9988; last call-in Aug 4, 2026, 2027 TBD -> CLOSED | Wage ("contact program"), classroom hours, fees; address conflict (1261 E Dyer Rd per DAS vs 717 S Lyon St in older directories) |
| WECA (goweca.com), Riverside | 18+, HS/GED; color ID test, basic skills test, multi-craft aptitude test, interview, orientation; must be hired by a WECA member contractor (employer pays tuition); 2-week block classes every 5-7 months; Residential 3 yrs; Commercial 5 yrs per older WECA materials; phone (877) 444-9322 | Starting wage, LV program length, dated application window, current Riverside address |
| ABC SoCal (abcsocal.org), Anaheim / San Fernando | HS/GED, SS card, DL + K4 DMV printout, algebra transcripts; aptitude test 70%, interview 80%, orientation; 2 attempts then 1-yr wait; 160-180 class hrs/yr; addresses and phones; "starts at about 50%" (no $) | Program length conflict (4 yrs/7,200 hrs vs 4.5 yrs/8,000 hrs); drug test; fees for apprentices; dated window |
| IEC Los Angeles / SoCal | NOT FOUND in DAS LA or Orange electrician program lists | Existence of any LA/OC IEC program |
| IBEW 40 / LA NECA (North Hollywood) | 60 months; 18+, HS/GED, algebra; written + oral; (818) 762-4239; applications reopen Spring 2028 -> CLOSED | Wage, hours, fees |
| LA County ITS Electrical JATC (via ETI) | Exists in DAS LA list; DIR apprentice wage table exists | Everything else |

DAS program search: https://www.dir.ca.gov/databases/das/aigstart.asp (DAS home: https://www.dir.ca.gov/das/). "calapprenticeship.org" could not be verified as official.

## 3. Wages
- National May 2025 (BLS, verified): median $63,190/yr ($30.38/hr).
- LA-Long Beach-Anaheim May 2025: median $35.49/hr / $73,810/yr; 25th $58,830; 75th $101,930; 90th $131,680 - from O*NET and third-party sites citing OEWS May 2025; bls.gov metro table NOT readable here -> UNVERIFIED.
- LA MSA May 2023 (BLS, verified): mean $39.95/hr, $83,090/yr, 19,520 employed. California May 2023 (BLS, verified): mean $40.54/hr, $84,330/yr. California May 2025: UNVERIFIED.
- IBEW Local 11 Inside Wireman journeyman: $65.00/hr (Jan 26 - Jun 30, 2026) per LA NECA/IBEW 11 bulletin and DIR LA 2026-1 determination; $64.50 for Jul 28, 2025 - Jan 25, 2026; H&W $16.64/hr. 2026-2031 agreement ratified Oct 14, 2026 with +$2.00 wages from 7/27/2026 (implied ~$67.00) - new schedule UNVERIFIED.
- Apprentice start: IBEW 11 Inside Wireman 40% ($26.00/hr); DIR LA apprentice Period 1 basic $26.00; IBEW 11 Sound & Comm 45% ($21.54, 12/31/2024 notice); ABC SoCal "about 50%" (no $); WECA unverified.

## Source URLs consulted (via search extracts)
### DIR / DLSE / regulations
- https://www.dir.ca.gov/dlse/ecu/electricaltrade.html
- https://www.dir.ca.gov/dlse/ecu/ECU_FAQ.htm
- https://www.dir.ca.gov/dlse/ecu/elecat.html
- https://dir.ca.gov/DLSE/ECU/1a.html
- https://dir.ca.gov/DLSE/ECU/1b.html
- https://dir.ca.gov/DLSE/ECU/1c.html
- https://dir.ca.gov/DLSE/ECU/1d.html
- https://dir.ca.gov/DLSE/ECU/1e.html
- https://www.dir.ca.gov/dlse/ecu/2a.html
- https://www.dir.ca.gov/dlse/ecu/3a.html
- https://www.dir.ca.gov/t8/291_1.html
- https://www.dir.ca.gov/t8/291_2.html
- https://www.dir.ca.gov/t8/291_5.html
- https://www.dir.ca.gov/t8/292_0.html
- https://www.dir.ca.gov/t8/296_1.html
- https://www.dir.ca.gov/t8/296_2.html
- https://www.dir.ca.gov/t8/296_3.html
- https://dir.ca.gov/t8/290_1.html
- https://www.dir.ca.gov/dlse/ecu/ElectricalTrade_Fees.html
- https://www.dir.ca.gov/dlse/ecu/ECUCertforms.htm
- https://www.dir.ca.gov/dlse/ecu/ecu_testinfo.htm
- https://www.dir.ca.gov/dlse/ecu/CandidateInfoBulletin.htm
- https://www.dir.ca.gov/dlse/ecu/cib.pdf
- https://www.dir.ca.gov/dlse/ECU/ElectricianExamOverview2023.pdf
- https://www.dir.ca.gov/dlse/ecu/electricaltrainee.htm
- https://dir.ca.gov/DLSE/ECU/ECTraineeDef.html
- https://www.dir.ca.gov/dlse/ECU/ElectricalTraineeRenewRegistration.pdf
- https://www.dir.ca.gov/DAS/ElectricianTraineeNEWRegistration.pdf
- https://www.dir.ca.gov/dlse/ECU/ListOfApprovedSchools.html
- https://www.dir.ca.gov/dlse/ecu/Guide_for_Electricians_and_Trainees_2-07.pdf
- https://www.dir.ca.gov/dlse/ecu/Curriculum_Guide_for_Electrician_Trainee_as_mandated_by_AB1087.pdf
- https://www.dir.ca.gov/DAS/ElectricalCertificationForm.pdf
- https://www.pearsonvue.com/us/en/ecu.html
### Statute
- https://law.justia.com/codes/california/2022/code-lab/division-1/chapter-4-5/section-108/
- https://law.justia.com/codes/california/code-lab/division-1/chapter-4-5/section-108-2
- https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260AB1707
### CSLB
- https://www.cslb.ca.gov/about_us/library/licensing_classifications/Licensing_Classifications_Detail.aspx?Class=C10
- https://www.cslb.ca.gov/contractors/applicants/contractors_license/exam_application/experience_for_exam.aspx
- https://www.cslb.ca.gov/Contractors/Applicants/Contractors_License/Exam_Application/Before_Applying_For_License.aspx
- https://www.cslb.ca.gov/contractors/applicants/contractors_license/exam_application/Issuing_My_License.aspx
- https://www.cslb.ca.gov/about_us/library/fees.aspx
- https://www.cslb.ca.gov/resources/industrybulletins/online_marketplace_fast_facts.pdf
### Apprenticeships / DAS
- https://www.dir.ca.gov/das/
- https://www.dir.ca.gov/databases/das/aigstart.asp
- https://www.dir.ca.gov/databases/das/results_aiglist.asp?varCounty=LOS+ANGELES&varType=22
- https://dir.ca.gov/databases/das/results_aiglist.asp?varCounty=ORANGE&varType=22
- https://www.dir.ca.gov/databases/das/results_aigdetail.asp?varOccId=448
- https://www.dir.ca.gov/databases/das/results_aigdetail.asp?varOccId=2726
- https://www.dir.ca.gov/oprl/pwappwage/wage/26119220.html?VarWageId=26119220
- https://www.laett.com/index.cfm?zone=%2Funionactive%2Fview_page.cfm&page=Inside20Wireman
- https://www.laett.com/Apprenticeship%20handouts/AW%20Official%20Notice%20-%2001-26-26.pdf
- https://www.laett.com/index.cfm?zone=%2Funionactive%2Fview_page.cfm&page=Sound202620Communications
- https://www.laett.com/Apprenticeship%20handouts/SAP%20Official%20Notice%20-%2012-31-24.pdf
- https://laett.com/Apprenticeship%20handouts/SAP%20Official%20Notice%20-%2006-28-26.pdf
- https://laett.com/index.cfm?zone=%2Funionactive%2Fcontact.cfm
- https://www.ocett.org/
- https://www.ocett.org/?zone=%2Funionactive%2Fview_page.cfm&page=How20to20Apply
- https://ocett.unionactive.com/OCETI%20Application%20Procedures%20Master.pdf
- https://www.goweca.com/Apprenticeship/ApplyforApprenticeship.aspx
- https://www.goweca.com/Apprenticeship/ThreeCaliforniaApprenticeshipPrograms.aspx
- https://www.goweca.com/Apprenticeship/ApplyforApprenticeship/OnlineApprenticeshipApplication.aspx
- https://www.goweca.com/Apprenticeship/ApprenticeFAQs.aspx
- https://abcsocal.org/education-training/apprenticeship-program/
- https://abcsocal.org/education-training/apprenticeship-program/applicants/
- https://abcsocal.org/wp-content/uploads/2025/10/Apprenticeship-Application_2024_Rev_2025-06-05-FINAL.pdf
- https://abcsocal.org/contact/
- https://abcsocal.org/labor-compliance/apprentice-wage-rates/
- https://ibew40.org/open-house-draws-enthusiastic-crowd/
### Wages
- https://www.bls.gov/ooh/construction-and-extraction/electricians.htm
- https://www.bls.gov/oes/current/oes472111.htm
- https://www.bls.gov/oes/2023/may/oes472111.htm
- https://www.bls.gov/oes/current/oes_31080.htm (not readable here)
- https://www.onetonline.org/link/localwages/47-2111.00?zip=95747
- https://laneca.org/wp-content/uploads/2025/06/2025-07-11-Inside-wage-rates.pdf
- https://cdn.prod.website-files.com/6904bac2453c5b0f64a72cdb/696f8a01f5622e0fd9277b06_Inisde-Wiremen-Agreement-01.26.2026-06.30.2026.pdf
- https://www.ibew11.org/latest-news/your-vote-your-contract-whats-inside-the-2026-2031-inside-wiremen-agreement
- https://www.ibew11.org/latest-news/message-from-the-business-manager-inside-wireman-contract-ratified
