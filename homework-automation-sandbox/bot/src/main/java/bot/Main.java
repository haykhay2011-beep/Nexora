package bot;

import bot.adapters.PlatformAdapter;
import bot.browser.BrowserSession;
import bot.config.BotConfig;
import bot.config.BotSettings;
import bot.config.ConfigLoader;
import bot.config.PlatformConfig;
import bot.model.Assignment;
import bot.model.Outcome;
import bot.model.SolveResult;
import bot.report.AssignmentResult;
import bot.report.RunReporter;
import io.github.bonigarcia.wdm.config.WebDriverManagerException;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriverException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Entry point. For every platform in platforms.json:
 *
 *   1. start a fresh browser
 *   2. build the right adapter (factory method, see createAdapter)
 *   3. check the dashboard is protected, then log in
 *   4. list the assignments and SORT them by due date (Assignment is Comparable)
 *   5. solve each one, catching errors per assignment
 *   6. log out and close the browser
 *
 * Then print the summary table and write run-report.txt.
 *
 * ERROR HANDLING has two layers:
 *   - Each ASSIGNMENT is wrapped in try/catch: one broken assignment is
 *     logged, screenshotted and skipped, and the bot moves on to the next.
 *   - Each PLATFORM is wrapped in try/catch: if a whole platform is down or
 *     login fails, we record that and continue with the next platform.
 *
 * Usage (from the bot/ folder):
 *   mvn -q compile exec:java                               run every platform
 *   mvn -q compile exec:java -Dexec.args="MathDrill"       run only the named platform(s)
 *   mvn -q compile exec:java -Dconfig=/path/platforms.json use a different config file
 */
public class Main {

    public static void main(String[] args) {
        System.out.println("Homework Automation Sandbox bot (local mock platforms only)");

        BotConfig config;
        try {
            Path configPath = findConfig();
            System.out.println("Config: " + configPath.toAbsolutePath().normalize());
            config = ConfigLoader.load(configPath);
        } catch (ConfigLoader.ConfigException e) {
            System.err.println("Config error: " + e.getMessage());
            System.exit(2);
            return;
        }

        RunReporter reporter = new RunReporter();
        List<PlatformConfig> platforms = selectPlatforms(config.getPlatforms(), args);
        for (PlatformConfig platform : platforms) {
            runPlatform(platform, config.getSettings(), reporter);
        }

        reporter.printSummary();
        Path reportFile = config.getSettings().getReportFile();
        try {
            reporter.writeReport(reportFile);
            System.out.println("Report written to " + reportFile);
        } catch (IOException e) {
            System.err.println("Could not write report: " + e.getMessage());
        }

        // Exit code 0 = everything ran; 1 = at least one failure (useful for scripts/CI).
        System.exit(reporter.hasFailures() ? 1 : 0);
    }

    /**
     * Run login -> list -> solve -> logout for ONE platform. Never throws:
     * any problem is recorded in the report and we return normally, so the
     * next platform still runs.
     */
    static void runPlatform(PlatformConfig platform, BotSettings settings, RunReporter reporter) {
        System.out.println();
        System.out.println("=== " + platform.getName() + " (" + platform.getBaseUrl() + ") ===");
        long start = System.currentTimeMillis();
        String stage = "starting the browser";
        BrowserSession browser = null;
        try {
            browser = new BrowserSession(settings);

            // POLYMORPHISM: the variable's type is the abstract PlatformAdapter,
            // but the object is a MathDrillAdapter, QuizZoneAdapter, etc.
            // Every call below runs that subclass's own version of the method.
            PlatformAdapter adapter = createAdapter(platform, browser);

            stage = "checking that pages require login";
            adapter.verifyLoginRequired();
            reporter.event(platform.getName(), "Dashboard redirected to the login page before signing in (pages are protected)");

            stage = "logging in";
            adapter.login();
            reporter.event(platform.getName(), "Logged in and verified the dashboard");

            stage = "listing assignments";
            ArrayList<Assignment> assignments = adapter.listAssignments();
            Collections.sort(assignments); // earliest due date first, thanks to Comparable
            reporter.event(platform.getName(), "Found " + assignments.size() + " assignments; working in due-date order");

            for (Assignment assignment : assignments) {
                solveOne(adapter, browser, assignment, reporter);
            }

            stage = "logging out";
            adapter.logout();
            reporter.event(platform.getName(), "Logged out (session cookie cleared)");
        } catch (Exception e) {
            // Something went wrong at the PLATFORM level (server down, login failed...).
            Path shot = (browser != null) ? browser.screenshot(platform.getName() + "-platform-error") : null;
            reporter.record(new AssignmentResult(platform.getName(), "(" + stage + ")", Outcome.FAILED,
                    describe(e), List.of(), System.currentTimeMillis() - start, shot));
        } finally {
            if (browser != null) {
                try {
                    browser.close();
                } catch (Exception ignored) {
                    // The browser may already be gone; nothing more to do.
                }
            }
        }
    }

