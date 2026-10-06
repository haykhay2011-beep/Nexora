package bot.solver;

/** The three kinds of MathDrill problems. */
public enum ProblemType {
    ARITHMETIC("arithmetic"), // 14 * 3          (no variable, no "=")
    ONE_STEP("one-step"),     // x + 9 = 20      (one operation applied to the variable)
    TWO_STEP("two-step");     // 3x + 7 = 22     (two or more operations)

    private final String label;

    ProblemType(String label) { this.label = label; }

    /** Matches the type names the MathDrill server uses, e.g. "one-step". */
    public String getLabel() { return label; }
}
