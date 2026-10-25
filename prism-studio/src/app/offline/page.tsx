export const metadata = { title: "Offline" };
export default function Offline() {
  return (
    <main className="main" style={{ maxWidth: 520, paddingTop: "14vh" }}>
      <div className="kicker">No connection</div>
      <h1>You&apos;re offline.</h1>
      <p className="lede">Prism keeps your studio on the server so nothing is lost. Reconnect and pull to refresh; anything you were doing on the Upload Desk will be where you left it.</p>
    </main>
  );
}
