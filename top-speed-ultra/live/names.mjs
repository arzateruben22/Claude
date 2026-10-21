// Which driver names are allowed. Names are public (they float over cars), so slurs, profanity and names that pass
// for staff are refused at sign-up. Short words only count as a whole part of the name (so "cockpit", "Assassin" and
// "Scunthorpe" stay fine); longer ones count anywhere, after undoing the usual number-for-letter swaps.

const RESERVED = ['admin', 'administrator', 'mod', 'moderator', 'staff', 'support', 'official', 'system', 'server', 'ocultra', 'oc_ultra', 'owner', 'dev', 'developer', 'root', 'null', 'undefined', 'anthropic', 'claude'];
// anywhere in the name (distinctive enough that innocent words don't contain them)
const ANYWHERE = ['fuck', 'fuk', 'shit', 'bitch', 'cunt', 'nigg', 'nigga', 'fagg', 'faggot', 'retard', 'whore', 'slut', 'rapist', 'rape', 'nazi', 'hitler', 'porn', 'pussy', 'dildo', 'penis', 'vagina', 'molest', 'pedo', 'kike', 'spic', 'chink', 'wetback', 'tranny', 'kys', 'killyourself', 'heil'];
// only as a whole part (split at underscores and letter/number boundaries, and at case changes)
const WHOLE = ['ass', 'asses', 'arse', 'cock', 'cocks', 'dick', 'dicks', 'fag', 'fags', 'kkk', 'sex', 'sexy', 'tit', 'tits', 'cum', 'jizz', 'twat', 'wank', 'piss', 'damn', 'hoe', 'hoes', 'nig', 'coon', 'gook', 'homo', 'isis'];

const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g', '@': 'a', '$': 's' };
const flat = (s) => s.toLowerCase().replace(/[0-9@$]/g, (c) => LEET[c] ?? c).replace(/_/g, '');
const parts = (s) => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Za-z])([0-9])|([0-9])([A-Za-z])/g, '$1$3 $2$4').split(/[\s_]+/).map((p) => p.toLowerCase()).filter(Boolean);

// '' when the name is fine, otherwise the reason to show
export function nameProblem(name) {
  const f = flat(name);
  if (RESERVED.some((r) => f === r.replace(/_/g, '') || f.startsWith(r.replace(/_/g, '')) && r.length >= 5)) return 'That name is reserved.';
  if (ANYWHERE.some((w) => f.includes(w))) return 'Pick a different name.';
  const ps = parts(name), pf = ps.map(flat);
  if (pf.some((p) => WHOLE.includes(p)) || WHOLE.includes(f)) return 'Pick a different name.';
  return '';
}
