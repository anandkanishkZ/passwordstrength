/**
 * Index.tsx — Main Page
 * =====================================================================
 * Secure User Registration System
 * University of Sunderland | CET324 – Advanced CyberSecurity
 * =====================================================================
 */

import { Shield, Lock, Database, Cpu } from "lucide-react";
import { RegistrationForm } from "@/components/RegistrationForm";

const SECURITY_BADGES = [
  { icon: Lock,     label: "bcrypt (12 rounds)" },
  { icon: Shield,   label: "Input Sanitisation" },
  { icon: Cpu,      label: "Entropy Scoring" },
  { icon: Database, label: "No Plaintext Storage" },
];

const Index = () => {
  return (
    <main className="bg-grid min-h-screen">
      <div className="container mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-12">

        {/* === Header === */}
        <header className="mb-8 text-center">
          {/* Shield logo */}
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.1)] shadow-[var(--glow-primary)]">
            <Shield size={32} className="text-primary" />
          </div>

          {/* University badge */}
          <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            University of Sunderland · CET324
          </p>

          <h1 className="mb-1 font-mono text-2xl font-bold tracking-tight text-gradient-cyber">
            Secure Registration
          </h1>
          <p className="font-mono text-xs text-muted-foreground">
            Advanced CyberSecurity Assignment Prototype
          </p>
        </header>

        {/* === Security feature badges === */}
        <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
          {SECURITY_BADGES.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 rounded-full border border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--primary)/0.06)] px-3 py-1"
            >
              <Icon size={11} className="text-primary" />
              <span className="font-mono text-[10px] text-primary/80">{label}</span>
            </div>
          ))}
        </div>

        {/* === Registration card === */}
        <div className="w-full rounded-2xl border border-border bg-card shadow-2xl">
          <div className="border-b border-border px-6 py-4">
            <div className="flex items-center gap-2">
              {/* Terminal-style dots */}
              <span className="h-2.5 w-2.5 rounded-full bg-[hsl(0_72%_55%)]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[hsl(45_95%_55%)]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[hsl(142_72%_45%)]" />
              <span className="ml-2 font-mono text-xs text-muted-foreground">
                secure_registration.tsx
              </span>
            </div>
          </div>

          <div className="p-6">
            <RegistrationForm />
          </div>
        </div>

        {/* === Footer === */}
        <footer className="mt-6 text-center">
          <p className="font-mono text-[10px] text-muted-foreground">
            Prototype for educational purposes · All processing is client-side
          </p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            CET324 Advanced CyberSecurity · University of Sunderland · 2026
          </p>
        </footer>
      </div>
    </main>
  );
};

export default Index;
