package bot.model;

import java.util.ArrayList;
import java.util.List;

/**
 * What an adapter returns after working on one assignment: an {@link Outcome},
 * a one-line summary (e.g. "Score 7/8"), and optional notes that flag anything
 * a human should look at ("q5 guessed", "low confidence", "retried 2x").
 */
public class SolveResult {

    private final Outcome outcome;
    private final String summary;
    private final ArrayList<String> notes = new ArrayList<>();

    public SolveResult(Outcome outcome, String summary) {
        this.outcome = outcome;
        this.summary = summary;
    }

    /**
     * For graded work: PASSED if every answer was right, otherwise PARTIAL.
     * This is a "static factory method", a named alternative to a constructor.
     */
    public static SolveResult graded(int correct, int total, String summary) {
        Outcome outcome = (correct == total) ? Outcome.PASSED : Outcome.PARTIAL;
        return new SolveResult(outcome, summary);
    }

    /** Add a note and return this object, so calls can be chained. */
    public SolveResult addNote(String note) {
        notes.add(note);
        return this;
    }

    public Outcome getOutcome() { return outcome; }
    public String getSummary() { return summary; }
    public List<String> getNotes() { return new ArrayList<>(notes); }
}
