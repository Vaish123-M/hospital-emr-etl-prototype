function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
}

export default function PatientTable({ patients, loading, onViewDetails, t }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-lg">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-sky-50 text-slate-700">
          <tr>
            <th className="p-3">{t("patient_id_short")}</th>
            <th className="p-3">{t("name")}</th>
            <th className="p-3">{t("gender")}</th>
            <th className="p-3">{t("phone")}</th>
            <th className="p-3">{t("email")}</th>
            <th className="p-3">{t("blood_group")}</th>
            <th className="p-3">{t("registered")}</th>
            <th className="p-3">{t("action")}</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td className="border-t p-3" colSpan={8}>
                {t("loading_patients")}
              </td>
            </tr>
          ) : patients.length === 0 ? (
            <tr>
              <td className="border-t p-3" colSpan={8}>
                {t("no_patients")}
              </td>
            </tr>
          ) : (
            patients.map((patient) => (
              <tr key={patient.patient_id} className="border-t border-slate-100">
                <td className="p-3">{patient.patient_id}</td>
                <td className="p-3">{`${patient.first_name} ${patient.last_name}`.trim()}</td>
                <td className="p-3">{patient.gender || "-"}</td>
                <td className="p-3">{patient.phone_number || "-"}</td>
                <td className="p-3">{patient.email || "-"}</td>
                <td className="p-3">{patient.blood_group || "-"}</td>
                <td className="p-3">{formatDate(patient.registration_date)}</td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => onViewDetails(patient.patient_id)}
                    className="rounded-lg bg-sky-100 px-3 py-1 font-medium text-sky-800 transition hover:bg-sky-200"
                  >
                    {t("view")}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
