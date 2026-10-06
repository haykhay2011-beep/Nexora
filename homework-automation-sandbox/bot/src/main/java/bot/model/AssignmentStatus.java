package bot.model;

/**
 * The three states an assignment can be in on any platform.
 *
 * Each platform words these differently on screen (MathDrill says "done",
 * QuizZone says "Completed", WriteWell says "Submitted"), so
 * {@link #fromLabel(String)} translates the on-screen text into one shared enum.
 */
public enum AssignmentStatus {
    NOT_STARTED, IN_PROGRESS, DONE;

    /**
     * Convert a status label from any platform into an AssignmentStatus.
     * Matching is case-insensitive and ignores extra spaces.
     *
     * @throws IllegalArgumentException for a label we've never seen: that's an
     *         "unexpected page state", and the caller should treat it as an error
     *         rather than guess.
     */
    public static AssignmentStatus fromLabel(String label) {
        String clean = label.trim().toLowerCase().replaceAll("\\s+", " ");
        switch (clean) {
            case "not started":
            case "new":
                return NOT_STARTED;
            case "in progress":
            case "draft saved":
                return IN_PROGRESS;
            case "done":
            case "completed":
            case "submitted":
                return DONE;
            default:
                throw new IllegalArgumentException("Unknown assignment status: \"" + label + "\"");
        }
    }
}
