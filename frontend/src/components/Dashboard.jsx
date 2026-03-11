import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import PatientForm from "./PatientForm";
import PatientTable from "./PatientTable";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const initialForm = {
  first_name: "",
  last_name: "",
  gender: "",
  phone_number: "",
  email: "",
  address: "",
  blood_group: "",
};

const initialVisitForm = {
  doctor_name: "",
  symptoms: "",
  visit_date: new Date().toISOString().split("T")[0],
};

export default function Dashboard() {
  const [formData, setFormData] = useState(initialForm);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [visits, setVisits] = useState([]);
  const [visitLoading, setVisitLoading] = useState(false);
  const [visitSubmitting, setVisitSubmitting] = useState(false);
  const [visitForm, setVisitForm] = useState(initialVisitForm);

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

  async function handleViewPatientDetails(patientId) {
    setError("");
    setVisitLoading(true);
    try {
      const [patientResponse, visitsResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/patients/${patientId}`),
        axios.get(`${API_BASE_URL}/patients/${patientId}/visits`),
      ]);
      setSelectedPatient(patientResponse.data);
      setVisits(visitsResponse.data);
    } catch {
      setError("Could not fetch patient details.");
    } finally {
      setVisitLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
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
      setSelectedPatient(null);
      setVisits([]);
      await fetchPatients();
    } catch (submitError) {
      const detail = submitError?.response?.data?.detail;
      setError(detail || "Could not add patient.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleVisitChange(event) {
    const { name, value } = event.target;
    setVisitForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleVisitSubmit(event) {
    event.preventDefault();
    if (!selectedPatient) return;

    setVisitSubmitting(true);
    setError("");

    try {
      await axios.post(`${API_BASE_URL}/visits`, {
        patient_id: selectedPatient.patient_id,
        doctor_name: visitForm.doctor_name,
        symptoms: visitForm.symptoms || null,
        visit_date: visitForm.visit_date,
      });

      const visitsResponse = await axios.get(
        `${API_BASE_URL}/patients/${selectedPatient.patient_id}/visits`
      );
      setVisits(visitsResponse.data);
      setVisitForm(initialVisitForm);
    } catch (submitError) {
      const detail = submitError?.response?.data?.detail;
      setError(detail || "Could not add visit.");
    } finally {
      setVisitSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-sky-50 px-6 py-8 animate-fade-in">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold text-slate-800">Hospital Patient Dashboard</h1>
          <Link
            to="/"
            className="rounded-xl bg-white px-4 py-2 font-medium text-teal-700 shadow-lg transition-all duration-300 hover:scale-105"
          >
            Back to Home
          </Link>
        </div>

        {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="mb-8">
          <PatientForm
            formData={formData}
            onChange={handleChange}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        </div>

        {selectedPatient && (
          <section className="mb-8 rounded-xl border border-sky-100 bg-white p-5 shadow-lg">
            <h2 className="mb-3 text-xl font-semibold text-slate-800">Patient Details</h2>
            <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
              <p><span className="font-semibold">Patient ID:</span> {selectedPatient.patient_id}</p>
              <p><span className="font-semibold">Name:</span> {selectedPatient.first_name} {selectedPatient.last_name}</p>
              <p><span className="font-semibold">Gender:</span> {selectedPatient.gender || "-"}</p>
              <p><span className="font-semibold">Date of Birth:</span> {selectedPatient.date_of_birth || "-"}</p>
              <p><span className="font-semibold">Phone:</span> {selectedPatient.phone_number || "-"}</p>
              <p><span className="font-semibold">Email:</span> {selectedPatient.email || "-"}</p>
              <p className="md:col-span-2"><span className="font-semibold">Address:</span> {selectedPatient.address || "-"}</p>
              <p><span className="font-semibold">Blood Group:</span> {selectedPatient.blood_group || "-"}</p>
              <p><span className="font-semibold">Registration Date:</span> {selectedPatient.registration_date || "-"}</p>
            </div>

            <div className="mt-6">
              <h3 className="mb-3 text-lg font-semibold text-slate-800">Add Visit</h3>
              <form onSubmit={handleVisitSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <input
                  name="doctor_name"
                  value={visitForm.doctor_name}
                  onChange={handleVisitChange}
                  placeholder="Doctor Name"
                  className="rounded-lg border border-sky-200 p-2 outline-none focus:border-sky-500"
                  required
                />
                <input
                  name="visit_date"
                  type="date"
                  value={visitForm.visit_date}
                  onChange={handleVisitChange}
                  className="rounded-lg border border-sky-200 p-2 outline-none focus:border-sky-500"
                  required
                />
                <button
                  type="submit"
                  disabled={visitSubmitting}
                  className="rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-70"
                >
                  {visitSubmitting ? "Saving..." : "Save Visit"}
                </button>
                <textarea
                  name="symptoms"
                  value={visitForm.symptoms}
                  onChange={handleVisitChange}
                  placeholder="Symptoms / Notes"
                  className="rounded-lg border border-sky-200 p-2 outline-none focus:border-sky-500 md:col-span-3"
                  rows={3}
                />
              </form>
            </div>

            <div className="mt-6">
              <h3 className="mb-3 text-lg font-semibold text-slate-800">Visit History</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-2">Visit ID</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Doctor</th>
                      <th className="p-2">Symptoms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitLoading ? (
                      <tr>
                        <td className="border-t p-2" colSpan={4}>Loading visit history...</td>
                      </tr>
                    ) : visits.length === 0 ? (
                      <tr>
                        <td className="border-t p-2" colSpan={4}>No visits recorded yet.</td>
                      </tr>
                    ) : (
                      visits.map((visit) => (
                        <tr key={visit.visit_id} className="border-t">
                          <td className="p-2">{visit.visit_id}</td>
                          <td className="p-2">{visit.visit_date}</td>
                          <td className="p-2">{visit.doctor_name}</td>
                          <td className="p-2">{visit.symptoms || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        <PatientTable
          patients={patients}
          loading={loading}
          onViewDetails={handleViewPatientDetails}
        />
      </div>
    </div>
  );
}
