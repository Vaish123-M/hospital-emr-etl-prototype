import { useTranslation } from "react-i18next";

function MetricCard({ title, value, note }) {
  return (
    <article className="rounded-xl border border-sky-100 bg-white p-4 shadow-lg">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-800">{value}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </article>
  );
}

function TrendChart({ points, t }) {
  const maxVisits = Math.max(...points.map((point) => point.visits), 1);

  return (
    <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-lg">
      <h3 className="mb-3 text-lg font-semibold text-slate-800">{t("trend")}</h3>
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

function formatFollowUpStatus(daysUntilFollowUp) {
  if (daysUntilFollowUp < 0) {
    const overdueDays = Math.abs(daysUntilFollowUp);
    return overdueDays === 1 ? "Overdue by 1 day" : `Overdue by ${overdueDays} days`;
  }

  if (daysUntilFollowUp === 0) {
    return "Due today";
  }

  if (daysUntilFollowUp === 1) {
    return "Due in 1 day";
  }

  return `Due in ${daysUntilFollowUp} days`;
}

export default function AnalyticsPanel({ analytics, loading, error }) {
  const { t } = useTranslation();
  const summary = analytics?.summary || {
    total_patients: 0,
    new_today: 0,
    repeat_patients: 0,
    repeat_visit_rate: 0,
  };
  const trend = normalizeWeekdayTrend(analytics?.visit_trend || []);
  const topSymptoms = analytics?.top_symptoms || [];
  const doctorWorkload = analytics?.doctor_workload || [];
  const followUpReminders = analytics?.follow_up_reminders || {
    overdue_count: 0,
    due_soon_count: 0,
    overdue_follow_ups: [],
    due_soon_follow_ups: [],
  };

  return (
    <section className="mb-8 rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-teal-50 p-5 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800">{t("hospital_snapshot")}</h2>
        {loading && <span className="text-xs text-slate-500">{t("refreshing_analytics")}</span>}
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title={t("total_patients")} value={summary.total_patients} />
        <MetricCard title={t("new_today")} value={summary.new_today} />
        <MetricCard title={t("repeat_patients")} value={summary.repeat_patients} />
        <MetricCard
          title={t("repeat_visit_rate")}
          value={`${summary.repeat_visit_rate}%`}
          note={t("patients_with_2plus_visits")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrendChart points={trend} t={t} />
        </div>

        <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-lg">
          <h3 className="mb-3 text-lg font-semibold text-slate-800">{t("top_symptoms")}</h3>
          {topSymptoms.length === 0 ? (
            <p className="text-sm text-slate-500">{t("no_symptom_data")}</p>
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

      <div className="mt-4 rounded-xl border border-sky-100 bg-white p-4 shadow-lg">
        <h3 className="mb-3 text-lg font-semibold text-slate-800">{t("doctor_workload")}</h3>
        {doctorWorkload.length === 0 ? (
          <p className="text-sm text-slate-500">{t("no_doctor_workload")}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {doctorWorkload.map((item) => (
              <div key={item.doctor_name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-700">Dr. {item.doctor_name}</span>
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
                  {item.visit_count} visits
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-amber-100 bg-white p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-800">{t("follow_up_reminders")}</h3>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
            {followUpReminders.overdue_count} {t("overdue")}
          </span>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <MetricCard
            title={t("due_soon")}
            value={followUpReminders.due_soon_count}
            note={t("due_soon_note")}
          />
          <MetricCard
            title={t("overdue")}
            value={followUpReminders.overdue_count}
            note={t("overdue_note")}
          />
        </div>

        {followUpReminders.overdue_follow_ups.length === 0 && followUpReminders.due_soon_follow_ups.length === 0 ? (
          <p className="text-sm text-slate-500">{t("no_follow_up_reminders")}</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-700">
                {t("overdue_follow_ups")}
              </h4>
              {followUpReminders.overdue_follow_ups.length === 0 ? (
                <p className="text-sm text-slate-500">{t("no_overdue_follow_ups")}</p>
              ) : (
                <ul className="space-y-2 text-sm text-slate-700">
                  {followUpReminders.overdue_follow_ups.map((item) => (
                    <li key={`overdue-${item.visit_id}`} className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{item.patient_name}</span>
                        <span className="text-xs font-semibold text-amber-800">
                          {formatFollowUpStatus(item.days_until_follow_up)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        Dr. {item.doctor_name} · Follow-up date: {item.follow_up_date}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-teal-700">
                {t("follow_ups_due_soon")}
              </h4>
              {followUpReminders.due_soon_follow_ups.length === 0 ? (
                <p className="text-sm text-slate-500">{t("no_due_soon_follow_ups")}</p>
              ) : (
                <ul className="space-y-2 text-sm text-slate-700">
                  {followUpReminders.due_soon_follow_ups.map((item) => (
                    <li key={`soon-${item.visit_id}`} className="rounded-lg border border-teal-100 bg-teal-50 px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{item.patient_name}</span>
                        <span className="text-xs font-semibold text-teal-800">
                          {formatFollowUpStatus(item.days_until_follow_up)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        Dr. {item.doctor_name} · Follow-up date: {item.follow_up_date}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
