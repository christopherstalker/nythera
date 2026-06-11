"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

type Report = {
  id: string;
  reason: string;
  details?: string | null;
  status: string;
  character?: {
    name: string;
  } | null;
  message?: {
    content: string;
  } | null;
};

export default function AdminPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/reports")
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((body) => setReports(body.reports ?? []))
      .catch(() => setError("Moderator or admin access required."));
  }, []);

  async function updateReport(id: string, status: string) {
    await fetch("/api/admin/reports", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status })
    });
    setReports((current) => current.map((report) => (report.id === id ? { ...report, status } : report)));
  }

  return (
    <div className="container py-8">
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-border bg-card p-5 shadow-card-glow">
          <ShieldAlert className="h-6 w-6 text-primary" />
          <h1 className="mt-4 text-[32px] font-bold leading-10 tracking-tight">Moderation</h1>
          <div className="mt-6 space-y-2">
            {["Reports", "Characters", "Users", "Safety logs"].map((item, index) => (
              <div key={item} className={index === 0 ? "rounded-xl bg-primary/15 px-3 py-2 text-sm font-medium text-primary" : "rounded-xl px-3 py-2 text-sm text-muted-foreground"}>
                {item}
              </div>
            ))}
          </div>
        </aside>

        <main className="rounded-2xl border border-border bg-card shadow-card-glow">
          <div className="border-b border-border p-5">
            <h2 className="text-2xl font-bold leading-8">Report queue</h2>
            <p className="mt-1 text-sm text-muted-foreground">Review public character and message reports.</p>
            {error ? <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-card text-character text-xs uppercase tracking-[0.08em] text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">Reason</th>
                  <th className="px-5 py-3 text-left font-semibold">Target</th>
                  <th className="px-5 py-3 text-left font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id} className="border-t border-border bg-background transition hover:bg-card">
                    <td className="px-5 py-4 font-medium text-foreground">{report.reason}</td>
                    <td className="max-w-[360px] px-5 py-4 text-muted-foreground">
                      <p className="truncate">{report.character?.name ?? report.message?.content ?? report.details ?? "No report target details"}</p>
                    </td>
                    <td className="px-5 py-4">
                      <Status status={report.status} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => updateReport(report.id, "REVIEWED")}>
                          Review
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => updateReport(report.id, "RESOLVED")}>
                          Resolve
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!error && reports.length === 0 ? (
            <div className="border-t border-border p-10 text-center text-sm text-muted-foreground">No reports in queue.</div>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function Status({ status }: { status: string }) {
  const className =
    status === "PENDING"
      ? "border-[#f59e0b]/30 bg-[#f59e0b]/10 text-[#f59e0b]"
      : status === "RESOLVED"
        ? "border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981]"
        : status === "REJECTED"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-primary/30 bg-primary/10 text-primary";

  return <span className={`rounded-full border px-3 py-1 text-xs font-medium ${className}`}>{status}</span>;
}
