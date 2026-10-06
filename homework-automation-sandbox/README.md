# homework-automation-sandbox

> **Safety note: this bot only ever runs against websites in this repository, served on `localhost`.**
> The three "homework platforms" are mock sites built here for practice. The bot must never be
> pointed at a real website, and it enforces that rule: `ConfigLoader` refuses to start if any URL in
> `platforms.json` points anywhere other than `localhost` or `127.0.0.1`.

A practice project for **browser-automation engineering**: authentication, multi-site navigation,
assignment discovery, interacting with different UI patterns, and robust error handling. It is written
to be presented for **AP Computer Science A**, so the Java code is heavily commented and organized
around a clear object-oriented design.

---

## Why mock sites? (a note for my teacher)

Automating real school platforms would break their terms of service, could submit work under a real
student's name, and isn't something I'm allowed to test against. So I built my own. The three mock
platforms are small websites that copy the *kinds* of things real platforms do: logins with
sessions, dashboards that load with JavaScript, one-question-at-a-time drills, multiple-choice forms,
free-response boxes with validation. Each one is deliberately different, so the bot has to be properly
engineered instead of hard-coded. Everything runs on my own computer, so I can safely test edge cases
like failures, timeouts and wrong passwords as often as I want, and I control the answer data so I
can check whether the bot actually got things right.

---

## Architecture

```
homework-automation-sandbox/
├── platforms.json          ← bot config: URLs, demo logins, settings (localhost only!)
├── package.json            ← npm scripts: seed, start-all, test
├── platforms/              ← PART 1: three mock homework websites (Node.js + Express)
│   ├── shared/             ←   cookie sessions, JSON-file store, HTML helper
│   ├── mathdrill/          ←   Platform A, port 4001
│   ├── quizzone/           ←   Platform B, port 4002
│   ├── writewell/          ←   Platform C, port 4003
│   └── test/               ←   node:test suites
└── bot/                    ← PART 2: the automation bot (Java 17 + Selenium + Maven)
    ├── pom.xml
    └── src/main/java/bot/
        ├── Main.java                  run everything, factory method, error handling
        ├── config/                    PlatformConfig, BotSettings, BotConfig, ConfigLoader
        ├── model/                     Assignment (Comparable), AssignmentStatus, Outcome, SolveResult
        ├── browser/BrowserSession     wraps Selenium: explicit waits, safe click/type, screenshots
        ├── adapters/                  PlatformAdapter (abstract) + one subclass per platform
        ├── solver/                    MathSolver: parses and solves equations in Java
        ├── writing/                   TextGenerator interface + TemplateTextGenerator
        └── report/                    RunReporter, AssignmentResult
```

Each platform is its own Express app with its own port, its own data file
(`platforms/<name>/data/db.json`, created by its seed script), and its own HTML, CSS and JavaScript.

### The three platforms

| | MathDrill (A) | QuizZone (B) | WriteWell (C) |
|---|---|---|---|
| URL | http://localhost:4001 | http://localhost:4002 | http://localhost:4003 |
| Demo login | `student` / `practice123` | `student@quizzone.local` / `practice123` | `student` / `practice123` |
| Login form | `id="username"` / `id="password"`, classic POST | `name="email"` / `name="pw"`, sent by `fetch()` | **multi-step**: username → *Continue* → password appears |
| Dashboard | `<table>` rows, ISO due dates | `<li class="quiz-card">`, due date in `<time datetime>` | `<article class="prompt-card">`, due date only as text ("Due Oct 8, 2026") |
| Assignment UI | one problem at a time in `<div class="problem">`, `<input name="answer">`, *Next* / *Submit*, 200 ms delay between problems | all 5 questions in one `<form>`, `<fieldset>` + `<legend>` + `<label>`-wrapped radios | a prompt + `<textarea>` + *Submit* |
| "Correct" means | server checks each numeric answer; results page shows score | server grades all answers at once; returns per-question JSON | no right answer; accepted if it meets a hidden minimum word count |
| Built-in messiness | 3 problem types; ~1 in 6 problems shown with extra spaces / a trailing period; one assignment already half done | options **shuffled on every load**; one "under review" question per quiz has no answer key | too-short answers are **rejected** with a message; one prompt has a saved draft; one prompt fits no template |

