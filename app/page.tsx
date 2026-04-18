import AnimatedBackground from "@/components/AnimatedBackground";
import TerminalWindow from "@/components/TerminalWindow";

export default function Home() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden">
      <AnimatedBackground />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 sm:px-8 sm:py-12">
        <section className="w-full max-w-5xl">
          <TerminalWindow />
        </section>
      </div>
    </main>
  );
}
