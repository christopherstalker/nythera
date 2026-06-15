"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Users, Bot, FileWarning, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, PageShell, Surface, SurfaceMuted } from "@/components/ui/page";
import { cn } from "@/lib/utils";

type Report = {
  id: string;
  reason: string;
  details?: string | null;
  status: string;
  character?: {
    id: string;
    name: string;
    creatorId: string;
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
      .catch(() => setError("Admin access is limited to chrisstalker@gmail.com."));
  }, []);

  async function updateReport(id: string, status: string, extras?: { blockCharacter?: boolean; banUser?: boolean }) {
    await fetch("/api/admin/reports", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status, ...extras })
    });
    setReports((current) => current.map((report) => (report.id === id ? { ...report, status } : report)));
  }

  return (
    <PageShell className="space-y-10">
      <PageHeader
        icon={ShieldAlert}
        title="Moderation"
        description="Review reports, scan safety state, and keep public characters aligned with Aurenya policy."
      />

      <div className="grid gap-7 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Surface className="h-fit p-4 lg:sticky lg:top-28">
          <div className="space-y-2">
            {[
              { item: "Reports", icon: FileWarning, count: reports.length },
              { item: "Characters", icon: Bot, count: 0 },
              { item: "Users", icon: Users, count: 0 },
              { item: "Safety logs", icon: Activity, count: 0 }
            ].map(({ item, icon: Icon, count }, index) => (
              <div
                key={String(item)}
                className={cn(
                  "flex items-center justify-between rounded-3xl border px-3 py-3 text-sm transition",
                  index === 0
                    ? "border-primary/[0.14] bg-primary/[0.09] text-foreground shadow-inset"
                    : "border-transparent text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {item}
                </span>
                <span className="rounded-full bg-white/[0.03] px-2 py-0.5 text-xs shadow-inset">{String(count)}</span>
              </div>
            ))}
          </div>
        </Surface>

        <Surface className="overflow-hidden">
          <div className="p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-2xl font-semibold leading-8 tracking-tight">Report queue</h2>
                <p className="mt-1 text-sm text-muted-foreground">Review public character and message reports.</p>
              </div>
              <div className="flex gap-2">
                <Status status="PENDING" />
                <Status status="REVIEWED" />
              </div>
            </div>
            {error ? <p className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
          </div>

          {error ? (
            <div className="p-6">
              <EmptyState icon={ShieldAlert} title="Admin access required" description={error} />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 text-left font-semibold">Reason</th>
                      <th className="px-5 py-3 text-left font-semibold">Target</th>
                      <th className="px-5 py-3 text-left font-semibold">Status</th>
                      <th className="px-5 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((report) => (
                      <tr key={report.id} className="border-t border-white/[0.05] bg-white/[0.018] transition hover:bg-white/[0.045]">
                        <td className="px-5 py-4 font-medium text-foreground">{report.reason}</td>
                        <td className="max-w-[360px] px-5 py-4 text-muted-foreground">
                          <p className="truncate">{report.character?.name ?? report.message?.content ?? report.details ?? "No report target details"}</p>
                        </td>
                        <td className="px-5 py-4">
                          <Status status={report.status} />
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <Button variant="secondary" size="sm" onClick={() => updateReport(report.id, "REVIEWED")}>
                              Review
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => updateReport(report.id, "RESOLVED")}>
                              Resolve
                            </Button>
                            {report.character ? (
                              <>
                                <Button variant="destructive" size="sm" onClick={() => updateReport(report.id, "RESOLVED", { blockCharacter: true })}>
                                  Block
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => updateReport(report.id, "RESOLVED", { blockCharacter: true, banUser: true })}>
                                  Ban creator
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {reports.length === 0 ? (
                <div className="p-6">
                  <SurfaceMuted className="p-8 text-center text-sm text-muted-foreground">No reports in queue.</SurfaceMuted>
                </div>
              ) : null}
            </>
          )}
        </Surface>
      </div>
    </PageShell>
  );
}

function Status({ status }: { status: string }) {
  const className =
    status === "PENDING"
      ? "border-[#f2c572]/30 bg-[#f2c572]/10 text-[#f2c572]"
      : status === "RESOLVED"
        ? "border-[#8fd8c2]/30 bg-[#8fd8c2]/10 text-[#8fd8c2]"
        : status === "REJECTED"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-primary/20 bg-primary/[0.075] text-foreground";

  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium shadow-[var(--glass-highlight)] ${className}`}>{status}</span>;
}
