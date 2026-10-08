import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import { apiUrl } from "@/lib/api";

export type Tone = "recommended" | "neutral" | "negative" | "not_recommended";
export type ResponseStatus = "success" | "failed" | "unusable";

export type PipelineSpan = { start: number; end: number; text: string };

export type CompanyEvaluation = {
  brand: string;
  company: string;
  mentioned: boolean | null;
  position: number | null;
  tone: Tone | null;
  spans: PipelineSpan[];
};

export type Answer = {
  rowId: string;
  id: string;
  week: number;
  engine: string;
  question: string;
  promptId: string;
  stage: string;
  priority: number | null;
  status: ResponseStatus;
  statusDetail: string;
  featuredEvaluation: CompanyEvaluation | null;
  response: string;
  citations: string[];
  evaluations: CompanyEvaluation[];
};

export type AnswerFilters = {
  week: string;
  engine: string;
  question: string;
  company: string;
  tone: string;
};

export function tableCompanyEvaluation(
  answer: Answer,
  selectedCompany: string,
  selectedTone = "all",
): CompanyEvaluation | null {
  if (selectedCompany === "all") {
    if (selectedTone === "all") return answer.featuredEvaluation;
    return (
      answer.evaluations
        .filter((evaluation) => evaluation.mentioned === true && evaluation.tone === selectedTone)
        .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity))[0] ?? null
    );
  }
  return (
    answer.evaluations.find(
      (evaluation) => evaluation.company === selectedCompany && evaluation.mentioned === true,
    ) ?? null
  );
}

export type Company = {
  id: string;
  name: string;
  score: number;
  weeklyChange: number | null;
  trend: number[];
  changeReason: string;
};

export type DashboardChange = {
  title: string;
  detail: string;
  company: string;
  direction: "up" | "down";
};

export type SuggestedAction = {
  title: string;
  detail: string;
  priority: "High" | "Medium" | "Low";
  evidence: string[];
};

export type WrongFact = {
  id: string;
  claim: string;
  factKey: string;
  responseId: string;
  week: number | null;
  engine: string;
  question: string;
  company: string;
};

export type WeeklyCoverage = {
  week: number;
  status: string;
  coverage: number;
  validSlots: number;
  expectedSlots: number;
  failedResponses: number;
  missingEngines: string[];
};

export type DashboardDataset = {
  period: string;
  coverage: WeeklyCoverage;
  partialWeeks: WeeklyCoverage[];
  coverageHistory: WeeklyCoverage[];
  comparisonLabel: string;
  comparisonUnavailableLabel: string;
  driverPeriodLabel: string;
  companies: Company[];
  changes: DashboardChange[];
  wrongFacts: WrongFact[];
  suggestedActions: SuggestedAction[];
  answers: Answer[];
};

type RawBrand = { brand: string; name: string; role: string };
type RawEvaluation = {
  brand: string;
  mentioned: boolean;
  position: number | null;
  tone: Tone | null;
  mention_evidence?: { start: number; end: number; matched_text: string }[];
};
type RawResponse = {
  response_id: string;
  week: number;
  engine: string;
  prompt_id: string;
  prompt: { question: string; stage?: string; priority?: number } | null;
  run: number | null;
  source_line: number;
  status: ResponseStatus;
  source_error?: string | null;
  issues?: string[];
  answer_text: string;
  citations: string[];
  evaluations: RawEvaluation[];
};
type RawScoreWeek = {
  week: number;
  score_status: string;
  coverage: number;
  valid_run_slots: number;
  expected_run_slots: number;
  failed_responses: number;
  engine_coverage: Record<string, { coverage: number }>;
  brands: Record<string, { score: number }>;
};
type RawDriver = {
  engine: string;
  prompt_id: string;
  previous_value: number;
  current_value: number;
  weighted_direction: "gain" | "loss";
  current_response_ids?: string[];
};
type RawComparisonBrand = { drivers?: RawDriver[]; change_points?: number | null };
type RawComparison = {
  week: number;
  compared_to_week: number | null;
  status: string;
  brands: Record<string, RawComparisonBrand>;
  gap_comparison?: RawComparison;
};
type RawWrongFact = { response_id: string; brand: string; fact_key: string; claim_text: string };
export type PipelineDashboardData = {
  meta: { status_counts?: Record<string, number> };
  brands: RawBrand[];
  scores: RawScoreWeek[];
  week_over_week: RawComparison[];
  wrong_facts: RawWrongFact[];
  responses: RawResponse[];
};

