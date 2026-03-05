const points = [
  "Database-driven patient storage",
  "Automated Excel data ingestion",
  "Patient registration system",
  "API-driven backend architecture",
];

export default function About() {
  return (
    <section id="about" className="mx-auto max-w-6xl px-6 py-14">
      <h2 className="mb-4 text-3xl font-bold text-slate-800">Objective</h2>
      <p className="mb-10 text-slate-600">
        To replace Excel-based hospital record keeping with a structured backend system that
        allows patient registration, visit tracking, and easy data retrieval.
      </p>

      <h3 className="mb-5 text-2xl font-semibold text-teal-700">Solution Provided</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {points.map((point, index) => (
          <article
            key={point}
            className={`animate-slide-up rounded-xl border border-sky-100 bg-white p-5 shadow-lg transition-all duration-300 hover:scale-105 ${index > 1 ? "animation-delay-200" : ""}`}
          >
            <p className="font-medium text-slate-700">{point}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
