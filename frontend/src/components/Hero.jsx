import { Link } from "react-router-dom";

export default function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-2 md:items-center">
      <div className="animate-fade-in">
        <span className="mb-4 inline-flex rounded-full bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700">
          Digital Care Platform
        </span>
        <h1 className="mb-5 text-4xl font-bold leading-tight text-slate-800 md:text-5xl">
          Modern Patient Management for Small Hospitals
        </h1>
        <p className="mb-4 text-lg text-slate-600">
          Many small hospitals still manage patient records in Excel which causes duplication,
          lack of structure, and poor scalability.
        </p>
        <p className="mb-8 text-slate-600">
          Our system replaces Excel with a structured database-driven patient management
          platform.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex rounded-xl bg-sky-600 px-5 py-3 font-semibold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:bg-sky-700"
        >
          Launch System
        </Link>
      </div>

      <div className="animate-slide-up rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-sky-50 to-teal-50 p-8 shadow-xl transition-all duration-300 hover:scale-[1.02]">
        <div className="mb-4 text-5xl">🩺</div>
        <h3 className="mb-2 text-xl font-semibold text-slate-800">Healthcare First</h3>
        <p className="mb-6 text-slate-600">
          Secure, organized, and scalable patient management for modern clinical workflows.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white p-3 shadow-sm">
            <p className="text-xs text-slate-500">Records</p>
            <p className="text-lg font-bold text-teal-700">Structured</p>
          </div>
          <div className="rounded-xl bg-white p-3 shadow-sm">
            <p className="text-xs text-slate-500">Data Flow</p>
            <p className="text-lg font-bold text-sky-700">API Ready</p>
          </div>
        </div>
      </div>
    </section>
  );
}
