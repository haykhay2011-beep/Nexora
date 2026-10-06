package bot.solver;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads a MathDrill problem as plain text and computes the answer, entirely in Java.
 * No lookup tables, no external services: this is real parsing and algebra.
 *
 * It handles:
 *   arithmetic        "14 * 3", "6 + 4 * 5"   (respects order of operations)
 *   one-step algebra  "x + 9 = 20, solve for x", "5n = 35, solve for n", "k / 3 = 7, solve for k"
 *   two-step algebra  "3x + 7 = 22, solve for x"
 *
 * THE BIG IDEA: every value is a "linear expression" of the form
 *
 *         coefficient * x + constant
 *
 * A plain number like 7 is just  0x + 7.  The variable x is  1x + 0.
 * "3x" is 3 times x, which is 3x + 0. If we evaluate BOTH sides of an
 * equation into this form, we get
 *
 *         a x + b  =  c x + d
 *
 * and the solution is always   x = (d - b) / (a - c).
 * The same evaluator also does arithmetic: it just never sees an x.
 *
 * The work happens in three stages:
 *   1. normalize()  clean up messy text (extra spaces, trailing periods)
 *   2. tokenize()   split text into numbers, variables and operators
 *   3. evaluate()   combine the tokens, doing * and / before + and -
 *
 * Limitations (documented on purpose): no parentheses, no exponents, and
 * only one variable per problem. That covers every problem MathDrill makes.
 */
public class MathSolver {

    /** Finds the "solve for x" part of an algebra problem and captures the letter. */
    private static final Pattern SOLVE_FOR = Pattern.compile("solve\\s+for\\s+([a-z])");

    // ==================================================================
    //  Stage 1: normalize
    // ==================================================================

    /**
     * Clean up raw problem text from the page.
     *
     * About 1 in 6 MathDrill problems is deliberately displayed with extra
     * whitespace or a trailing period, e.g. "   9x   -   25   =   65,   solve   for   x.  "
     * A real page can contain all sorts of junk like this, so we:
     *   - turn non-breaking spaces and "fancy" math symbols into plain ones
     *     (the minus sign U+2212, multiply U+00D7 and divide U+00F7)
     *   - lowercase everything ("Solve for X" becomes "solve for x")
     *   - trim the ends and collapse runs of whitespace into one space
     *   - remove trailing periods (the sentence ending, not a decimal point)
     */
    public static String normalize(String raw) {
        if (raw == null) {
            throw new IllegalArgumentException("Problem text is missing");
        }
        String s = raw.replace(' ', ' ')
                .replace('−', '-')
                .replace('×', '*')
                .replace('÷', '/')
                .toLowerCase();
        s = s.trim().replaceAll("\\s+", " ");
        while (s.endsWith(".")) {
            s = s.substring(0, s.length() - 1).trim();
        }
        if (s.isEmpty()) {
            throw new IllegalArgumentException("Problem text is empty");
        }
        return s;
    }

    // ==================================================================
    //  The public entry point
    // ==================================================================

    /** Normalize, classify and solve one problem. */
    public static Solution solve(String rawProblem) {
        String text = normalize(rawProblem);

        // Pull out "solve for x" (if present) and remember the variable letter.
        String variable = null;
        String expression = text;
        Matcher m = SOLVE_FOR.matcher(text);
        if (m.find()) {
            variable = m.group(1);
            expression = text.substring(0, m.start()) + text.substring(m.end());
            expression = expression.replaceAll("[,:;]", " ").trim();
        }

        // No "=" means it's an arithmetic expression: just evaluate it.
        if (!expression.contains("=")) {
            Linear value = evaluate(tokenize(expression, null));
            if (value.coefficient != 0) {
                throw new IllegalArgumentException("Arithmetic problem unexpectedly contains a variable: " + text);
            }
            return new Solution(ProblemType.ARITHMETIC, text, null, value.constant);
        }

        // Otherwise it's an equation: evaluate both sides into  a x + b = c x + d.
        String[] sides = expression.split("=");
        if (sides.length != 2) {
            throw new IllegalArgumentException("Expected exactly one '=' in: " + text);
        }
        if (variable == null) {
            variable = findVariable(expression);
        }
        ArrayList<String> leftTokens = tokenize(sides[0], variable);
        ArrayList<String> rightTokens = tokenize(sides[1], variable);
        Linear left = evaluate(leftTokens);
        Linear right = evaluate(rightTokens);

        // a x + b = c x + d   =>   (a - c) x = d - b   =>   x = (d - b) / (a - c)
        double coefficient = left.coefficient - right.coefficient;
        double constant = right.constant - left.constant;
        if (Math.abs(coefficient) < 1e-12) {
            throw new ArithmeticException("Equation has no single solution: " + text);
        }
        double answer = constant / coefficient;
        return new Solution(classify(leftTokens, rightTokens, variable), text, variable, answer);
    }

