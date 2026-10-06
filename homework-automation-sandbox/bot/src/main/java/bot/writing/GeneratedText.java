package bot.writing;

/**
 * A piece of generated writing plus how much the generator trusts it.
 * Immutable: lengthening a draft creates a NEW GeneratedText.
 */
public class GeneratedText {

    /** How well the generator's templates fit the prompt. */
    public enum Confidence { HIGH, MEDIUM, LOW }

    private final String prompt;
    private final String text;
    private final Confidence confidence;
    private final String topic;
    private final int extrasUsed; // how many elaboration sentences have been added so far

    public GeneratedText(String prompt, String text, Confidence confidence, String topic, int extrasUsed) {
        this.prompt = prompt;
        this.text = text;
        this.confidence = confidence;
        this.topic = topic;
        this.extrasUsed = extrasUsed;
    }

    public String getPrompt() { return prompt; }
    public String getText() { return text; }
    public Confidence getConfidence() { return confidence; }
    public String getTopic() { return topic; }
    public int getExtrasUsed() { return extrasUsed; }

    public int getWordCount() {
        return countWords(text);
    }

    /** Count words the same way WriteWell does: runs of non-space characters. */
    public static int countWords(String text) {
        String trimmed = text.trim();
        return trimmed.isEmpty() ? 0 : trimmed.split("\\s+").length;
    }
}
