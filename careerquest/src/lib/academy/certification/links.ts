/**
 * Official DIR links for the certification tracker, taken from the researched seed facts
 * (`data/seed/certification_facts.json` via the Academy roadmap loader). Pure: only dir.ca.gov
 * http(s) URLs are kept, deduplicated, with readable labels.
 */
import type { RoadmapData } from "@/lib/academy/roadmap";

export type DirLink = { label: string; url: string; group: "program" | "trainee" | "requirements" | "exam" | "renewal" | "fees" };

const KNOWN: readonly [RegExp, string][] = [
  [/electricaltrade\.html$/i, "DIR Electrician Certification Program"],
  [/ListOfApprovedSchools/i, "List of DIR-approved schools"],
  [/ElectricianTraineeNEWRegistration/i, "Trainee registration form (new)"],
  [/ElectricalTraineeRenewRegistration/i, "Trainee registration renewal form"],
  [/electricaltrainee\.htm$/i, "Electrician Trainee program"],
  [/ECTraineeDef/i, "Trainee definition"],
  [/ecu_testinfo/i, "Exam test information"],
  [/CandidateInfoBulletin|cib\.pdf/i, "Candidate information bulletin"],
  [/ECU_FAQ/i, "Certification FAQ"],
  [/ElectricianExamOverview/i, "Exam statistical overview"],
  [/ECUCertforms/i, "Certification forms"],
  [/ElectricalTrade_Fees/i, "Certification fees"],
  [/\/t8\/291_1\.html/i, "8 CCR 291.1 (eligibility)"],
  [/\/t8\/291_5\.html/i, "8 CCR 291.5 (renewal)"],
  [/\/t8\/292_0\.html/i, "8 CCR 292.0 (fees)"],
  [/\/t8\/296_1\.html/i, "8 CCR 296.1 (trainees)"],
  [/\/t8\/296_2\.html/i, "8 CCR 296.2 (trainee classroom hours)"],
  [/\/t8\/296_3\.html/i, "8 CCR 296.3 (trainee supervision)"],
  [/\/DLSE\/ECU\/1a\.html/i, "General Electrician requirements"],
  [/\/DLSE\/ECU\/1b\.html/i, "Residential Electrician requirements"],
  [/\/DLSE\/ECU\/1c\.html/i, "Fire/Life Safety Technician requirements"],
  [/\/DLSE\/ECU\/1d\.html/i, "Voice Data Video Technician requirements"],
  [/\/DLSE\/ECU\/1e\.html/i, "Non-Residential Lighting Technician requirements"],
];

function isDirUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return (url.protocol === "https:" || url.protocol === "http:") && (url.hostname === "dir.ca.gov" || url.hostname.endsWith(".dir.ca.gov"));
  } catch {
    return false;
  }
}

export function labelForDirUrl(u: string): string {
  for (const [re, label] of KNOWN) if (re.test(u)) return label;
  try {
    const url = new URL(u);
    const tail = url.pathname.split("/").filter(Boolean).pop() ?? url.hostname;
    return `DIR: ${decodeURIComponent(tail)}`;
  } catch {
    return "DIR page";
  }
}

const URL_IN_TEXT = /https?:\/\/[^\s)"']+/g;

export function buildDirLinks(r: RoadmapData, classificationSourceUrl: string | null): DirLink[] {
  const out: DirLink[] = [];
  const seen = new Set<string>();
  const add = (url: string | null | undefined, group: DirLink["group"], label?: string) => {
    if (!url) return;
    const clean = url.replace(/[.,;]+$/, "");
    if (!isDirUrl(clean)) return;
    const key = clean.toLowerCase().replace(/^http:/, "https:").replace("://dir.ca.gov", "://www.dir.ca.gov");
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ url: clean, group, label: label ?? labelForDirUrl(clean) });
  };
  add(r.mainUrl, "program");
  add(classificationSourceUrl, "requirements");
  for (const f of r.trainee?.facts ?? []) for (const m of f.value.match(URL_IN_TEXT) ?? []) add(m, "trainee");
  for (const f of r.trainee?.forms ?? []) add(f.url, "trainee");
  for (const u of r.exam?.sources ?? []) add(u, "exam");
  for (const u of r.renewal?.sources ?? []) add(u, "renewal");
  for (const u of r.fees?.sources ?? []) add(u, "fees");
  return out;
}

export const DIR_LINK_GROUP_LABELS: Record<DirLink["group"], string> = {
  program: "Program",
  requirements: "Requirements",
  trainee: "Trainee registration",
  exam: "Exam",
  renewal: "Renewal",
  fees: "Fees",
};
