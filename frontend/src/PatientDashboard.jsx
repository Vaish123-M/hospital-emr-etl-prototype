import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE_URL = "http://localhost:8000";

const initialForm = {
  first_name: "",
  last_name: "",
  gender: "",
  phone_number: "",
  email: "",
  address: "",
  blood_group: "",
};

function getCityFromAddress(address) {
  if (!address) return "-";
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : "-";
}

export default function PatientDashboard() {
  const [formData, setFormData] = useState(initialForm);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fullRows = useMemo(() => {
    return patients.map((patient) => ({
      id: patient.patient_id,
      name: `${patient.first_name} ${patient.last_name}`.trim(),
      phone: patient.phone_number || "-",
      bloodGroup: patient.blood_group || "-",
      city: getCityFromAddress(patient.address),
    }));
  }, [patients]);

  async function fetchPatients() {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(`${API_BASE_URL}/patients`);
      setPatients(response.data);
    } catch {
      setError("Could not fetch patients. Make sure backend is running.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPatients();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    try {
      await axios.post(`${API_BASE_URL}/patients`, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        gender: formData.gender || null,
        phone_number: formData.phone_number,
        email: formData.email || null,
        address: formData.address || null,
        blood_group: formData.blood_group || null,
      });

      setFormData(initialForm);
      fetchPatients();
    } catch (submitError) {
      const detail = submitError?.response?.data?.detail;
      setError(detail || "Could not add patient.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl rounded-lg bg-white p-6 shadow">
        <h1 className="mb-6 text-2xl font-semibold text-slate-800">
          Hospital Patient Management
        </h1>

        <form onSubmit={handleSubmit} className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <input
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            placeholder="First Name"
            className="rounded border p-2"
            required
          />
          <input
            name="last_name"
            value={formData.last_name}
            onChange={handleChange}
            placeholder="Last Name"
            className="rounded border p-2"
            required
          />
          <input
            name="gender"
            value={formData.gender}
            onChange={handleChange}
            placeholder="Gender"
            className="rounded border p-2"
          />
          <input
            name="phone_number"
            value={formData.phone_number}
            onChange={handleChange}
            placeholder="Phone"
            className="rounded border p-2"
            required
          />
          <input
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Email"
            className="rounded border p-2"
            type="email"
          />
          <input
            name="blood_group"
            value={formData.blood_group}
            onChange={handleChange}
            placeholder="Blood Group"
            className="rounded border p-2"
          />
          <input
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="Address"
            className="rounded border p-2 md:col-span-2"
          />
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 md:col-span-2"
          >
            Add Patient
          </button>
        </form>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-slate-200 text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border border-slate-200 p-2">Name</th>
                <th className="border border-slate-200 p-2">Phone</th>
                <th className="border border-slate-200 p-2">Blood Group</th>
                <th className="border border-slate-200 p-2">City</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="border border-slate-200 p-2" colSpan={4}>
                    Loading patients...
                  </td>
                </tr>
              ) : fullRows.length === 0 ? (
                <tr>
                  <td className="border border-slate-200 p-2" colSpan={4}>
                    No patients found.
                  </td>
                </tr>
              ) : (
                fullRows.map((row) => (
                  <tr key={row.id}>
                    <td className="border border-slate-200 p-2">{row.name}</td>
                    <td className="border border-slate-200 p-2">{row.phone}</td>
                    <td className="border border-slate-200 p-2">{row.bloodGroup}</td>
                    <td className="border border-slate-200 p-2">{row.city}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
