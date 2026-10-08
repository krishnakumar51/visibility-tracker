# AI-Native Developer Case Study: Corvane Fleet

## How this works

You'll build a working AI visibility tracker for a fictional client,
Corvane Fleet, from a data pack of real-world-messy AI answers. Every
company, person and product in this brief is fictional.

You don't need any SEO or WordPress knowledge. Everything you need to
understand the problem is explained here in plain English.

### Using AI tools

We expect you to build with AI coding tools such as Claude Code, Cursor
or Codex.

Please include a short note on how you used them, including anything
they got wrong that you had to fix.

### Constraints

-   No paid APIs in the tool itself.
-   No API keys will be provided.
-   The tool must not depend on paid APIs.
-   Everything it does to analyse the data has to run on a normal
    laptop.
-   A rules-based approach using code and open-source libraries is
    perfectly acceptable.
-   If you use a local AI model, for example through Ollama, keep it
    small enough to run on an ordinary laptop.
-   The tool will be run on new data it hasn't seen, so results labelled
    in advance by a paid AI service will not work.

### Stack

Your choice of stack. Use any language or framework you like.

### Ownership

The code you write remains your property. It will not be used for
anything beyond assessing your application.

### Assumptions

If something you need isn't in the brief, make a reasonable assumption
and write it down in your README.

### Submission

Email a link to the GitHub repository, plus your note to Marcus, to:

`careers@joinindexed.com`

Use the subject line:

`Case Study: AI-Native Developer, [Your Name]`

------------------------------------------------------------------------

# The client: Corvane Fleet

Corvane Fleet sells GPS tracking and compliance software to trucking and
field service companies with 20 to 500 vehicles.

-   Founded: 2014
-   Based in: Columbus, Ohio
-   Customers: around 4,000

More and more of Corvane's buyers now ask AI tools like ChatGPT,
Perplexity, Gemini and Google's AI Overviews questions such as:

> "what's the best fleet tracking software for a small trucking
> company?"

The AI writes an answer, often recommends a few companies by name, and
sometimes lists the websites it got its information from (its
"citations").

Corvane has no idea whether it's being recommended, ignored, or
described wrongly.

## Marcus Hale, CEO

Marcus wants to open one screen every Monday and know in two minutes:

-   whether Corvane is winning or losing in AI
-   who it is winning or losing against
-   what they are doing about it
-   one number that can be tracked
-   why that number moved
-   whether AI tools are telling people wrong things about Corvane,
    before the sales team hears it from a prospect

## Priya Nair, Head of Marketing

Priya wants the detail:

-   exactly which questions Corvane shows up for
-   which questions Corvane does not show up for
-   the actual answer the AI gave
-   the ability to pull the numbers into a monthly board report

## Marcus's follow-up

Marcus also wants the same picture for Trakvia, Routelyne and Gridwell.

When Corvane loses ground, he wants to know exactly who took it and
where.

If the AI is getting competitors' facts wrong too, the sales team should
know.

------------------------------------------------------------------------

# Tracked competitors

Track these three as thoroughly as Corvane itself.

  -----------------------------------------------------------------------
  Company                 Website                 Known for
  ----------------------- ----------------------- -----------------------
  Corvane Fleet (the      `corvanefleet.com`      GPS tracking and
  client)                                         compliance for small
                                                  and mid-sized fleets

  Trakvia                 `trakvia.com`           Dashcams and video
                                                  safety

  Routelyne               `routelyne.com`         The cheapest option

  Gridwell Systems        `gridwell.io`           Large enterprise fleets
  -----------------------------------------------------------------------

## Other companies that appear in answers

Detect these, but they don't need full tracking.

  Company    Website
  ---------- ----------------
  Fleetora   `fleetora.com`
  Novahaul   `novahaul.com`

### Important name distinction

Corvane Logistics is an unrelated freight company with a similar name.

It is **not** the client.

------------------------------------------------------------------------

# The data pack

The data pack contains six weeks of AI answers:

