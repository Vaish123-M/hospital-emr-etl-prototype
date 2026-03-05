import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import About from "../components/About";
import Features from "../components/Features";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      <Navbar />
      <main>
        <Hero />
        <About />
        <Features />
      </main>
    </div>
  );
}
