package bot.browser;

import bot.config.BotSettings;
import io.github.bonigarcia.wdm.WebDriverManager;
import org.openqa.selenium.By;
import org.openqa.selenium.Cookie;
import org.openqa.selenium.Keys;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.StaleElementReferenceException;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedCondition;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Wraps a Selenium WebDriver (one headless Chrome window) and gives the
 * adapters a small set of SAFE helpers: open a page, wait for an element,
 * click, type, read text, take a screenshot.
 *
 * WHY EXPLICIT WAITS INSTEAD OF Thread.sleep()?
 * Web pages load at unpredictable speeds. The mock platforms deliberately
 * render content after 200-300 ms, and a real site might take 50 ms one time
 * and 3 s the next. If we wrote Thread.sleep(1000):
 *   - when the page is faster, we waste time on every single step, and
 *   - when the page is slower, the element still isn't there and we crash.
 * A WebDriverWait instead checks a condition repeatedly (every 100 ms here)
 * and continues the MOMENT it's true, up to a maximum timeout.
 * It's both faster and more reliable. Every helper below waits for the
 * element to be present AND visible (or clickable) before touching it.
 *
 * DESIGN NOTE (encapsulation / wrapper class):
 * The adapters never create a ChromeDriver or a WebDriverWait themselves.
 * Keeping all of that here means browser setup, timeouts and screenshots
 * are written once, and changing them changes them everywhere.
 */
public class BrowserSession implements AutoCloseable {

    /** How often a wait re-checks its condition. Selenium's default is 500 ms. */
    private static final Duration POLL_INTERVAL = Duration.ofMillis(100);

    // Selenium logs a harmless warning when its DevTools support is older than
    // the installed Chrome. Silence its routine logging so the console stays readable.
    // (Kept in a static field because Java may forget loggers nobody references.)
    private static final Logger SELENIUM_LOG = Logger.getLogger("org.openqa.selenium");
    static {
        SELENIUM_LOG.setLevel(Level.SEVERE);
    }

    private final WebDriver driver;
    private final WebDriverWait wait;
    private final Path screenshotDir;

