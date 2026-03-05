import { Link, NavLink } from "react-router-dom";

const navItemClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-all duration-300 ${
    isActive
      ? "bg-teal-50 text-teal-700"
      : "text-slate-700 hover:bg-sky-50 hover:text-teal-700"
  }`;

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-sky-100 bg-white/90 backdrop-blur animate-fade-in">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold text-teal-700">
          <span className="text-2xl">🏥</span>
          <span>Smart Hospital EMR</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <NavLink to="/" className={navItemClass}>
            Home
          </NavLink>
          <NavLink to="/about" className={navItemClass}>
            About
          </NavLink>
          <NavLink to="/system" className={navItemClass}>
            System
          </NavLink>
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
