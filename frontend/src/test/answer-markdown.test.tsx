import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { AnswerMarkdown } from "@/components/answer-markdown";

describe("AnswerMarkdown", () => {
  it("renders common answer Markdown as formatted, safe React elements", () => {
    render(
      <AnswerMarkdown
        text={[
          "**Driver safety matters most**",
          "",
          "*Compare the options carefully.*",
          "",
          "- First bullet",
          "- Second bullet",
          "",
          "1. First step",
          "2. Second step",
          "",
          "First line",
          "Second line",
          "",
          "[Vendor guide](https://example.com/guide) https://example.com/docs",
          "",
          "<script>alert('xss')</script>",
        ].join("\n")}
      />,
    );

    expect(screen.getByText("Driver safety matters most").tagName).toBe("STRONG");
    expect(screen.getByText("Compare the options carefully.").tagName).toBe("EM");
    expect(screen.getByText("First bullet").closest("ul")).not.toBeNull();
    expect(screen.getByText("First step").closest("ol")).not.toBeNull();
    expect(screen.getByText("First line").closest("p")?.querySelector("br")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Vendor guide" })).toHaveAttribute(
      "href",
      "https://example.com/guide",
    );
    expect(screen.getByRole("link", { name: "https://example.com/docs" })).toHaveAttribute(
      "href",
      "https://example.com/docs",
    );
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByText("<script>alert('xss')</script>")).toBeInTheDocument();
    expect(screen.queryByText(/\*\*Driver safety/)).toBeNull();
  });

  it("continues to render plain text without interpreting it as markup", () => {
    render(<AnswerMarkdown text="Plain text answer with normal words." />);
    expect(screen.getByText("Plain text answer with normal words.")).toBeInTheDocument();
  });

  it("formats an original answer from the current pipeline data", () => {
    const dashboard = JSON.parse(
      readFileSync(resolve(process.cwd(), "../outputs/dashboard_data.json"), "utf8"),
    ) as { responses: { answer_text: string }[] };
    const originalAnswer = dashboard.responses.find((response) => /\*\*[^*]+\*\*/.test(response.answer_text));
    expect(originalAnswer).toBeDefined();

    render(<AnswerMarkdown text={originalAnswer!.answer_text} />);
    expect(document.querySelector("strong, ul, ol")).not.toBeNull();
    expect(screen.queryByText(/\*\*[^*]+\*\*/)).toBeNull();
  });
});
