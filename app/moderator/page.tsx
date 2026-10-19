"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import SiteNav from "@/components/SiteNav";
import OtpLogin from "@/components/OtpLogin";
import { useSession } from "@/components/useSession";
import { supabase } from "@/lib/supabase";

type Row = { id: string; full_name: string; email: string; phone: string | null; city: string | null; college: string | null; year_of_study: string | null; branch: string | null; builder_id: string; consent: boolean | null; status: string; submitted_at: string };

export default function ModeratorPage() {
  const { session, loading } = useSession();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("applications").select("*").order("submitted_at", { ascending: false });
    if (error) return toast.error(error.message);
    setRows(data as Row[]);
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase.rpc("is_moderator").then(({ data }) => { setAllowed(!!data); if (data) load(); });
  }, [session, load]);

  async function decide(id: string, decision: "accepted" | "rejected") {
    const { error } = await supabase.rpc("review_application", { app_id: id, new_status: decision, note: null });
    if (error) return toast.error(error.message);
    toast.success(`Marked ${decision}`);
    load();
  }

  const shown = useMemo(() => rows.filter((r) =>
    (filter === "all" || r.status === filter) &&
    (!q || `${r.full_name} ${r.email} ${r.phone ?? ""} ${r.city ?? ""} ${r.college ?? ""} ${r.builder_id}`.toLowerCase().includes(q.toLowerCase()))), [rows, filter, q]);

  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Name", "Email", "Phone", "City", "College", "Year", "Branch", "Builder ID", "Consent", "Status", "Submitted"];
    const lines = shown.map((r) => [r.full_name, r.email, r.phone, r.city, r.college, r.year_of_study, r.branch, r.builder_id, r.consent ? "Yes" : "No", r.status, r.submitted_at].map(esc).join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "applications.csv"; a.click();
  }

  const count = (s: string) => rows.filter((r) => r.status === s).length;

  const toReview = shown.filter((r) => r.status === "pending");
  const reviewed = shown.filter((r) => r.status !== "pending");

  const renderRow = (r: Row) => (
    <tr key={r.id}>
      <td className="px-4 py-3">{r.full_name}</td><td className="px-4 py-3">{r.email}</td>
      <td className="px-4 py-3">{r.phone}</td><td className="px-4 py-3">{r.city}</td>
      <td className="px-4 py-3">{r.college}</td><td className="px-4 py-3">{r.year_of_study}</td>
      <td className="px-4 py-3">{r.branch}</td><td className="px-4 py-3">{r.builder_id}</td>
      <td className={`px-4 py-3 font-semibold capitalize ${r.status === "accepted" ? "text-green-400" : r.status === "rejected" ? "text-red-400" : "text-yellow-300"}`}>{r.status}</td>
      <td className="space-x-2 px-4 py-3 whitespace-nowrap">
        <button disabled={r.status === "accepted"} onClick={() => decide(r.id, "accepted")} className="rounded bg-green-600 px-3 py-1 text-xs font-semibold disabled:opacity-30">Accept</button>
        <button disabled={r.status === "rejected"} onClick={() => decide(r.id, "rejected")} className="rounded bg-red-600 px-3 py-1 text-xs font-semibold disabled:opacity-30">Reject</button>
      </td>
    </tr>
  );

  return (
    <>
      <SiteNav solid />
      <main className="mx-auto max-w-6xl px-5 py-10">
        {allowed ? <h1 className="text-2xl font-bold">Moderator dashboard</h1> : <span />}
        {loading ? <p className="mt-6 text-slate-400">Loading...</p>
          : !session ? <div className="mt-6 max-w-sm rounded-2xl border border-line bg-panel p-6"><OtpLogin title="Sign in" onDone={() => {}} /></div>
          : allowed === null ? <p className="mt-6 text-slate-400">Checking access...</p>
          : !allowed ? <p className="mt-6 text-slate-400">404 – This page could not be found.</p>
          : (
            <>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[["Total", rows.length], ["Pending", count("pending")], ["Accepted", count("accepted")], ["Rejected", count("rejected")]].map(([k, v]) => (
                  <div key={k as string} className="rounded-xl border border-line bg-panel p-4"><p className="text-xs text-slate-400">{k}</p><p className="text-2xl font-bold">{v}</p></div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <select className="rounded-lg border border-line bg-ink px-3 py-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option value="all">All</option><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option>
                </select>
                <input className="min-w-56 flex-1 rounded-lg border border-line bg-ink px-3 py-2 text-sm" placeholder="Search name, email, phone, city, college, Builder ID" value={q} onChange={(e) => setQ(e.target.value)} />
                <button onClick={exportCsv} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-white/5">Export CSV</button>
              </div>
              <div className="mt-4 overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-left text-sm">
                  <thead className="bg-panel text-xs uppercase text-slate-400"><tr>
                    {["Name", "Email", "Phone", "City", "College", "Year", "Branch", "Builder ID", "Status", "Actions"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-line">
                    {toReview.length > 0 && <tr><td colSpan={10} className="bg-panel px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">To review ({toReview.length})</td></tr>}
                    {toReview.map(renderRow)}
                    {reviewed.length > 0 && <tr><td colSpan={10} className="border-t-2 border-accent bg-panel px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Already reviewed ({reviewed.length})</td></tr>}
                    {reviewed.map(renderRow)}
                    {shown.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">No applications.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
      </main>
    </>
  );
}