Shared behavior on all three:
* Logging in sets an **HTTP-only session cookie** (`md_session`, `qz_session`, `ww_session`).
  Protected pages redirect to the login page without it, and **protected API endpoints return 401**,
  so the bot can't skip the login by calling the API directly.
* The dashboard's assignment list is **fetched by JavaScript** from an API and drawn after a 300 ms delay,
  so the bot has to wait for dynamic content.
* A visible **logout** button deletes the session, and the bot uses it at the end of each platform.
* A seed script creates **4 assignments** with varied due dates (and statuses).

---

## Prerequisites

* **Node.js 18+** (for the mock platforms)
* **Java 17+** and **Maven 3.8+** (for the bot)
* **Google Chrome** (the bot drives it headlessly; WebDriverManager downloads the matching chromedriver automatically)

## Setup

```bash
cd homework-automation-sandbox
npm install          # installs express + concurrently
npm run seed         # creates the assignment data for all three platforms
```

`npm run seed` also **resets** everything. The bot skips assignments that are already done, so
re-seed before each demo run.

## Start the platforms

```bash
npm run start-all    # starts all three platforms in one terminal (Ctrl+C stops them)
```

Then open http://localhost:4001, http://localhost:4002 and http://localhost:4003 in a browser and log in
with the demo accounts in the table above. You can also start one at a time with
`npm run start:mathdrill`, `npm run start:quizzone` or `npm run start:writewell`.

## Run the bot

In a second terminal, with the platforms running:

```bash
cd bot
mvn -q compile exec:java
```

Useful variations:

```bash
mvn -q compile exec:java -Dexec.args="MathDrill"            # run only one platform (names from platforms.json)
mvn -q compile exec:java -Dexec.args="QuizZone WriteWell"   # or several
mvn -q compile exec:java -Dconfig=/path/to/other.json       # use a different config file
```

Output:
* a live log, then a **summary table** (platform, assignment, result, duration, details)
* `run-report.txt` in the project root: the summary, per-assignment notes, and the platform event log
* `screenshots/` in the project root: a PNG for every failure

Exit code 0 means no failures and 1 means at least one failure, so the bot can be used in scripts.

Example summary from a fresh seed:

```
+-----------+----------------------------------+-----------+----------+----------------------------------------------------------+
| Platform  | Assignment                       | Result    | Duration | Details                                                  |
+-----------+----------------------------------+-----------+----------+----------------------------------------------------------+
| MathDrill | Warm-up: Mental Arithmetic       | PASSED    | 3.8s     | Score 6/6 (arithmetic 6/6)                               |
| MathDrill | Mixed Review (started last week) | PASSED    | 5.0s     | Score 10/10 (arithmetic 4/4, one-step 3/3, two-step 3/3) |
| MathDrill | One-Step Equations               | PASSED    | 4.4s     | Score 7/7 (one-step 5/5, arithmetic 2/2)                 |
| MathDrill | Two-Step Equations Challenge     | PASSED    | 4.8s     | Score 8/8 (two-step 5/5, one-step 3/3)                   |
| QuizZone  | Cell Biology Check               | PASSED    | 1.1s     | Score 5/5 (1 guessed)                                    |
| QuizZone  | Java Basics Quiz                 | PARTIAL   | 1.0s     | Score 4/5 (1 guessed)                                    |
| QuizZone  | World Geography                  | PARTIAL   | 1.0s     | Score 4/5 (1 guessed)                                    |
| QuizZone  | Computer Science History         | PARTIAL   | 1.0s     | Score 4/5 (1 guessed)                                    |
| WriteWell | What Is a Variable?              | SUBMITTED | 0.7s     | Accepted, 46 words (after 1 rejection)                   |
| WriteWell | Reflection: Your Ideal Weekend   | SUBMITTED | 0.8s     | Accepted, 37 words (after 1 rejection)                   |
| WriteWell | Loops in Everyday Code           | SUBMITTED | 0.8s     | Accepted, 59 words (after 1 rejection)                   |
| WriteWell | The Water Cycle                  | SUBMITTED | 0.9s     | Accepted, 44 words (after 1 rejection)                   |
+-----------+----------------------------------+-----------+----------+----------------------------------------------------------+
Total: 12   passed: 5   partial: 3   submitted: 4   skipped: 0   failed: 0
```

