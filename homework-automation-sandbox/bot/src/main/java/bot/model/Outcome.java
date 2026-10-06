package bot.model;

/** How working on one assignment turned out. Used in the final report. */
public enum Outcome {
    PASSED("PASSED"),       // graded, and everything was correct
    PARTIAL("PARTIAL"),     // graded, but some answers were wrong
    SUBMITTED("SUBMITTED"), // ungraded work (WriteWell) that the platform accepted
    SKIPPED("SKIPPED"),     // nothing to do (e.g. already finished before this run)
    FAILED("FAILED");       // an error stopped us; see the details and screenshot

    private final String label;

    Outcome(String label) { this.label = label; }

    public String getLabel() { return label; }
}
