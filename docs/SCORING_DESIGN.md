# Scoring design

## What the score needs to do

The brief asks for one score for Corvane and the three tracked competitors, understandable in plain English and trackable week to week. It should explain what moved, distinguish movement from ordinary variation between two runs, and avoid presenting an incomplete week as a drop. The score is an index of appearances in the sampled answers, not market share, actual recommendations seen by buyers, or business performance.

## What the data supports

Each successful answer has a week, engine, prompt, run, answer text, and citations/sources. The prompt table gives stage and priority. Mention, order, and tone can be inferred from answer text. There are nominally two runs for each of 15 prompts × 3 engines × 6 weeks, but the source has 518 raw JSONL lines (515 successful and 3 failed) out of 540 expected slots. Week 2 has eight exact duplicate lines; Week 4 has 88/90 valid slots due to two failed Perplexity responses; Week 5 has 60/90 valid slots (66.7%) because all 30 Perplexity slots are missing; Week 6 has 90/90 (100%). The pack does not provide impressions, traffic, sales, citation quality, or a gold-standard score.

## Implemented score (0–100)

For each tracked company, assign each successful prompt-engine-run answer a visibility point value:

- No mention: **0**.
- Mention with tone `not_recommended`: **0.25**.
- Mention with tone `negative`: **0.40**.
- Mention with tone `neutral`: **0.65**.
- Mention with tone `recommended`: **1.00**.

If the company is mentioned, multiply by a position factor: position 1 = **1.00**, position 2 = **0.80**, position 3 = **0.60**, position 4 or later = **0.40**. Average duplicate source records within a run slot, average available run values equally within each prompt-engine stratum, then take a priority-weighted mean across strata and multiply by 100. (The six configured companies can occupy only six positions.) The score rewards appearing, appearing early, and being recommended, while treating a negative mention as visible but damaging. A recommended company at position 1 earns 100; absent company earns 0.

Prompt priority is implemented as a 1–3 weight. A high-priority buyer question therefore counts up to three times a priority-1 question. Tone, position, priority, coverage, variation floor, and history window are configured in `backend/config/scoring.json`. These are product choices, not weights specified by the assignment.

## Aggregation and comparability

1. Score each successful run independently.
2. For each prompt-engine stratum, average its valid run values. Then calculate a priority-weighted mean across the fixed set of prompt-engine strata, giving each engine equal presence in the panel. This avoids a duplicated slot in one engine or many answers in a week dominating the index.
3. Do not turn timeouts/blank failed responses into zero. Exclude the failed observation and show coverage. A stratum with one valid run contributes its available estimate; the overall week coverage and completeness status show reduced data coverage.
4. A week is complete with at least 95% valid-slot coverage and at least one valid slot from every expected engine. Otherwise show its available score as **partial** and suppress the headline week-over-week change. Week 5 is partial because Perplexity is absent. Week 6 does not show a normal WoW comparison against incomplete Week 5. It provides a separate comparison to Week 4, labeled as change since the last complete week, not week-over-week.
5. Keep competitor scores calculated by exactly the same method. The four score series therefore have a common scale.

## Variation and meaningful change

Two runs per slot are too few to claim statistical certainty. The implementation calculates run variation from paired run values, using the mean absolute within-stratum difference from up to the previous four complete weeks. A movement is marked outside observed variation only when the delta exceeds the larger of this historical value and the configured two-point floor. Week-2 duplicate source records remain visible, but coverage counts a slot once and repeated observations in one run are averaged. Avoid p-values or claims of statistical significance.

## Week-on-week changes and explanation

Calculate change as current comparable score minus previous comparable score, in score points, not percent. Attribute change to prompt-engine strata where mention/tone/position changed, and show example answer links. When the latest week is incomplete, keep the score visibly partial and defer headline change until comparable coverage exists. For an absent-to-present or present-to-absent shift, identify the answer evidence and engine/question. The implementation suppresses headline week-over-week movement when the immediately prior week is incomplete. It reports a separate, clearly labeled gap comparison to the latest earlier complete week; week 6 therefore has a gap comparison with week 4, since week 5 is partial. Driver records include previous/current response IDs.

## Limitations to disclose

- Small and uneven sample; two runs do not estimate all real-world answer variation.
- Rules for names, tone, and claims can miss paraphrases or misread context; the 15-answer manual results are a sample only.
- Score weights are product choices, not ground truth, and can move rankings.
- It measures this question set and these engines, not total market visibility or buyer exposure.
- Missing data can make weeks incomparable; partial scores need visible caveats.
- Prompt priorities are treated as importance by an explicit product decision.

## Export status limitation

The required `mentions.csv` value set has no `unavailable` option. To meet its exact row and column contract, failed/unusable records have `false` and blank position/tone as a placeholder. This is not used as a score observation; machine-readable response status remains `failed` or `unusable` in the JSON evaluation outputs and is called out in the quality report.
