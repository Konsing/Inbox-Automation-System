import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Mail, Play, ArrowRight, Bot, Zap, Database, LayoutDashboard } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated gradient blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-500/20 blur-[120px] animate-pulse" />
        <div className="absolute top-20 right-0 h-[400px] w-[400px] rounded-full bg-purple-500/15 blur-[120px] animate-pulse [animation-delay:2s]" />
        <div className="absolute bottom-0 left-1/3 h-[350px] w-[350px] rounded-full bg-indigo-500/15 blur-[120px] animate-pulse [animation-delay:4s]" />
      </div>

      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10">
        <Header />
        <main className="container mx-auto px-4 py-20">
          {/* Hero */}
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur-sm">
              <Zap className="h-3.5 w-3.5 text-yellow-400" />
              Powered by Google Gemini AI
            </div>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                AI-Powered Inbox
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
                Automation
              </span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
              Automatically classify, prioritize, and respond to messages using AI.
              Watch the pipeline process messages in real-time.
            </p>
            <div className="mt-10 flex justify-center gap-4">
              <Link href="/demo">
                <Button size="lg" className="h-12 px-8 text-base bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0 shadow-lg shadow-blue-500/25">
                  <Play className="mr-2 h-4 w-4" />
                  Try the Demo
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline" size="lg" className="h-12 px-8 text-base border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="mx-auto mt-24 grid max-w-4xl gap-6 sm:grid-cols-3">
            {[
              {
                icon: Bot,
                title: "AI Classification",
                desc: "Messages are classified by category, priority, and sentiment using Google Gemini.",
                color: "blue",
              },
              {
                icon: Zap,
                title: "Real-Time Pipeline",
                desc: "Watch each automation step happen live with Server-Sent Events streaming.",
                color: "yellow",
              },
              {
                icon: Database,
                title: "Ticket Management",
                desc: "Every message becomes a ticket stored in Supabase with full classification data.",
                color: "green",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="group rounded-xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm transition-all hover:bg-white/[0.06] hover:border-white/20 hover:shadow-lg hover:shadow-blue-500/5"
              >
                <div className={`mb-4 inline-flex rounded-lg p-2.5 ${
                  card.color === "blue" ? "bg-blue-500/10 text-blue-400" :
                  card.color === "yellow" ? "bg-yellow-500/10 text-yellow-400" :
                  "bg-green-500/10 text-green-400"
                }`}>
                  <card.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 font-semibold">{card.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {card.desc}
                </p>
              </div>
            ))}
          </div>

          {/* How It Works */}
          <div className="mx-auto mt-24 max-w-2xl">
            <h3 className="text-center text-xl font-semibold">How It Works</h3>
            <div className="mt-10 space-y-6">
              {[
                { icon: Mail, label: "Message received", desc: "Submit a customer message", color: "from-blue-500 to-blue-600" },
                { icon: Bot, label: "AI classifies", desc: "Category, priority, and sentiment detected", color: "from-purple-500 to-purple-600" },
                { icon: Zap, label: "Response generated", desc: "AI writes a professional reply", color: "from-indigo-500 to-indigo-600" },
                { icon: Database, label: "Ticket stored", desc: "Everything saved to the database", color: "from-green-500 to-green-600" },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="relative">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${step.color} shadow-lg`}>
                      <step.icon className="h-5 w-5 text-white" />
                    </div>
                    {i < 3 && (
                      <div className="absolute left-1/2 top-full h-6 w-px -translate-x-1/2 bg-gradient-to-b from-white/20 to-transparent" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{step.label}</p>
                    <p className="text-sm text-muted-foreground">{step.desc}</p>
                  </div>
                  {i < 3 && <ArrowRight className="h-4 w-4 text-muted-foreground/50" />}
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
