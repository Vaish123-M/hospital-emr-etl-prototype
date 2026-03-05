import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import PatientForm from "./PatientForm";
import PatientTable from "./PatientTable";

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

export default function Dashboard() {
  const [formData, setFormData] = useState(initialForm);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
      await fetchPatients();
    } catch (submitError) {
      const detail = submitError?.response?.data?.detail;
      setError(detail || "Could not add patient.");
    } finally {
      setSubmitting(false);
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

        <PatientTable patients={patients} loading={loading} />
      </div>
    </div>
  );
}
