const features = [
  { title: "Patient Registration", icon: "📝" },
  { title: "Visit History Tracking", icon: "📋" },
  { title: "Excel Data Migration", icon: "📊" },
  { title: "Structured Database Storage", icon: "🗄️" },
  { title: "REST API Architecture", icon: "🔌" },
];

export default function Features() {
  return (
    <section id="system" className="mx-auto max-w-6xl px-6 py-14">
      <h2 className="mb-8 text-3xl font-bold text-slate-800">System Features</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <article
            key={feature.title}
            className="rounded-xl border border-sky-100 bg-white p-5 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl"
          >
            <div className="mb-3 text-3xl">{feature.icon}</div>
            <h3 className="font-semibold text-slate-800">{feature.title}</h3>
          </article>
        ))}
      </div>
    </section>
  );
}
