package bot.report;

import bot.model.Outcome;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;

/**
 * Collects a result for every assignment the bot touches, prints progress as
 * it goes, and at the end prints a summary table and writes run-report.txt.
 *
 * It also keeps a simple event log per platform ("protected page redirected
 * to login", "logged in", "logged out") so the report shows the
 * authentication flow actually happened.
 */
public class RunReporter {

    private final ArrayList<AssignmentResult> results = new ArrayList<>();
    private final ArrayList<String> events = new ArrayList<>();
    private final LocalDateTime startedAt = LocalDateTime.now();

    /** Log a platform-level event, e.g. "Logged in; dashboard verified". */
    public void event(String platform, String message) {
        String line = "[" + platform + "] " + message;
        events.add(line);
        System.out.println("  " + line);
    }

    /** Record the outcome for one assignment and print a one-line progress update. */
    public void record(AssignmentResult result) {
        results.add(result);
        System.out.printf("  %-9s %s / %s (%s) %s%n", result.getOutcome().getLabel(), result.getPlatform(),
                result.getAssignment(), result.getDurationText(), result.getDetail());
        for (String note : result.getNotes()) {
            System.out.println("            - " + note);
        }
        if (result.getScreenshot() != null) {
            System.out.println("            screenshot: " + result.getScreenshot());
        }
    }

    public ArrayList<AssignmentResult> getResults() {
        return new ArrayList<>(results);
    }

    /** How many results had the given outcome. */
    public int count(Outcome outcome) {
        int n = 0;
        for (AssignmentResult r : results) {
            if (r.getOutcome() == outcome) n++;
        }
        return n;
    }

    public boolean hasFailures() {
        return count(Outcome.FAILED) > 0;
    }

    /** Build the summary table as text (used for both the console and the file). */
    public String formatSummary() {
        String[] headers = {"Platform", "Assignment", "Result", "Duration", "Details"};
        // Find the widest value in each column so the table lines up.
        int[] widths = new int[headers.length];
        for (int c = 0; c < headers.length; c++) widths[c] = headers[c].length();
        ArrayList<String[]> rows = new ArrayList<>();
        for (AssignmentResult r : results) {
            String[] row = {r.getPlatform(), shorten(r.getAssignment(), 34), r.getOutcome().getLabel(),
                    r.getDurationText(), shorten(r.getDetail(), 60)};
            rows.add(row);
            for (int c = 0; c < row.length; c++) widths[c] = Math.max(widths[c], row[c].length());
        }

        StringBuilder sb = new StringBuilder();
        String divider = divider(widths);
        sb.append(divider).append(formatRow(headers, widths)).append(divider);
        for (String[] row : rows) sb.append(formatRow(row, widths));
        sb.append(divider);
        sb.append(String.format("Total: %d   passed: %d   partial: %d   submitted: %d   skipped: %d   failed: %d%n",
                results.size(), count(Outcome.PASSED), count(Outcome.PARTIAL), count(Outcome.SUBMITTED),
                count(Outcome.SKIPPED), count(Outcome.FAILED)));
        return sb.toString();
    }

    /** Print the final summary table to the console. */
    public void printSummary() {
        System.out.println();
        System.out.println("=== RUN SUMMARY ===");
        System.out.print(formatSummary());
    }

    /** Write the full report (summary, notes, screenshots, event log) to a text file. */
    public void writeReport(Path file) throws IOException {
        StringBuilder sb = new StringBuilder();
        sb.append("Homework Automation Sandbox: run report\n");
        sb.append("Started:  ").append(startedAt.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)).append('\n');
        sb.append("Finished: ").append(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)).append("\n\n");
        sb.append(formatSummary()).append('\n');

        sb.append("Details\n-------\n");
        for (AssignmentResult r : results) {
            sb.append(String.format("* %s / %s: %s (%s)%n", r.getPlatform(), r.getAssignment(),
                    r.getOutcome().getLabel(), r.getDurationText()));
            sb.append("    ").append(r.getDetail()).append('\n');
            for (String note : r.getNotes()) sb.append("    - ").append(note).append('\n');
            if (r.getScreenshot() != null) sb.append("    screenshot: ").append(r.getScreenshot()).append('\n');
        }

        sb.append("\nPlatform event log\n------------------\n");
        for (String e : events) sb.append(e).append('\n');

        if (file.getParent() != null) Files.createDirectories(file.getParent());
        Files.writeString(file, sb.toString());
    }

    private static String formatRow(String[] cells, int[] widths) {
        StringBuilder sb = new StringBuilder("|");
        for (int c = 0; c < cells.length; c++) {
            sb.append(' ').append(String.format("%-" + widths[c] + "s", cells[c])).append(" |");
        }
        return sb.append('\n').toString();
    }

    private static String divider(int[] widths) {
        StringBuilder sb = new StringBuilder("+");
        for (int w : widths) sb.append("-".repeat(w + 2)).append('+');
        return sb.append('\n').toString();
    }

    private static String shorten(String text, int max) {
        if (text == null) return "";
        return text.length() <= max ? text : text.substring(0, max - 3) + "...";
    }
}