The QuizZone "PARTIAL" rows are expected. Each quiz has one question the bot has no key for, and it
guesses that one (see below). The notes in the live log and `run-report.txt` say which questions were
guessed and whether each guess was right.

### Demo the error handling

```bash
npm run seed
npm run start-chaos     # same as start-all, but MathDrill's "Two-Step Equations Challenge" loads too slowly on purpose
```

Run the bot. That assignment times out after 10 s, gets a screenshot, and is marked FAILED, and the bot
continues with the next assignment. You can also stop one platform (or never start it) to see a
"connection refused" platform failure, or put a wrong password in a copy of `platforms.json` to see
the login check fail loudly with the platform's own error message.

## Run the tests

```bash
npm test                 # platform tests (node:test): 21 tests
cd bot && mvn test       # bot unit tests (JUnit 5): 36 tests, no browser needed
```

* **Platform tests** start each app on a random port with a throwaway database. They check
  that wrong credentials fail without a cookie, that the cookie is HTTP-only, that protected pages
  redirect and protected APIs return 401 (with no cookie *and* with a forged one), that a correct answer to
  a seeded MathDrill problem is marked correct, that options shuffle, that the answer key leaves out
  "review" questions, and that the word-count validation works.
* **Bot tests** cover the pure-logic pieces: the equation parser/solver (a dozen-plus equations, messy
  input, bad input, and *every seeded MathDrill problem exactly as displayed*), `Assignment.compareTo`
  sorting, status-label parsing, the config loader (including the localhost-only rule), and the text
  generator. Browser behavior is covered by the end-to-end run instead.

---

## How the bot is designed

```
                    ┌──────────────────────────────┐
                    │  «abstract» PlatformAdapter   │
                    │  login()                      │
                    │  listAssignments()            │
                    │  solveAssignment(Assignment)  │
                    │  logout()                     │
                    │  verifyLoginRequired()  ← shared
                    │  verifyOnDashboard()    ← shared
                    └──────────────┬───────────────┘
              ┌────────────────────┼────────────────────┐
   MathDrillAdapter         QuizZoneAdapter        WriteWellAdapter
   uses MathSolver          uses answer key        uses TextGenerator
                                                   («interface»)

  Main ── createAdapter() (factory) ──▶ PlatformAdapter
   │                                      │ uses
   ├── ConfigLoader ──▶ PlatformConfig    ▼
   └── RunReporter ◀── AssignmentResult  BrowserSession (wraps Selenium WebDriver)
```

**One contract, three implementations.** `PlatformAdapter` is an abstract class that says *what*
every platform must support. Each subclass supplies the *how*: its own selectors, login steps and
answering logic. `Main` stores every adapter in a `PlatformAdapter` variable and calls
`adapter.login()` and the other methods. Java picks the right subclass method at run time. That is
**polymorphism**, and it's why `Main` contains no `if (platform is MathDrill) ...` code.

**Design goal met: adding a fourth platform = one new class + one config entry.**
1. Write `bot/src/main/java/bot/adapters/MyNewAdapter.java` extending `PlatformAdapter`, with a
   `(PlatformConfig, BrowserSession)` constructor.
2. Add an entry to `platforms.json` with `"adapter": "MyNewAdapter"`.

That's all. `Main.createAdapter()` looks the class up by name (reflection), so not even the factory
needs editing. The comments in `createAdapter` show the simpler `switch` version and explain the trade-off.

