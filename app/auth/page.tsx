"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, UserPlus } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [signedInAs, setSignedInAs] = useState<string | null>(null);

  const configured = supabaseConfigured();

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      setSignedInAs(data.user?.email ?? null);
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    try {
      const { error } =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage(error.message);
      } else if (mode === "signup") {
        setMessage("Account created — check your email if confirmation is on.");
      } else {
        router.push("/");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card>
        <h1 className="text-xl font-bold">
          {signedInAs ? "Account" : mode === "signin" ? "Sign in" : "Create account"}
        </h1>

        {!configured ? (
          <p className="mt-3 text-sm text-ink-dim">
            Supabase isn&apos;t configured, so you&apos;re in{" "}
            <span className="text-accent-bright">guest mode</span> — progress
            is saved in this browser only. To enable accounts, set{" "}
            <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>,
            run <code className="text-xs">supabase/schema.sql</code>, and seed
            with <code className="text-xs">npm run seed</code>.
          </p>
        ) : signedInAs ? (
          <div className="mt-3">
            <p className="text-sm text-ink-dim">
              Signed in as <span className="text-ink">{signedInAs}</span>.
              Attempts sync to your account automatically.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={async () => {
                await getSupabase()?.auth.signOut();
                setSignedInAs(null);
              }}
            >
              Sign out
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-10 w-full rounded-lg border border-navy-600 bg-navy-950 px-3 text-sm outline-none focus:border-accent"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              className="h-10 w-full rounded-lg border border-navy-600 bg-navy-950 px-3 text-sm outline-none focus:border-accent"
            />
            {message && <p className="text-sm text-warn">{message}</p>}
            <Button className="w-full" disabled={busy}>
              {mode === "signin" ? (
                <>
                  <LogIn className="h-4 w-4" /> Sign in
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" /> Sign up
                </>
              )}
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-ink-faint hover:text-ink"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin"
                ? "No account? Sign up"
                : "Have an account? Sign in"}
            </button>
          </form>
        )}
        <p className="mt-6 text-xs text-ink-faint">
          Guest mode always works — practice without an account and progress
          stays in this browser.
        </p>
      </Card>
    </div>
  );
}
