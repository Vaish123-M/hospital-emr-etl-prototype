import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-sky-100 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold text-teal-700">
          <span className="text-2xl">🏥</span>
          <span>Smart Hospital EMR</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <a href="#home" className="text-slate-700 transition-all hover:text-teal-700">
            Home
          </a>
          <a href="#about" className="text-slate-700 transition-all hover:text-teal-700">
            About
          </a>
          <a href="#system" className="text-slate-700 transition-all hover:text-teal-700">
            System
          </a>
        </div>

        <Link
          to="/dashboard"
          className="rounded-xl bg-teal-600 px-4 py-2 font-medium text-white shadow-lg transition-all duration-300 hover:scale-105 hover:bg-teal-700"
        >
          Open System
        </Link>
      </nav>
    </header>
  );
}
