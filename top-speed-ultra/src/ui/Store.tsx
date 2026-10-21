// The store: optional looks, sold honestly. The catalog (src/store/catalog.json) grouped by kind, each item's price
// and what it unlocks, what you own, Restore purchases, and a checkout sheet. In TEST MODE the sheet takes Stripe's
// test cards and nothing is charged; live, it hands you to Stripe's own checkout page (src/store/payments.ts).
// The rules it shows, from PROJECT_OC_MONETIZATION.md: looks only; a licence, not ownership (California AB 2426);
// 13+ with a neutral age question, and a parent's or guardian's OK under 18; a subscription's terms before its
// checkbox (California's automatic renewal law); the Founder Pack's fixed end date, with no countdown. The OC Hypercar
// Founder Edition has its own card: its price, the founder window, the plaque and paint it comes with, that the
// Founder Pack doesn't include it, its two tunes, and "Coming soon" until the car is in the game (catalog.json). The
// Ultra Graphics card (decision 15) says what Ultra is in one line (the maximum graphics tier; Low and HD are free)
// and who has it on this device right now (ultraState in src/store/entitlements.ts).
// Styles: `.store` in styles.css. Opened from the main menu and the pause menu (App.tsx).
import { cloneElement, useEffect, useId, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { Game } from '../game/Game';
import { CONFIG } from '../store/config';
import { CATALOG, KINDS, FOUNDER_SKU, HYPERCAR_SKU, ULTRA_SKU, Sku, Entitlement, saleState, priceLine, money, carFor, CAR_NAMES, entById, skuById, grantLine, windowDate } from '../store/catalog';
import * as account from '../store/account';
import { has, ownsSku, receipts, restore, list, serialOf, serialLabel, Receipt, ULTRA_ENTITLEMENT, ultraState, UltraState } from '../store/entitlements';
import { checkout, formatCard, formatExpiry, confirmReturn, onSaleFromServer, cleanRollName, ReturnState } from '../store/payments';
import { ownedPaints, equippedPaintId, equipPaint, inGame } from '../store/locker';
import { onStoreChange } from '../store/bus';

const LOOKS_ONLY = 'Looks only: it changes nothing about how any car drives or scores.';
// the owner's two-tune rule (PROJECT_OC_MONETIZATION.md rule 3a), in the store's words. Free Drive has no clock and
// no rivals, but it does keep a score (the distance), a best and a device-only board: hence "stay on your device" and
// "marked", which the car must do before it is sold (its `needs` in cosmetics.json)
const FREE_DRIVE_ONLY = 'no clock and no rivals, your Free Drive bests stay on your device, and its Unleashed runs and run cards are marked';
const TWO_TUNE = `Unleashed in Free Drive only: ${FREE_DRIVE_ONLY}. In Races, Time Trial and Speed Survival it runs a race tune at or under the Rossini Corsa, with its ability off.`;
// the Ultra graphics tier (decision 15): graphics only, and the free tiers named wherever its price is
const GRAPHICS_ONLY = 'Graphics only: it changes nothing about how any car drives, scores or earns. Low and HD are free.';
const WHERE_ULTRA = 'Settings → Display → Graphics';
const ULTRA_LINE: Record<UltraState, string> = {
  test: 'This test build unlocks Ultra for everyone, so buying it here only tries the test checkout. Nothing is charged.',
  owned: `Unlocked on this account: choose Ultra in ${WHERE_ULTRA}.`,
  owner: 'Unlocked by owner mode on this device (test builds only).',
  free: 'Ultra stays unlocked for everyone until it goes on sale.',
  locked: `Unlocks Ultra in ${WHERE_ULTRA} on every device you sign in on.`,
};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface StoreHooks { open: (sku: string) => void; preview: (sku: string) => void; close: () => void }

export function Store({ game, onClose }: { game: Game; onClose: () => void }) {
  const [, bump] = useState(0);
  const [sheet, setSheet] = useState<{ sku: string; preview: boolean } | null>(null);
  const [note, setNote] = useState<{ text: string; kind: 'good' | 'bad' | 'info' } | null>(null);
  const [ret, setRet] = useState<ReturnState>({ kind: 'none' });
  const [serverSale, setServerSale] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [signin, setSignin] = useState(false);
  const top = useRef<HTMLHeadingElement>(null);

  useEffect(() => onStoreChange(() => bump((n) => n + 1)), []);
  useEffect(() => {
    top.current?.focus();
    let alive = true;
    void account.ready.then(() => {
      if (!alive) return;
      void confirmReturn((s) => alive && setRet(s));
      if (CONFIG.live) {
        void restore();
        void onSaleFromServer().then((r) => alive && r && setServerSale(new Set(r.on_sale)));
      }
    });
    return () => { alive = false; };
  }, []);
  // test hooks, like window.__game: open an item's checkout; preview shows any item's sheet (pay switched off)
  useEffect(() => {
    const w = window as unknown as { __store?: StoreHooks };
    w.__store = { open: (sku) => setSheet({ sku, preview: false }), preview: (sku) => setSheet({ sku, preview: true }), close: () => setSheet(null) };
    return () => { delete w.__store; };
  }, []);

  const s = account.current(), age = account.ageState(), garage = game.profile.p.vehicles;
  const founder = skuById(FOUNDER_SKU);
  const founderOn = !!founder && saleState(founder).ok;
  // the hypercar's card: on sale, "Coming soon" until it is, and after the window only for the people who own it
  const hyper = skuById(HYPERCAR_SKU);
  const hyperOn = !!hyper && saleState(hyper).ok;
  const hyperSale = hyper ? saleState(hyper) : null;
  const hyperSoon = !!hyper && !hyperOn && !ownsSku(hyper.sku);
  const hyperShown = !!hyper && (!hyper.window || Date.now() <= Date.parse(hyper.window.until) || ownsSku(hyper.sku));
  const ultra = skuById(ULTRA_SKU), ultraOn = !!ultra && saleState(ultra).ok;
  const lockedWhy = (it: Sku): string | null => {
    if (age === 'under13') return 'For players 13 and over';
    const car = carFor(it);
    if (car && !garage.includes(car)) return `Earn the ${CAR_NAMES[car] ?? car} first`;
    if (serverSale && !serverSale.has(it.sku)) return 'On sale once it is in the game';
    return null;
  };
  const buy = (sku: string) => { setNote(null); setSheet({ sku, preview: false }); };
  const doRestore = async () => {
    setBusy(true);
    const r = await restore();
    setBusy(false);
    setNote({ text: r.message, kind: r.ok ? 'good' : 'bad' });
  };

  const owned = list();
  return (
    <>
      <div className="overlay center store">
        <div className="panel wide store-panel" aria-labelledby="store-title">
          <p className="eyebrow">OC Ultra</p>
          <h2 id="store-title" ref={top} tabIndex={-1}>Store</h2>
          {CONFIG.live
            ? <div className="store-mode live" role="note"><b>Secure checkout</b><span>Stripe's own page takes your card, Apple Pay or Google Pay. We never see your card.</span></div>
            : <div className="store-mode" role="note"><b>Test mode</b><span>Nothing is charged. Use 4242 4242 4242 4242.</span></div>}
          {hyperShown
            ? <p className="store-lede">Optional looks for your car and your driver,{ultraOn ? ' the Ultra graphics tier,' : ''} and one founder car. The looks{ultraOn ? ' and Ultra' : ''} change nothing about how any car drives or scores. The OC Hypercar Founder Edition is faster than any car you can earn in Free Drive only ({FREE_DRIVE_ONLY}); everywhere else it runs at or under the Rossini Corsa. Every freeway, every mode{ultraOn ? ', every graphics setting but Ultra' : ''} and every car you can earn stays free, and credits are earned by driving only.</p>
            : <p className="store-lede">Optional looks for your car and your driver{ultraOn ? ', and the Ultra graphics tier' : ''}. Nothing here changes how any car drives or scores. Every freeway, every mode{ultraOn ? ', every graphics setting but Ultra' : ''} and every car you can earn stays free, and credits are earned by driving only.</p>}

          <Account signin={signin} setSignin={setSignin} busy={busy} onRestore={() => void doRestore()} />
          {note && <p className={'store-note ' + note.kind} role="status">{note.text}</p>}
          <ReturnNotice ret={ret} onDismiss={() => setRet({ kind: 'none' })} />
          {account.authError() && <p className="store-note bad" role="alert">{account.authError()}</p>}

          {owned.length > 0 && <Locker game={game} />}

          {founder && founderOn && (
            <section className="store-founder" data-sku={founder.sku} aria-labelledby="store-founder-h">
              <p className="store-founder-when">For launch players · sold until {windowDate(founder)}, then never again</p>
              <div className="store-founder-head">
                <h3 id="store-founder-h">{founder.name}</h3>
                <Price item={founder} />
              </div>
              <p className="store-desc">{founder.description}</p>
              <Grants item={founder} />
              <Action item={founder} locked={lockedWhy(founder)} onBuy={buy} />
            </section>
          )}

          {hyper && hyperShown && (
            // not the class 'soon': that is the main menu's coming-soon tile (styles.css), a two-column grid
            <section className={'store-founder store-hyper' + (hyperSoon ? ' is-soon' : '')} data-sku={hyper.sku} data-soon={hyperSoon ? 'true' : undefined} aria-labelledby="store-hyper-h">
              <p className="store-founder-when">Founder Edition · sold until {windowDate(hyper, 'short')}</p>
              <div className="store-founder-head">
                <h3 id="store-hyper-h">{hyper.name}</h3>
                <Price item={hyper} />
              </div>
              <p className="store-desc">{hyper.description}</p>
              <p className="store-q small">Comes with</p>
              <Grants item={hyper} shows={false} />
              <p className="store-hyper-not">The $10 Founder Pack does not include this car, and this car does not include the pack's Founder '26 badge or Founders Sunset paint.</p>
              {!hyperSoon ? <Action item={hyper} locked={lockedWhy(hyper)} onBuy={buy} />
                : <><p className="store-act"><em className="store-soon">Coming soon</em></p><p className="fine store-soon-why">{hyperSale && !hyperSale.ok ? hyperSale.why + ' ' : ''}No pre-orders.</p></>}
            </section>
          )}

          {KINDS.map(({ kind, label, blurb }) => {
            const items = CATALOG.filter((it) => it.kind === kind && it.sku !== FOUNDER_SKU && it.sku !== HYPERCAR_SKU && saleState(it).ok);
            if (!items.length) return null;
            return (
              <section key={kind} className="store-group" aria-labelledby={'store-g-' + kind}>
                <h3 className="sect" id={'store-g-' + kind}>{label}</h3>
                {blurb && <p className="fine">{blurb}</p>}
                <div className="store-items">
                  {items.map((it) => (
                    <article key={it.sku} className={'store-item' + (ownsSku(it.sku) ? ' owned' : '')} data-sku={it.sku}>
                      <div className="store-item-head"><h4>{it.name}</h4><Price item={it} small={it.kind === 'tip'} /></div>
                      <p className="store-desc">{it.description}</p>
                      <Grants item={it} shows={it.kind !== 'graphics'} />
                      {it.kind === 'graphics' && <p className="fine store-ultra-state" data-ultra={ultraState()}>{ULTRA_LINE[ultraState()]}</p>}
                      <Action item={it} locked={lockedWhy(it)} onBuy={buy} />
                    </article>
                  ))}
                </div>
              </section>
            );
          })}

          <Terms />
          <p className="fine">{CONFIG.live ? 'Payments by Stripe. Receipts come from Stripe by email.' : 'This store build is in test mode: live payments need the owner\'s Stripe and Supabase accounts.'} {s ? '' : CONFIG.live ? 'Signing in sends your email to our database host (Supabase); playing never needs it.' : 'In test mode your email stays on this device.'}</p>
          <div className="row"><button className="btn primary" onClick={onClose}>Done</button></div>
        </div>
      </div>
      {sheet && <Checkout key={sheet.sku} sku={sheet.sku} preview={sheet.preview} game={game} garage={garage} onClose={() => setSheet(null)} />}
    </>
  );
}

// a labelled field: the label points at its control by id, so the control's name is the label alone
function Field({ label, children }: { label: string; children: ReactElement }) {
  const id = useId();
  return <div className="store-field"><label htmlFor={id}>{label}</label>{cloneElement(children, { id })}</div>;
}

// ------------------------------------------------------------------------------------------- item parts
// Every price carries the test-mode notice right under it, not only the banner at the top of the store, so a price is
// never on screen without it (CLAUDE.md: test mode until the owner connects Stripe and says live; nothing is charged).
const TEST_TAG = 'Test mode · nothing is charged';
function Price({ item, small = false }: { item: Sku; small?: boolean }) {
  return (
    <div className="store-pricebox">
      <p className={'store-price' + (small ? ' small' : '')}>{priceLine(item)}</p>
      {!CONFIG.live && <p className="store-test-tag">{TEST_TAG}</p>}
    </div>
  );
}
function Swatch({ hex, label, mark }: { hex?: string; label?: string; mark?: 'sunset' | 'silver' | 'blank' }) {
  if (hex) return <i className="store-sw" style={{ background: hex }} aria-hidden={label ? undefined : true} title={label} />;
  return mark ? <i className={'store-sw ' + mark} aria-hidden="true" /> : null;
}
// badges, frames, plaques and cars have no colour of their own: a sunset mark for the Founder Pack's exclusives, a
// silver one for the Founder Edition's (the two founder offers never share a look), a blank otherwise
const markOf = (e: Entitlement) => (e.exclusive === FOUNDER_SKU ? 'sunset' as const : e.exclusive ? 'silver' as const : 'blank' as const);
function swatchOf(e: Entitlement) {
  return e.hex ?? e.rim?.hex ?? e.sleeve?.hex ?? e.watch?.dial.hex;
}
function Grants({ item, shows = true }: { item: Sku; shows?: boolean }) {
  const ents = item.grants.map(entById).filter((e): e is Entitlement => !!e);
  const shown = ents.filter((e) => inGame(e.id)).length;
  return (
    <>
      <ul className="store-grants">
        {ents.map((e) => <li key={e.id} className={has(e.id) ? 'got' : ''}><Swatch hex={swatchOf(e)} mark={markOf(e)} />{e.leds && <Swatch hex={e.leds.hex} label={e.leds.name + ' lights'} />}{grantLine(e)}{e.caliper && <Swatch hex={e.caliper.hex} label={e.caliper.name + ' calipers'} />}</li>)}
      </ul>
      {shows && <p className="store-shows">{shown === ents.length ? 'Shows in the game now.' : shown ? `In the game now: the paints${ents.some((e) => e.id === 'badge-founder-26') ? ' and the run-card badge and frame' : ''}. The rest is saved to your account and shows once the game can fit it.` : 'Saved to your account; it shows in the game once the game can fit it (test mode only until then).'}</p>}
    </>
  );
}
function Action({ item, locked, onBuy }: { item: Sku; locked: string | null; onBuy: (sku: string) => void }) {
  if (item.kind !== 'tip' && ownsSku(item.sku)) return <p className="store-act"><em className="store-owned">Owned</em></p>;
  if (locked) return <p className="store-act"><em className="store-locked">{locked}</em></p>;
  const label = item.kind === 'tip' ? 'Choose an amount' : item.mode === 'subscription' ? 'Join' : `Buy · ${money(item.price_cents)}`;
  return <p className="store-act"><button className="btn primary" onClick={() => onBuy(item.sku)} aria-label={`${item.kind === 'tip' ? 'Support' : 'Buy'} ${item.name}, ${priceLine(item)}`}>{label}</button></p>;
}

// ------------------------------------------------------------------------------------------- account
function Account({ signin, setSignin, busy, onRestore }: { signin: boolean; setSignin: (v: boolean) => void; busy: boolean; onRestore: () => void }) {
  const s = account.current(), age = account.ageState();
  const badges = ['badge-founder-26', 'badge-supporter', 'badge-club'].filter(has).map((id) => entById(id)!);
  if (age === 'under13') return <div className="store-account"><p>The store is for players 13 and over. Every freeway, every mode and every car you can earn stays free to play.</p></div>;
  return (
    <div className="store-account" aria-label="Account">
      {s ? <>
        <div className="store-who">
          <p><small>Signed in{s.test ? ' (test account)' : ''}</small><b>{s.email}</b></p>
          {badges.length > 0 && <ul className="store-badges">{badges.map((b) => <li key={b.id} className={b.id === 'badge-founder-26' ? 'founder' : ''}>{b.name}</li>)}</ul>}
        </div>
        <div className="row">
          <button className="btn" onClick={onRestore} disabled={busy}>{busy ? 'Restoring…' : 'Restore purchases'}</button>
          <button className="btn" onClick={() => void account.signOut()}>Sign out</button>
        </div>
      </> : signin ? <SignIn onDone={() => setSignin(false)} /> : <>
        <p>Not signed in. You only need an account to buy, or to get your items on another device.</p>
        <div className="row">
          <button className="btn" onClick={() => setSignin(true)}>Sign in</button>
          <button className="btn" onClick={onRestore}>Restore purchases</button>
        </div>
      </>}
    </div>
  );
}

// the neutral age question: no default, no hint of the cutoff, asked before the email
function AgeGate() {
  const [m, setM] = useState(''), [y, setY] = useState(''), [err, setErr] = useState('');
  const go = () => {
    const r = account.answerAge(Number(y), Number(m));
    if (r === 'unknown') setErr('Choose a month and type the year, like 1998.');
  };
  return (
    <div className="store-step" role="group" aria-labelledby="store-age-q">
      <p id="store-age-q" className="store-q">What month and year were you born?</p>
      <div className="store-fields two">
        <Field label="Month"><select value={m} onChange={(e) => setM(e.target.value)}><option value="">Choose</option>{MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}</select></Field>
        <Field label="Year"><input inputMode="numeric" maxLength={4} placeholder="YYYY" value={y} onChange={(e) => setY(e.target.value.replace(/\D/g, '').slice(0, 4))} /></Field>
      </div>
      {err && <p className="store-err" role="alert">{err}</p>}
      <div className="row"><button className="btn" onClick={go}>Continue</button></div>
    </div>
  );
}

function SignIn({ onDone }: { onDone?: () => void }) {
  const [email, setEmail] = useState(''), [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle'), [err, setErr] = useState('');
  if (account.ageState() === 'unknown') return <AgeGate />;
  if (account.ageState() === 'under13') return <p>The store is for players 13 and over. Every freeway, every mode and every car you can earn stays free to play.</p>;
  if (state === 'sent') return <p className="store-note good" role="status">Check your email for the sign-in link and open it on this device. The store opens again when you come back.</p>;
  const send = async () => {
    setErr(''); setState('busy');
    const r = await account.requestLink(email);
    if (r.error) { setErr(r.error); setState('idle'); return; }
    if (r.sent) { setState('sent'); return; }
    onDone?.();
  };
  return (
    <form className="store-step" onSubmit={(e) => { e.preventDefault(); void send(); }}>
      <Field label="Email"><input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></Field>
      <p className="fine">{CONFIG.live ? 'We email you a one-tap sign-in link. No password.' : 'Test mode: this signs you straight in on this device. No email is sent.'}</p>
      {err && <p className="store-err" role="alert">{err}</p>}
      <div className="row"><button className="btn primary" type="submit" disabled={state === 'busy'}>{state === 'busy' ? 'Sending…' : 'Send my sign-in link'}</button></div>
    </form>
  );
}

// ------------------------------------------------------------------------------------------- what you own
function Locker({ game }: { game: Game }) {
  const car = game.profile.p.car, paints = ownedPaints(car), on = equippedPaintId(car);
  const others = list().map((o) => entById(o.entitlement)).filter((e): e is Entitlement => !!e && e.type !== 'paint' && !inGame(e.id) && e.type !== 'badge');
  const badgeLike = list().map((o) => entById(o.entitlement)).filter((e): e is Entitlement => !!e && (e.type === 'badge' || e.type === 'frame'));
  return (
    <section className="store-locker" aria-labelledby="store-locker-h">
      <h3 className="sect" id="store-locker-h">Your items</h3>
      {paints.length > 0 && <>
        <p className="store-q">Paint on your {CAR_NAMES[car] ?? car}</p>
        <div className="store-paints" role="group" aria-label={`Paint on your ${CAR_NAMES[car] ?? car}`}>
          <button className="store-paint" aria-pressed={!on} onClick={() => equipPaint(car, null)}><i className="store-sw factory" aria-hidden="true" />Factory paint</button>
          {paints.map((p) => <button key={p.id} className="store-paint" data-paint={p.id} aria-pressed={on === p.id} onClick={() => equipPaint(car, p.id)}><Swatch hex={p.hex} />{p.name}<small>{p.finish}</small></button>)}
        </div>
        <p className="fine">On the car you drive. Change cars in the Garage; each car keeps its own paint.</p>
      </>}
      {badgeLike.length > 0 && <p className="fine">On your run cards: {badgeLike.map((b) => b.name).join(', ')}.</p>}
      {has(ULTRA_ENTITLEMENT) && <p className="fine store-ultra-owned">Ultra graphics: unlocked on this account. Choose it in {WHERE_ULTRA}.</p>}
      {has('car-oc-hyper') && <p className="fine store-serial">{serialOf('car-oc-hyper') !== null ? `Your OC Hypercar Founder Edition: ${serialLabel(serialOf('car-oc-hyper')!)}, assigned by the server when your payment went through.` : 'Your OC Hypercar Founder Edition has no number here: only the server numbers a sale, when a live payment succeeds, and test purchases have none.'}</p>}
      {others.length > 0 && <p className="fine">Saved to your account, and shown in the game once it can fit them: {others.map((e) => e.name).join(', ')}.</p>}
      {receipts().length > 0 && (
        <details className="store-receipts"><summary>Test receipts ({receipts().length})</summary>
          <ul>{receipts().map((r) => <li key={r.id}><b>{r.name}</b> {money(r.amount_cents, true)} · {new Date(r.at).toLocaleDateString()} · {r.id}</li>)}</ul>
        </details>
      )}
    </section>
  );
}

function ReturnNotice({ ret, onDismiss }: { ret: ReturnState; onDismiss: () => void }) {
  if (ret.kind === 'none') return null;
  if (ret.kind === 'waiting') return <p className="store-note info" role="status">Confirming your purchase with the server…</p>;
  if (ret.kind === 'cancelled') return <p className="store-note info" role="status">Checkout cancelled. Nothing was charged. <button className="store-link" onClick={onDismiss}>OK</button></p>;
  if (ret.kind === 'slow') return <p className="store-note info" role="status">{ret.message} <button className="store-link" onClick={onDismiss}>OK</button></p>;
  return <div className="store-note good" role="status"><ReceiptView r={ret.receipt} /><button className="store-link" onClick={onDismiss}>OK</button></div>;
}

function ReceiptView({ r }: { r: Receipt }) {
  return (
    <div className="store-receipt" aria-label="Receipt">
      <p className="eyebrow">Receipt{r.test ? ' · test mode' : ''}</p>
      <dl>
        <div><dt>Item</dt><dd>{r.name}</dd></div>
        <div><dt>Amount</dt><dd>{money(r.amount_cents, true)} {r.currency.toUpperCase()}</dd></div>
        {r.card && <div><dt>Card</dt><dd>{r.card}</dd></div>}
        <div><dt>Date</dt><dd>{new Date(r.at).toLocaleString()}</dd></div>
        <div><dt>Receipt no.</dt><dd className="mono">{r.id.length > 24 ? r.id.slice(0, 12) + '…' + r.id.slice(-6) : r.id}</dd></div>
        {r.roll_name && <div><dt>Founders roll</dt><dd>{r.roll_name} (after the owner approves it)</dd></div>}
      </dl>
      {r.test && <p className="store-test-line">Test mode: nothing was charged.</p>}
    </div>
  );
}

function Terms() {
  return (
    <details className="store-terms" id="store-terms">
      <summary>Store terms (draft)</summary>
      <ul>
        <li>You get a licence to use the items in OC Ultra, not ownership of them. A refund takes the items back, and the game can change.</li>
        <li>Looks only: no item changes speed, grip, handling, score, credits or XP. The Ultra graphics tier changes how the game looks, not how it plays, and Low and HD are free. The one exception is the OC Hypercar Founder Edition: it is faster than any car you can earn in Free Drive only ({FREE_DRIVE_ONLY}). In Races, Time Trial and Speed Survival it runs a race tune at or under the best car you can earn, with its ability off, and its Free Drive earnings are capped at that tune's top speed. Credits are never sold. No loot boxes and no premium currency.</li>
        <li>For players 13 and over. Under 18, a parent or guardian must say yes first.</li>
        <li>Refunds: ask within 14 days if you haven't used the item in a drive. An accidental purchase, or a minor's purchase without permission, is refunded any time. Email (TODO: support email).</li>
        <li>Your items are saved to your account: sign in with the same email on any device and tap Restore purchases.</li>
        <li>Subscriptions renew until you cancel, and you can cancel online in the store at any time.</li>
      </ul>
      <p className="fine">A draft for the owner's lawyer to review before live mode (TODO).</p>
    </details>
  );
}

// ------------------------------------------------------------------------------------------- the checkout sheet
function Checkout({ sku, preview, game, garage, onClose }: { sku: string; preview: boolean; game: Game; garage: string[]; onClose: () => void }) {
  const it = skuById(sku);
  const [, bump] = useState(0);
  const [adult, setAdult] = useState(false), [renew, setRenew] = useState(false);
  const [roll, setRoll] = useState(false), [rollName, setRollName] = useState(game.profile.p.username === 'Driver' ? '' : game.profile.p.username);
  const [tip, setTip] = useState(it?.custom_amount ? String(it.custom_amount.preset_cents / 100) : '');
  const [card, setCard] = useState(''), [exp, setExp] = useState(''), [cvc, setCvc] = useState('');
  const [state, setState] = useState<'form' | 'paying' | 'done'>('form');
  const [err, setErr] = useState(''), [receipt, setReceipt] = useState<Receipt | null>(null);
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => onStoreChange(() => bump((n) => n + 1)), []);
  useEffect(() => { head.current?.focus(); }, [state]);
  if (!it) return null;

  const sale = saleState(it), age = account.ageState(), s = account.current();
  const sub = it.mode === 'subscription', isTip = it.kind === 'tip', a = it.custom_amount;
  const tipCents = Math.round(Number(tip) * 100);
  const amount = isTip ? tipCents : it.price_cents;
  const per = it.interval === 'year' ? 'year' : 'month';
  const car = game.profile.p.car, fitsCar = (e: Entitlement | null) => !!e && e.type === 'paint' && (e.cars === 'all' || e.cars === car);
  const paint = it.grants.map(entById).find((e) => fitsCar(e) && (e!.exclusive || it.grants.length === 1)) ?? it.grants.map(entById).find(fitsCar);
  const pay = async () => {
    setErr(''); setState('paying');
    const r = await checkout({ sku, tipCents: isTip ? tipCents : undefined, adultOrGuardian: adult, renewalAgreed: renew, rollName: roll ? cleanRollName(rollName) : null, garage },
      CONFIG.live ? undefined : { number: card, expiry: exp, cvc });
    if (r.ok === true) { setReceipt(r.receipt); setState('done'); setCard(''); setCvc(''); return; }
    if (r.ok === 'redirect') return;                     // on the way to Stripe's page
    setErr(r.message); setState('form');
  };

  return (
    <div className="overlay center store store-sheet" role="dialog" aria-modal="true" aria-labelledby="store-sheet-h">
      <div className="panel narrow" data-sku={sku}>
        {state === 'done' && receipt ? <>
          <p className="eyebrow">Thank you</p>
          <h2 id="store-sheet-h" ref={head} tabIndex={-1}>{isTip ? 'Thanks for the fuel' : 'It\'s yours to use'}</h2>
          <ReceiptView r={receipt} />
          <ul className="store-grants">{receipt.grants.map((g) => entById(g)).filter((e): e is Entitlement => !!e).map((e) => <li key={e.id} className="got"><Swatch hex={swatchOf(e)} mark={markOf(e)} />{grantLine(e)}</li>)}</ul>
          {it.kind === 'graphics' && <p className="fine store-ultra-next">Choose Ultra in {WHERE_ULTRA}.</p>}
          <div className="row">
            {paint && <button className="btn primary" onClick={() => { equipPaint(game.profile.p.car, paint.id); onClose(); }}>Use {paint.name}</button>}
            <button className={'btn' + (paint ? '' : ' primary')} onClick={onClose}>Done</button>
          </div>
        </> : <>
          <p className="eyebrow">{CONFIG.live ? 'Checkout' : 'Checkout · test mode'}</p>
          <h2 id="store-sheet-h" ref={head} tabIndex={-1}>{it.name}</h2>
          <p className="store-sheet-price">{isTip ? (CONFIG.live ? `From ${money(a!.minimum_cents)}, you choose` : money(Math.max(0, amount || 0), true)) : sub ? `${money(it.price_cents, true)} a ${per}` : money(it.price_cents, true)}</p>
          {!CONFIG.live && <p className="store-test-tag">{TEST_TAG}</p>}
          <ul className="store-grants">{it.grants.map(entById).filter((e): e is Entitlement => !!e).map((e) => <li key={e.id}><Swatch hex={swatchOf(e)} mark={markOf(e)} />{grantLine(e)}</li>)}</ul>
          <p className="store-q small">{isTip ? 'It unlocks nothing else, and the badge is the same at any amount.' : sku === HYPERCAR_SKU ? TWO_TUNE : it.kind === 'graphics' ? GRAPHICS_ONLY : LOOKS_ONLY}</p>
          {it.kind === 'graphics' && !CONFIG.live && <p className="fine store-ultra-state">{ULTRA_LINE.test}</p>}

          {preview && !sale.ok && <p className="store-note info" role="status">Preview only. {sale.why}</p>}
          {!sale.ok && !preview && <p className="store-note bad" role="alert">{sale.why}</p>}

          {age === 'unknown' ? <AgeGate /> : age === 'under13' ? <p className="store-note info">The store is for players 13 and over. Every freeway, every mode and every car you can earn stays free to play.</p>
            : !s ? <><p className="store-q">Sign in, so your items are saved to your account.</p><SignIn /></> : <>
              <p className="fine">Signed in as {s.email}{s.test ? ' (test account)' : ''}.</p>

              {isTip && a && (CONFIG.live
                ? <p className="fine">You choose the amount on Stripe's page, from {money(a.minimum_cents)} to {money(a.maximum_cents)}.</p>
                : <div className="store-step" role="group" aria-labelledby="store-tip-q">
                    <p className="store-q" id="store-tip-q">How much?</p>
                    <div className="seg">{[2, 5, 10, 20].filter((d) => d * 100 >= a.minimum_cents && d * 100 <= a.maximum_cents).map((d) => <button key={d} aria-pressed={tipCents === d * 100} onClick={() => setTip(String(d))}>${d}</button>)}</div>
                    <Field label={`Or type an amount in dollars (${money(a.minimum_cents)} to ${money(a.maximum_cents)})`}><input inputMode="numeric" value={tip} onChange={(e) => setTip(e.target.value.replace(/[^\d]/g, '').slice(0, 3))} /></Field>
                  </div>)}

              {sku === FOUNDER_SKU && (
                <div className="store-step">
                  <label className="store-check"><input type="checkbox" checked={roll} onChange={(e) => setRoll(e.target.checked)} /><span>Put my name on the Founders roll in the game's credits (optional; the owner approves each name)</span></label>
                  {roll && <Field label="Name on the roll (letters, numbers, spaces; up to 24)"><input maxLength={24} value={rollName} onChange={(e) => setRollName(e.target.value)} /></Field>}
                </div>
              )}

              {sub && (
                <div className="store-step">
                  <div className="store-renew" aria-label="Renewal terms">
                    <p><b>{money(it.price_cents, true)} a {per}, renews automatically every {per} until you cancel.</b></p>
                    <p>You're billed {money(it.price_cents, true)} today, then again every {per} on the same date.</p>
                    <p>Cancel online any time in the store (Account), the same way you joined. You keep it until the end of the {per} you paid for, and you keep every club paint you received.</p>
                    <p>We email you these terms and how to cancel{per === 'year' ? ', and remind you before each yearly renewal' : ''}. We tell you before any price change.</p>
                  </div>
                  <label className="store-check"><input type="checkbox" checked={renew} onChange={(e) => setRenew(e.target.checked)} /><span>I agree to these renewal terms: {money(it.price_cents, true)} a {per} until I cancel.</span></label>
                </div>
              )}

              <label className="store-check"><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} /><span>I'm 18 or over, or a parent or guardian has said yes.</span></label>
              <p className="store-licence">You're getting a licence to use {isTip ? 'the badge' : 'these items'} in OC Ultra, not ownership of them. <a href="#store-terms" onClick={() => { const d = document.getElementById('store-terms') as HTMLDetailsElement | null; if (d) d.open = true; onClose(); }}>Terms</a></p>

              {CONFIG.live ? <>
                <p className="fine">Stripe's secure page takes your card, Apple Pay or Google Pay. We never see your card.</p>
                {err && <p className="store-err" role="alert">{err}</p>}
                <div className="row">
                  <button className="btn primary" disabled={state === 'paying' || !sale.ok || preview} onClick={() => void pay()}>{state === 'paying' ? 'Opening checkout…' : sub || isTip ? 'Checkout' : `Checkout · ${money(it.price_cents, true)}`}</button>
                  <button className="btn" onClick={onClose}>Cancel</button>
                </div>
              </> : <>
                <div className="store-card" role="group" aria-label="Test card">
                  <Field label="Card number"><input value={card} onChange={(e) => setCard(formatCard(e.target.value))} inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" maxLength={23} aria-describedby="store-card-hint" /></Field>
                  <div className="store-fields two">
                    <Field label="Expiry"><input value={exp} onChange={(e) => setExp(formatExpiry(e.target.value))} inputMode="numeric" autoComplete="off" placeholder="MM/YY" maxLength={5} /></Field>
                    <Field label="CVC"><input value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" autoComplete="off" placeholder="123" maxLength={4} /></Field>
                  </div>
                  <p className="fine" id="store-card-hint">Test mode: nothing is charged and nothing leaves this device. 4242 4242 4242 4242 succeeds, 4000 0000 0000 0002 is declined. Use any future date and any 3 digits. Real cards are refused.</p>
                </div>
                {err && <p className="store-err" role="alert">{err}</p>}
                <div className="row">
                  <button className="btn primary" disabled={state === 'paying' || !sale.ok || preview} onClick={() => void pay()}>{state === 'paying' ? 'Processing…' : `Pay ${money(Math.max(0, amount || 0), true)}${sub ? ' a ' + per : ''} (test)`}</button>
                  <button className="btn" onClick={onClose}>Cancel</button>
                </div>
              </>}
            </>}
          {(age !== 'ok' || !s) && <div className="row"><button className="btn" onClick={onClose}>Cancel</button></div>}
        </>}
      </div>
    </div>
  );
}
