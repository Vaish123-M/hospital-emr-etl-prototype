function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
}

export default function PatientTable({ patients, loading, onViewDetails }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-lg">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-sky-50 text-slate-700">
          <tr>
            <th className="p-3">ID</th>
            <th className="p-3">Name</th>
            <th className="p-3">Gender</th>
            <th className="p-3">Phone</th>
            <th className="p-3">Email</th>
            <th className="p-3">Blood Group</th>
            <th className="p-3">Registered</th>
            <th className="p-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td className="border-t p-3" colSpan={8}>
                Loading patients...
              </td>
            </tr>
          ) : patients.length === 0 ? (
            <tr>
              <td className="border-t p-3" colSpan={8}>
                No patients available.
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
                    View
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
