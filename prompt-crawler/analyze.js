/* Prompt Crawler: splits a prompt into seven sections and sorts every word.
   Pure functions, shared by the page (window.PromptAnalyzer) and the tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PromptAnalyzer = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // The seven sections a complete prompt covers, in crawl order.
  const SECTIONS = [
    { key: 'role', abbr: 'ROL', axis: 'ROLE', color: '#e9edf1', sub: 'who the studio works for',
      names: ['role', 'persona', 'identity', 'who you are', 'you are', 'about you', 'voice'] },
    { key: 'objective', abbr: 'OBJ', axis: 'OBJ', color: '#3cc3f2', sub: 'what done looks like',
      names: ['objective', 'objectives', 'goal', 'goals', 'task', 'mission', 'purpose', 'outcome',
        'deliverable', 'deliverables', 'output', 'ask'] },
    { key: 'context', abbr: 'CON', axis: 'CTX', color: '#a08cff', sub: 'what is already true',
      names: ['context', 'background', 'situation', 'brief', 'overview', 'about', 'inputs', 'input',
        'notes', 'details'] },
    { key: 'roles', abbr: 'TEA', axis: 'TEAM', color: '#5fe3a1', sub: 'who owns what',
      names: ['roles', 'team', 'owners', 'ownership', 'people', 'stakeholders', 'responsibilities',
        'raci', 'audience', 'who'] },
    { key: 'rules', abbr: 'RUL', axis: 'RULES', color: '#ff9c55', sub: 'what never bends',
      names: ['rules', 'constraints', 'guardrails', 'requirements', 'policy', 'policies', 'limits',
        'style', 'tone', 'format', 'standards', 'dos and donts'] },
    { key: 'review', abbr: 'REV', axis: 'REV', color: '#e98bff', sub: 'how it gets checked',
      names: ['review', 'checks', 'check', 'qa', 'acceptance', 'verification', 'verify', 'tests',
        'testing', 'criteria', 'success criteria', 'definition of done', 'evaluation'] },
    { key: 'start', abbr: 'STA', axis: 'START', color: '#d7e35b', sub: 'the first move',
      names: ['start', 'first step', 'first steps', 'kickoff', 'begin', 'steps', 'process', 'workflow',
        'plan', 'next steps', 'instructions', 'how to start'] },
  ];

  // Words that sound like a spec but leave the reader guessing, by the question they raise.
  const VAGUE = {
    measure: ['full', 'fully', 'complete', 'completely', 'entire', 'whole', 'proper', 'properly',
      'appropriate', 'appropriately', 'adequate', 'sufficient', 'enough', 'relevant', 'necessary',
      'reasonable', 'reasonably', 'optimal', 'optimized', 'ideal'],
    quality: ['nice', 'clean', 'modern', 'sleek', 'premium', 'beautiful', 'stunning', 'gorgeous',
      'professional', 'polished', 'elegant', 'pretty', 'cool', 'awesome', 'amazing', 'great', 'good',
      'better', 'best', 'high-quality', 'perfect', 'engaging', 'compelling', 'luxury', 'luxurious', 'classy'],
    speed: ['fast', 'faster', 'quick', 'quickly', 'soon', 'asap', 'later', 'eventually', 'shortly',
      'timely', 'promptly', 'rapid', 'rapidly', 'instantly', 'snappy'],
    amount: ['some', 'many', 'few', 'several', 'various', 'lots', 'numerous', 'multiple', 'handful',
      'bunch', 'plenty'],
    hedge: ['maybe', 'probably', 'possibly', 'perhaps', 'might', 'somehow', 'something', 'somewhere',
      'stuff', 'things', 'whatever', 'etc', 'tbd', 'tba', 'todo', 'kinda', 'sorta', 'basically',
      'ideally', 'hopefully'],
    ease: ['simple', 'simply', 'easy', 'easily', 'intuitive', 'user-friendly', 'seamless', 'seamlessly',
      'robust', 'scalable', 'flexible', 'dynamic', 'smart', 'powerful', 'efficient', 'smooth',
      'smoothly', 'effortless'],
  };
  const VAGUE_OF = {};
  Object.keys(VAGUE).forEach((g) => VAGUE[g].forEach((w) => { VAGUE_OF[w] = g; }));

  // Words that tie the prompt to something checkable: who owns it, where it comes from, who signs it.
  const OWNER = new Set(['owner', 'owners', 'own', 'owns', 'staff', 'chief', 'lead', 'leads', 'team',
    'client', 'clients', 'customer', 'customers', 'designer', 'designers', 'developer', 'developers',
    'manager', 'managers', 'editor', 'editors', 'reviewer', 'reviewers', 'admin', 'founder', 'owned']);
  const CLAIM = new Set(['claim', 'claims', 'source', 'sources', 'sourced', 'traceable', 'cite', 'cites',
    'cited', 'citation', 'citations', 'evidence', 'proof', 'fact', 'facts', 'verified', 'verifiable',
    'data', 'reference', 'references', 'quote', 'quotes', 'receipt', 'receipts']);
  const APPROVAL = new Set(['approve', 'approves', 'approved', 'approval', 'approvals', 'sign-off',
    'signoff', 'signs', 'accept', 'accepts', 'accepted', 'acceptance', 'confirm', 'confirms',
    'confirmed', 'greenlight', 'greenlit', 'permission', 'consent', 'reviews', 'reviewed']);
  const FILE = /\.(html?|css|js|ts|md|json|toml|ya?ml|py|png|jpe?g|svg|webp|pdf|csv|prompt)$/i;

  const ASK = {
    measure: (w) => `“${w}” by what measure? List exactly what it includes.`,
    quality: (w) => `“${w}” how? Point to a reference site, a color or a typeface.`,
    speed: (w) => `“${w}”: give a number or a date.`,
    amount: (w) => `“${w}”: how many, exactly?`,
    hedge: (w) => {
      const l = w.toLowerCase();
      if (l === 'etc') return '“etc.”: finish the list.';
      if (l === 'todo' || l === 'tbd' || l === 'tba') return `“${w}”: fill this in before anyone builds.`;
      return `“${w}”: decide it. In or out?`;
    },
    ease: (w) => `“${w}” for whom, doing what? Describe the test it has to pass.`,
  };
  const MISSING = {
    role: 'No role. Who is this for, and who is speaking?',
    objective: 'No objective. What does done look like?',
    context: 'No context. What is already true that the reader can’t guess?',
    roles: 'No roles. Who owns each part, and who approves it?',
    rules: 'No rules. What must never happen?',
    review: 'No review. How will the result be checked before it ships?',
    start: 'No start. What is the very first step?',
  };

  // Sentence cues for prompts without headings, checked in this order.
  const CUES = [
    ['role', /\b(you are|you're|act as|acting as|your role|you work for)\b/i],
    ['review', /\b(check|checks|verify|verified|review|reviews|test|tests|qa|approve|approval|acceptance|proofread)\b/i],
    ['rules', /\b(never|always|must|don't|do not|avoid|only|no more than|at least|at most|required|forbidden)\b/i],
    ['start', /\b(first|start|begin|step \d|kick ?off|initially)\b/i],
    ['roles', /\b(team|owner|owns|client|stakeholder|designer|developer|manager|lead|responsible|signs? off)\b/i],
    ['objective', /\b(goal|objective|build|create|write|produce|make|deliver|ship|so that|in order to)\b/i],
  ];

  const MAX_WORDS = 3000;
  const WORD = /[\p{L}\p{N}$#][\p{L}\p{N}$.%:'’\/-]*[\p{L}\p{N}%]|[\p{L}\p{N}$%]/gu;

  function tokenize(text) {
    const out = [];
    WORD.lastIndex = 0;
    let m;
    while ((m = WORD.exec(text))) {
      const next = text.charAt(m.index + m[0].length);
      out.push({ text: m[0], end: /[.!?:;]/.test(next) });
    }
    return out;
  }

  function isSpec(word) {
    return /\d/.test(word) || /^#[0-9a-f]{3,8}$/i.test(word) || /^https?:/i.test(word) || FILE.test(word);
  }

  function classify(word) {
    const w = word.toLowerCase().replace(/’/g, "'").replace(/'s$/, '');
    if (VAGUE_OF[w]) return { kind: 'vague', group: VAGUE_OF[w] };
    if (isSpec(word)) return { kind: 'spec', group: null };
    if (OWNER.has(w)) return { kind: 'owner', group: null };
    if (CLAIM.has(w)) return { kind: 'claim', group: null };
    if (APPROVAL.has(w)) return { kind: 'approval', group: null };
    return { kind: null, group: null };
  }

  function headingOf(line) {
    let m = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (m) return m[1];
    m = line.match(/^\s*\*\*([^*]{1,40})\*\*:?\s*$/);
    if (m) return m[1];
    m = line.match(/^\s*<([a-z][a-z_ -]{0,30})>\s*$/i);
    if (m) return m[1].replace(/_/g, ' ');
    m = line.match(/^\s*([A-Za-z][A-Za-z &\/'-]{1,30}):\s*$/);
    if (m && m[1].trim().split(/\s+/).length <= 4) return m[1];
    return null;
  }

  function splitSections(text) {
    const blocks = [];
    let cur = { heading: null, body: [] };
    text.replace(/\r\n?/g, '\n').split('\n').forEach((line) => {
      if (/^\s*<\/[a-z][a-z_ -]{0,30}>\s*$/i.test(line)) return;   // closing XML-style tag
      const h = headingOf(line);
      if (h !== null) { blocks.push(cur); cur = { heading: h, body: [] }; }
      else cur.body.push(line);
    });
    blocks.push(cur);
    return blocks
      .map((b) => ({ heading: b.heading, body: b.body.join('\n') }))
      .filter((b) => b.heading !== null || b.body.trim());
  }

  function matchHeading(heading) {
    const clean = heading.replace(/[*_`]/g, '').trim();
    const parts = clean.split(/\s+[·—–|-]\s+|\s*:\s+/);
    const name = parts[0].toLowerCase().replace(/^\d+[.)]?\s*/, '').replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim();
    const sub = parts.slice(1).join(' · ').trim();
    let key = null;
    for (const s of SECTIONS) if (s.names.includes(name)) { key = s.key; break; }
    if (!key) {
      for (const s of SECTIONS) {
        if (s.names.some((n) => new RegExp('\\b' + n + '\\b').test(name))) { key = s.key; break; }
      }
    }
    return { key, sub, name: clean };
  }

  function guessSection(sentence) {
    for (const [key, re] of CUES) if (re.test(sentence)) return key;
    return 'context';
  }

  function sentences(text) {
    return text.replace(/([.!?])\s+/g, '$1\n').split(/\n+/).map((s) => s.trim()).filter(Boolean);
  }

  function analyze(text) {
    const sections = SECTIONS.map((s) => ({
      key: s.key, abbr: s.abbr, axis: s.axis, color: s.color, sub: s.sub,
      words: [], headed: false, guessed: 0,
    }));
    const byKey = {};
    sections.forEach((s) => { byKey[s.key] = s; });
    let count = 0, truncated = false, guessed = 0;

    function add(section, chunk, wasGuessed) {
      for (const t of tokenize(chunk)) {
        if (count >= MAX_WORDS) { truncated = true; return; }
        const c = classify(t.text);
        section.words.push({ text: t.text, lower: t.text.toLowerCase(), kind: c.kind, group: c.group,
          end: t.end, guessed: wasGuessed });
        count++;
      }
    }

    for (const block of splitSections(text)) {
      const m = block.heading !== null ? matchHeading(block.heading) : null;
      if (m && m.key) {
        const s = byKey[m.key];
        if (m.sub && !s.headed) s.sub = m.sub;
        s.headed = true;
        add(s, block.body, false);
      } else {
        for (const sentence of sentences(block.body)) {
          const s = byKey[guessSection(sentence)];
          s.guessed++;
          guessed++;
          add(s, sentence, true);
        }
      }
    }
    return { sections, total: count, guessed, truncated };
  }

  // Each section is worth 100/7 points: read in full, at least 12 words deep, with no vague words.
  function sectionPoints(n, read, flags) {
    if (!n) return 0;
    const depth = Math.min(1, n / 12);
    return (100 / 7) * (read / n) * depth * Math.max(0.4, 1 - 0.12 * flags);
  }

  function score(doc, readCounts) {
    let total = 0;
    const per = doc.sections.map((s, i) => {
      const r = readCounts ? readCounts[i] : s.words.length;
      let f = 0;
      for (let k = 0; k < r; k++) if (s.words[k].kind === 'vague') f++;
      const p = sectionPoints(s.words.length, r, f);
      total += p;
      return p / (100 / 7);
    });
    return { total: Math.round(total), per };
  }

  function snippet(words, i) {
    const a = Math.max(0, i - 5), b = Math.min(words.length, i + 6);
    return {
      before: (a > 0 ? '…' : '') + words.slice(a, i).map((w) => w.text).join(' '),
      word: words[i].text,
      after: words.slice(i + 1, b).map((w) => w.text).join(' ') + (b < words.length ? '…' : ''),
    };
  }

  // One question per distinct vague word, then one per missing section.
  function questions(doc) {
    const out = [];
    const seen = new Map();
    doc.sections.forEach((s) => s.words.forEach((w, i) => {
      if (w.kind !== 'vague') return;
      const q = seen.get(w.lower);
      if (q) {
        q.count++;
        if (!q.sections.includes(s.key)) q.sections.push(s.key);
        return;
      }
      const item = { word: w.text, lower: w.lower, group: w.group, sections: [s.key], count: 1,
        ask: ASK[w.group](w.text), context: snippet(s.words, i), missing: false };
      seen.set(w.lower, item);
      out.push(item);
    }));
    doc.sections.forEach((s) => {
      if (!s.words.length) out.push({ word: null, sections: [s.key], count: 1, ask: MISSING[s.key], missing: true });
    });
    return out;
  }

  return { SECTIONS, VAGUE, MAX_WORDS, tokenize, classify, splitSections, matchHeading, guessSection,
    analyze, sectionPoints, score, questions };
});
