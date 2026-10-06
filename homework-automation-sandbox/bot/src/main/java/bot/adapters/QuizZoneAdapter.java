package bot.adapters;

import bot.browser.BrowserSession;
import bot.config.PlatformConfig;
import bot.model.Assignment;
import bot.model.AssignmentStatus;
import bot.model.SolveResult;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.openqa.selenium.By;
import org.openqa.selenium.Cookie;
import org.openqa.selenium.WebElement;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Adapter for QuizZone (Platform B): multiple-choice quizzes, all questions on one page.
 *
 * HOW THE BOT CHOOSES ANSWERS (and an honest note about it):
 * Multiple-choice answers can't be worked out from the question text the
 * way math answers can. Because we built this sandbox ourselves, QuizZone
 * has a TEST-ONLY endpoint, /debug/answers, that returns the answer key as
 * question text -> answer text. NO REAL PLATFORM WOULD EVER EXPOSE THIS. It
 * stands in for whatever answering strategy a real system would use, so
 * the rest of the automation (reading the page, matching text, handling
 * missing data, submitting, parsing results) can be practised for real.
 *
 * Things this adapter has to handle:
 *   - Option ORDER IS SHUFFLED on every page load, so we can never click
 *     "the second option". We read each option's text and match it.
 *   - One question per quiz is "under review" and missing from the key. For
 *     it we use a documented fallback guess and flag it as "guessed".
 *   - Results come back as JSON, shown in a collapsed box on the page.
 *
 * SELECTOR STRATEGIES used here:
 *   - By.name("email"): matching on the form field's name attribute.
 *   - CSS "fieldset.question" and "label.choice" for the repeated structure.
 *   - XPath "./legend": the "." means "starting from this fieldset", so we
 *     only search inside the current question. XPath is also used to find
 *     the review note by class.
 */
public class QuizZoneAdapter extends PlatformAdapter {

    private static final By EMAIL = By.name("email");
    private static final By PASSWORD = By.name("pw");
    private static final By SIGN_IN = By.cssSelector("button.btn-signin");
    private static final By LOGIN_ERROR = By.cssSelector(".flash-error");
    private static final By PAGE_TITLE = By.cssSelector("h1.page-title");
    private static final By SPINNER = By.id("spinner");
    private static final By CARDS = By.cssSelector("ul.quiz-list li.quiz-card");
    private static final By QUIZ_FORM = By.id("quiz-form");
    private static final By QUESTIONS = By.cssSelector("#quiz-form fieldset.question");
    private static final By LEGEND = By.xpath("./legend");
    private static final By REVIEW_NOTE = By.xpath(".//p[contains(@class,'review-note')]");
    private static final By CHOICES = By.cssSelector("label.choice");
    private static final By RADIO = By.cssSelector("input[type='radio']");
    private static final By SUBMIT = By.cssSelector("button.btn-submit-quiz");
    private static final By RESULT_PANEL = By.id("quiz-result");
    private static final By SCORE_VALUE = By.cssSelector("#quiz-result .score-value");
    private static final By RESULT_JSON = By.id("result-json");
    private static final By LOGOUT = By.cssSelector("button[data-action='logout']");

    /** Name of QuizZone's session cookie (each platform names its cookie differently). */
    private static final String SESSION_COOKIE = "qz_session";

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public QuizZoneAdapter(PlatformConfig config, BrowserSession browser) {
        super(config, browser);
    }

    @Override
    protected By dashboardMarker() { return PAGE_TITLE; }

    @Override
    protected By loginErrorLocator() { return LOGIN_ERROR; }

    /** QuizZone login: fields named "email" and "pw", submitted by JavaScript. */
    @Override
    public void login() {
        browser.open(config.getLoginUrl());
        browser.type(EMAIL, config.getUsername());
        browser.type(PASSWORD, config.getPassword());
        browser.click(SIGN_IN);
        verifyOnDashboard();
    }

    /**
     * Cards are rendered by JavaScript after a short delay while a spinner
     * shows. Here we wait for the spinner to DISAPPEAR, a different strategy
     * from MathDrill's "wait for the table to appear". The due date is read
     * from the machine-readable datetime attribute of the &lt;time&gt; element,
     * not from the human text ("Due Thu, Oct 8").
     */
    @Override
    public ArrayList<Assignment> listAssignments() {
        goToDashboard();
        browser.waitForInvisible(SPINNER);
        ArrayList<Assignment> list = new ArrayList<>();
        for (WebElement card : browser.findAll(CARDS)) {
            WebElement link = card.findElement(By.cssSelector(".quiz-title a"));
            String due = card.findElement(By.cssSelector("time.quiz-due")).getDomAttribute("datetime");
            String badge = card.findElement(By.cssSelector(".badge")).getText();
            list.add(new Assignment(getName(), card.getDomAttribute("data-quiz-id"), link.getText().trim(),
                    LocalDate.parse(due), AssignmentStatus.fromLabel(badge), link.getDomProperty("href")));
        }
        return list;
    }

