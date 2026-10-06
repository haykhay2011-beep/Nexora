package bot.adapters;

import bot.browser.BrowserSession;
import bot.config.PlatformConfig;
import bot.model.Assignment;
import bot.model.AssignmentStatus;
import bot.model.Outcome;
import bot.model.SolveResult;
import bot.writing.GeneratedText;
import bot.writing.TemplateTextGenerator;
import bot.writing.TextGenerator;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Adapter for WriteWell (Platform C): free-response writing prompts.
 *
 * What's different here:
 *   - MULTI-STEP LOGIN: type the username, click Continue, and WAIT for the
 *     password field to become visible before typing into it. (Typing into a
 *     hidden field throws ElementNotInteractableException.)
 *   - There is no "right answer". Success means the platform ACCEPTED the
 *     response, and it only does that if the response meets a minimum word
 *     count it doesn't reveal in advance.
 *   - VALIDATION + RETRY LOOP: submit a concise draft; if it's rejected, read
 *     the validation message, pull the required word count out of it,
 *     lengthen the draft, and try again (up to MAX_ATTEMPTS times).
 *
 * SELECTOR STRATEGIES used here:
 *   - XPath by visible text: //button[normalize-space()='Continue'].
 *     CSS cannot select elements by their text; XPath can. The trade-off:
 *     if the site renames the button to "Next", this selector breaks, while
 *     an id-based selector would survive. Here we use it on purpose to show
 *     the technique.
 *   - CSS attribute selectors: section.prompt-grid[aria-busy='false'].
 */
public class WriteWellAdapter extends PlatformAdapter {

    private static final By USERNAME = By.id("ww-user");
    private static final By CONTINUE = By.xpath("//button[normalize-space()='Continue']");
    private static final By PASSWORD = By.id("ww-pass");
    private static final By SIGN_IN = By.id("signin-btn");
    private static final By STEP_ERROR = By.cssSelector(".step-error");
    private static final By LOGIN_ERROR = By.cssSelector(".alert, .step-error"); // either step's error box
    private static final By GRID = By.cssSelector("section.prompt-grid");
    private static final By CARDS = By.cssSelector("section.prompt-grid article.prompt-card");
    private static final By PROMPT_TEXT = By.cssSelector("blockquote.prompt-text");
    private static final By RESPONSE = By.id("response");
    private static final By SUBMIT = By.id("submit-response");
    private static final By VALIDATION_ERROR = By.cssSelector(".validation-error");
    private static final By CONFIRMATION = By.cssSelector(".confirmation");
    private static final By FINAL_COUNT = By.cssSelector(".confirmation .final-count");
    private static final By SIGN_OUT = By.cssSelector("button.signout");

