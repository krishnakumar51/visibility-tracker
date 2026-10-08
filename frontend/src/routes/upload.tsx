import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileJson2,
  LoaderCircle,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api";
import { useDashboardData } from "@/lib/dashboard-data";

export const Route = createFileRoute("/upload")({ component: UploadPage });

type AnalysisSummary = {
  filename: string;
  week: number;
  responses_processed: number;
  successful_responses: number;
  failed_responses: number;
  mentions: number;
  wrong_facts: number;
};

const downloads = [
  { filename: "mentions.csv", label: "Download mentions.csv" },
  { filename: "wrong_facts.csv", label: "Download wrong_facts.csv" },
  { filename: "dashboard_data.json", label: "Download dashboard_data.json" },
];

function UploadPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { refresh } = useDashboardData();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);

  const selectFile = (nextFile?: File) => {
    setError("");
    setSummary(null);
    setFile(nextFile ?? null);
  };

  const runAnalysis = async () => {
    if (!file || isProcessing) return;
    setError("");
    setSummary(null);
    setIsProcessing(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(apiUrl("/api/analyze"), { method: "POST", body: form });
      const result = (await response.json()) as AnalysisSummary | { detail?: string };
      if (!response.ok) {
        throw new Error("detail" in result && result.detail ? result.detail : "Analysis failed.");
      }
      setSummary(result as AnalysisSummary);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-8 sm:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 px-1 pb-1 pt-1">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
            Fleet analytics <span className="px-1 text-border">/</span> Upload & Analyze
          </div>
          <h1 className="mt-2 font-display text-[30px] font-bold leading-tight tracking-[-0.04em] text-foreground sm:text-[38px]">
            Upload & Analyze
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Add one new week's AI responses to the existing history and run the Corvane pipeline.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/">
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            Return to Overview
          </Link>
        </Button>
      </header>

      <section className="glass-surface rounded-2xl p-4 sm:p-6" aria-labelledby="upload-title">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileJson2 aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 id="upload-title" className="section-heading">
              Weekly response file
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              JSONL format · one week per upload · up to 20 MB
            </p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".jsonl,application/x-ndjson,application/jsonl"
          className="sr-only"
          aria-label="Choose a JSONL response file"
          onChange={(event) => selectFile(event.currentTarget.files?.[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            selectFile(event.dataTransfer.files[0]);
          }}
          className={`mt-5 flex min-h-44 w-full flex-col items-center justify-center rounded-xl border border-dashed px-5 py-7 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isDragging ? "border-primary bg-primary/5" : "border-border bg-card/55 hover:border-primary/60 hover:bg-card/80"}`}
        >
          <Upload aria-hidden="true" className="size-6 text-primary" />
          <span className="mt-3 text-sm font-semibold text-foreground">
            {file ? file.name : "Drop a JSONL file here or browse"}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">
            {file
              ? `${(file.size / 1024).toFixed(1)} KB selected`
              : "Choose one week's response records"}
          </span>
        </button>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={runAnalysis} disabled={!file || isProcessing}>
            {isProcessing ? (
              <>
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Running
                analysis…
              </>
            ) : (
              <>
                <Upload aria-hidden="true" className="size-4" /> Run Analysis
              </>
            )}
          </Button>
          {file && !isProcessing && (
            <Button variant="ghost" onClick={() => selectFile(undefined)}>
              Clear file
            </Button>
          )}
          {isProcessing && (
            <span role="status" className="text-xs text-muted-foreground">
              Validating upload and running the existing pipeline. Keep this page open.
            </span>
          )}
        </div>
      </section>

      {error && (
        <section className="rounded-xl border border-negative/30 bg-negative/5 p-4" role="alert">
          <div className="flex items-start gap-2.5 text-sm font-semibold text-negative">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>Analysis could not be completed</span>
          </div>
          <p className="mt-2 pl-6 text-xs leading-relaxed text-muted-foreground">{error}</p>
        </section>
      )}

      {summary && (
        <section className="glass-surface rounded-2xl p-4 sm:p-6" aria-labelledby="summary-title">
          <div className="flex items-start gap-3">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-positive" />
            <div>
              <h2 id="summary-title" className="section-heading">
                Analysis complete · Week {summary.week}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {summary.filename} was added to response history. The dashboard data has been
                refreshed.
              </p>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <SummaryMetric label="Responses processed" value={summary.responses_processed} />
            <SummaryMetric label="Successful" value={summary.successful_responses} />
            <SummaryMetric label="Failed / unusable" value={summary.failed_responses} />
            <SummaryMetric label="Company mentions" value={summary.mentions} />
            <SummaryMetric label="Wrong-fact alerts" value={summary.wrong_facts} />
          </dl>
          <div className="mt-5 border-t border-border pt-4">
            <h3 className="text-xs font-semibold text-foreground">Generated outputs</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {downloads.map(({ filename, label }) => (
                <Button key={filename} variant="outline" size="sm" asChild>
                  <a href={apiUrl(`/api/downloads/${filename}`)} download={filename}>
                    <Download aria-hidden="true" className="size-3.5" />
                    {label}
                  </a>
                </Button>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/75 bg-card/70 p-3">
      <dt className="text-[10px] font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-display text-xl font-bold text-foreground">
        {value.toLocaleString()}
      </dd>
    </div>
  );
}