    @Override
    public SolveResult solveAssignment(Assignment assignment) {
        Map<String, String> answerKey = fetchAnswerKey(assignment.getId());

        browser.open(assignment.getUrl());
        browser.waitForVisible(QUIZ_FORM);

        List<String> notes = new ArrayList<>();
        Map<String, String> guessed = new HashMap<>(); // question id -> what we picked

        for (WebElement fieldset : browser.findAll(QUESTIONS)) {
            String qid = fieldset.getDomAttribute("data-qid");
            String question = normalize(fieldset.findElement(LEGEND).getText());
            boolean underReview = !fieldset.findElements(REVIEW_NOTE).isEmpty();
            List<WebElement> choices = fieldset.findElements(CHOICES);
            if (choices.isEmpty()) {
                throw new IllegalStateException("Question " + qid + " has no answer options");
            }

            String expected = answerKey.get(question);
            WebElement choice = (expected == null) ? null : findChoice(choices, expected);

            if (choice == null) {
                // FALLBACK: no key for this question (or the key's answer isn't
                // among the options). Pick deterministically and flag it.
                choice = fallbackChoice(choices);
                String reason = (expected == null)
                        ? (underReview ? "under review, not in the answer key" : "not in the answer key")
                        : "key answer \"" + expected + "\" not among the options";
                guessed.put(qid, choice.getText().trim());
                notes.add(qid + " guessed (" + reason + "): picked \"" + choice.getText().trim() + "\" by the longest-option rule");
            }

            WebElement radio = choice.findElement(RADIO);
            radio.click();
            if (!radio.isSelected()) {
                throw new IllegalStateException("Clicked an option for " + qid + " but it isn't selected");
            }
        }

        browser.click(SUBMIT);
        browser.waitForVisible(RESULT_PANEL);

        // The score as a human sees it ("4/5"), and the full JSON response.
        String scoreText = browser.textOf(SCORE_VALUE).trim();
        JsonObject json = JsonParser.parseString(browser.textContentOf(RESULT_JSON)).getAsJsonObject();
        int score = json.get("score").getAsInt();
        int total = json.get("total").getAsInt();
        if (!scoreText.equals(score + "/" + total)) {
            notes.add("warning: page shows " + scoreText + " but JSON says " + score + "/" + total);
        }

        // Use the per-question breakdown to say whether each guess paid off.
        List<String> wrong = new ArrayList<>();
        for (JsonElement element : json.getAsJsonArray("breakdown")) {
            JsonObject item = element.getAsJsonObject();
            String qid = item.get("questionId").getAsString();
            boolean correct = item.get("correct").getAsBoolean();
            if (guessed.containsKey(qid)) {
                notes.add(qid + " guess was " + (correct ? "CORRECT" : "incorrect"));
            } else if (!correct) {
                wrong.add(qid);
            }
        }
        if (!wrong.isEmpty()) {
            notes.add("answered from the key but marked wrong: " + String.join(", ", wrong));
        }

        String summary = "Score " + score + "/" + total
                + (guessed.isEmpty() ? "" : " (" + guessed.size() + " guessed)");
        SolveResult result = SolveResult.graded(score, total, summary);
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

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /**
     * TEST-ONLY: download the answer key for one quiz from /debug/answers.
     *
     * This also shows how sessions work: we copy the HTTP-only session cookie
     * out of the logged-in browser and send it with a plain Java HTTP request.
     * The server accepts it because the cookie IS the login. Without it, the
     * endpoint answers 401 like every other protected API.
     */
    private Map<String, String> fetchAnswerKey(String quizId) {
        Cookie session = browser.getCookie(SESSION_COOKIE);
        if (session == null) {
            throw new IllegalStateException("No " + SESSION_COOKIE + " cookie: are we logged in?");
        }
        HttpRequest request = HttpRequest.newBuilder(URI.create(config.url("/debug/answers?quiz=" + quizId)))
                .header("Cookie", session.getName() + "=" + session.getValue())
                .timeout(Duration.ofSeconds(5))
                .GET()
                .build();
        try {
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new IllegalStateException("Answer key request failed with HTTP " + response.statusCode());
            }
            Map<String, String> key = new HashMap<>();
            JsonObject body = JsonParser.parseString(response.body()).getAsJsonObject();
            for (JsonElement quiz : body.getAsJsonArray("quizzes")) {
                for (JsonElement entry : quiz.getAsJsonObject().getAsJsonArray("answers")) {
                    JsonObject pair = entry.getAsJsonObject();
                    key.put(normalize(pair.get("question").getAsString()), pair.get("answer").getAsString());
                }
            }
            return key;
        } catch (IOException e) {
            throw new UncheckedIOException("Could not reach the answer key", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while fetching the answer key");
        }
    }

    /** Find the option whose text matches the expected answer (ignoring case and spacing). */
    private static WebElement findChoice(List<WebElement> choices, String expected) {
        String target = normalize(expected);
        for (WebElement choice : choices) {
            if (normalize(choice.getText()).equals(target)) {
                return choice;
            }
        }
        return null;
    }

    /**
     * FALLBACK STRATEGY (documented): choose the LONGEST option text, breaking
     * ties alphabetically. "The longest answer is often right" is a classic
     * test-taking heuristic. It's no better than a guess in general, but it is
     * DETERMINISTIC: because it depends only on the option text, not the
     * shuffled order, the bot makes the same choice every time.
     */
    static WebElement fallbackChoice(List<WebElement> choices) {
        WebElement best = choices.get(0);
        for (WebElement choice : choices) {
            String text = choice.getText().trim();
            String bestText = best.getText().trim();
            if (text.length() > bestText.length()
                    || (text.length() == bestText.length() && text.compareTo(bestText) < 0)) {
                best = choice;
            }
        }
        return best;
    }

    /**
     * Normalize question/option text for comparison: lowercase, collapse
     * spaces, and drop the "3. " numbering the page puts in front of questions.
     */
    static String normalize(String text) {
        return text.trim()
                .toLowerCase()
                .replaceAll("\\s+", " ")
                .replaceFirst("^\\d+\\.\\s*", "");
    }
}