-   15 buyer questions
-   three AI engines:
    -   ChatGPT
    -   Perplexity
    -   Google's AI Overviews
-   every question was asked twice per engine per week
-   roughly 500 answers in total

AI answers vary each time a question is asked.

The data is intentionally not clean:

-   formats differ between engines and over time
-   not every week is complete
-   noticing and handling this is part of the task

## Files in the data pack

### `responses.jsonl`

One AI answer per line containing:

-   response ID
-   week
-   engine
-   question ID
-   run number (1 or 2)
-   when it was collected
-   full answer text
-   citations, meaning the web pages the AI listed as sources

### `prompts.csv`

The 15 buyer questions.

Each question has:

-   buying stage:
    -   early research
    -   comparing options
    -   asking about a specific company
-   priority from 1 to 3

### `brands.json`

The official names and websites of:

-   Corvane
-   the three tracked competitors
-   the two other companies

### `facts.json`

What is actually true about Corvane and the three tracked competitors,
including:

-   features each does and doesn't offer
-   starting price
-   location
-   founding year
-   integrations

------------------------------------------------------------------------

# What to build

Build a working web app, run locally or deployed, that turns the data
pack into something Marcus and Priya can actually use.

How it looks and how it works under the hood are up to you.

You will not finish everything, and that's intended.

Do the core requirements first, then any stretch items you choose.

In the README, tell them what you prioritised and why.

Those choices are part of what is being assessed.

------------------------------------------------------------------------

# Core requirements

## 1. Find every mention

Detect when each company is mentioned in an answer, under any form of
its name.

Do not confuse Corvane Fleet with Corvane Logistics.

------------------------------------------------------------------------

## 2. Position and tone

For each mention, record:

-   position
-   tone

The definitions are provided below.

------------------------------------------------------------------------

## 3. Catch wrong facts

Flag anything an AI engine says about Corvane that contradicts
`facts.json`.

Link the incorrect claim to the answer it came from.

A claim that `facts.json` doesn't cover is **unverified**, not wrong.

Do not flag an uncovered claim as wrong.

------------------------------------------------------------------------

## 4. One honest score

Create a single visibility score for:

-   Corvane
-   Trakvia
-   Routelyne
-   Gridwell

Define the score and explain it in plain English.

Week-on-week changes must:

-   separate real movement from the normal variation between runs
-   avoid showing an incomplete week as a false drop

------------------------------------------------------------------------

## 5. Marcus's Monday view

Provide one screen Marcus can understand in two minutes.

It should show:

-   the scores
-   what changed and why
-   who gained or lost ground
-   wrong-fact alerts
-   what you suggest he does about it

------------------------------------------------------------------------

## 6. Check your own accuracy

Pick 15 answers at random.

Check them by hand.

Report in the README:

-   how often the tool is right on mentions
-   how often the tool is right on tone
-   where it goes wrong

------------------------------------------------------------------------

# Basic requirements

The tool must also provide:

-   one command to run it locally
-   a new week's file must be loadable without code changes
-   later files may vary slightly in format
-   the scoring export described below
-   a few automated tests for the detection logic

Simple is fine.

A simple approach with honestly reported accuracy beats a complex
approach.

------------------------------------------------------------------------

# Stretch requirements

Pick any of the following.

## Priya's detail view

Allow filtering by:

-   question
-   engine
-   buying stage
-   company

Provide a drill-down to:

-   the original AI answer
-   every mention highlighted

## Head-to-head

Show:

-   which company wins each question on each engine
-   when a company drops out of an answer
-   which company took its place

## Competitor fact-checking

Flag wrong claims about:

-   Trakvia
-   Routelyne
-   Gridwell

against `facts.json`.

This allows Corvane's sales team to use the information.

## Sources

Show:

-   which websites the AI engines cite
-   sources that cite competitors but never Corvane

## No hard-coding

Adding a competitor, or viewing the market from a competitor's side,
should be a configuration change rather than a code change.

## Board report export

Provide a board report export that Priya can drop into her monthly
report.

