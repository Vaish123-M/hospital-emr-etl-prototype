import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AnalyticsPanel from "./AnalyticsPanel";
import PatientForm from "./PatientForm";
import PatientTable from "./PatientTable";
import LanguageSwitcher from "./LanguageSwitcher";
import OfflineSync from "./OfflineSync";
import {
  savePendingPatient,
  savePendingVisit,
  isOnline,
} from "../utils/offlineStorage";
import { generatePatientPDF } from "../utils/pdfExport";
import { getApiBaseUrl } from "../utils/apiBaseUrl";

const API_BASE_URL = getApiBaseUrl();

function buildApiBaseCandidates(baseUrl) {
  const base = (baseUrl || "").trim();
  const candidates = [];

  if (base) {
    candidates.push(base);
    if (base.endsWith("/api")) {
      candidates.push(base.slice(0, -4) || "");
    }
  }

  if (base === "/api") {
    candidates.push("");
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocalPageHost = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
    if (isLocalPageHost) {
      // Covers environments where frontend is served without /api proxy (e.g. vite preview/static hosting).
      if (host === "127.0.0.1") {
        candidates.push("http://127.0.0.1:8000");
        candidates.push("http://localhost:8000");
      } else {
        candidates.push("http://localhost:8000");
        candidates.push("http://127.0.0.1:8000");
      }
    }
  }

  return [...new Set(candidates.filter((candidate) => candidate !== undefined && candidate !== null))];
}

const API_BASE_CANDIDATES = buildApiBaseCandidates(API_BASE_URL);

function buildUrl(base, endpoint) {
  if (!base) return endpoint;
  return `${base}${endpoint}`;
}

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
  medications: "",
  follow_up_date: "",
  visit_date: new Date().toISOString().split("T")[0],
};

