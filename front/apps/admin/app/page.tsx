const metrics = [
  { label: "Utilisateurs", value: "—", change: "En attente de données", color: "#FF2638" },
  { label: "Courses actives", value: "—", change: "Système prêt", color: "#22C55E" },
  { label: "Chauffeurs", value: "—", change: "Système prêt", color: "#F59E0B" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-[#27272A] bg-[#18181B] px-5 py-6 md:block">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#FF2638] text-xl font-black">R</div>
          <span className="text-lg font-black tracking-[0.18em]">REDGO</span>
        </div>
        <nav className="mt-10 space-y-2 text-sm font-semibold text-[#A1A1AA]">
          {["Vue d'ensemble", "Utilisateurs", "Chauffeurs", "Courses", "Paramètres"].map((item, index) => (
            <div key={item} className={`rounded-xl px-4 py-3 ${index === 0 ? "bg-[#27272A] text-white" : ""}`}>
              {item}
            </div>
          ))}
        </nav>
      </aside>

      <main className="md:ml-64">
        <header className="flex items-center justify-between border-b border-[#27272A] px-5 py-5 md:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF2638]">Console administration</p>
            <h1 className="mt-1 text-2xl font-bold">Vue d&apos;ensemble</h1>
          </div>
          <div className="size-10 rounded-full border border-[#3F3F46] bg-[#27272A]" />
        </header>

        <div className="p-5 md:p-8">
          <section className="grid gap-4 lg:grid-cols-3">
            {metrics.map((metric) => (
              <article key={metric.label} className="rounded-2xl border border-[#27272A] bg-[#18181B] p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[#A1A1AA]">{metric.label}</p>
                  <span className="size-2 rounded-full" style={{ backgroundColor: metric.color }} />
                </div>
                <p className="mt-5 text-4xl font-bold">{metric.value}</p>
                <p className="mt-2 text-xs text-[#71717A]">{metric.change}</p>
              </article>
            ))}
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
            <article className="rounded-2xl border border-[#27272A] bg-[#18181B] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold">Activité des courses</h2>
                  <p className="mt-1 text-xs text-[#71717A]">Aucune donnée de production</p>
                </div>
                <span className="rounded-lg border border-[#3F3F46] px-3 py-2 text-xs text-[#A1A1AA]">7 derniers jours</span>
              </div>
              <div className="mt-8 flex h-64 items-end gap-3 border-b border-l border-[#27272A] px-4 pb-1">
                {[18, 30, 24, 42, 36, 58, 48].map((height, index) => (
                  <div key={index} className="flex flex-1 items-end">
                    <div className="w-full rounded-t-md bg-[#FF2638]/20" style={{ height: `${height}%` }} />
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-[#27272A] bg-[#18181B] p-5">
              <h2 className="font-bold">Statut de la plateforme</h2>
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#27272A] pb-4">
                  <span className="text-sm text-[#A1A1AA]">API Supabase</span>
                  <span className="text-xs font-bold text-[#22C55E]">PRÊT À CONFIGURER</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#27272A] pb-4">
                  <span className="text-sm text-[#A1A1AA]">Realtime</span>
                  <span className="text-xs font-bold text-[#22C55E]">PRÊT À CONFIGURER</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#A1A1AA]">Storage</span>
                  <span className="text-xs font-bold text-[#22C55E]">PRÊT À CONFIGURER</span>
                </div>
              </div>
            </article>
          </section>
        </div>
      </main>
    </div>
  );
}
