package bot.writing;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TemplateTextGeneratorTest {

    private final TemplateTextGenerator generator = new TemplateTextGenerator();

    @Test
    void picksTheMatchingTopicAndConfidence() {
        GeneratedText loops = generator.draft("Describe how a for loop works and when you would use a loop instead of repeating code.");
        assertEquals("loops", loops.getTopic());
        assertEquals(GeneratedText.Confidence.HIGH, loops.getConfidence());

        GeneratedText variable = generator.draft("In 3 to 4 sentences, explain what a variable is in programming.");
        assertEquals("variables", variable.getTopic());
        assertEquals(GeneratedText.Confidence.MEDIUM, variable.getConfidence());
    }

    @Test
    void unknownTopicsDegradeToALowConfidenceGenericAnswer() {
        GeneratedText text = generator.draft("Describe your ideal weekend and explain what makes it relaxing for you.");
        assertEquals("general", text.getTopic());
        assertEquals(GeneratedText.Confidence.LOW, text.getConfidence());
        assertTrue(text.getText().contains("weekend"), text.getText());
    }

    @Test
    void keywordsMatchWholeWordsOnly() {
        // "rain" must not match inside "explain"
        assertEquals(0, TemplateTextGenerator.countKeywordHits("Please explain this", List.of("rain")));
        assertEquals(1, TemplateTextGenerator.countKeywordHits("Rain, again!", List.of("rain")));
    }

    @Test
    void lengthenAlwaysReachesTheMinimum() {
        for (String prompt : new String[]{"Explain the water cycle.", "Describe your favorite food."}) {
            GeneratedText draft = generator.draft(prompt);
            for (int min : new int[]{10, 45, 120}) {
                GeneratedText longer = generator.lengthen(draft, min);
                assertTrue(longer.getWordCount() >= min, prompt + " / " + min + " -> " + longer.getWordCount());
                assertTrue(longer.getText().startsWith(draft.getText()), "lengthen should keep the original draft");
            }
        }
    }

    @Test
    void countWordsMatchesThePlatformRule() {
        assertEquals(4, GeneratedText.countWords("  one   two\nthree\t four  "));
        assertEquals(0, GeneratedText.countWords("   "));
    }
}