const TONE_LABELS: Record<Tone, string> = {
  recommended: "Recommended",
  neutral: "Neutral",
  negative: "Negative",
  not_recommended: "Not recommended",
};

export function toneLabel(tone: Tone): string {
  return TONE_LABELS[tone];
}

export function toneClass(tone: Tone): string {
  if (tone === "recommended") return "tone-positive";
  if (tone === "neutral") return "tone-neutral";
  return "tone-negative";
}

function engineLabel(engine: string): string {
  const labels: Record<string, string> = {
    chatgpt: "ChatGPT",
    perplexity: "Perplexity",
    google_ai_overview: "Google AI Overviews",
  };
  return labels[engine] ?? engine;
}

function assertPipelineData(value: unknown): asserts value is PipelineDashboardData {
  if (!value || typeof value !== "object") throw new Error("Pipeline data must be a JSON object.");
  const data = value as Record<string, unknown>;
  for (const key of ["meta", "brands", "scores", "week_over_week", "wrong_facts", "responses"]) {
    if (!(key in data)) throw new Error(`Pipeline data is missing the '${key}' field.`);
  }
  if (
    !Array.isArray(data["brands"]) ||
    !Array.isArray(data["scores"]) ||
    !Array.isArray(data["week_over_week"]) ||
    !Array.isArray(data["wrong_facts"]) ||
    !Array.isArray(data["responses"])
  ) {
    throw new Error("Pipeline data has an invalid dashboard schema.");
  }
}

