function MetricCard({ title, value, note }) {
  return (
    <article className="rounded-xl border border-sky-100 bg-white p-4 shadow-lg">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-800">{value}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </article>
  );
}

function TrendChart({ points }) {
  const maxVisits = Math.max(...points.map((point) => point.visits), 1);

  return (
    <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-lg">
      <h3 className="mb-3 text-lg font-semibold text-slate-800">Visits Trend (Last 7 Days)</h3>
      <div className="grid grid-cols-7 items-end gap-2">
        {points.map((point) => {
          const heightPct = Math.max(6, Math.round((point.visits / maxVisits) * 100));
          return (
            <div key={point.date} className="flex flex-col items-center gap-2">
              <div className="text-xs font-medium text-slate-500">{point.visits}</div>
              <div className="flex h-28 w-full items-end rounded-md bg-slate-100 p-1">
                <div
                  className="w-full rounded-sm bg-teal-500"
                  style={{ height: `${heightPct}%` }}
                  title={`${point.date}: ${point.visits} visits`}
                />
              </div>
              <div className="text-xs text-slate-500">{point.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function normalizeWeekdayTrend(points) {
  const weekdayOrder = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const byLabel = new Map();

  (points || []).forEach((point) => {
    if (!point?.label || !weekdayOrder.includes(point.label)) return;

    const existing = byLabel.get(point.label);
    if (!existing) {
      byLabel.set(point.label, {
        date: point.date || point.label,
        label: point.label,
        visits: Number(point.visits || 0),
      });
      return;
    }

    byLabel.set(point.label, {
      ...existing,
      visits: Number(existing.visits || 0) + Number(point.visits || 0),
    });
  });

  return weekdayOrder.map((label) => {
    const found = byLabel.get(label);
    if (found) return found;
    return { date: label, label, visits: 0 };
  });
}

export default function AnalyticsPanel({ analytics, loading, error }) {
  const summary = analytics?.summary || {
    total_patients: 0,
    new_today: 0,
    repeat_patients: 0,
    repeat_visit_rate: 0,
  };
  const trend = normalizeWeekdayTrend(analytics?.visit_trend || []);
  const topSymptoms = analytics?.top_symptoms || [];

  return (
    <section className="mb-8 rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-teal-50 p-5 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800">Hospital Snapshot</h2>
        {loading && <span className="text-xs text-slate-500">Refreshing analytics...</span>}
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Patients" value={summary.total_patients} />
        <MetricCard title="New Today" value={summary.new_today} />
        <MetricCard title="Repeat Patients" value={summary.repeat_patients} />
        <MetricCard
          title="Repeat Visit Rate"
          value={`${summary.repeat_visit_rate}%`}
          note="Patients with 2+ visits"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrendChart points={trend} />
        </div>

        <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-lg">
          <h3 className="mb-3 text-lg font-semibold text-slate-800">Top Symptoms</h3>
          {topSymptoms.length === 0 ? (
            <p className="text-sm text-slate-500">No symptom data available yet.</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-700">
              {topSymptoms.map((item) => (
                <li key={item.symptom} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span>{item.symptom}</span>
                  <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-800">
                    {item.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