    // ==================================================================
    //  Stage 2: tokenize
    // ==================================================================

    /**
     * Split an expression into tokens. For example
     *     "3x - 4"   becomes   ["3", "*", "x", "-", "4"]
     *     "-15"      becomes   ["-15"]
     *     "-x"       becomes   ["-1", "*", "x"]
     *
     * Two subtle cases:
     *   - "3x" has a HIDDEN multiplication, so we insert "*" between them.
     *   - A "-" is a negative sign (not subtraction) if it comes first or right
     *     after another operator, as in "= -15" or "4 * -2".
     *
     * @param variable the expected variable letter, or null for arithmetic
     */
    static ArrayList<String> tokenize(String expression, String variable) {
        ArrayList<String> tokens = new ArrayList<>();
        int i = 0;
        while (i < expression.length()) {
            char c = expression.charAt(i);

            if (c == ' ') {
                i++;
                continue;
            }

            boolean negativeSign = (c == '-') && (tokens.isEmpty() || isOperator(tokens.get(tokens.size() - 1)));
            if (Character.isDigit(c) || c == '.' || negativeSign) {
                StringBuilder number = new StringBuilder();
                if (negativeSign) {
                    number.append('-');
                    i++;
                    while (i < expression.length() && expression.charAt(i) == ' ') i++; // allow "- 5"
                }
                while (i < expression.length()
                        && (Character.isDigit(expression.charAt(i)) || expression.charAt(i) == '.')) {
                    number.append(expression.charAt(i));
                    i++;
                }
                if (number.toString().equals("-")) {
                    // A lone minus before a variable, like "-x", means -1 times x.
                    tokens.add("-1");
                    tokens.add("*");
                    continue;
                }
                tokens.add(number.toString());
                // Hidden multiplication: a number immediately followed by a letter ("3x").
                if (i < expression.length() && Character.isLetter(expression.charAt(i))) {
                    tokens.add("*");
                }
            } else if (Character.isLetter(c)) {
                String letter = String.valueOf(c);
                if (variable != null && !letter.equals(variable)) {
                    throw new IllegalArgumentException("Unexpected letter '" + c + "' (solving for " + variable + ")");
                }
                tokens.add(letter);
                i++;
            } else if (isOperator(String.valueOf(c))) {
                tokens.add(String.valueOf(c));
                i++;
            } else {
                throw new IllegalArgumentException("Unexpected character '" + c + "' in: " + expression);
            }
        }
        if (tokens.isEmpty()) {
            throw new IllegalArgumentException("Nothing to evaluate");
        }
        return tokens;
    }

    private static boolean isOperator(String token) {
        return token.equals("+") || token.equals("-") || token.equals("*") || token.equals("/");
    }

    /** If the problem doesn't say "solve for ...", use the first letter we find. */
    private static String findVariable(String expression) {
        for (int i = 0; i < expression.length(); i++) {
            if (Character.isLetter(expression.charAt(i))) {
                return String.valueOf(expression.charAt(i));
            }
        }
        throw new IllegalArgumentException("Equation has no variable: " + expression);
    }

    // ==================================================================
    //  Stage 3: evaluate (order of operations with two ArrayList passes)
    // ==================================================================

    /**
     * Evaluate tokens like ["6", "+", "4", "*", "5"] respecting order of operations.
     *
     * We split the tokens into two parallel lists:
     *     values:     [6, 4, 5]
     *     operators:  [+, *]
     * Operator i sits between values i and i+1.
     *
     * PASS 1 walks the operators and combines every * and / immediately:
     *     values: [6, 20]   operators: [+]
     * PASS 2 does the same for + and -, left to right:
     *     values: [26]      operators: []
     *
     * Watch the loop: when we combine, we REMOVE an element, so the next
     * operator slides into position i. That's why we only do i++ when we
     * DON'T combine. (Removing from an ArrayList while traversing it is a
     * classic AP CSA trap; this is the correct way to do it.)
     */
    static Linear evaluate(ArrayList<String> tokens) {
        ArrayList<Linear> values = new ArrayList<>();
        ArrayList<String> operators = new ArrayList<>();

        // Tokens must alternate: value, operator, value, operator, ..., value
        for (int i = 0; i < tokens.size(); i++) {
            String token = tokens.get(i);
            boolean shouldBeValue = (i % 2 == 0);
            if (shouldBeValue == isOperator(token)) {
                throw new IllegalArgumentException("Malformed expression near '" + token + "' in " + tokens);
            }
            if (shouldBeValue) {
                values.add(toLinear(token));
            } else {
                operators.add(token);
            }
        }
        if (values.size() != operators.size() + 1) {
            throw new IllegalArgumentException("Expression ends with an operator: " + tokens);
        }

        combine(values, operators, "*", "/"); // pass 1
        combine(values, operators, "+", "-"); // pass 2
        return values.get(0);
    }

