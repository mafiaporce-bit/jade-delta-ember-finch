import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

const OPEN = `(() => {
  const go = () => { location.replace('/treadmill.html?v=coach'); };
  const wipe = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) {}
    go();
  };
  wipe();
})();`;

function Home() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#040714",
        color: "#e9eeff",
        fontFamily: "Inter, system-ui, sans-serif",
        display: "grid",
        placeItems: "center",
      }}
    >
      <script dangerouslySetInnerHTML={{ __html: OPEN }} />
      <a href="/treadmill.html?v=coach" style={{ color: "#22d3ee", fontSize: 18 }}>
        Open ProForm Smart Control
      </a>
    </main>
  );
}
