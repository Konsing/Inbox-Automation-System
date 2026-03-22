import Link from "next/link";
import { Inbox } from "lucide-react";

export function Header() {
  return (
    <header className="border-b border-white/10 bg-white/[0.03] backdrop-blur-md">
      <div className="container mx-auto flex items-center gap-3 px-4 py-4">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 p-2 shadow-lg shadow-blue-500/20">
            <Inbox className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              AI Inbox Automation
            </h1>
            <p className="text-sm text-muted-foreground">
              Intelligent message classification & response pipeline
            </p>
          </div>
        </Link>
      </div>
    </header>
  );
}
