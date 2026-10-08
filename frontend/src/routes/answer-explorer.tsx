import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowDown,
  ArrowDownUp,
  ArrowRight,
  Database,
  ListFilter,
  MessageSquareText,
  RotateCcw,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AnswerMarkdown } from "@/components/answer-markdown";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  answerFilterOptions,
  filterAnswers,
  tableCompanyEvaluation,
  toneClass,
  toneLabel,
  useDashboardData,
  type Answer,
  type AnswerFilters,
  type CompanyEvaluation,
} from "@/lib/dashboard-data";

export const Route = createFileRoute("/answer-explorer")({
  validateSearch: (search: Record<string, unknown>) =>
    typeof search["responseId"] === "string"
      ? { responseId: search["responseId"] }
      : {},
  component: AnswerExplorerPage,
});

const filterLabels: { key: keyof AnswerFilters; label: string; defaultLabel: string }[] = [
  { key: "week", label: "Week", defaultLabel: "All weeks" },
  { key: "engine", label: "Engine", defaultLabel: "All engines" },
  { key: "question", label: "Question", defaultLabel: "All questions" },
  { key: "company", label: "Company", defaultLabel: "All companies" },
  { key: "tone", label: "Tone", defaultLabel: "All tones" },
];

const EMPTY_FILTERS: AnswerFilters = {
  week: "all",
  engine: "all",
  question: "all",
  company: "all",
  tone: "all",
};

