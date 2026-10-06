package bot.adapters;

import bot.browser.BrowserSession;
import bot.config.PlatformConfig;
import bot.model.Assignment;
import bot.model.SolveResult;
import org.openqa.selenium.By;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.support.ui.ExpectedConditions;

import java.util.ArrayList;

/**
 * THE HEART OF THE OBJECT-ORIENTED DESIGN.
 *
 * PlatformAdapter is an abstract class that defines the operations EVERY
 * homework platform supports:
 *
 *     login()                      sign in and prove we reached the dashboard
 *     listAssignments()            read the dashboard into Assignment objects
 *     solveAssignment(Assignment)  work through one assignment
 *     logout()                     end the session cleanly
 *
 * It says WHAT must happen, not HOW. Each platform's subclass
 * (MathDrillAdapter, QuizZoneAdapter, WriteWellAdapter) fills in the HOW:
 * its own selectors, its own login form, its own way of answering.
 *
 * POLYMORPHISM: Main holds every adapter in a variable of type
 * PlatformAdapter and calls adapter.login(), adapter.listAssignments(), and so on.
 * Java decides at RUN TIME which subclass's version of the method to run,
 * based on the actual object. Main never needs an if-statement like
 * "if this is MathDrill do X, else if QuizZone do Y".
 *
 * EXTENSIBILITY: to support a fourth platform, write one new subclass and
 * add one entry to platforms.json. Nothing else changes.
 *
 * INHERITANCE: code that is the same for every platform (checking that
 * pages are protected, verifying the dashboard after login) is written once
 * here, and every subclass inherits it.
 */
public abstract class PlatformAdapter {

    // "protected" = visible to subclasses but hidden from the rest of the program.
    protected final PlatformConfig config;
    protected final BrowserSession browser;

    protected PlatformAdapter(PlatformConfig config, BrowserSession browser) {
        this.config = config;
        this.browser = browser;
    }

    public String getName() {
        return config.getName();
    }

    // ==================================================================
    //  The contract: every subclass MUST implement these.
    // ==================================================================

    /** Log in through the platform's own login form, then call verifyOnDashboard(). */
    public abstract void login();

    /** Read every assignment from the dashboard. */
    public abstract ArrayList<Assignment> listAssignments();

    /** Work through one assignment and report how it went. */
    public abstract SolveResult solveAssignment(Assignment assignment);

    /** Click the platform's logout control and confirm we're back at the login page. */
    public abstract void logout();

    /** An element that only exists on the dashboard (proves login worked). */
    protected abstract By dashboardMarker();

    /** The element where this platform shows login errors ("wrong password"). */
    protected abstract By loginErrorLocator();

    // ==================================================================
    //  Shared behavior, inherited by every subclass.
    // ==================================================================

    /**
     * AUTHENTICATION CHECK, run BEFORE logging in: visit the dashboard with no
     * session cookie and confirm the platform bounces us to the login page.
     * This proves the pages really are protected, so when we DO reach them
     * later it's because our login created a valid session.
     */
    public void verifyLoginRequired() {
        browser.open(config.getDashboardUrl());
        try {
            browser.waitForUrlContains(config.getLoginPath());
        } catch (TimeoutException e) {
            throw new IllegalStateException(getName() + " showed " + config.getDashboardPath()
                    + " without logging in. Expected a redirect to " + config.getLoginPath());
        }
    }

    /**
     * AUTHENTICATION CHECK, run AFTER submitting the login form. We wait for
     * EITHER the dashboard URL OR a login error message, whichever comes first.
     * Then we confirm the dashboard marker is visible. If anything is off we
     * "fail loudly" with a LoginFailedException that includes the page's own
     * error message, rather than carrying on and failing mysteriously later.
     */
    protected void verifyOnDashboard() {
        try {
            browser.waitUntil(ExpectedConditions.or(
                    ExpectedConditions.urlContains(config.getDashboardPath()),
                    ExpectedConditions.visibilityOfElementLocated(loginErrorLocator())));
        } catch (TimeoutException e) {
            throw new LoginFailedException(getName() + ": login didn't reach the dashboard (still at "
                    + browser.currentUrl() + ")");
        }
        if (browser.isVisible(loginErrorLocator())) {
            String message = browser.textOf(loginErrorLocator());
            throw new LoginFailedException(getName() + ": login rejected: \"" + message.trim() + "\"");
        }
        try {
            browser.waitForVisible(dashboardMarker());
        } catch (TimeoutException e) {
            throw new LoginFailedException(getName() + ": reached " + browser.currentUrl()
                    + " but the dashboard never appeared");
        }
    }

    /** Make sure the browser is on the dashboard (navigating there if needed). */
    protected void goToDashboard() {
        if (!browser.currentUrl().contains(config.getDashboardPath())) {
            browser.open(config.getDashboardUrl());
        }
    }
}