export function mapPipelineData(value: unknown): DashboardDataset {
  assertPipelineData(value);
  const data = value;
  const brands = data.brands.filter((brand) => brand.role !== "other_company");
  const brandNames = new Map(data.brands.map((brand) => [brand.brand, brand.name]));
  const weeks = [...data.scores].sort((a, b) => a.week - b.week);
  const latest = weeks.at(-1);
  if (!latest) throw new Error("Pipeline data contains no weekly scores.");
  const comparisons = [...data.week_over_week].sort((a, b) => a.week - b.week);
  const latestComparison = comparisons.at(-1);
  const comparable = latestComparison?.status === "comparable" ? latestComparison : null;
  const driverComparison = comparable ?? latestComparison?.gap_comparison ?? null;
  const responseById = new Map(data.responses.map((response) => [response.response_id, response]));
  const prompts = new Map(
    data.responses
      .filter((response) => response.prompt)
      .map((response) => [response.prompt_id, response.prompt!]),
  );

  const coverageHistory: WeeklyCoverage[] = weeks.map((week) => {
    const missingEngines = Object.entries(week.engine_coverage)
      .filter(([, engine]) => engine.coverage < 1)
      .map(([engine]) => engineLabel(engine));
    return {
      week: week.week,
      status: week.score_status,
      coverage: week.coverage,
      validSlots: week.valid_run_slots,
      expectedSlots: week.expected_run_slots,
      failedResponses: week.failed_responses,
      missingEngines,
    };
  });
  const coverage = coverageHistory.at(-1)!;
  const partialWeeks = coverageHistory.filter((week) => week.status !== "complete");
  const comparisonLabel =
    latestComparison?.status === "comparable"
      ? `Week ${latestComparison.week} compared with Week ${latestComparison.compared_to_week}.`
      : latestComparison?.status === "not_comparable_previous_week_incomplete"
        ? `WoW unavailable — Week ${latestComparison.compared_to_week} incomplete. Last comparable week: Week ${latestComparison.gap_comparison?.compared_to_week ?? "unknown"}.`
        : "No comparable previous week is available.";
  const comparisonUnavailableLabel =
    latestComparison?.status === "not_comparable_previous_week_incomplete"
      ? `WoW unavailable — Week ${latestComparison.compared_to_week} incomplete`
      : "WoW unavailable";
  const driverPeriodLabel = comparable
    ? `Week ${comparable.week} vs Week ${comparable.compared_to_week}`
    : driverComparison
      ? `Gap comparison: Week ${driverComparison.week} vs Week ${driverComparison.compared_to_week} (not week-over-week)`
      : "No comparable movement drivers available";

  const companies: Company[] = brands.map((brand) => {
    const weeklyChange = comparable?.brands[brand.brand]?.change_points ?? null;
    const driverCount = driverComparison?.brands[brand.brand]?.drivers?.length ?? 0;
    return {
      id: brand.brand,
      name: brand.name,
      score: latest.brands[brand.brand]?.score ?? 0,
      weeklyChange,
      trend: weeks.map((week) => week.brands[brand.brand]?.score ?? 0),
      changeReason: comparable
        ? `${driverCount} prompt-engine drivers in this week-over-week comparison.`
        : `Week ${latest.week} has no week-over-week comparison to the incomplete prior week.`,
    };
  });

  const changes: DashboardChange[] = [];
  if (driverComparison) {
    for (const brand of brands) {
      const brandChange = driverComparison.brands[brand.brand];
      for (const driver of (brandChange?.drivers ?? []).slice(0, 2)) {
        const prompt = prompts.get(driver.prompt_id);
        const question = prompt?.question ?? driver.prompt_id;
        changes.push({
          title: `${engineLabel(driver.engine)} · ${question}`,
          detail: `Visibility value: ${driver.previous_value.toFixed(1)} → ${driver.current_value.toFixed(1)} points. ${driverPeriodLabel}.`,
          company: brand.name,
          direction: driver.weighted_direction === "gain" ? "up" : "down",
        });
      }
    }
  }

  const wrongFacts: WrongFact[] = data.wrong_facts
    .map((fact, index) => {
      const response = responseById.get(fact.response_id);
      return {
        id: `${fact.response_id}-${fact.brand}-${fact.fact_key}-${index}`,
        claim: fact.claim_text,
        factKey: fact.fact_key,
        responseId: fact.response_id,
        week: response?.week ?? null,
        engine: response ? engineLabel(response.engine) : "Unknown engine",
        question: response?.prompt?.question ?? response?.prompt_id ?? "Unknown prompt",
        company: brandNames.get(fact.brand) ?? fact.brand,
      };
    })
    .sort((a, b) => (b.week ?? 0) - (a.week ?? 0));

  const answers: Answer[] = data.responses.map((response) => {
    const isAvailable = response.status === "success";
    const evaluations: CompanyEvaluation[] = data.brands.map((brand) => {
      const evaluation = response.evaluations.find((item) => item.brand === brand.brand);
      const spans = (evaluation?.mention_evidence ?? []).map((span) => ({
        start: span.start,
        end: span.end,
        text: span.matched_text,
      }));
      return {
        brand: brand.brand,
        company: brand.name,
        mentioned: isAvailable ? (evaluation?.mentioned ?? false) : null,
        position: isAvailable ? (evaluation?.position ?? null) : null,
        tone: isAvailable ? (evaluation?.tone ?? null) : null,
        spans,
      };
    });
    const featuredEvaluation =
      evaluations
        .filter((evaluation) => evaluation.mentioned)
        .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity))[0] ?? null;
    const detail = response.source_error || response.issues?.join(", ") || "";
    return {
      rowId: `${response.response_id}-${response.week}-${response.engine}-${response.prompt_id}-${response.run ?? "x"}-${response.source_line}`,
      id: response.response_id,
      week: response.week,
      engine: engineLabel(response.engine),
      question: response.prompt?.question ?? response.prompt_id,
      promptId: response.prompt_id,
      stage: response.prompt?.stage ?? "unknown",
      priority: response.prompt?.priority ?? null,
      status: response.status,
      statusDetail: detail,
      featuredEvaluation,
      response: response.answer_text,
      citations: response.citations ?? [],
      evaluations,
    };
  });

  const suggestedActions: SuggestedAction[] = [];
  const latestFact = wrongFacts.find((fact) => fact.week === latest.week);
  if (latestFact) {
    suggestedActions.push({
      title: `Validate a flagged ${latestFact.company} fact`,
      detail: `Review the claim against approved product facts before correcting source content: “${latestFact.claim}”`,
      priority: "High",
      evidence: [latestFact.responseId],
    });
  }

  const corvaneDrivers = driverComparison?.brands["corvane"]?.drivers ?? [];
  const highPriorityGap = corvaneDrivers.find((driver) => {
    const prompt = prompts.get(driver.prompt_id);
    return prompt?.priority === 3 && driver.current_value === 0;
  });
  if (highPriorityGap) {
    const prompt = prompts.get(highPriorityGap.prompt_id);
    suggestedActions.push({
      title: "Review coverage for a priority question",
      detail: `The ${engineLabel(highPriorityGap.engine)} driver for “${prompt?.question ?? highPriorityGap.prompt_id}” has a visibility value of ${highPriorityGap.current_value.toFixed(1)}. Check whether approved content clearly addresses this question.`,
      priority: "High",
      evidence: highPriorityGap.current_response_ids ?? [],
    });
  }

  const negativeCorvaneAnswers = answers.filter(
    (answer) =>
      answer.week === latest.week &&
      answer.status === "success" &&
      answer.evaluations.some(
        (evaluation) =>
          evaluation.brand === "corvane" &&
          (evaluation.tone === "negative" || evaluation.tone === "not_recommended"),
      ),
  );
  if (negativeCorvaneAnswers.length > 0) {
    const examples = negativeCorvaneAnswers.slice(0, 3);
    suggestedActions.push({
      title: "Investigate negative Corvane descriptions",
      detail: `${negativeCorvaneAnswers.length} Week ${latest.week} responses classify Corvane as negative or not recommended. Review the answer context and determine whether supported product information needs clarification.`,
      priority: "Medium",
      evidence: examples.map((answer) => answer.id),
    });
  }

  return {
    period: `Week ${latest.week}`,
    coverage,
    partialWeeks,
    coverageHistory,
    comparisonLabel,
    comparisonUnavailableLabel,
    driverPeriodLabel,
    companies,
    changes,
    wrongFacts,
    suggestedActions,
    answers,
  };
}