### The workflow for each platform (`Main.runPlatform`)
1. Start a fresh headless Chrome (a clean cookie jar per platform).
2. **Prove pages are protected:** open the dashboard without logging in and confirm the platform
   redirects to its login page.
3. **Log in** through that platform's own form, then **verify** the dashboard: wait for *either* the
   dashboard URL *or* the login-error box, and throw `LoginFailedException` with the page's own error
   message if login didn't work.
4. **List** assignments into an `ArrayList<Assignment>` and `Collections.sort()` them by due date.
5. **Solve** each one inside its own try/catch, skipping ones already done.
6. **Log out** and confirm we're back at the login page. Close the browser in a `finally` block.

### How each adapter answers

* **MathDrill: real Java logic, no shortcuts.** `MathSolver` normalizes the text (trims, collapses
  spaces, strips trailing periods, handles Unicode math symbols), tokenizes it (inserting the hidden `*`
  in `3x`, telling negative signs from subtraction), and evaluates it with order of operations using two
  passes over `ArrayList`s. The key idea is that every value is treated as `a·x + b`. Evaluating both
  sides of an equation gives `ax + b = cx + d`, so `x = (d − b) / (a − c)`. The same code does plain
  arithmetic, one-step and two-step equations. The bot also reads which problem it's on (`data-index`),
  so it correctly resumes the half-finished assignment, and it reads the final score from the results page.
* **QuizZone: the test-only answer key (an honest limitation).** Multiple-choice answers can't be
  computed from the question text. Because I control the sandbox, QuizZone has a clearly-labeled,
  **test-only `/debug/answers` endpoint** that returns the key as *question text → answer text*.
  **No real platform would ever expose this.** It stands in for whatever answering strategy a real system
  would use. The bot still has to do real automation work. It copies the HTTP-only session cookie
  out of Selenium to call the endpoint (the endpoint requires login too). It matches answers by **option
  text**, because positions are shuffled. For the "under review" question that isn't in the key, it uses
  a documented fallback (longest option text, ties broken alphabetically, so the choice doesn't depend on
  the shuffle), flags the question as **guessed**, and reports whether the guess was right. Results are
  parsed from the JSON response.
* **WriteWell: generated text plus a validation retry loop.** `TemplateTextGenerator` picks a topic by
  whole-word keyword matching and fills in a template, with **zero API calls and zero secrets**. Its first
  draft is deliberately concise. If WriteWell rejects it, the bot reads the validation message, extracts
  the required word count with a regex, lengthens the draft and retries (up to 4 attempts). A prompt that
  matches no template still gets a generic answer that meets the word count, but it's flagged
  **LOW confidence** in the report. The `TextGenerator` interface is the **optional hook** where a
  real text generator could be plugged in later without changing anything else.

### Engineering topics demonstrated (and where to look)

| Topic | Where |
|---|---|
| **Authentication & sessions**: real login flows, protected-page check before login, dashboard verification after, clean logout, reusing the session cookie for an HTTP call | `PlatformAdapter.verifyLoginRequired/verifyOnDashboard`, each adapter's `login/logout`, `QuizZoneAdapter.fetchAnswerKey`, `platforms/shared/session.js` |
| **Explicit waits over sleeps**: no `Thread.sleep` anywhere in the bot. Waits for visible, clickable, invisible, attribute value, URL, and "either A or B" conditions | `BrowserSession` (the comment explains why), adapters |
| **Three dynamic-content strategies**: wait for the table to appear (MathDrill), wait for the spinner to disappear (QuizZone), wait for `aria-busy="false"` (WriteWell) | each adapter's `listAssignments` |
| **Resilient selectors: CSS vs XPath** | see below |
| **Error handling**: per-assignment and per-platform try/catch, friendly messages for timeouts, missing elements and connection errors, screenshots on failure, stale-element retry, graceful degradation when a problem can't be parsed | `Main.runPlatform/solveOne/describe`, `BrowserSession.click/screenshot` |
| **Config separated from code**: no URLs, ports or credentials in Java | `platforms.json`, `ConfigLoader` |
| **Reading hidden text**: `getText()` returns only *visible* text, so the JSON in a collapsed `<details>` is read through `textContent` | `BrowserSession.textContentOf` |

