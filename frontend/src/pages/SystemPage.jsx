import Navbar from "../components/Navbar";
import Features from "../components/Features";

export default function SystemPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      <Navbar />
      <main>
        <Features />
      </main>
    </div>
  );
}