## Deployed version

Provide a deployed version that can be opened in a browser.

------------------------------------------------------------------------

# Definitions

## Mention

A company is considered mentioned when the company is referred to in the
answer text by:

-   its name
-   a variation of its name, including obvious misspellings
-   its website

A company that appears only in the citations does **not** count as a
mention.

Corvane Logistics never counts as Corvane.

------------------------------------------------------------------------

## Position

Position is the order in which companies are first named in the answer
text.

Example:

-   the first company named is position 1
-   the next new company is position 2
-   and so on

Only the six companies in `brands.json` count.

Citations are ignored.

------------------------------------------------------------------------

## Tone

The available tone values are:

-   `recommended`
-   `neutral`
-   `negative`
-   `not_recommended`

### `recommended`

The answer suggests choosing the company.

Example:

> "For small fleets, Corvane is a strong pick."

### `neutral`

The company is named without a judgement.

Example:

> "Other options include Corvane and Fleetora."

### `negative`

The company is criticised, but not ruled out.

Example:

> "Routelyne is cheap, but users report slow support."

### `not_recommended`

The answer advises against the company.

Example:

> "Avoid Gridwell if you run fewer than 100 vehicles."

### Mixed tone

If an answer is mixed about a company, use the tone of its final verdict
on that company.

------------------------------------------------------------------------

# The scoring export

The tool must produce two CSV files in exactly the specified format.

These files are for the assessment team, not for Marcus or Priya.

------------------------------------------------------------------------

# `mentions.csv`

There must be one row for every answer and every company.

That means:

**six rows per answer**, including when a company isn't mentioned.

## Columns

  -----------------------------------------------------------------------
  Column                              Values
  ----------------------------------- -----------------------------------
  `response_id`                       The ID from `responses.jsonl`

  `brand`                             `corvane`, `trakvia`, `routelyne`,
                                      `gridwell`, `fleetora` or
                                      `novahaul`

  `mentioned`                         `true` or `false`

  `position`                          `1` for the first company named in
                                      the answer, `2` for the second, and
                                      so on. Blank if not mentioned

  `tone`                              `recommended`, `neutral`,
                                      `negative` or `not_recommended`.
                                      Blank if not mentioned
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# `wrong_facts.csv`

Produce one row for each incorrect claim about Corvane.

If the competitor fact-checking stretch item is taken on, also include
incorrect claims about the tracked competitors.

## Columns

  Column          Values
  --------------- ---------------------------------------------------
  `response_id`   The ID of the answer containing the claim
  `brand`         `corvane`, `trakvia`, `routelyne` or `gridwell`
  `fact_key`      Which entry in `facts.json` the claim contradicts
  `claim_text`    The incorrect claim, as it appears in the answer

------------------------------------------------------------------------

# What to submit

## 1. GitHub repository

Provide a GitHub repository with the **full commit history**.

The README must cover:

-   how to run it
-   assumptions
-   what you prioritised and why
-   your accuracy check
-   how you used AI tools in building it
-   a short section (half a page) on how you'd run this every day for 20
    clients:
    -   cost
    -   storage
    -   what happens when an AI engine changes its format

## 2. Note to Marcus

Provide a half-page note in plain English explaining:

-   what the tool shows him
-   how the score works
-   why you chose the score

------------------------------------------------------------------------

# What they look for

## Accuracy

They will check your scoring export against their own answer key.

They will also compare it with the accuracy you reported.

## Judgement

They want to see how you handle:

-   messy data
-   uncertainty
-   the gap between what Marcus asked for and what's actually possible

## Usability

They want to know whether Marcus and Priya could use the tool without
help.

## Engineering

They will assess:

-   code quality
-   tests
-   commit history
-   how easily someone else can pick it up

## Clarity

They will assess how well you explain your decisions to people who
aren't developers.

------------------------------------------------------------------------

# Final expectation

They are not looking for perfection or a polished product.

They want to understand:

-   how you think
-   what you prioritise
-   how you handle a hard problem