**Selector strategies and trade-offs** (documented in the adapter comments):
* `By.id("username")`: the most stable choice when a page provides ids.
* `By.name("email")`: good for form fields.
* CSS, e.g. `#assignment-table tr.assignment-row`, `section.prompt-grid[aria-busy='false']`: short,
  fast and readable. It can't match by visible text or move *up* to a parent element.
* XPath, e.g. `//button[normalize-space()='Continue']`, `./legend`,
  `//table[contains(@class,'breakdown')]//tbody/tr`: can match by text and search relative to an
  element, but it's longer and breaks more easily when a page's wording or structure changes.
  Rule of thumb: **id > name > CSS > XPath**, and keep every selector in one constant at the top of
  the adapter so a redesign means editing one place.

---

## How this maps to AP Computer Science A

| CSA topic | In this project |
|---|---|
| **Classes and objects / encapsulation** | `Assignment`, `PlatformConfig`, `BrowserSession`, every adapter: private fields, constructors, getters, no setters where values shouldn't change |
| **Inheritance and polymorphism** | abstract `PlatformAdapter` with three subclasses, chosen at run time by a factory method. Shared code (`verifyOnDashboard`) is inherited, and the abstract methods are overridden. This is the clearest demonstration of polymorphism in the project |
| **Interfaces** | `Comparable<Assignment>`, `TextGenerator`, `AutoCloseable` (`BrowserSession`) |
| **ArrayList and traversal** | storing discovered assignments in `ArrayList<Assignment>`; `MathSolver.evaluate` removes elements *while traversing* (and explains why it only does `i++` when it doesn't remove) |
| **Sorting with Comparable** | `Assignment.compareTo` (due date, then title) and `Collections.sort` |
| **Boolean logic and conditionals** | classifying problem types, choosing Next vs Submit, deciding accepted vs rejected, the fallback guess, status-label parsing with `switch` |
| **String manipulation** | normalizing problem text, tokenizing equations character by character, matching quiz option text, parsing dates and word counts out of page text |
| **Exception handling** | try/catch around every platform and every assignment, a custom `LoginFailedException`, re-throwing with better messages, `finally` to always close the browser |
| **Program decomposition** | one responsibility per class, config separated from code, one-new-class-per-platform extensibility |
| **Enums and static methods** (beyond the core) | `AssignmentStatus`, `Outcome`, `ProblemType`; static factory `SolveResult.graded` |

---

## Troubleshooting

* **"Platform is not running (connection refused)"**: start the platforms with `npm run start-all` first.
* **Everything says SKIPPED**: the assignments are already done from an earlier run. Run `npm run seed`.
* **Port already in use**: change `port` in `platforms/<name>/config.json` *and* the matching `baseUrl` in `platforms.json`.
* **Chrome/driver problems**: WebDriverManager normally handles this. If you use a Chromium in an unusual
  location, set `CHROME_BINARY=/path/to/chrome`. If you already have a matching chromedriver, set
  `CHROMEDRIVER=/path/to/chromedriver` and WebDriverManager is skipped.
* **Want to watch it work?** Set `"headless": false` in `platforms.json`.

## Future work

Ideas I haven't built yet:
* **A fourth platform with a different paradigm** (drag-and-drop ordering, or a code-entry box) to prove
  the adapter design really is extensible.
* **Parallel platform runs** on separate threads, with a thread-safe `RunReporter`, to introduce basic concurrency.
* **A summary dashboard**: a single static HTML page the bot writes out to visualize the last run.
* **Configurable retry/backoff** for transient failures.
* **Per-step timing metrics** to find the slowest part of each workflow.
