package bot.solver;

/** The result of solving one problem: what kind it was, and the answer. */
public class Solution {

    private final ProblemType type;
    private final String normalizedText;
    private final String variable; // null for arithmetic problems
    private final double value;

    public Solution(ProblemType type, String normalizedText, String variable, double value) {
        this.type = type;
        this.normalizedText = normalizedText;
        this.variable = variable;
        this.value = value;
    }

    public ProblemType getType() { return type; }
    public String getNormalizedText() { return normalizedText; }
    public String getVariable() { return variable; }
    public double getValue() { return value; }

    /** The answer formatted for typing into the page: "42", "-3" or "2.5". */
    public String getAnswerText() {
        return MathSolver.formatNumber(value);
    }

    @Override
    public String toString() {
        String lhs = (variable == null) ? normalizedText : variable;
        return lhs + " = " + getAnswerText() + " [" + type.getLabel() + "]";
    }
}