    /** Solve one assignment, timing it and turning any exception into a FAILED row. */
    static void solveOne(PlatformAdapter adapter, BrowserSession browser, Assignment assignment, RunReporter reporter) {
        String platform = assignment.getPlatformName();
        if (assignment.isDone()) {
            reporter.record(new AssignmentResult(platform, assignment.getTitle(), Outcome.SKIPPED,
                    "Already done before this run (re-seed to reset)", List.of(), 0, null));
            return;
        }
        long start = System.currentTimeMillis();
        try {
            SolveResult result = adapter.solveAssignment(assignment);
            reporter.record(new AssignmentResult(platform, assignment.getTitle(), result.getOutcome(),
                    result.getSummary(), result.getNotes(), System.currentTimeMillis() - start, null));
        } catch (Exception e) {
            // Log, screenshot, skip: one failure never stops the rest of the run.
            Path shot = browser.screenshot(platform + "-" + assignment.getId());
            reporter.record(new AssignmentResult(platform, assignment.getTitle(), Outcome.FAILED,
                    describe(e), List.of(), System.currentTimeMillis() - start, shot));
        }
    }

    /**
     * FACTORY METHOD: build the right adapter for a platform.
     *
     * The adapter's class name comes from platforms.json ("adapter": "MathDrillAdapter").
     * We look the class up by name and call its (PlatformConfig, BrowserSession)
     * constructor. This is called "reflection". Because of it, adding a fourth
     * platform needs NO change here: write the new class, add the config entry.
     *
     * The simpler alternative would be a switch statement:
     *     switch (config.getAdapterClass()) {
     *         case "MathDrillAdapter": return new MathDrillAdapter(config, browser);
     *         case "QuizZoneAdapter":  return new QuizZoneAdapter(config, browser);
     *         ...
     *     }
     * That's easier to read, but every new platform would mean editing this method too.
     */
    static PlatformAdapter createAdapter(PlatformConfig config, BrowserSession browser) {
        String className = "bot.adapters." + config.getAdapterClass();
        try {
            Class<?> cls = Class.forName(className);
            if (!PlatformAdapter.class.isAssignableFrom(cls)) {
                throw new IllegalArgumentException(className + " does not extend PlatformAdapter");
            }
            return (PlatformAdapter) cls.getConstructor(PlatformConfig.class, BrowserSession.class)
                    .newInstance(config, browser);
        } catch (ClassNotFoundException e) {
            throw new IllegalArgumentException("No adapter class named " + className
                    + " (check the \"adapter\" field in platforms.json)");
        } catch (ReflectiveOperationException e) {
            throw new IllegalArgumentException("Could not create " + className + ": " + e);
        }
    }

    /**
     * Turn an exception into a short, readable explanation for the report.
     * Separate catch-style branches for the common Selenium failures.
     */
    static String describe(Exception e) {
        String message = (e.getMessage() == null) ? "" : e.getMessage().split("\n")[0];
        if (e instanceof TimeoutException) {
            return "Timed out waiting for the page: " + message;
        } else if (e instanceof NoSuchElementException) {
            return "Expected element not found: " + message;
        } else if (e instanceof WebDriverException && message.contains("ERR_CONNECTION_REFUSED")) {
            return "Platform is not running (connection refused). Did you run `npm run start-all`?";
        } else if (e instanceof WebDriverException) {
            return "Browser error: " + message;
        } else if (e instanceof WebDriverManagerException) {
            return "Could not download a chromedriver automatically (" + message
                    + "). Set CHROMEDRIVER=/path/to/chromedriver to use one you already have.";
        }
        return e.getClass().getSimpleName() + ": " + message;
    }

    /** Use -Dconfig=... if given, otherwise look for platforms.json here or one folder up. */
    static Path findConfig() {
        String override = System.getProperty("config");
        if (override != null && !override.isBlank()) {
            return Path.of(override);
        }
        for (Path candidate : new Path[]{Path.of("platforms.json"), Path.of("..", "platforms.json")}) {
            if (Files.exists(candidate)) {
                return candidate;
            }
        }
        throw new ConfigLoader.ConfigException("Could not find platforms.json (looked in . and ..). Use -Dconfig=path");
    }

    /** If platform names were given on the command line, run only those. */
    static List<PlatformConfig> selectPlatforms(List<PlatformConfig> all, String[] names) {
        if (names == null || names.length == 0) {
            return all;
        }
        List<PlatformConfig> chosen = new ArrayList<>();
        for (PlatformConfig p : all) {
            for (String name : names) {
                if (p.getName().equalsIgnoreCase(name)) chosen.add(p);
            }
        }
        if (chosen.isEmpty()) {
            System.err.println("No platform matched " + String.join(", ", names) + "; running all.");
            return all;
        }
        return chosen;
    }
}
