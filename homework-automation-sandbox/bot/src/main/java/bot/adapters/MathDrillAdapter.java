package bot.adapters;

import bot.browser.BrowserSession;
import bot.config.PlatformConfig;
import bot.model.Assignment;
import bot.model.AssignmentStatus;
import bot.model.SolveResult;
import bot.solver.MathSolver;
import bot.solver.ProblemType;
import bot.solver.Solution;
import org.openqa.selenium.By;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Adapter for MathDrill (Platform A): one arithmetic/algebra problem at a time.
 *
 * Workflow for one assignment:
 *   1. Wait until EITHER a problem OR the results panel is visible.
 *   2. Read the problem text and its data-index (assignments can be resumed
 *      halfway, so we never assume we start at problem 1).
 *   3. Solve it in Java with MathSolver, type the answer, click Next
 *      (or Submit if it's the last problem).
 *   4. Wait for the old problem to disappear (the site pauses 200 ms between
 *      problems), then repeat. When the results appear, read the score.
 *
 * SELECTOR STRATEGIES used here (compare with the other adapters):
 *   - By.id("username"): the most reliable when a page gives elements ids.
 *   - CSS selectors like "tr.assignment-row" and "input[name='answer']":
 *     short, fast, and readable; they match on tag, class and attributes.
 *   - XPath for the results breakdown: "//table[contains(@class,'breakdown')]//tbody/tr".
 *     XPath can walk the document in ways CSS can't (to a parent, or by
 *     visible text), but it is longer and breaks more easily when the page
 *     structure changes. Rule of thumb: prefer id > CSS > XPath.
 */
public class MathDrillAdapter extends PlatformAdapter {

    // --- Selectors (kept in one place so a page redesign means editing one spot) ---
    private static final By USERNAME = By.id("username");
    private static final By PASSWORD = By.id("password");
    private static final By LOGIN_BUTTON = By.id("login-btn");
    private static final By LOGIN_ERROR = By.cssSelector(".error-box");
    private static final By ASSIGNMENT_TABLE = By.id("assignment-table");
    private static final By ASSIGNMENT_ROWS = By.cssSelector("#assignment-table tr.assignment-row");
    private static final By LOADING = By.id("loading");
    private static final By PROBLEM = By.cssSelector("#problem-area .problem");
    private static final By ANSWER_INPUT = By.cssSelector("input[name='answer']");
    private static final By NEXT_BUTTON = By.id("next-btn");
    private static final By SUBMIT_BUTTON = By.id("submit-btn");
    private static final By ERROR_TEXT = By.id("error-text");
    private static final By RESULTS = By.id("results");
    private static final By SCORE = By.id("score");
    private static final By TOTAL = By.id("total");
    private static final By BREAKDOWN_ROWS = By.xpath("//table[contains(@class,'breakdown')]//tbody/tr");
    private static final By LOGOUT = By.id("logout-btn");

    /** Safety net: never loop forever if the page misbehaves. */
    private static final int MAX_PROBLEMS = 50;

    public MathDrillAdapter(PlatformConfig config, BrowserSession browser) {
        super(config, browser);
    }

    @Override
    protected By dashboardMarker() { return ASSIGNMENT_TABLE; }

    @Override
    protected By loginErrorLocator() { return LOGIN_ERROR; }

    /** MathDrill login: a classic form with id="username" and id="password". */
    @Override
    public void login() {
        browser.open(config.getLoginUrl());
        browser.type(USERNAME, config.getUsername());
        browser.type(PASSWORD, config.getPassword());
        browser.click(LOGIN_BUTTON);
        verifyOnDashboard();
    }

    /**
     * The dashboard table is filled in by JavaScript ~300 ms after the page
     * loads. waitForVisible(ASSIGNMENT_TABLE) waits for the table to be
     * un-hidden, which only happens after the rows are rendered.
     */
    @Override
    public ArrayList<Assignment> listAssignments() {
        goToDashboard();
        browser.waitForVisible(ASSIGNMENT_TABLE);
        ArrayList<Assignment> list = new ArrayList<>();
        for (WebElement row : browser.findAll(ASSIGNMENT_ROWS)) {
            WebElement link = row.findElement(By.cssSelector("td.title a"));
            String dueText = row.findElement(By.cssSelector("td.due")).getText().trim();
            String statusText = row.findElement(By.cssSelector(".status-pill")).getText();
            list.add(new Assignment(
                    getName(),
                    row.getDomAttribute("data-id"),
                    link.getText().trim(),
                    LocalDate.parse(dueText),               // MathDrill shows ISO dates: 2026-10-08
                    AssignmentStatus.fromLabel(statusText),
                    link.getDomProperty("href")));          // the browser resolves this to an absolute URL
        }
        return list;
    }

