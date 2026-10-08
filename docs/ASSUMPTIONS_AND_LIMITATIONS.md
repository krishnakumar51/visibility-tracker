# Assumptions and limitations

- The source pack is a finite panel of 15 prompts, three engines, and normally two runs per
  prompt/engine/week. It is small and does not represent every buyer, query, or answer variation.
- The original base contains 518 source records and 510 unique response IDs. Week 2 has eight
  duplicated ChatGPT rows/slots with identical content. They remain visible in source-line exports;
  coverage counts the slot once and scoring averages duplicate observations within a run.
- Week 5 is incomplete because all 30 Perplexity slots are absent. A week is called complete at
  95% or greater valid-slot coverage with at least one valid slot from each expected engine.
- The base contains three timeouts. Failed/unusable responses are preserved with status and excluded
  from scoring and fact checks. `mentions.csv` cannot encode unavailable, so those rows use its
  required false/blank placeholder; inspect JSON status before treating one as an observed absence.
- The manual validation is 15 randomly selected unique successful answers (90 answer-brand rows).
  Mention accuracy is 90/90, position is 37/37 reviewed mentions, and tone is 33/37. Four tone
  disagreements show that nearby recommendations and limiting/final-verdict language can confuse
  deterministic context rules. This sample is not proof of future accuracy.
- Tone labels and numeric score weights are product decisions implemented in code/configuration,
  not an external standard. The index measures this question/engine panel, not all buyer exposure,
  market share, or sales outcomes.
- Fact checks cover explicit contradictions supported by `facts.json` for Corvane Fleet. The
  current fact checker does not generate competitor fact alerts. Claims outside the supported
  facts are unverified, not wrong.
- Mention, position, tone, and fact rules can miss aliases, paraphrases, or context. Known input
  aliases are normalized, but a major new engine schema may require a normalization change and
  parser test. The upload API accepts a single week per file and rejects malformed/unknown-prompt
  records.
- The 518-response base is not overwritten by uploads. Each upload is additive and independently
  deactivatable. Deactivation removes it from recalculated dashboard data but retains the uploaded
  JSONL and generated run files for audit.
- The analysis has no paid AI API or local-model dependency. Collection of responses, scheduled
  collection, and multi-client orchestration are outside the implemented application.
- The tool is configured for one Corvane Fleet dataset. A 20-client service, authentication, source
  aggregation, and a board-report file are not implemented.
