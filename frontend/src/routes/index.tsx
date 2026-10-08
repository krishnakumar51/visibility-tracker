import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileSearch,
  MoveRight,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDashboardData } from "@/lib/dashboard-data";

export const Route = createFileRoute("/")({
  component: OverviewPage,
});

const accentClasses: Record<string, string> = {
  corvane: "company-marker-corvane",
  trakvia: "company-marker-trakvia",
  routelyne: "company-marker-routelyne",
  gridwell: "company-marker-gridwell",
};

function TrendSparkline({
  values,
  name,
  colorClass,
}: {
  values: number[];
  name: string;
  colorClass: string;
}) {
  const min = Math.min(...values) - 4;
  const max = Math.max(...values) + 4;
  const points = values
    .map(
      (value, index) =>
        `${(index / Math.max(values.length - 1, 1)) * 100},${34 - ((value - min) / Math.max(max - min, 1)) * 29}`,
    )
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 38"
      preserveAspectRatio="none"
      role="img"
      aria-label={`${name} weekly visibility score trend`}
      className={`h-10 w-full ${colorClass}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChangeNumber({
  value,
  unavailableLabel,
}: {
  value: number | null;
  unavailableLabel: string;
}) {
  if (value === null)
    return (
      <span className="inline-flex max-w-[190px] items-center gap-1 whitespace-normal text-right text-[10px] font-medium leading-tight text-muted-foreground">
        <Clock3 aria-hidden="true" className="size-3" />
        {unavailableLabel}
      </span>
    );
  const positive = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${positive ? "direction-positive" : "direction-negative"}`}
    >
      {positive ? (
        <ArrowUpRight aria-hidden="true" className="size-3" />
      ) : (
        <ArrowDownRight aria-hidden="true" className="size-3" />
      )}
      {positive ? "+" : "−"}
      {Math.abs(value)} pts
    </span>
  );
}

