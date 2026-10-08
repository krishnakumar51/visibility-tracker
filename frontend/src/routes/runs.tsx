import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Clock3, LoaderCircle, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiUrl } from "@/lib/api";
import { useDashboardData } from "@/lib/dashboard-data";

export const Route = createFileRoute("/runs")({ component: UploadHistoryPage });

type UploadRun = {
  upload_id: string;
  filename: string;
  detected_week: number;
  uploaded_at: string;
  response_count: number;
  success_count: number;
  failed_count: number;
  coverage: number | null;
  status: "processing" | "active" | "deleted" | "failed";
  active: boolean;
};

function UploadHistoryPage() {
  const { refresh } = useDashboardData();
  const [runs, setRuns] = useState<UploadRun[]>([]);
  const [selected, setSelected] = useState<UploadRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl("/api/uploads"), { cache: "no-store" });
      const body = (await response.json()) as UploadRun[] | { detail?: string };
      if (!response.ok) {
        throw new Error("detail" in body && body.detail ? body.detail : "Could not load upload history.");
      }
      setRuns(body as UploadRun[]);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load upload history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const confirmDelete = async () => {
    if (!selected || deleting) return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(apiUrl(`/api/uploads/${encodeURIComponent(selected.upload_id)}`), {
        method: "DELETE",
      });
      const body = (await response.json()) as UploadRun | { detail?: string };
      if (!response.ok) {
        throw new Error("detail" in body && body.detail ? body.detail : "Could not deactivate this upload.");
      }
      setSelected(null);
      setNotice(`Week ${selected.detected_week} was removed from the active dashboard. Its run files remain in history.`);
      await refresh();
      await loadRuns();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not deactivate this upload.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5 pb-8 sm:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 px-1 pb-1 pt-1">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
            Fleet analytics <span className="px-1 text-border">/</span> Upload History
          </div>
          <h1 className="mt-2 font-display text-[30px] font-bold leading-tight tracking-[-0.04em] text-foreground sm:text-[38px]">
            Upload History
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Review uploaded runs and choose which ones contribute to the active dashboard.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadRuns()} disabled={loading}>
          {loading ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> : <Clock3 aria-hidden="true" className="size-3.5" />}
          Refresh history
        </Button>
      </header>

      {notice && (
        <div className="flex items-center gap-2 rounded-lg border border-positive/25 bg-positive/5 px-3 py-2.5 text-xs text-positive" role="status">
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
          {notice}
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-negative/25 bg-negative/5 px-3 py-2.5 text-xs text-negative" role="alert">
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}

      <section className="glass-surface overflow-hidden rounded-2xl" aria-label="Uploaded runs">
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <h2 className="section-heading">Runs</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Deleted runs are excluded from the dashboard, but their generated files remain stored for audit.
          </p>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 px-5 py-10 text-sm text-muted-foreground" role="status">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Loading upload history…
          </div>
        ) : runs.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            No uploaded runs yet. Add a JSONL response file from Upload & Analyze.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-xs">
              <thead className="bg-muted/60 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Upload</th>
                  <th className="px-3 py-3 font-semibold">Week</th>
                  <th className="px-3 py-3 font-semibold">Uploaded</th>
                  <th className="px-3 py-3 font-semibold">Responses</th>
                  <th className="px-3 py-3 font-semibold">Success / failed</th>
                  <th className="px-3 py-3 font-semibold">Coverage</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {runs.map((run) => (
                  <tr key={run.upload_id} className="align-middle">
                    <td className="max-w-[240px] px-4 py-3.5">
                      <span className="block truncate font-medium text-foreground" title={run.filename}>{run.filename}</span>
                      <span className="mt-1 block truncate font-mono text-[9px] text-muted-foreground">{run.upload_id}</span>
                    </td>
                    <td className="px-3 py-3.5 font-semibold text-foreground">Week {run.detected_week}</td>
                    <td className="px-3 py-3.5 text-muted-foreground">{new Date(run.uploaded_at).toLocaleString()}</td>
                    <td className="px-3 py-3.5 text-foreground">{run.response_count}</td>
                    <td className="px-3 py-3.5 text-foreground">{run.success_count} / {run.failed_count}</td>
                    <td className="px-3 py-3.5 text-foreground">{run.coverage === null ? "—" : `${(run.coverage * 100).toFixed(1)}%`}</td>
                    <td className="px-3 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${run.status === "active" ? "bg-positive/10 text-positive" : run.status === "failed" ? "bg-negative/10 text-negative" : "bg-muted text-muted-foreground"}`}>
                        {run.status === "active" ? "Active" : run.status === "deleted" ? "Deleted" : run.status === "failed" ? "Failed" : "Processing"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {run.status !== "deleted" ? (
                        <Button variant="outline" size="sm" onClick={() => { setNotice(""); setSelected(run); }}>
                          <Trash2 aria-hidden="true" className="size-3.5" /> Delete
                        </Button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Retained</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AlertDialog open={selected !== null} onOpenChange={(open) => { if (!open && !deleting) setSelected(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this upload?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this upload from the active dashboard, scores, trends, alerts, and Answer Explorer. The original baseline data will remain unchanged. Generated run files will be kept for audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => { event.preventDefault(); void confirmDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Recalculating…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
