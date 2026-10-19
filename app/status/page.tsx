"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import OtpLogin from "@/components/OtpLogin";
import { useSession } from "@/components/useSession";
import { supabase } from "@/lib/supabase";

type App = { full_name: string; builder_id: string; status: "pending" | "accepted" | "rejected"; submitted_at: string };

export default function StatusPage() {
  const { session, loading } = useSession();
  const [app, setApp] = useState<App | null | undefined>(undefined);
  const [wa, setWa] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase.from("applications").select("full_name,builder_id,status,submitted_at").eq("user_id", session.user.id).maybeSingle()
      .then(({ data }) => setApp((data as App) ?? null));
    // Returns the link only when this user's application is accepted.
    supabase.rpc("get_whatsapp_link").then(({ data }) => setWa((data as string) || null));
  }, [session]);

  const label = { pending: "Awaiting confirmation", accepted: "Confirmed", rejected: "Not selected" };
  const badge = { pending: "bg-yellow-500/20 text-yellow-300", accepted: "bg-green-500/20 text-green-300", rejected: "bg-red-500/20 text-red-300" };

  return (
    <>
      <SiteNav solid />
      <main className="mx-auto max-w-xl px-5 py-12">
        <div className="rounded-2xl border border-line bg-panel p-6 sm:p-8">
          <h1 className="mb-4 text-2xl font-bold">My registration</h1>
          {loading ? <p className="text-slate-400">Loading...</p>
            : !session ? <OtpLogin title="Sign in to see your status" onDone={() => {}} />
            : app === undefined ? <p className="text-slate-400">Loading...</p>
            : app === null ? (
              <p className="text-slate-300">No registration yet. <Link href="/register" className="underline text-accent">Register now</Link></p>
            ) : (
              <div className="space-y-4">
                <p><span className="text-slate-400">Name: </span>{app.full_name}</p>
                <p><span className="text-slate-400">Builder ID: </span>{app.builder_id}</p>
                <p><span className="text-slate-400">Status: </span><span className={`rounded-full px-3 py-1 text-sm font-semibold ${badge[app.status]}`}>{label[app.status]}</span></p>
                {app.status === "pending" && <p className="text-sm text-slate-400">We'll update your status here soon. Check back later.</p>}
                {app.status === "rejected" && <p className="text-sm text-slate-400">Sorry, we couldn't offer you a seat this time.</p>}
                {app.status === "accepted" && (
                  <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-4">
                    <p className="font-semibold">You're in! 🎉</p>
                    {wa ? <a href={wa} target="_blank" rel="noreferrer" className="mt-2 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">Join the WhatsApp group</a>
                        : <p className="mt-1 text-sm text-slate-300">Your seat is confirmed. See you there!</p>}
                  </div>
                )}
                <button className="text-xs text-slate-400 underline" onClick={() => supabase.auth.signOut()}>Sign out</button>
              </div>
            )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
