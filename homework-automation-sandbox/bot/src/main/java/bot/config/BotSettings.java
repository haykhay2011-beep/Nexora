package bot.config;

import java.nio.file.Path;

/**
 * Global settings from the "settings" section of platforms.json:
 * browser mode, wait timeout, and where output files go.
 */
public class BotSettings {

    private final boolean headless;
    private final int waitTimeoutSeconds;
    private final Path screenshotDir;
    private final Path reportFile;

    public BotSettings(boolean headless, int waitTimeoutSeconds, Path screenshotDir, Path reportFile) {
        this.headless = headless;
        this.waitTimeoutSeconds = waitTimeoutSeconds;
        this.screenshotDir = screenshotDir;
        this.reportFile = reportFile;
    }

    public boolean isHeadless() { return headless; }
    public int getWaitTimeoutSeconds() { return waitTimeoutSeconds; }
    public Path getScreenshotDir() { return screenshotDir; }
    public Path getReportFile() { return reportFile; }
}
