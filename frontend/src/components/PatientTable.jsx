function getCityFromAddress(address) {
  if (!address) return "-";
  const parts = address
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "-";
}

export default function PatientTable({ patients, loading }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-lg">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-sky-50 text-slate-700">
          <tr>
            <th className="p-3">Name</th>
            <th className="p-3">Phone</th>
            <th className="p-3">Blood Group</th>
            <th className="p-3">City</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td className="border-t p-3" colSpan={4}>
                Loading patients...
              </td>
            </tr>
          ) : patients.length === 0 ? (
            <tr>
              <td className="border-t p-3" colSpan={4}>
                No patients available.
              </td>
            </tr>
          ) : (
            patients.map((patient) => (
              <tr key={patient.patient_id} className="border-t border-slate-100">
                <td className="p-3">{`${patient.first_name} ${patient.last_name}`.trim()}</td>
                <td className="p-3">{patient.phone_number || "-"}</td>
                <td className="p-3">{patient.blood_group || "-"}</td>
                <td className="p-3">{getCityFromAddress(patient.address)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