export default function Dashboard() {
  const { t } = useTranslation();
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
  const [timeline, setTimeline] = useState([]);
  const [riskData, setRiskData] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [pipelineLogs, setPipelineLogs] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [reportName, setReportName] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportData, setReportData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");

  function extractApiError(error, fallbackMessage) {
    const status = error?.response?.status;
    const detail = error?.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((item) => item?.msg).filter(Boolean).join(" | ") || fallbackMessage;
    }
    if (status === 413) {
      return "The selected file is too large to upload. Please use a smaller file or increase server upload limits.";
    }
    if (status === 404) {
      return "Upload endpoint not found. Verify backend routing and API base URL settings.";
    }
    if (!error?.response) {
      return "Could not reach the server. Check that backend is running and API URL is correct.";
    }
    return fallbackMessage;
  }

  async function postWithApiFallback(endpoint, payload, config) {
    let lastError;
    const retryableStatuses = new Set([404, 405, 502, 503, 504]);

    for (let index = 0; index < API_BASE_CANDIDATES.length; index += 1) {
      const base = API_BASE_CANDIDATES[index];
      try {
        return await axios.post(buildUrl(base, endpoint), payload, config);
      } catch (error) {
        const status = error?.response?.status;
        const hasMoreCandidates = index < API_BASE_CANDIDATES.length - 1;
        if (hasMoreCandidates && retryableStatuses.has(status)) {
          lastError = error;
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }

  function getDiagnosisFromVisits(visitsList) {
    if (!visitsList || visitsList.length === 0) {
      return "No diagnosis data available.";
    }

    const sortedVisits = [...visitsList].sort((a, b) => {
      const aDate = new Date(a.visit_date || "").getTime();
      const bDate = new Date(b.visit_date || "").getTime();
      return bDate - aDate;
    });

    const latestVisit = sortedVisits.find((visit) => visit.symptoms || visit.medications) || sortedVisits[0];
    if (latestVisit.symptoms) {
      return latestVisit.symptoms;
    }
    if (latestVisit.medications) {
      return `Medications: ${latestVisit.medications}`;
    }
    return "No diagnosis data available.";
  }

  function getPatientNameKey(patient) {
    return `${patient.first_name || ""} ${patient.last_name || ""}`.trim();
  }

  function getDisplayPatientName(patient, fallbackName = "") {
    const fullName = getPatientNameKey(patient);
    if (fullName) return fullName;
    if (fallbackName) return fallbackName;
    return "Unknown Patient";
  }

  function normalizeSearchText(value) {
    return (value || "").toString().toLowerCase().replace(/\s+/g, " ").trim();
  }

  function findMatchingPatients(searchValue, patientList) {
    const normalizedSearch = normalizeSearchText(searchValue);
    if (!normalizedSearch) return [];

    return (patientList || []).filter((patient) => {
      const first = normalizeSearchText(patient?.first_name);
      const last = normalizeSearchText(patient?.last_name);
      const full = normalizeSearchText(`${first} ${last}`);
      return (
        full.includes(normalizedSearch)
        || first.includes(normalizedSearch)
        || last.includes(normalizedSearch)
      );
    });
  }

  async function handleGetReportByName(event) {
    event.preventDefault();
    const searchValue = reportName.trim();
    if (!searchValue) {
      setReportError("Please enter a patient name.");
      setReportData(null);
      return;
    }

    if (patients.length === 0) {
      setReportError("No patients are loaded yet. Please refresh the page.");
      setReportData(null);
      return;
    }

    let candidatePatients = patients;
    let matches = findMatchingPatients(searchValue, candidatePatients);

    // Refresh once from backend to avoid stale UI state after imports.
    if (matches.length === 0) {
      try {
        const patientListResponse = await axios.get(`${API_BASE_URL}/patients`);
        candidatePatients = patientListResponse.data || [];
        setPatients(candidatePatients);
        matches = findMatchingPatients(searchValue, candidatePatients);
      } catch {
        // Keep existing behavior below if refresh fails.
      }
    }

    if (matches.length === 0) {
      if (uploadResult?.upload_id && !importResult) {
        setReportError("Excel is uploaded but not imported yet. Click Clean and Import Data, then try again.");
        setReportData(null);
        return;
      }
      setReportError(`No patient found matching "${searchValue}".`);
      setReportData(null);
      return;
    }

    let selected = matches[0];
    if (matches.length > 1) {
      const exactMatch = matches.find(
        (patient) => normalizeSearchText(getPatientNameKey(patient)) === normalizeSearchText(searchValue)
      );
      if (exactMatch) {
        selected = exactMatch;
      } else {
        setReportError("Multiple patients match that name. Please enter a more specific name.");
        setReportData(null);
        return;
      }
    }

    setReportError("");
    setReportLoading(true);
    try {
      const [patientResponse, visitsResponse, timelineResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/patients/${selected.patient_id}`),
        axios.get(`${API_BASE_URL}/patients/${selected.patient_id}/visits`),
        axios.get(`${API_BASE_URL}/patients/${selected.patient_id}/timeline`),
      ]);

      const reportPatient = patientResponse.data;
      const reportVisits = visitsResponse.data;
      const reportTimeline = timelineResponse.data?.timeline || [];
      const diagnosis = getDiagnosisFromVisits(reportVisits);

      setReportData({
        patient: reportPatient,
        visits: reportVisits,
        timeline: reportTimeline,
        diagnosis,
        searchedName: searchValue,
      });
    } catch (searchError) {
      setReportError("Could not load the report for that patient.");
      setReportData(null);
    } finally {
      setReportLoading(false);
    }
  }

  function handleReportNameChange(event) {
    setReportName(event.target.value);
    setReportError("");
  }

  function downloadErrorReport() {
    if (!uploadResult?.invalid_rows || uploadResult.invalid_rows.length === 0) {
      setError("No invalid rows to download.");
      return;
    }

    const rows = uploadResult.invalid_rows;
    let csv = "Row #,First Name,Last Name,Phone,Email,DOB,Errors\n";

    rows.forEach((row) => {
      const errors = (row.errors || []).join("; ");
      const data = row.data || {};
      const errorStr = `"${errors.replace(/"/g, '""')}"`;
      csv += `${row.row_number},"${(data.first_name || "").toString().replace(/"/g, '""')}","${(data.last_name || "").toString().replace(/"/g, '""')}","${(data.phone_number || "").toString().replace(/"/g, '""')}","${(data.email || "").toString().replace(/"/g, '""')}","${(data.date_of_birth || "").toString().replace(/"/g, '""')}",${errorStr}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `error-report-${new Date().getTime()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

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

  async function fetchAnalytics() {
    setAnalyticsLoading(true);
    setAnalyticsError("");
    try {
      const response = await axios.get(`${API_BASE_URL}/analytics/overview`);
      setAnalytics(response.data);
    } catch {
      setAnalyticsError("Could not load analytics.");
    } finally {
      setAnalyticsLoading(false);
    }
  }

  useEffect(() => {
    fetchPatients();
    fetchAnalytics();
  }, []);

  async function handleViewPatientDetails(patientId) {
    setError("");
    setVisitLoading(true);
    try {
      const [patientResponse, visitsResponse, timelineResponse, riskResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/patients/${patientId}`),
        axios.get(`${API_BASE_URL}/patients/${patientId}/visits`),
        axios.get(`${API_BASE_URL}/patients/${patientId}/timeline`),
        axios.get(`${API_BASE_URL}/patients/${patientId}/risk`),
      ]);
      setSelectedPatient(patientResponse.data);
      setVisits(visitsResponse.data);
      setTimeline(timelineResponse.data?.timeline || []);
      setRiskData(riskResponse.data || null);
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

    const patientData = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      gender: formData.gender || null,
      phone_number: formData.phone_number,
      email: formData.email || null,
      address: formData.address || null,
      blood_group: formData.blood_group || null,
    };

    try {
      await axios.post(`${API_BASE_URL}/patients`, patientData);
      setFormData(initialForm);
      setSelectedPatient(null);
      setVisits([]);
      await fetchPatients();
      await fetchAnalytics();
    } catch (submitError) {
      if (!isOnline()) {
        // Save locally when offline
        savePendingPatient(patientData);
        setError(
          "No internet connection. Patient saved locally and will sync when online."
        );
        setFormData(initialForm);
      } else {
        const detail = submitError?.response?.data?.detail;
        setError(detail || "Could not add patient.");
      }
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

    const visitData = {
      patient_id: selectedPatient.patient_id,
      doctor_name: visitForm.doctor_name,
      symptoms: visitForm.symptoms || null,
      medications: visitForm.medications || null,
      follow_up_date: visitForm.follow_up_date || null,
      visit_date: visitForm.visit_date,
    };

    try {
      await axios.post(`${API_BASE_URL}/visits`, visitData);

      const visitsResponse = await axios.get(
        `${API_BASE_URL}/patients/${selectedPatient.patient_id}/visits`
      );
      const timelineResponse = await axios.get(
        `${API_BASE_URL}/patients/${selectedPatient.patient_id}/timeline`
      );
      const riskResponse = await axios.get(
        `${API_BASE_URL}/patients/${selectedPatient.patient_id}/risk`
      );
      setVisits(visitsResponse.data);
      setTimeline(timelineResponse.data?.timeline || []);
      setRiskData(riskResponse.data || null);
      setVisitForm(initialVisitForm);
      await fetchAnalytics();
    } catch (submitError) {
      if (!isOnline()) {
        // Save locally when offline
        savePendingVisit(visitData, selectedPatient.patient_id);
        setError(
          "No internet connection. Visit saved locally and will sync when online."
        );
        setVisitForm(initialVisitForm);
      } else {
        const detail = submitError?.response?.data?.detail;
        setError(detail || "Could not add visit.");
      }
    } finally {
      setVisitSubmitting(false);
    }
  }

  function handleFileSelection(file) {
    if (!file) return;
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];

    const validExtension = /\.(xlsx|xls|csv)$/i.test(file.name);
    const validMimeType = allowed.includes(file.type) || file.type === "";

    if (!validExtension || !validMimeType) {
      setError("Please upload a valid data file (.xlsx, .xls, or .csv).");
      setUploadFile(null);
      return;
    }

    setError("");
    setUploadResult(null);
    setImportResult(null);
    setPipelineLogs([]);
    setUploadStatus("");
    setImportStatus("");
    setUploadFile(file);
  }

  function handleFileInputChange(event) {
    handleFileSelection(event.target.files?.[0]);
  }

  function handleDragOver(event) {
    event.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    setDragActive(false);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    handleFileSelection(event.dataTransfer.files?.[0]);
  }

  async function handleUploadExcel() {
    if (!uploadFile) {
      setError("Please choose an Excel file first.");
      return;
    }

    setUploading(true);
    setError("");
    setImportStatus("");
    setUploadStatus("Uploading and profiling file...");

    const formData = new FormData();
    formData.append("file", uploadFile);

    try {
      const response = await postWithApiFallback("/upload-excel", formData);
      setUploadResult(response.data);
      setImportResult(null);
      setPipelineLogs(response.data.logs || []);
      setUploadStatus("Upload complete. Review quality report and click Clean and Import Data.");
    } catch (uploadError) {
      setError(extractApiError(uploadError, "Could not import Excel data."));
      setUploadStatus("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleCleanAndImport() {
    if (!uploadResult?.upload_id) {
      setError("Upload the Excel file first.");
      return;
    }

    setImporting(true);
    setError("");
    setImportStatus("Cleaning and importing records...");

    try {
      const response = await postWithApiFallback("/clean-import-data", {
        upload_id: uploadResult.upload_id,
      });
      setImportResult(response.data);
      setPipelineLogs((prev) => [...prev, ...(response.data.logs || [])]);
      await fetchPatients();
      await fetchAnalytics();
      const inserted = response.data?.import_summary?.records_inserted ?? 0;
      setImportStatus(`Import complete. ${inserted} records inserted.`);
    } catch (importError) {
      setError(extractApiError(importError, "Could not clean and import data."));
      setImportStatus("Clean and import failed.");
    } finally {
      setImporting(false);
    }
  }

  const auditEvents = timeline.filter((event) => event.event_type === "audit");

  function formatAuditPayload(payload) {
    if (!payload) return null;
    if (typeof payload === "string") return payload;

    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  }

  return (
    <div className="min-h-screen bg-sky-50 px-6 py-8 animate-fade-in">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold text-slate-800">{t("dashboard_title")}</h1>
          <Link
            to="/"
            className="rounded-xl bg-white px-4 py-2 font-medium text-teal-700 shadow-lg transition-all duration-300 hover:scale-105"
          >
            {t("back_to_home")}
          </Link>
        </div>

        {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <OfflineSync />

        <AnalyticsPanel analytics={analytics} loading={analyticsLoading} error={analyticsError} />

        <div className="mb-8">
          <PatientForm
            formData={formData}
            onChange={handleChange}
            onSubmit={handleSubmit}
            submitting={submitting}
            t={t}
          />
        </div>

        <section className="mb-8 rounded-xl border border-sky-100 bg-white p-5 shadow-lg">
          <h2 className="mb-3 text-xl font-semibold text-slate-800">{t("get_report_title")}</h2>
          <form onSubmit={handleGetReportByName} className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              type="text"
              name="reportName"
              value={reportName}
              onChange={handleReportNameChange}
              placeholder={t("enter_patient_name_for_report")}
              className="rounded-xl border border-sky-200 p-3 outline-none transition-all focus:border-sky-500"
            />
            <button
              type="submit"
              disabled={reportLoading}
              className="rounded-xl bg-teal-600 px-4 py-3 font-semibold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {reportLoading ? t("loading") : t("get_report")}
            </button>
          </form>
          {reportError && (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{reportError}</p>
          )}
          {reportData && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-800">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">{t("patient_report_for")}</h3>
                  <p className="text-sm text-slate-600">
                    {getDisplayPatientName(reportData.patient, reportData.searchedName)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => generatePatientPDF(reportData.patient, reportData.visits, reportData.timeline, reportData.diagnosis)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  📄 {t("download_pdf")}
                </button>
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <p><span className="font-semibold">{t("patient_id")}:</span> {reportData.patient.patient_id}</p>
                <p><span className="font-semibold">{t("phone")}:</span> {reportData.patient.phone_number || "-"}</p>
                <p><span className="font-semibold">{t("email")}:</span> {reportData.patient.email || "-"}</p>
                <p><span className="font-semibold">{t("registration_date")}:</span> {reportData.patient.registration_date || "-"}</p>
              </div>
              <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
                <p className="font-semibold text-slate-800">{t("diagnosis")}:</p>
                <p className="mt-2 text-sm text-slate-700">
                  {t("diagnosis_summary_sentence", {
                    name: getDisplayPatientName(reportData.patient, reportData.searchedName),
                  })}
                </p>
                <p className="mt-2 text-sm text-slate-700">{reportData.diagnosis}</p>
              </div>
            </div>
          )}
        </section>

        <section className="mb-8 rounded-xl border border-sky-100 bg-white p-5 shadow-lg">
          <h2 className="mb-3 text-xl font-semibold text-slate-800">{t("upload_excel_title")}</h2>
          <p className="mb-4 text-sm text-slate-600">
            {t("upload_excel_description")}
          </p>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed p-6 text-center transition ${
              dragActive
                ? "border-teal-500 bg-teal-50"
                : "border-sky-200 bg-sky-50"
            }`}
          >
            <p className="mb-3 text-sm text-slate-700">{t("drag_drop_excel")}</p>
            <p className="mb-4 text-xs text-slate-500">{t("accepted_formats")}</p>
            <label className="inline-flex cursor-pointer items-center rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow transition hover:bg-slate-50">
              {t("choose_file")}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </label>
            {uploadFile && (
              <p className="mt-3 text-sm text-teal-700">
                {t("selected_file_prefix")}: {uploadFile.name}
              </p>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleUploadExcel}
              disabled={uploading}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-70"
            >
              {uploading ? t("uploading") : t("upload_excel_action")}
            </button>
            <button
              type="button"
              onClick={handleCleanAndImport}
              disabled={importing || !uploadResult?.upload_id}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {importing ? t("importing") : t("clean_import_action")}
            </button>
          </div>

          {(uploading || importing) && (
            <p className="mt-3 text-sm text-slate-600">
              {uploading
                ? `${t("uploading")} ${t("loading")}`
                : `${t("clean_import_action")} ${t("loading")}`}
            </p>
          )}

          {uploadStatus && (
            <p
              className={`mt-3 text-sm ${
                uploadStatus.toLowerCase().includes("failed") ? "text-red-700" : "text-emerald-700"
              }`}
            >
              {uploadStatus}
            </p>
          )}

          {importStatus && (
            <p
              className={`mt-2 text-sm ${
                importStatus.toLowerCase().includes("failed") ? "text-red-700" : "text-emerald-700"
              }`}
            >
              {importStatus}
            </p>
          )}

          {uploadResult && (
            <div className="mt-6 space-y-6">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <p>
                  Imported file: <span className="font-semibold">{uploadResult.file_name}</span>
                </p>
                <p>
                  Upload ID: <span className="font-semibold">{uploadResult.upload_id}</span>
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <h3 className="mb-3 text-lg font-semibold text-slate-800">{t("data_quality_report")}</h3>
                <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                  <p>
                    <span className="font-semibold">{t("total_records")}:</span>{" "}
                    {uploadResult.data_quality_report?.total_records ?? 0}
                  </p>
                  <p>
                    <span className="font-semibold">{t("invalid_rows_found")}:</span>{" "}
                    {uploadResult.invalid_rows?.length ?? 0}
                  </p>
                  <p>
                    <span className="font-semibold">{t("duplicate_phone")}:</span>{" "}
                    {uploadResult.data_quality_report?.duplicate_phone_entries ?? 0}
                  </p>
                  <p>
                    <span className="font-semibold">{t("duplicate_email")}:</span>{" "}
                    {uploadResult.data_quality_report?.duplicate_email_entries ?? 0}
                  </p>
                  <p>
                    <span className="font-semibold">{t("invalid_dates")}:</span>{" "}
                    {uploadResult.data_quality_report?.invalid_date_formats ?? 0}
                  </p>
                </div>

                <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="p-2">{t("column")}</th>
                        <th className="p-2">{t("missing_values")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(uploadResult.data_quality_report?.missing_values || {}).map(
                        ([column, count]) => (
                          <tr key={column} className="border-t">
                            <td className="p-2">{column}</td>
                            <td className="p-2">{count}</td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {(uploadResult?.invalid_rows?.length ?? 0) > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-red-900">
                      ⚠️ Invalid Rows ({uploadResult.invalid_rows.length})
                    </h3>
                    <button
                      type="button"
                      onClick={downloadErrorReport}
                      className="rounded-lg bg-red-600 px-3 py-1 text-sm font-semibold text-white transition hover:bg-red-700"
                    >
                      Download Error Report
                    </button>
                  </div>
                  <p className="mb-3 text-sm text-red-800">
                    These rows contain errors and will not be imported. Review the errors below and fix your data.
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-red-200">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-red-100">
                        <tr>
                          <th className="p-2">{t("row_number")}</th>
                          <th className="p-2">{t("name")}</th>
                          <th className="p-2">{t("phone")}</th>
                          <th className="p-2">{t("errors")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadResult.invalid_rows.map((row, idx) => (
                          <tr key={idx} className="border-t border-red-200 bg-red-50">
                            <td className="p-2 font-semibold text-red-900">{row.row_number}</td>
                            <td className="p-2">
                              {row.data?.first_name} {row.data?.last_name}
                            </td>
                            <td className="p-2">{row.data?.phone_number || "-"}</td>
                            <td className="p-2">
                              <div className="space-y-1">
                                {row.errors?.map((error, eIdx) => (
                                  <div key={eIdx} className="text-red-700">
                                    • {error}
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-slate-200 p-4">
                <h3 className="mb-3 text-lg font-semibold text-slate-800">{t("excel_preview")}</h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {(uploadResult.preview_columns || []).map((column) => (
                          <th key={column} className="p-2">{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(uploadResult.preview_rows || []).length === 0 ? (
                        <tr>
                          <td className="border-t p-2" colSpan={(uploadResult.preview_columns || []).length || 1}>
                            No rows available in uploaded file.
                          </td>
                        </tr>
                      ) : (
                        (uploadResult.preview_rows || []).map((row, index) => (
                          <tr key={`preview-${index}`} className="border-t">
                            {(uploadResult.preview_columns || []).map((column) => (
                              <td key={`${index}-${column}`} className="p-2">{row[column] ?? "-"}</td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {importResult?.import_summary && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <h3 className="mb-3 text-lg font-semibold text-emerald-900">{t("import_results")}</h3>
                  <div className="grid gap-2 text-sm text-emerald-950 md:grid-cols-2">
                    <p>
                      <span className="font-semibold">{t("total_records")}:</span>{" "}
                      {importResult.import_summary.records_found ?? 0}
                    </p>
                    <p>
                      <span className="font-semibold">{t("records_inserted")}:</span>{" "}
                      {importResult.import_summary.records_inserted ?? 0}
                    </p>
                    <p>
                      <span className="font-semibold">{t("duplicates_removed")}:</span>{" "}
                      {importResult.import_summary.duplicates_removed ?? 0}
                    </p>
                    <p>
                      <span className="font-semibold">{t("invalid_rows_skipped")}:</span>{" "}
                      {importResult.import_summary.invalid_rows_skipped ?? 0}
                    </p>
                  </div>
                </div>
              )}

              {pipelineLogs.length > 0 && (
                <div className="rounded-lg border border-slate-200 p-4">
                  <h3 className="mb-3 text-lg font-semibold text-slate-800">{t("etl_logs")}</h3>
                  <div className="max-h-48 overflow-y-auto rounded-lg bg-slate-900 p-3 font-mono text-xs text-emerald-300">
                    {pipelineLogs.map((logLine, index) => (
                      <p key={`log-${index}`} className="mb-1 last:mb-0">
                        {logLine}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {selectedPatient && (
          <section className="mb-8 rounded-xl border border-sky-100 bg-white p-5 shadow-lg">
            <h2 className="mb-3 text-xl font-semibold text-slate-800">{t("patient_details_title")}</h2>

            {riskData && (
              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="font-semibold text-slate-800">{t("triage_score")}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    riskData.risk === "red"
                      ? "bg-red-100 text-red-800"
                      : riskData.risk === "amber"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}>
                    {String(riskData.risk || "green").toUpperCase()}
                  </span>
                  <span className="text-slate-600">{t("score")}: {riskData.score ?? 0}</span>
                  <span className="text-slate-600">{t("age")}: {riskData.age ?? "-"}</span>
                  <span className="text-slate-600">{t("repeat_visits")}: {riskData.repeat_visits ?? 0}</span>
                </div>
                {Array.isArray(riskData.reasons) && riskData.reasons.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-slate-600">
                    {riskData.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => generatePatientPDF(selectedPatient, visits, timeline, getDiagnosisFromVisits(visits))}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                📄 {t("download_pdf")}
              </button>
            </div>

            <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
              <p><span className="font-semibold">{t("patient_id")}:</span> {selectedPatient.patient_id}</p>
              <p><span className="font-semibold">{t("name")}:</span> {selectedPatient.first_name} {selectedPatient.last_name}</p>
              <p><span className="font-semibold">{t("gender")}:</span> {selectedPatient.gender || "-"}</p>
              <p><span className="font-semibold">{t("date_of_birth")}:</span> {selectedPatient.date_of_birth || "-"}</p>
              <p><span className="font-semibold">{t("phone")}:</span> {selectedPatient.phone_number || "-"}</p>
              <p><span className="font-semibold">{t("email")}:</span> {selectedPatient.email || "-"}</p>
              <p className="md:col-span-2"><span className="font-semibold">{t("address")}:</span> {selectedPatient.address || "-"}</p>
              <p><span className="font-semibold">{t("blood_group")}:</span> {selectedPatient.blood_group || "-"}</p>
              <p><span className="font-semibold">{t("registration_date")}:</span> {selectedPatient.registration_date || "-"}</p>
            </div>

            <div className="mt-6">
              <h3 className="mb-3 text-lg font-semibold text-slate-800">{t("visit_information")}</h3>
              <form onSubmit={handleVisitSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <input
                  name="doctor_name"
                  value={visitForm.doctor_name}
                  onChange={handleVisitChange}
                  placeholder={t("doctor_name")}
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
                  {visitSubmitting ? t("saving_visit") : t("save_visit")}
                </button>
                <textarea
                  name="symptoms"
                  value={visitForm.symptoms}
                  onChange={handleVisitChange}
                  placeholder={t("symptoms")}
                  className="rounded-lg border border-sky-200 p-2 outline-none focus:border-sky-500 md:col-span-3"
                  rows={3}
                />
                <textarea
                  name="medications"
                  value={visitForm.medications}
                  onChange={handleVisitChange}
                  placeholder={t("medications")}
                  className="rounded-lg border border-sky-200 p-2 outline-none focus:border-sky-500 md:col-span-2"
                  rows={2}
                />
                <input
                  name="follow_up_date"
                  type="date"
                  value={visitForm.follow_up_date}
                  onChange={handleVisitChange}
                  className="rounded-lg border border-sky-200 p-2 outline-none focus:border-sky-500"
                />
              </form>
            </div>

            <div className="mt-6">
              <h3 className="mb-3 text-lg font-semibold text-slate-800">{t("visit_history_title")}</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-2">{t("visit_id")}</th>
                      <th className="p-2">{t("visit_date")}</th>
                      <th className="p-2">{t("doctor_name")}</th>
                      <th className="p-2">{t("symptoms")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitLoading ? (
                      <tr>
                        <td className="border-t p-2" colSpan={4}>{t("loading_visit_history")}</td>
                      </tr>
                    ) : visits.length === 0 ? (
                      <tr>
                        <td className="border-t p-2" colSpan={4}>{t("no_visits_recorded")}</td>
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

            <div className="mt-6">
              <h3 className="mb-3 text-lg font-semibold text-slate-800">{t("patient_timeline")}</h3>
              <div className="space-y-3">
                {timeline.length === 0 ? (
                  <p className="text-sm text-slate-500">{t("no_data")}</p>
                ) : (
                  timeline.map((event, idx) => (
                    <article key={`${event.event_type}-${idx}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-800">{event.title}</p>
                        <span className="text-xs text-slate-500">{event.event_date || "-"}</span>
                      </div>
                      {event.details?.symptoms && <p><span className="font-medium">Symptoms:</span> {event.details.symptoms}</p>}
                      {event.details?.medications && <p><span className="font-medium">Medications:</span> {event.details.medications}</p>}
                      {event.details?.follow_up_date && <p><span className="font-medium">Follow-up:</span> {event.details.follow_up_date}</p>}
                      {event.details?.changed_by && <p><span className="font-medium">Changed by:</span> {event.details.changed_by}</p>}
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="mt-6">
              <h3 className="mb-3 text-lg font-semibold text-slate-800">{t("audit_trail")}</h3>
              {auditEvents.length === 0 ? (
                <p className="text-sm text-slate-500">{t("no_data")}</p>
              ) : (
                <div className="space-y-3">
                  {auditEvents.map((event, idx) => (
                    <article
                      key={`audit-${event.event_type}-${idx}`}
                      className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                        <p className="font-semibold text-amber-950">{event.title}</p>
                        <span className="text-xs text-amber-800">{event.event_date || "-"}</span>
                      </div>
                      {event.details?.changed_by && (
                        <p className="text-amber-900">
                          <span className="font-medium">{t("changed_by")}:</span> {event.details.changed_by}
                        </p>
                      )}
                      {event.details?.payload && (
                        <div className="mt-2 rounded-md bg-white/80 p-3 text-xs text-slate-700">
                          <p className="mb-1 font-medium text-slate-800">{t("audit_payload")}</p>
                          <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-slate-600">
                            {formatAuditPayload(event.details.payload)}
                          </pre>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        <PatientTable
          patients={patients}
          loading={loading}
          onViewDetails={handleViewPatientDetails}
          t={t}
        />
      </div>
    </div>
  );
}