    @Override
    public SolveResult solveAssignment(Assignment assignment) {
        browser.open(assignment.getUrl());

        // Count how many problems of each type the bot solved (for the report).
        Map<ProblemType, Integer> solvedByType = new EnumMap<>(ProblemType.class);
        List<String> notes = new ArrayList<>();
        int messyInputs = 0;
        int firstIndex = -1;

        for (int step = 0; step < MAX_PROBLEMS; step++) {
            // Wait for whichever comes first: the next problem, or the results.
            try {
                browser.waitUntil(ExpectedConditions.or(
                        ExpectedConditions.visibilityOfElementLocated(PROBLEM),
                        ExpectedConditions.visibilityOfElementLocated(RESULTS)));
            } catch (TimeoutException e) {
                // Re-throw with a message that says what we were waiting for, in page terms.
                String where = browser.isVisible(LOADING) ? "the page is stuck on \"Loading problem...\"" : "unexpected page state";
                throw new TimeoutException("no problem or results appeared (" + where + ")", e);
            }
            if (browser.isVisible(RESULTS)) {
                break;
            }

            WebElement problemDiv = browser.waitForVisible(PROBLEM);
            String index = problemDiv.getDomAttribute("data-index");
            String rawText = problemDiv.getText();
            if (firstIndex < 0) {
                firstIndex = Integer.parseInt(index);
            }
            if (!rawText.equals(rawText.trim()) || rawText.trim().endsWith(".") || rawText.contains("  ")) {
                messyInputs++;
            }

            // Solve in Java. If the solver can't parse a problem, we don't crash:
            // we enter 0, note it in the report, and keep going (graceful degradation).
            String answer;
            try {
                Solution solution = MathSolver.solve(rawText);
                answer = solution.getAnswerText();
                solvedByType.merge(solution.getType(), 1, Integer::sum);
            } catch (RuntimeException e) {
                answer = "0";
                notes.add("problem " + (Integer.parseInt(index) + 1) + " could not be solved (" + e.getMessage() + "); entered 0");
            }

            browser.type(ANSWER_INPUT, answer);
            // The last problem shows "Submit" instead of "Next". Check which one is visible.
            browser.click(browser.isVisible(SUBMIT_BUTTON) ? SUBMIT_BUTTON : NEXT_BUTTON);

            // Wait for THIS problem to go away before looking for the next one.
            // Without this, we could read the same problem twice.
            By thisProblem = By.cssSelector("#problem-area .problem[data-index='" + index + "']");
            try {
                browser.waitForInvisible(thisProblem);
            } catch (TimeoutException e) {
                String pageError = browser.isVisible(ERROR_TEXT) ? browser.textOf(ERROR_TEXT) : "no message";
                throw new IllegalStateException("Problem " + (Integer.parseInt(index) + 1)
                        + " was not accepted (page says: " + pageError + ")");
            }
        }

        // Read the results panel.
        browser.waitForVisible(RESULTS);
        int score = Integer.parseInt(browser.textOf(SCORE).trim());
        int total = Integer.parseInt(browser.textOf(TOTAL).trim());
        StringBuilder breakdown = new StringBuilder();
        for (WebElement row : browser.findAll(BREAKDOWN_ROWS)) {
            if (breakdown.length() > 0) breakdown.append(", ");
            breakdown.append(row.findElement(By.cssSelector(".type")).getText())
                    .append(' ')
                    .append(row.findElement(By.cssSelector(".type-score")).getText().replace(" ", ""));
        }

        SolveResult result = SolveResult.graded(score, total, "Score " + score + "/" + total + " (" + breakdown + ")");
        if (firstIndex > 0) {
            result.addNote("resumed an in-progress assignment at problem " + (firstIndex + 1));
        }
        result.addNote("bot solved " + describeCounts(solvedByType)
                + (messyInputs > 0 ? "; normalized " + messyInputs + " messy problem text(s)" : ""));
        for (String note : notes) {
            result.addNote(note);
        }
        return result;
    }

    @Override
    public void logout() {
        goToDashboard();
        browser.click(LOGOUT);
        browser.waitForUrlContains(config.getLoginPath());
    }

    /** e.g. "3 arithmetic, 2 one-step, 3 two-step" */
    private static String describeCounts(Map<ProblemType, Integer> counts) {
        if (counts.isEmpty()) return "0 problems";
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<ProblemType, Integer> entry : counts.entrySet()) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(entry.getValue()).append(' ').append(entry.getKey().getLabel());
        }
        return sb.toString();
    }
}
