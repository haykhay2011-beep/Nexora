package bot.solver;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** Unit tests for the MathDrill parser/solver. No browser needed. */
class MathSolverTest {

    /**
     * A dozen-plus problems covering all three types, plus messy input.
     * Each row: problem text | expected answer | expected type.
     * (The '|' delimiter is used because the problems contain commas.)
     */
    @ParameterizedTest(name = "{0}  ->  {1} ({2})")
    @CsvSource(delimiter = '|', value = {
            "14 * 3                          | 42  | ARITHMETIC",
            "76 - 19                         | 57  | ARITHMETIC",
            "120 / 12                        | 10  | ARITHMETIC",
            "6 + 4 * 5                       | 26  | ARITHMETIC",
            "4 * 7 - 9                       | 19  | ARITHMETIC",
            "x + 9 = 20, solve for x         | 11  | ONE_STEP",
            "k + 11 = 8, solve for k         | -3  | ONE_STEP",
            "x - 14 = -11, solve for x       | 3   | ONE_STEP",
            "8y = 56, solve for y            | 7   | ONE_STEP",
            "n / 5 = 8, solve for n          | 40  | ONE_STEP",
            "3x + 7 = 22, solve for x        | 5   | TWO_STEP",
            "4y + 23 = 71, solve for y       | 12  | TWO_STEP",
            "8k - 9 = -17, solve for k       | -1  | TWO_STEP",
            "3x - 3 = -15, solve for x       | -4  | TWO_STEP",
            "2x + 3 = x + 10, solve for x    | 7   | TWO_STEP",
            "5x = 12, solve for x            | 2.4 | ONE_STEP",
    })
    void solvesProblems(String problem, String expectedAnswer, ProblemType expectedType) {
        Solution solution = MathSolver.solve(problem);
        assertEquals(expectedAnswer, solution.getAnswerText());
        assertEquals(expectedType, solution.getType());
    }

    @Test
    void handlesMessyWhitespaceAndTrailingPeriods() {
        assertEquals("10", MathSolver.solve("  9x   -   25   =   65,   solve   for   x.  ").getAnswerText());
        assertEquals("2", MathSolver.solve("10 / 5.").getAnswerText());
        assertEquals("105", MathSolver.solve("  15   *   7   ").getAnswerText());
        assertEquals("0", MathSolver.solve("  y   +   11   =   11,   solve   for   y.  ").getAnswerText());
    }

    @Test
    void normalizeCleansText() {
        assertEquals("3x + 7 = 22, solve for x", MathSolver.normalize("  3x   +  7 = 22, Solve for X.  "));
        assertEquals("12 * 3", MathSolver.normalize("12 × 3"));
        assertEquals("5 - 2", MathSolver.normalize("5 − 2..."));
    }

    @Test
    void understandsSolveForPrefixAndNegativeVariable() {
        assertEquals("-5", MathSolver.solve("Solve for x: -x = 5").getAnswerText());
    }

    @Test
    void rejectsGarbage() {
        assertThrows(IllegalArgumentException.class, () -> MathSolver.solve("what is love?"));
        assertThrows(IllegalArgumentException.class, () -> MathSolver.solve("   "));
        assertThrows(IllegalArgumentException.class, () -> MathSolver.solve("3 + * 4"));
        assertThrows(ArithmeticException.class, () -> MathSolver.solve("8 / 0"));
        assertThrows(ArithmeticException.class, () -> MathSolver.solve("x + 1 = x + 2, solve for x"));
    }

    /**
     * Bonus check: if the MathDrill seed data exists, solve EVERY seeded problem
     * (exactly as displayed on the page, messy ones included) and compare with
     * the platform's stored answer and type tag. Skipped if you haven't seeded.
     */
    @Test
    void solvesEverySeededMathDrillProblem() throws Exception {
        Path db = Path.of("..", "platforms", "mathdrill", "data", "db.json");
        assumeTrue(Files.exists(db), "run `npm run seed` to enable this test");
        JsonObject root = JsonParser.parseString(Files.readString(db)).getAsJsonObject();
        int checked = 0;
        for (JsonElement a : root.getAsJsonArray("assignments")) {
            for (JsonElement p : a.getAsJsonObject().getAsJsonArray("problems")) {
                JsonObject problem = p.getAsJsonObject();
                Solution s = MathSolver.solve(problem.get("display").getAsString());
                assertEquals(problem.get("answer").getAsDouble(), s.getValue(), 1e-9, problem.toString());
                assertEquals(problem.get("type").getAsString(), s.getType().getLabel(), problem.toString());
                checked++;
            }
        }
        assertEquals(31, checked);
    }
}