function DataMessage({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="glass-surface rounded-2xl p-6" role="status">
      <h1 className="text-sm font-semibold text-foreground">{title}</h1>
      {detail && <p className="mt-2 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function OverviewPage() {
  const state = useDashboardData();
  if (state.status === "loading") return <DataMessage title="Loading pipeline data…" />;
  if (state.status === "error")
    return <DataMessage title="Pipeline data could not be loaded" detail={state.message} />;
  const dashboardData = state.data;

  return (
    <div className="space-y-5 pb-8 sm:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 px-1 pb-1 pt-1 sm:gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary sm:text-[11px]">
            <span>Fleet analytics</span>
            <span className="text-border">/</span>
            <span>Executive overview</span>
          </div>
          <h1 className="mt-2 font-display text-[30px] font-bold leading-tight tracking-[-0.04em] text-foreground sm:text-[38px]">
            AI answer visibility
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            An executive view of how AI engines describe Corvane Fleet and its competitors.
          </p>
        </div>
        <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs shadow-sm sm:gap-2.5">
          <Clock3 aria-hidden="true" className="size-4 shrink-0 text-warning" />
          <span className="font-semibold text-foreground">{dashboardData.period}</span>
          <span className="hidden h-4 w-px bg-border sm:block" />
          <span className="whitespace-nowrap text-muted-foreground">
            {dashboardData.coverage.validSlots} of {dashboardData.coverage.expectedSlots} slots ·{" "}
            {Math.round(dashboardData.coverage.coverage * 100)}% coverage
          </span>
        </div>
      </header>

      {dashboardData.partialWeeks.length > 0 && (
        <div
          className="flex flex-wrap items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-foreground"
          role="status"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            Partial historical coverage:{" "}
            {dashboardData.partialWeeks
              .map(
                (week) =>
                  `Week ${week.week} (${week.validSlots}/${week.expectedSlots}${week.missingEngines.length ? `; missing ${week.missingEngines.join(", ")}` : ""})`,
              )
              .join("; ")}
            .
          </span>
        </div>
      )}

      <section
        aria-label="Company visibility scores"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4"
      >
        {dashboardData.companies.map((company) => {
          const accent = accentClasses[company.id] ?? "company-marker-corvane";
          return (
            <article key={company.id} className="glass-surface score-card min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-2 shrink-0 rounded-full ${accent}`}
                      style={{ backgroundColor: "currentColor" }}
                    />
                    <div className="truncate text-sm font-semibold text-foreground">
                      {company.name}
                    </div>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="font-display text-[40px] font-bold leading-none tracking-[-0.04em] text-foreground">
                      {company.score}
                    </span>
                    <span className="text-[11px] text-muted-foreground">/ 100</span>
                  </div>
                </div>
                <span className="mt-0.5 shrink-0">
                  <ChangeNumber
                    value={company.weeklyChange}
                    unavailableLabel={dashboardData.comparisonUnavailableLabel}
                  />
                </span>
              </div>
              <div className="mt-4 flex items-end justify-between gap-3 border-t border-border/80 pt-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    WEEKLY VISIBILITY
                  </span>
                  <span className="truncate text-[11px] font-medium text-foreground">
                    {company.changeReason}
                  </span>
                </div>
                <div className="w-[72px] shrink-0">
                  <TrendSparkline values={company.trend} name={company.name} colorClass={accent} />
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.75fr)]">
        <article className="glass-surface min-w-0 rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="section-heading">Visibility score comparison</h2>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Weekly score points, not market or answer share
              </p>
            </div>
            <span className="rounded-md bg-muted px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground">
              {dashboardData.period}
            </span>
          </div>
          <div
            className="mt-5 flex h-3.5 w-full overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`Visibility scores: ${dashboardData.companies.map((company) => `${company.name} ${company.score} points`).join(", ")}`}
          >
            {dashboardData.companies.map((company) => (
              <div
                key={company.id}
                className={`company-chart-${company.id} h-full transition-[width] duration-500`}
                style={{
                  width: `${Math.min(company.score, 100)}%`,
                  backgroundColor: "currentColor",
                }}
              />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            {dashboardData.companies.map((company) => {
              const accent = accentClasses[company.id] ?? "company-marker-corvane";
              return (
                <div key={company.id} className="flex min-w-0 items-start gap-2">
                  <span
                    className={`mt-1 size-2.5 shrink-0 rounded-sm ${accent}`}
                    style={{ backgroundColor: "currentColor" }}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-semibold text-foreground">
                      {company.name}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {company.score.toFixed(1)} points
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 border-t border-border/80 pt-4">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.11em] text-muted-foreground">
              Week-over-week movement · {dashboardData.comparisonLabel}
            </div>
            <div className="space-y-3">
              {dashboardData.companies.map((company) => (
                <div key={company.id} className="flex items-center gap-2.5">
                  <span className="w-32 shrink-0 truncate text-[11px] font-medium text-foreground">
                    {company.name}
                  </span>
                  <div className="relative h-2 min-w-0 flex-1 rounded-full bg-muted">
                    {company.weeklyChange !== null && (
                      <div
                        className={`absolute top-0 h-2 rounded-full ${company.weeklyChange >= 0 ? "left-1/2 bg-positive" : "right-1/2 bg-negative"}`}
                        style={{ width: `${Math.max(Math.abs(company.weeklyChange) * 6, 2)}%` }}
                      />
                    )}
                    <span className="absolute left-1/2 top-[-2px] h-3 w-px bg-border" />
                  </div>
                  <div className="w-[190px] shrink-0 text-right">
                    <ChangeNumber
                      value={company.weeklyChange}
                      unavailableLabel={dashboardData.comparisonUnavailableLabel}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="glass-surface min-w-0 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="section-heading">Movement drivers</h2>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {dashboardData.driverPeriodLabel}
              </p>
            </div>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Activity aria-hidden="true" className="size-[18px]" />
            </span>
          </div>
          <div className="mt-4 space-y-0">
            {dashboardData.changes.slice(0, 6).map((change, index) => (
              <div
                key={`${change.company}-${change.title}`}
                className={`flex gap-3 py-3 ${index < dashboardData.changes.length - 1 ? "border-b border-border/70" : ""}`}
              >
                <span
                  className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-md ${change.direction === "up" ? "direction-positive" : "direction-negative"}`}
                >
                  {change.direction === "up" ? (
                    <ArrowUpRight aria-hidden="true" className="size-3.5" />
                  ) : (
                    <ArrowDownRight aria-hidden="true" className="size-3.5" />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground">{change.title}</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {change.detail}
                  </p>
                  <p className="mt-1 text-[10px] font-medium text-primary">{change.company}</p>
                </div>
              </div>
            ))}
            {dashboardData.changes.length === 0 && (
              <p className="py-4 text-xs text-muted-foreground">
                No comparable movement drivers are available for this week.
              </p>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="glass-surface min-w-0 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="section-heading">Wrong facts detected</h2>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Pipeline fact alerts across available weeks
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-negative/15 px-2 py-1 text-[10px] font-semibold text-negative">
              <CircleAlert aria-hidden="true" className="size-3" />
              {dashboardData.wrongFacts.length} flagged
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {dashboardData.wrongFacts.slice(0, 3).map((fact) => (
              <div
                key={fact.id}
                className="flex gap-3 rounded-lg border border-border/75 bg-card/70 p-3"
              >
                <span className="mt-0.5 h-auto w-[2px] shrink-0 rounded-full bg-negative" />
                <div className="min-w-0">
                  <p className="text-xs font-medium leading-relaxed text-foreground">
                    “{fact.claim}”
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                    <span className="font-semibold text-foreground">{fact.company}</span>
                    <span>·</span>
                    <span>
                      Week {fact.week ?? "?"} · {fact.engine}
                    </span>
                    <span>·</span>
                    <span>{fact.question}</span>
                  </div>
                </div>
              </div>
            ))}
            {dashboardData.wrongFacts.length === 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-border/75 bg-card/70 px-3 py-5 text-xs text-muted-foreground">
                <CheckCircle2 aria-hidden="true" className="size-4 text-positive" />
                No incorrect claims were flagged in this dataset.
              </div>
            )}
          </div>
        </article>

        <article className="glass-surface min-w-0 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="section-heading">Suggested actions</h2>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Practical next steps from this week’s signals
              </p>
            </div>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Sparkles aria-hidden="true" className="size-[18px]" />
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {dashboardData.suggestedActions.slice(0, 3).map((action) => (
              <div
                key={action.title}
                className="flex items-start gap-3 rounded-lg border border-border/75 bg-card/70 p-3"
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
                  {action.priority === "High" ? "1" : "2"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xs font-semibold text-foreground">{action.title}</h3>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${action.priority === "High" ? "direction-negative" : "bg-muted text-muted-foreground"}`}
                    >
                      {action.priority} priority
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {action.detail}
                  </p>
                  {action.evidence.length > 0 && (
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                      <span>Evidence:</span>
                      {action.evidence.map((responseId) => (
                        <Link
                          key={responseId}
                          to="/answer-explorer"
                          search={{ responseId }}
                          className="font-mono text-primary underline underline-offset-2 hover:text-primary/80"
                        >
                          {responseId}
                        </Link>
                      ))}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {dashboardData.suggestedActions.length === 0 && (
              <div className="rounded-lg border border-border/75 bg-card/70 px-3 py-5 text-xs text-muted-foreground">
                No evidence-linked actions were generated for this week.
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="glass-surface flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <FileSearch aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-foreground">
              Explore the original answers
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              Review original responses and all six company evaluations.
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <Link to="/answer-explorer">
            Open explorer
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </Button>
      </section>

      <footer className="flex items-center justify-between gap-3 px-1 text-[10px] text-muted-foreground">
        <span>Generated from the Python pipeline</span>
        <span className="hidden items-center gap-1.5 sm:inline-flex">
          <MoveRight aria-hidden="true" className="size-3" />
          Executive summary
        </span>
      </footer>
    </div>
  );
}
