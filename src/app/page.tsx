import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Play, ArrowRight, Bot, Zap, Database } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12">
        {/* Hero */}
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            AI-Powered Inbox Automation
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Automatically classify, prioritize, and respond to messages using AI.
            Watch the pipeline process messages in real-time.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link href="/demo">
              <Button size="lg">
                <Play className="mr-2 h-4 w-4" />
                Try the Demo
              </Button>
            </Link>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="mx-auto mt-16 grid max-w-3xl gap-6 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <Bot className="h-8 w-8 text-blue-500" />
              <CardTitle className="text-base">AI Classification</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Messages are classified by category, priority, and sentiment using Google Gemini.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <Zap className="h-8 w-8 text-yellow-500" />
              <CardTitle className="text-base">Real-Time Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Watch each automation step happen live with Server-Sent Events streaming.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <Database className="h-8 w-8 text-green-500" />
              <CardTitle className="text-base">Ticket Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Every message becomes a ticket stored in Supabase with full classification data.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <div className="mx-auto mt-16 max-w-2xl">
          <h3 className="text-center text-xl font-semibold">How It Works</h3>
          <div className="mt-8 space-y-4">
            {[
              { icon: Mail, label: "Message received", desc: "Submit a customer message" },
              { icon: Bot, label: "AI classifies", desc: "Category, priority, and sentiment detected" },
              { icon: Zap, label: "Response generated", desc: "AI writes a professional reply" },
              { icon: Database, label: "Ticket stored", desc: "Everything saved to the database" },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <step.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{step.label}</p>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </div>
                {i < 3 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
