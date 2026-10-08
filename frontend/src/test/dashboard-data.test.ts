import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  answerFilterOptions,
  filterAnswers,
  loadDashboardData,
  mapPipelineData,
  tableCompanyEvaluation,
  type AnswerFilters,
  type PipelineDashboardData,
} from "@/lib/dashboard-data";

const raw = JSON.parse(
  readFileSync(resolve(process.cwd(), "../outputs/dashboard_data.json"), "utf8"),
) as PipelineDashboardData;
const data = mapPipelineData(raw);
const noFilters: AnswerFilters = {
  week: "all",
  engine: "all",
  question: "all",
  company: "all",
  tone: "all",
};

describe("real pipeline dashboard adapter", () => {
  it("maps latest weekly scores and the separate partial-week gap comparison", () => {
    const latest = raw.scores.at(-1)!;
    expect(data.period).toBe(`Week ${latest.week}`);
    expect(data.companies.map((company) => company.name)).toEqual([
      "Corvane Fleet",
      "Trakvia",
      "Routelyne",
      "Gridwell Systems",
    ]);
    expect(data.companies[0]?.score).toBe(latest.brands["corvane"]?.score);
    expect(data.comparisonLabel.length).toBeGreaterThan(0);
    expect(data.comparisonUnavailableLabel).toContain("WoW unavailable");
    expect(data.companies[0]?.trend).toHaveLength(raw.scores.length);
  });

  it("maps coverage and identifies the partial week and absent engine", () => {
    const latest = raw.scores.at(-1)!;
    expect(data.coverage).toMatchObject({
      week: latest.week,
      status: latest.score_status,
      validSlots: latest.valid_run_slots,
      expectedSlots: latest.expected_run_slots,
    });
    expect(data.partialWeeks.map((week) => week.week)).toEqual(
      raw.scores.filter((week) => week.score_status !== "complete").map((week) => week.week),
    );
  });

  it("keeps all real response records, explicit failures, six evaluations, and original positions/spans", () => {
    expect(data.answers).toHaveLength(raw.responses.length);
    expect(data.answers.filter((answer) => answer.status !== "success")).toHaveLength(
      raw.responses.filter((response) => response.status !== "success").length,
    );
    expect(data.answers.every((answer) => answer.evaluations.length === 6)).toBe(true);
    const failed = data.answers.find((answer) => answer.status !== "success");
    expect(failed?.evaluations.every((evaluation) => evaluation.mentioned === null)).toBe(true);
    expect(failed?.response).toBe("");
    const positioned = data.answers.find((answer) => answer.featuredEvaluation?.position != null);
    expect(Number.isInteger(positioned?.featuredEvaluation?.position)).toBe(true);
    expect(positioned?.evaluations.some((evaluation) => evaluation.spans.length > 0)).toBe(true);
  });

  it("supports every canonical tone, including not_recommended", () => {
    const tones = new Set(
      data.answers.flatMap((answer) =>
        answer.evaluations.map((evaluation) => evaluation.tone).filter(Boolean),
      ),
    );
    expect(tones).toEqual(new Set(["recommended", "neutral", "negative", "not_recommended"]));
    expect(answerFilterOptions(data).tone).toContain("not_recommended");
  });

  it("derives deterministic actions with response evidence", () => {
    expect(data.suggestedActions.every((action) => action.evidence.length > 0)).toBe(true);
    for (const action of data.suggestedActions) {
      expect(action.evidence.every((id) => data.answers.some((answer) => answer.id === id))).toBe(
        true,
      );
    }
  });

  it("shows first-mentioned evaluation by default and selected company's result when filtered", () => {
    const answer = data.answers.find(
      (item) =>
        item.status === "success" &&
        item.featuredEvaluation?.brand !== "corvane" &&
        item.evaluations.some(
          (evaluation) => evaluation.brand === "corvane" && evaluation.mentioned,
        ),
    );
    expect(answer).toBeDefined();
    expect(tableCompanyEvaluation(answer!, "all")).toBe(answer!.featuredEvaluation);
    expect(tableCompanyEvaluation(answer!, "Corvane Fleet")?.brand).toBe("corvane");
  });

  it("filters real answers by week, engine, prompt, company, and tone", () => {
    const answer = data.answers.find(
      (item) =>
        item.status === "success" &&
        item.evaluations.some(
          (evaluation) =>
            evaluation.company === "Corvane Fleet" && evaluation.tone === "recommended",
        ),
    );
    expect(answer).toBeDefined();
    const filters = {
      ...noFilters,
      week: String(answer!.week),
      engine: answer!.engine,
      question: answer!.question,
      company: "Corvane Fleet",
      tone: "recommended",
    };
    expect(filterAnswers(data.answers, filters).map((item) => item.rowId)).toContain(answer!.rowId);
  });

  it("loads only the dashboard JSON through the static data URL", async () => {
    const fetcher = async (input: RequestInfo | URL) => {
      expect(input).toBe("/dashboard_data.json");
      return { ok: true, json: async () => raw } as Response;
    };
    const loaded = await loadDashboardData(fetcher);
    expect(loaded.answers).toHaveLength(raw.responses.length);
  });
});