export const answerFilterOptions = (data: DashboardDataset) => ({
  week: [...new Set(data.answers.map((answer) => String(answer.week)))],
  engine: [...new Set(data.answers.map((answer) => answer.engine))],
  question: [...new Set(data.answers.map((answer) => answer.question))],
  company: [
    ...new Set(data.answers.flatMap((answer) => answer.evaluations.map((item) => item.company))),
  ],
  tone: Object.keys(TONE_LABELS),
});

export function filterAnswers(answers: Answer[], filters: AnswerFilters): Answer[] {
  return answers.filter((answer) => {
    if (filters.week !== "all" && String(answer.week) !== filters.week) return false;
    if (filters.engine !== "all" && answer.engine !== filters.engine) return false;
    if (filters.question !== "all" && answer.question !== filters.question) return false;
    if (
      filters.company !== "all" &&
      !answer.evaluations.some((item) => item.company === filters.company && item.mentioned)
    )
      return false;
    if (
      filters.tone !== "all" &&
      !answer.evaluations.some(
        (item) =>
          item.tone === filters.tone &&
          (filters.company === "all" || item.company === filters.company),
      )
    )
      return false;
    return true;
  });
}

type DashboardState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: DashboardDataset };

type DashboardContextValue = DashboardState & { refresh: () => Promise<void> };

const DashboardContext = createContext<DashboardContextValue>({
  status: "loading",
  refresh: async () => {},
});

export async function loadDashboardData(fetcher: typeof fetch = fetch): Promise<DashboardDataset> {
  const response = await fetcher(apiUrl("/dashboard_data.json"), { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load dashboard_data.json (${response.status}).`);
  return mapPipelineData(await response.json());
}

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DashboardState>({ status: "loading" });
  const activeRequest = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setState({ status: "loading" });
    try {
      const data = await loadDashboardData((input, init) =>
        fetch(input, { ...init, signal: controller.signal }),
      );
      if (!controller.signal.aborted) setState({ status: "ready", data });
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        setState({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => activeRequest.current?.abort();
  }, [refresh]);

  return createElement(DashboardContext.Provider, { value: { ...state, refresh } }, children);
}

export function useDashboardData(): DashboardContextValue {
  return useContext(DashboardContext);
}