    /** Start a new Chrome window configured from the bot settings. */
    public BrowserSession(BotSettings settings) {
        ChromeOptions options = new ChromeOptions();
        if (settings.isHeadless()) {
            options.addArguments("--headless=new"); // no visible window
        }
        options.addArguments("--window-size=1280,900", "--no-sandbox", "--disable-dev-shm-usage");

        // Optional overrides for unusual setups (e.g. a Chromium that isn't
        // installed in the standard place). Normally neither is needed.
        String chromeBinary = System.getenv("CHROME_BINARY");
        if (chromeBinary != null && !chromeBinary.isBlank()) {
            options.setBinary(chromeBinary);
        }
        String chromedriver = System.getenv("CHROMEDRIVER");
        if (chromedriver != null && !chromedriver.isBlank()) {
            System.setProperty("webdriver.chrome.driver", chromedriver);
        } else {
            // WebDriverManager finds your installed Chrome version and downloads
            // the matching chromedriver, so nobody installs drivers by hand.
            WebDriverManager manager = WebDriverManager.chromedriver();
            if (chromeBinary != null && !chromeBinary.isBlank()) {
                String major = detectMajorVersion(chromeBinary);
                if (major != null) manager.browserVersion(major);
            }
            manager.setup();
        }

        this.driver = new ChromeDriver(options);
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(settings.getWaitTimeoutSeconds()));
        // Check conditions every 100 ms instead of every 500 ms, so the bot reacts
        // quickly when the page is ready (the timeout above is still the upper limit).
        this.wait.pollingEvery(POLL_INTERVAL);
        this.screenshotDir = settings.getScreenshotDir();
    }

    // ------------------------------------------------------------------
    // Navigation
    // ------------------------------------------------------------------

    public void open(String url) {
        driver.get(url);
    }

    public String currentUrl() {
        return driver.getCurrentUrl();
    }

    /** Wait until the address bar contains the given text (e.g. "/dashboard"). */
    public void waitForUrlContains(String fragment) {
        wait.until(ExpectedConditions.urlContains(fragment));
    }

    // ------------------------------------------------------------------
    // Waiting
    // ------------------------------------------------------------------

    /**
     * Wait for any Selenium ExpectedCondition. Adapters use this for special
     * cases, e.g. "wait until EITHER the results OR the next problem shows up".
     * Throws org.openqa.selenium.TimeoutException if it never becomes true.
     */
    public <T> T waitUntil(ExpectedCondition<T> condition) {
        return wait.until(condition);
    }

    /** Wait until an element is in the page AND visible, then return it. */
    public WebElement waitForVisible(By locator) {
        return wait.until(ExpectedConditions.visibilityOfElementLocated(locator));
    }

    /** Wait until an element is visible AND enabled, so a click will work. */
    public WebElement waitForClickable(By locator) {
        return wait.until(ExpectedConditions.elementToBeClickable(locator));
    }

    /** Wait until an element is hidden or removed from the page (e.g. a loading spinner). */
    public void waitForInvisible(By locator) {
        wait.until(ExpectedConditions.invisibilityOfElementLocated(locator));
    }

    // ------------------------------------------------------------------
    // Interacting
    // ------------------------------------------------------------------

    /**
     * Wait until clickable, then click.
     *
     * Pages built with JavaScript sometimes replace an element between the
     * moment we find it and the moment we click it. Selenium then throws
     * StaleElementReferenceException. We handle that by finding the element
     * again and retrying once.
     */
    public void click(By locator) {
        try {
            waitForClickable(locator).click();
        } catch (StaleElementReferenceException e) {
            waitForClickable(locator).click();
        }
    }

    /**
     * Wait until visible, clear whatever is already in the field, then type.
     * Clearing matters: WriteWell can pre-fill a saved draft, and typing
     * without clearing would append to it.
     */
    public void type(By locator, String text) {
        WebElement field = waitForVisible(locator);
        field.clear();
        // Some pages don't react to clear(); fall back to select-all + delete.
        String leftover = field.getDomProperty("value");
        if (leftover != null && !leftover.isEmpty()) {
            field.sendKeys(Keys.chord(Keys.CONTROL, "a"), Keys.DELETE);
        }
        field.sendKeys(text);
    }

    /** Wait until visible and return the element's visible text. */
    public String textOf(By locator) {
        return waitForVisible(locator).getText();
    }

    /**
     * Read the raw text of an element even if it is HIDDEN.
     * getText() only returns text a human could see, so for an element inside
     * a collapsed &lt;details&gt; box it returns "". The DOM property
     * "textContent" returns the text regardless of visibility.
     */
    public String textContentOf(By locator) {
        return wait.until(ExpectedConditions.presenceOfElementLocated(locator)).getDomProperty("textContent");
    }

    /** Find all matching elements right now (no waiting). May return an empty list. */
    public List<WebElement> findAll(By locator) {
        return driver.findElements(locator);
    }

    /** True if at least one matching element exists and is displayed. Never waits, never throws. */
    public boolean isVisible(By locator) {
        for (WebElement element : driver.findElements(locator)) {
            try {
                if (element.isDisplayed()) return true;
            } catch (StaleElementReferenceException ignored) {
                // The element disappeared while we were checking; treat it as not visible.
            }
        }
        return false;
    }

    /** Read a cookie (including HTTP-only ones, which page JavaScript can't see). */
    public Cookie getCookie(String name) {
        return driver.manage().getCookieNamed(name);
    }

    // ------------------------------------------------------------------
    // Debugging aids
    // ------------------------------------------------------------------

    /**
     * Save a PNG of the current page into the screenshot folder and return its
     * path. Returns null (instead of throwing) if the screenshot itself fails,
     * because a broken screenshot must never hide the original error.
     */
    public Path screenshot(String label) {
        try {
            Files.createDirectories(screenshotDir);
            String stamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss"));
            String safeLabel = label.replaceAll("[^A-Za-z0-9_-]+", "_");
            Path target = screenshotDir.resolve(stamp + "-" + safeLabel + ".png");
            File png = ((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE);
            Files.copy(png.toPath(), target, StandardCopyOption.REPLACE_EXISTING);
            return target;
        } catch (Exception e) {
            System.err.println("  (could not save screenshot: " + e.getMessage() + ")");
            return null;
        }
    }

    /** Close the browser. Called automatically by try-with-resources. */
    @Override
    public void close() {
        driver.quit();
    }

    /** Run "chrome --version" and pull out the major version, e.g. "141". */
    private static String detectMajorVersion(String chromeBinary) {
        try {
            Process process = new ProcessBuilder(chromeBinary, "--version").redirectErrorStream(true).start();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line = reader.readLine();
                Matcher m = Pattern.compile("(\\d+)\\.\\d+").matcher(line == null ? "" : line);
                return m.find() ? m.group(1) : null;
            }
        } catch (IOException e) {
            return null;
        }
    }
}
