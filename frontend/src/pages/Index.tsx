/**
 * Index — Secure Guardian Gate (main entry)
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Lock, KeyRound, FileCheck, Sparkles, Clock } from "lucide-react";
import { getStoredToken } from "@/lib/api";
import { RegistrationForm } from "@/components/RegistrationForm";
import { LoginForm } from "@/components/LoginForm";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CAPABILITIES = [
  {
    icon: Lock,
    title: "Credential protection",
    description: "bcrypt hashing with strong work factor; passwords never stored in plaintext.",
  },
  {
    icon: KeyRound,
    title: "Strong authentication",
    description: "Optional TOTP-based MFA and recovery codes for account recovery.",
  },
  {
    icon: FileCheck,
    title: "Validated onboarding",
    description:
      "Input sanitisation, live password strength meter (bar segments + entropy), and Google reCAPTCHA v3.",
  },
  {
    icon: Clock,
    title: "Lockout & password age",
    description:
      "Failed sign-in attempts are limited (temporary lockout); dashboard reminds you to rotate passwords (e.g. every 30 days).",
  },
];

const Index = () => {
  const navigate = useNavigate();
  const [authTab, setAuthTab] = useState<"login" | "register">("login");

  useEffect(() => {
    if (getStoredToken()) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  return (
    <div className="bg-grid-subtle min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
              <Shield className="h-4 w-4 text-primary" aria-hidden />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold tracking-tight text-foreground">Secure Guardian Gate</p>
              <p className="text-[11px] text-muted-foreground">Identity &amp; access prototype</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded-md border border-border bg-secondary/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              CET324 · Advanced CyberSecurity
            </span>
            <span className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
              University of Sunderland
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-14 xl:gap-16">
          <section className="flex flex-col justify-center lg:col-span-5">
            <p className="mb-3 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
              Secure registration
            </p>
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Enterprise-grade{" "}
              <span className="text-gradient-brand">identity onboarding</span>
            </h1>
            <p className="mt-4 max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
              A controlled demonstration of secure account creation and sign-in—hashing, policy enforcement,
              reCAPTCHA v3, and multi-factor authentication—suitable for coursework and security review.
            </p>

            <Separator className="my-8 max-w-sm bg-border/80" />

            <ul className="space-y-5">
              {CAPABILITIES.map(({ icon: Icon, title, description }) => (
                <li key={title} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card/80 shadow-sm">
                    <Icon className="h-4 w-4 text-primary" aria-hidden />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col justify-center lg:col-span-7">
            <Card className="mx-auto w-full max-w-lg border-border bg-card shadow-md shadow-slate-900/8">
              <Tabs
                value={authTab}
                onValueChange={(v) => setAuthTab(v as "login" | "register")}
                className="w-full"
              >
                <CardHeader className="space-y-0 border-b border-border/80 pb-4 pt-6">
                  <TabsList
                    className="grid h-11 w-full grid-cols-2 bg-muted/80 p-1"
                    aria-label="Sign in or create account"
                  >
                    <TabsTrigger value="login" className="text-sm">
                      Sign in
                    </TabsTrigger>
                    <TabsTrigger value="register" className="text-sm">
                      Create account
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>

                <CardContent className="pt-6">
                  <TabsContent value="login" forceMount className="mt-0 outline-none data-[state=inactive]:hidden">
                    <p className="mb-6 text-sm text-muted-foreground">
                      Use your email and password. Signing in runs an invisible reCAPTCHA v3 check. You can enable
                      two-factor authentication after you sign in.
                    </p>
                    <LoginForm />
                  </TabsContent>

                  <TabsContent value="register" forceMount className="mt-0 outline-none data-[state=inactive]:hidden">
                    <p className="mb-6 text-sm text-muted-foreground">
                      Choose a username and a strong password, then complete the verification challenge.
                    </p>
                    <RegistrationForm />
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>

            <p className="mx-auto mt-8 max-w-lg text-center text-xs leading-relaxed text-muted-foreground lg:text-left">
              Educational prototype. Processing follows backend API configuration; refer to deployment notes for
              production hardening.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border/80 py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 text-center text-xs text-muted-foreground sm:flex-row sm:text-left sm:px-6 lg:px-8">
          <span>© {new Date().getFullYear()} Secure Guardian Gate · CET324</span>
          <span className="text-muted-foreground/80">University of Sunderland</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
