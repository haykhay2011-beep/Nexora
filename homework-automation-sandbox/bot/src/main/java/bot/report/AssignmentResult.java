package bot.report;

import bot.model.Outcome;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/** One row of the final report: what happened to one assignment (or one platform step). */
public class AssignmentResult {

    private final String platform;
    private final String assignment;
    private final Outcome outcome;
    private final String detail;
    private final List<String> notes;
    private final long durationMillis;
    private final Path screenshot; // null unless something failed

    public AssignmentResult(String platform, String assignment, Outcome outcome, String detail,
                            List<String> notes, long durationMillis, Path screenshot) {
        this.platform = platform;
        this.assignment = assignment;
        this.outcome = outcome;
        this.detail = detail;
        this.notes = new ArrayList<>(notes);
        this.durationMillis = durationMillis;
        this.screenshot = screenshot;
    }

    public String getPlatform() { return platform; }
    public String getAssignment() { return assignment; }
    public Outcome getOutcome() { return outcome; }
    public String getDetail() { return detail; }
    public List<String> getNotes() { return new ArrayList<>(notes); }
    public long getDurationMillis() { return durationMillis; }
    public Path getScreenshot() { return screenshot; }

    /** e.g. 1234 ms -> "1.2s" */
    public String getDurationText() {
        return String.format("%.1fs", durationMillis / 1000.0);
    }
}
