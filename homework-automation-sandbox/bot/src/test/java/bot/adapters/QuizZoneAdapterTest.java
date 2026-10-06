package bot.adapters;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Tests the pure text-matching helper; the browser parts are covered by the end-to-end run. */
class QuizZoneAdapterTest {

    @Test
    void normalizeStripsNumberingCaseAndSpacing() {
        assertEquals("what is the capital of canada?", QuizZoneAdapter.normalize("3.  What is the   capital of Canada? "));
        assertEquals("ottawa", QuizZoneAdapter.normalize("  Ottawa "));
        assertEquals("0 and 1", QuizZoneAdapter.normalize("0 and 1")); // a leading digit that isn't numbering stays
    }
}