function DataMessage({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="glass-surface rounded-2xl p-6" role="status">
      <h1 className="text-sm font-semibold text-foreground">{title}</h1>
      {detail && <p className="mt-2 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function companyClass(brand: string): string {
  return `company-name-${brand}`;
}

function AnswerExplorerPage() {
  const state = useDashboardData();
  const routeSearch = Route.useSearch();
  const [filters, setFilters] = useState<AnswerFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<Answer | null>(null);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    if (state.status !== "ready" || !routeSearch.responseId) return;
    const response = state.data.answers.find((answer) => answer.id === routeSearch.responseId);
    if (response) {
      setSearchText(routeSearch.responseId);
      setSelected(response);
    }
  }, [routeSearch.responseId, state]);

  if (state.status === "loading") return <DataMessage title="Loading pipeline responses…" />;
  if (state.status === "error")
    return <DataMessage title="Pipeline data could not be loaded" detail={state.message} />;
  const dashboardData = state.data;
  const options = answerFilterOptions(dashboardData);

  const filteredAnswers = filterAnswers(dashboardData.answers, filters);
  const query = searchText.trim().toLowerCase();
  const visibleAnswers = query
    ? filteredAnswers.filter((answer) => {
        const evaluations = answer.evaluations
          .map(
            (evaluation) =>
              `${evaluation.company} ${evaluation.tone ?? ""} ${evaluation.position ?? ""}`,
          )
          .join(" ");
        return `${answer.id} ${answer.week} ${answer.engine} ${answer.question} ${answer.promptId} ${answer.status} ${evaluations} ${answer.response}`
          .toLowerCase()
          .includes(query);
      })
    : filteredAnswers;

  const activeFilterCount = Object.values(filters).filter((value) => value !== "all").length;
  const failedCount = dashboardData.answers.filter((answer) => answer.status !== "success").length;
  const setFilter = (key: keyof AnswerFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setSelected(null);
  };
  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearchText("");
    setSelected(null);
  };

  return (
    <div className="space-y-5 pb-8 sm:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 px-1 pb-1 pt-1 sm:gap-6">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary sm:text-[11px]">
            Fleet analytics <span className="px-1 text-border">/</span> Answer Explorer
          </div>
          <h1 className="mt-2 font-display text-[30px] font-bold leading-tight tracking-[-0.04em] text-foreground sm:text-[38px]">
            Answer Explorer
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Inspect the original pipeline responses and all six company evaluations.
          </p>
        </div>
        <div className="inline-flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs shadow-sm">
          <Database aria-hidden="true" className="size-4 shrink-0 text-primary" />
          <span className="font-semibold text-foreground">
            {dashboardData.answers.length} raw records
          </span>
          <span className="h-4 w-px bg-border" />
          <span className="text-muted-foreground">{failedCount} failed or unavailable</span>
        </div>
      </header>

      <section aria-label="Answer filters" className="glass-surface rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <ListFilter aria-hidden="true" className="size-4" />
            </span>
            <h2 className="section-heading">Filter answers</h2>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                {activeFilterCount} active
              </span>
            )}
          </div>
          {(activeFilterCount > 0 || searchText) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-7 px-2 text-[10px] text-muted-foreground"
            >
              <RotateCcw aria-hidden="true" className="size-3" /> Clear all
            </Button>
          )}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {filterLabels.map(({ key, label, defaultLabel }) => (
            <label key={key} className="block min-w-0">
              <span className="mb-2 block text-[11px] font-semibold text-foreground">{label}</span>
              <span className="relative block">
                <select
                  aria-label={label}
                  value={filters[key]}
                  onChange={(event) => setFilter(key, event.currentTarget.value)}
                  className="workspace-select h-10 w-full cursor-pointer appearance-none rounded-lg border border-input px-3 pr-8 text-xs text-foreground outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="all">{defaultLabel}</option>
                  {options[key].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <ArrowDown
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 size-3 -translate-y-1/2 text-muted-foreground"
                />
              </span>
            </label>
          ))}
        </div>
        <label className="relative mt-4 block w-full">
          <Search
            aria-hidden="true"
            className="absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.currentTarget.value)}
            placeholder="Search response ID, question, company, or answer text"
            aria-label="Search AI answers"
            className="workspace-search h-10 w-full rounded-lg border border-input pl-10 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
          />
        </label>
      </section>

      <section className="glass-surface overflow-hidden rounded-2xl" aria-label="AI answers">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <MessageSquareText aria-hidden="true" className="size-4" />
            </span>
            <div>
              <h2 className="section-heading">Pipeline responses</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Select a response to inspect all company evaluations
              </p>
            </div>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
            Showing {visibleAnswers.length} of {dashboardData.answers.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <div role="table" aria-label="Filtered AI answers" className="min-w-[860px]">
            <div
              role="row"
              className="answer-grid-row answer-grid-header bg-muted/60 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
            >
              <span role="columnheader">Response ID</span>
              <span role="columnheader">Week · engine</span>
              <span role="columnheader">Question</span>
              <span role="columnheader">
                {filters.company !== "all"
                  ? "Selected company / first mention"
                  : filters.tone !== "all"
                    ? "Matching company / first mention"
                    : "First company"}
              </span>
              <span role="columnheader">Position</span>
              <span role="columnheader">Tone / status</span>
            </div>
            {visibleAnswers.map((answer) => {
              const featured = answer.featuredEvaluation;
              const displayedEvaluation = tableCompanyEvaluation(
                answer,
                filters.company,
                filters.tone,
              );
              return (
                <button
                  type="button"
                  key={answer.rowId}
                  role="row"
                  onClick={() => setSelected(answer)}
                  aria-haspopup="dialog"
                  aria-label={`Open response ${answer.id}: ${answer.question}`}
                  className="answer-grid-row cursor-pointer text-left outline-none transition-colors hover:bg-primary/5 active:bg-primary/10 focus-visible:bg-primary/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span
                    role="cell"
                    className="font-mono text-[10px] font-semibold text-muted-foreground"
                  >
                    {answer.id}
                  </span>
                  <span role="cell" className="min-w-0">
                    <span className="block truncate text-[11px] font-semibold text-foreground">
                      Week {answer.week}
                    </span>
                    <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                      {answer.engine}
                    </span>
                  </span>
                  <span role="cell" className="min-w-0">
                    <span className="block truncate text-xs font-medium text-foreground">
                      {answer.question}
                    </span>
                  </span>
                  <span
                    role="cell"
                    className={`w-fit max-w-full truncate rounded-md border px-2 py-1.5 text-[10px] font-semibold ${displayedEvaluation ? companyClass(displayedEvaluation.brand) : "border-border text-muted-foreground"}`}
                  >
                    {answer.status !== "success"
                      ? answer.status
                      : (displayedEvaluation?.company ?? "No mention")}
                    {filters.company !== "all" &&
                      featured &&
                      displayedEvaluation &&
                      (filters.company !== "all" || filters.tone !== "all") &&
                      featured.brand !== displayedEvaluation.brand && (
                        <span className="ml-1 block truncate font-normal text-muted-foreground">
                          First: {featured.company} ({featured.position})
                        </span>
                      )}
                  </span>
                  <span
                    role="cell"
                    className="whitespace-nowrap text-[11px] font-semibold text-foreground"
                  >
                    {displayedEvaluation?.position ?? "—"}
                  </span>
                  <span role="cell">
                    {answer.status !== "success" ? (
                      <span className="rounded-full bg-negative/15 px-2.5 py-1 text-[10px] font-semibold text-negative">
                        Unavailable
                      </span>
                    ) : displayedEvaluation?.tone ? (
                      <span
                        className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold ${toneClass(displayedEvaluation.tone)}`}
                      >
                        {toneLabel(displayedEvaluation.tone)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </span>
                </button>
              );
            })}
            {visibleAnswers.length === 0 && (
              <div className="grid min-h-40 place-items-center p-6 text-center" role="status">
                <div>
                  <Search aria-hidden="true" className="mx-auto size-5 text-muted-foreground" />
                  <p className="mt-3 text-sm font-semibold text-foreground">No matching answers</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try changing or clearing a filter.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    className="mt-3"
                  >
                    Clear filters
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-[10px] text-muted-foreground sm:px-5">
          <span>Failed responses are shown as unavailable, not as non-mentions.</span>
          <span className="inline-flex items-center gap-1 font-medium">
            Select a row <ArrowRight aria-hidden="true" className="size-3" />
          </span>
        </div>
      </section>

      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-[min(560px,calc(100vw-1rem))] overflow-y-auto border-l border-border bg-background p-0 sm:max-w-[560px]"
        >
          {selected && <AnswerDetails answer={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AnswerDetails({ answer }: { answer: Answer }) {
  const featured = answer.featuredEvaluation;
  return (
    <div>
      <div className="border-b border-border bg-card/75 px-5 pb-5 pt-6 sm:px-7">
        <SheetHeader className="pr-8 text-left">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-muted-foreground">
            <span className="rounded bg-muted px-2 py-1">{answer.id}</span>
            <span>Week {answer.week}</span>
            <span aria-hidden="true">·</span>
            <span>{answer.engine}</span>
            <span
              className={`rounded px-2 py-1 ${answer.status === "success" ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative"}`}
            >
              {answer.status}
            </span>
          </div>
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
            Response details · original answer and six evaluations
          </p>
          <SheetTitle className="mt-3 font-display text-xl font-bold leading-snug text-foreground">
            {answer.question}
          </SheetTitle>
          <SheetDescription className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>
              First company:{" "}
              <strong className="font-semibold text-foreground">
                {featured?.company ??
                  (answer.status === "success" ? "None detected" : "Unavailable")}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Position:{" "}
              <strong className="font-semibold text-foreground">{featured?.position ?? "—"}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Tone:{" "}
              <strong className="font-semibold text-foreground">
                {featured?.tone ? toneLabel(featured.tone) : "—"}
              </strong>
            </span>
          </SheetDescription>
        </SheetHeader>
      </div>
      <div className="space-y-6 px-5 py-5 sm:px-7 sm:py-6">
        {answer.status !== "success" && (
          <div
            className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs"
            role="status"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>
              This response is {answer.status} and is not evaluated as an observed non-mention.{" "}
              {answer.statusDetail}
            </span>
          </div>
        )}
        <section>
          <div className="flex items-center gap-2">
            <MessageSquareText aria-hidden="true" className="size-4 text-primary" />
            <h3 className="text-xs font-semibold text-foreground">Original AI answer</h3>
          </div>
          <div className="mt-3 rounded-lg border border-border bg-card p-4 text-foreground">
            <AnswerMarkdown text={answer.response || "No answer text was returned."} />
          </div>
          {answer.citations.length > 0 && (
            <div className="mt-3 space-y-1 text-[10px] text-muted-foreground">
              <p className="font-semibold">Sources</p>
              {answer.citations.map((citation) => (
                <a
                  className="block truncate text-primary underline"
                  href={citation}
                  target="_blank"
                  rel="noreferrer"
                  key={citation}
                >
                  {citation}
                </a>
              ))}
            </div>
          )}
        </section>
        <section>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ArrowDownUp aria-hidden="true" className="size-4 text-primary" />
              <h3 className="text-xs font-semibold text-foreground">Company evaluations</h3>
            </div>
            <span className="text-[10px] text-muted-foreground">
              All {answer.evaluations.length} configured brands
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {answer.evaluations.map((evaluation) => (
              <EvaluationRow
                key={evaluation.brand}
                evaluation={evaluation}
                status={answer.status}
              />
            ))}
          </div>
        </section>
        <div className="flex items-start gap-2.5 rounded-lg bg-muted/80 p-3">
          <Search aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Mention spans are taken from the pipeline evaluation. Failed responses retain
            unavailable status rather than being counted as absent brands.
          </p>
        </div>
      </div>
    </div>
  );
}

function EvaluationRow({ evaluation, status }: { evaluation: CompanyEvaluation; status: string }) {
  const isUnavailable = status !== "success";
  return (
    <div className="rounded-lg border border-border/80 bg-card/75 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded border px-1.5 py-1 text-[10px] font-semibold ${companyClass(evaluation.brand)}`}
        >
          {evaluation.company}
        </span>
        <span className="text-[10px] font-medium text-muted-foreground">
          {isUnavailable ? "Unavailable" : evaluation.mentioned ? "Mentioned" : "Not mentioned"}
        </span>
        {evaluation.position !== null && (
          <span className="text-[10px] text-muted-foreground">Position {evaluation.position}</span>
        )}
        {evaluation.tone && (
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${toneClass(evaluation.tone)}`}
          >
            {toneLabel(evaluation.tone)}
          </span>
        )}
      </div>
      {evaluation.spans.length > 0 && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Matched text: {evaluation.spans.map((span) => `“${span.text}”`).join(", ")}
        </p>
      )}
    </div>
  );
}
