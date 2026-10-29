export default function Loading() {
  return (
    <main id="main" className="empty" style={{ minHeight: "100vh" }}>
      <div className="skeleton" style={{ width: 300, height: 140 }} />
      <p>Following the history…</p>
    </main>
  );
}