    /** WriteWell only shows dates as text like "Oct 8, 2026". */
    private static final DateTimeFormatter DUE_FORMAT = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US);

    /** Pulls the number out of "...requires at least 45 words." */
    private static final Pattern REQUIRED_WORDS = Pattern.compile("at least (\\d+) words");

    private static final int MAX_ATTEMPTS = 4;

    private final TextGenerator generator;

    public WriteWellAdapter(PlatformConfig config, BrowserSession browser) {
        // OPTIONAL HOOK: swap in any other TextGenerator implementation here.
        this(config, browser, new TemplateTextGenerator());
    }

    public WriteWellAdapter(PlatformConfig config, BrowserSession browser, TextGenerator generator) {
        super(config, browser);
        this.generator = generator;
    }

    @Override
    protected By dashboardMarker() { return GRID; }

    @Override
    protected By loginErrorLocator() { return LOGIN_ERROR; }

    /** Two-step login: username, Continue, wait for the password field, password, Sign in. */
    @Override
    public void login() {
        browser.open(config.getLoginUrl());
        browser.type(USERNAME, config.getUsername());
        browser.click(CONTINUE);

        // Step 2 appears after a short delay, or an error appears if the username is unknown.
        browser.waitUntil(ExpectedConditions.or(
                ExpectedConditions.visibilityOfElementLocated(PASSWORD),
                ExpectedConditions.visibilityOfElementLocated(STEP_ERROR)));
        if (browser.isVisible(STEP_ERROR)) {
            throw new LoginFailedException(getName() + ": username rejected: \"" + browser.textOf(STEP_ERROR).trim() + "\"");
        }

        browser.type(PASSWORD, config.getPassword());
        browser.click(SIGN_IN);
        verifyOnDashboard();
    }

    /**
     * While loading, the grid has aria-busy="true". We wait for the ATTRIBUTE
     * to change to "false" (a third waiting strategy, after MathDrill's
     * "wait for visible" and QuizZone's "wait for spinner to vanish").
     */
    @Override
    public ArrayList<Assignment> listAssignments() {
        goToDashboard();
        browser.waitUntil(ExpectedConditions.attributeToBe(GRID, "aria-busy", "false"));
        ArrayList<Assignment> list = new ArrayList<>();
        for (WebElement card : browser.findAll(CARDS)) {
            String title = card.findElement(By.cssSelector(".card-title")).getText().trim();
            String dueText = card.findElement(By.cssSelector(".due")).getText().replaceFirst("^Due\\s*", "").trim();
            String state = card.findElement(By.cssSelector(".state")).getText();
            WebElement link = card.findElement(By.cssSelector("a.open-link"));
            list.add(new Assignment(getName(), card.getDomAttribute("data-prompt-id"), title,
                    LocalDate.parse(dueText, DUE_FORMAT), AssignmentStatus.fromLabel(state), link.getDomProperty("href")));
        }
        return list;
    }

    @Override
    public SolveResult solveAssignment(Assignment assignment) {
        browser.open(assignment.getUrl());
        String prompt = browser.textOf(PROMPT_TEXT).trim();
        List<String> notes = new ArrayList<>();

        String savedDraft = browser.waitForVisible(RESPONSE).getDomProperty("value");
        if (savedDraft != null && !savedDraft.isBlank()) {
            notes.add("replaced a previously saved draft (" + GeneratedText.countWords(savedDraft) + " words)");
        }

        GeneratedText text = generator.draft(prompt);

        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            browser.type(RESPONSE, text.getText()); // type() clears the box first
            browser.click(SUBMIT);

            // Wait for the server's verdict: accepted OR rejected.
            browser.waitUntil(ExpectedConditions.or(
                    ExpectedConditions.visibilityOfElementLocated(CONFIRMATION),
                    ExpectedConditions.visibilityOfElementLocated(VALIDATION_ERROR)));

            if (browser.isVisible(CONFIRMATION)) {
                int words = Integer.parseInt(browser.textOf(FINAL_COUNT).trim());
                String summary = "Accepted, " + words + " words"
                        + (attempt > 1 ? " (after " + (attempt - 1) + " rejection" + (attempt > 2 ? "s" : "") + ")" : "");
                SolveResult result = new SolveResult(Outcome.SUBMITTED, summary);
                for (String note : notes) result.addNote(note);
                result.addNote("template topic: " + text.getTopic() + ", confidence: " + text.getConfidence());
                if (text.getConfidence() == GeneratedText.Confidence.LOW) {
                    result.addNote("LOW CONFIDENCE: no template fits this prompt, so a generic response was submitted. Review it by hand.");
                }
                return result;
            }

            // Rejected: read the message and work out how long the answer must be.
            String message = browser.textOf(VALIDATION_ERROR).trim();
            notes.add("attempt " + attempt + " (" + text.getWordCount() + " words) rejected: \"" + message + "\"");
            Matcher m = REQUIRED_WORDS.matcher(message);
            int required = m.find() ? Integer.parseInt(m.group(1)) : text.getWordCount() + 15;
            text = generator.lengthen(text, required);
        }
        throw new IllegalStateException("Response still rejected after " + MAX_ATTEMPTS + " attempts");
    }

    @Override
    public void logout() {
        goToDashboard();
        browser.click(SIGN_OUT);
        browser.waitForUrlContains(config.getLoginPath());
    }
}