    /** One pass: apply every operator equal to opA or opB, left to right. */
    private static void combine(ArrayList<Linear> values, ArrayList<String> operators, String opA, String opB) {
        int i = 0;
        while (i < operators.size()) {
            String op = operators.get(i);
            if (op.equals(opA) || op.equals(opB)) {
                Linear result = apply(values.get(i), op, values.get(i + 1));
                values.set(i, result);
                values.remove(i + 1);
                operators.remove(i);
                // no i++ here: the next operator has moved into position i
            } else {
                i++;
            }
        }
    }

    private static Linear apply(Linear a, String op, Linear b) {
        switch (op) {
            case "+": return a.plus(b);
            case "-": return a.minus(b);
            case "*": return a.times(b);
            default:  return a.dividedBy(b);
        }
    }

    private static Linear toLinear(String token) {
        if (Character.isLetter(token.charAt(0))) {
            return new Linear(1, 0); // the variable itself: 1x + 0
        }
        try {
            return new Linear(0, Double.parseDouble(token)); // a plain number: 0x + n
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Not a number: '" + token + "'");
        }
    }

    // ==================================================================
    //  Classification
    // ==================================================================

    /**
     * Decide whether an equation is one-step or two-step by counting the
     * operations applied to the variable's side:
     *     "x + 9"   -> ["x","+","9"]          1 operation  -> ONE_STEP
     *     "5x"      -> ["5","*","x"]          1 operation  -> ONE_STEP
     *     "3x + 7"  -> ["3","*","x","+","7"]  2 operations -> TWO_STEP
     * If the variable appears on both sides it takes extra steps, so TWO_STEP.
     */
    static ProblemType classify(ArrayList<String> left, ArrayList<String> right, String variable) {
        boolean inLeft = left.contains(variable);
        boolean inRight = right.contains(variable);
        if (inLeft && inRight) {
            return ProblemType.TWO_STEP;
        }
        ArrayList<String> side = inLeft ? left : right;
        int operations = 0;
        for (String token : side) {
            if (isOperator(token)) operations++;
        }
        return (operations <= 1) ? ProblemType.ONE_STEP : ProblemType.TWO_STEP;
    }

    // ==================================================================
    //  Formatting
    // ==================================================================

    /** Whole numbers print without ".0"; others print with up to 6 decimals. */
    public static String formatNumber(double value) {
        long rounded = Math.round(value);
        if (Math.abs(value - rounded) < 1e-9) {
            return Long.toString(rounded);
        }
        return new BigDecimal(value).setScale(6, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
    }

    // ==================================================================
    //  Helper class: a value of the form  coefficient * x + constant
    // ==================================================================

    /**
     * An immutable linear expression. A "static nested class" because it is
     * only meaningful inside the solver.
     */
    static class Linear {
        final double coefficient;
        final double constant;

        Linear(double coefficient, double constant) {
            this.coefficient = coefficient;
            this.constant = constant;
        }

        Linear plus(Linear other) {
            return new Linear(coefficient + other.coefficient, constant + other.constant);
        }

        Linear minus(Linear other) {
            return new Linear(coefficient - other.coefficient, constant - other.constant);
        }

        /** (ax + b)(cx + d) is only linear if at least one side has no x. */
        Linear times(Linear other) {
            if (coefficient != 0 && other.coefficient != 0) {
                throw new IllegalArgumentException("x times x is not a linear equation");
            }
            return new Linear(coefficient * other.constant + other.coefficient * constant, constant * other.constant);
        }

        /** Dividing by x isn't linear, and dividing by zero is undefined. */
        Linear dividedBy(Linear other) {
            if (other.coefficient != 0) {
                throw new IllegalArgumentException("Dividing by the variable is not supported");
            }
            if (other.constant == 0) {
                throw new ArithmeticException("Division by zero");
            }
            return new Linear(coefficient / other.constant, constant / other.constant);
        }
    }
}
