import Navbar from "../components/Navbar";
import About from "../components/About";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      <Navbar />
      <main>
        <About />
      </main>
    </div>
  );
}
