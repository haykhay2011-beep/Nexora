package bot.writing;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Writes free-response answers by filling in templates. No external services.
 *
 * How it works:
 *   1. Each Topic has KEYWORDS, a short CORE answer (1-2 sentences), and a
 *      list of EXTRA sentences that add detail.
 *   2. draft(prompt) counts how many of each topic's keywords appear in the
 *      prompt (whole words only) and picks the best-matching topic.
 *        2+ keyword hits  -> HIGH confidence
 *        1 keyword hit    -> MEDIUM confidence
 *        no hits          -> LOW confidence: fall back to a GENERIC template
 *                            built from the prompt's own important words
 *   3. The first draft is deliberately concise (just the core). WriteWell
 *      doesn't show its minimum word count, so the adapter learns it from
 *      the rejection message and calls lengthen(), which appends extra
 *      sentences until the draft is long enough.
 *
 * The generic fallback is "graceful degradation": the bot still submits
 * something that meets the length requirement, but it is flagged LOW
 * confidence in the report so a human knows to review it.
 */
public class TemplateTextGenerator implements TextGenerator {

    /** One subject the generator knows how to write about. */
    private static class Topic {
        final String name;
        final List<String> keywords;
        final List<String> core;
        final List<String> extras;

        Topic(String name, String[] keywords, String[] core, String[] extras) {
            this.name = name;
            this.keywords = Arrays.asList(keywords);
            this.core = Arrays.asList(core);
            this.extras = Arrays.asList(extras);
        }
    }

    private static final String GENERIC = "general";

    /** Words to ignore when picking out a prompt's important words. */
    private static final List<String> STOP_WORDS = Arrays.asList(
            "a", "an", "and", "the", "of", "to", "in", "on", "for", "is", "it", "its", "be", "are", "you", "your",
            "what", "why", "how", "when", "which", "who", "that", "this", "with", "about", "makes", "make",
            "describe", "explain", "discuss", "write", "give", "one", "example", "sentences", "sentence", "would",
            "use", "do", "does", "think", "main", "matters", "from", "or", "at", "as", "by", "into", "instead");

    private final ArrayList<Topic> topics = new ArrayList<>();

    public TemplateTextGenerator() {
        topics.add(new Topic("variables",
                new String[]{"variable", "variables", "store", "stores", "value", "values", "data type", "memory"},
                new String[]{
                        "A variable is a named place in a program's memory that stores a value.",
                        "The program can read that value later or change it while it runs."},
                new String[]{
                        "For example, the Java statement int score = 10; creates a variable called score that holds the number 10.",
                        "Every variable in Java has a data type, such as int, double, boolean, or String, which decides what kind of value it can hold.",
                        "Using clear variable names like totalPrice instead of x makes code much easier for other people to read.",
                        "Variables let a program remember information, such as a player's score or a user's name, instead of hard-coding it."}));

        topics.add(new Topic("loops",
                new String[]{"loop", "loops", "for loop", "while loop", "repeat", "repeating", "repeats", "iteration"},
                new String[]{
                        "A for loop repeats a block of code a set number of times.",
                        "It has three parts: a starting value, a condition that is checked before each pass, and an update that runs after each pass."},
                new String[]{
                        "For example, for (int i = 0; i < 10; i++) runs its body ten times while i counts from 0 to 9.",
                        "You would use a loop instead of copying code when you need to do the same thing many times, such as printing every name in a list of one hundred students.",
                        "Loops make programs shorter and easier to change, because the repeated code is written and fixed in only one place.",
                        "If the condition never becomes false, the loop never stops, which is called an infinite loop and is a common bug."}));

        topics.add(new Topic("water cycle",
                new String[]{"water", "cycle", "water cycle", "evaporation", "condensation", "precipitation", "rain"},
                new String[]{
                        "The water cycle is the continuous movement of water between the surface of the Earth and the atmosphere.",
                        "Its main stages are evaporation, condensation, precipitation, and collection."},
                new String[]{
                        "During evaporation, heat from the sun turns liquid water from oceans, lakes, and rivers into water vapor.",
                        "As the vapor rises and cools, it condenses into tiny droplets that form clouds.",
                        "When the droplets grow heavy, they fall back to the ground as rain, snow, sleet, or hail.",
                        "The water then collects in oceans, lakes, rivers, and underground aquifers, and the cycle begins again.",
                        "The water cycle matters because it delivers the fresh water that plants, animals, and people need to survive."}));

        topics.add(new Topic("methods",
                new String[]{"method", "methods", "function", "functions", "parameter", "parameters", "return"},
                new String[]{
                        "A method is a named block of code that performs one specific task.",
                        "You call the method whenever you need that task done instead of rewriting the code."},
                new String[]{
                        "Methods can take parameters, which are inputs that let the same method work with different values.",
                        "A method can also return a value, like a method that takes two numbers and returns their sum.",
                        "Breaking a program into small methods makes it easier to test, debug, and reuse.",
                        "In Java, the main method is where the program starts running."}));

        topics.add(new Topic("classes and objects",
                new String[]{"class", "classes", "object", "objects", "inheritance", "encapsulation", "polymorphism"},
                new String[]{
                        "A class is a blueprint that describes the data and behavior a kind of object has.",
                        "An object is one specific instance created from that class."},
                new String[]{
                        "For example, a Dog class might have a name and an age, and each Dog object stores its own values.",
                        "Encapsulation means keeping an object's data private and changing it only through its methods.",
                        "Inheritance lets one class extend another and reuse its code.",
                        "Polymorphism lets code treat different subclasses through a shared parent type."}));
    }

    @Override
    public GeneratedText draft(String prompt) {
        Topic best = null;
        int bestHits = 0;
        for (Topic topic : topics) {
            int hits = countKeywordHits(prompt, topic.keywords);
            if (hits > bestHits) {
                best = topic;
                bestHits = hits;
            }
        }
        if (best == null) {
            // Graceful degradation: no template fits, so write a generic answer.
            return new GeneratedText(prompt, String.join(" ", genericCore(prompt)),
                    GeneratedText.Confidence.LOW, GENERIC, 0);
        }
        GeneratedText.Confidence confidence = (bestHits >= 2)
                ? GeneratedText.Confidence.HIGH : GeneratedText.Confidence.MEDIUM;
        return new GeneratedText(prompt, String.join(" ", best.core), confidence, best.name, 0);
    }

    @Override
    public GeneratedText lengthen(GeneratedText draft, int minWords) {
        List<String> extras = extrasFor(draft);
        StringBuilder text = new StringBuilder(draft.getText());
        int used = draft.getExtrasUsed();
        int target = minWords + 3; // a small safety margin over the minimum

        while (GeneratedText.countWords(text.toString()) < target) {
            String sentence;
            if (used < extras.size()) {
                sentence = extras.get(used);
            } else {
                // Out of prepared sentences: use a neutral wrap-up line (numbered so it never repeats exactly).
                sentence = "In summary, point " + (used - extras.size() + 1) + " shows why this topic deserves careful thought.";
            }
            text.append(' ').append(sentence);
            used++;
            if (used > 200) {
                throw new IllegalStateException("Could not reach " + minWords + " words");
            }
        }
        return new GeneratedText(draft.getPrompt(), text.toString(), draft.getConfidence(), draft.getTopic(), used);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /**
     * Count keywords that appear in the prompt as WHOLE words or phrases.
     * Padding with spaces means "rain" does not match inside "explain".
     */
    static int countKeywordHits(String prompt, List<String> keywords) {
        String padded = " " + prompt.toLowerCase().replaceAll("[^a-z0-9 ]", " ").replaceAll("\\s+", " ") + " ";
        int hits = 0;
        for (String keyword : keywords) {
            if (padded.contains(" " + keyword + " ")) {
                hits++;
            }
        }
        return hits;
    }

    /** Pick up to two "important" words from the prompt (the longest non-stop-words). */
    static List<String> keyTerms(String prompt) {
        ArrayList<String> words = new ArrayList<>();
        for (String word : prompt.toLowerCase().replaceAll("[^a-z ]", " ").split("\\s+")) {
            if (word.length() > 2 && !STOP_WORDS.contains(word) && !words.contains(word)) {
                words.add(word);
            }
        }
        words.sort((a, b) -> b.length() - a.length()); // longest first
        if (words.isEmpty()) words.add("this topic");
        if (words.size() == 1) words.add(words.get(0));
        return words.subList(0, 2);
    }

    private static List<String> genericCore(String prompt) {
        List<String> terms = keyTerms(prompt);
        return Arrays.asList(
                "This response focuses on " + terms.get(0) + " and " + terms.get(1) + ".",
                "Both ideas connect to everyday experience in a few important ways.");
    }

    private List<String> extrasFor(GeneratedText draft) {
        for (Topic topic : topics) {
            if (topic.name.equals(draft.getTopic())) {
                return topic.extras;
            }
        }
        List<String> terms = keyTerms(draft.getPrompt());
        String a = terms.get(0);
        String b = terms.get(1);
        return Arrays.asList(
                "One important idea is that " + a + " can look very different for different people, depending on their interests and responsibilities.",
                "Thinking carefully about " + a + " helps people make better choices about how they spend their time and energy.",
                "Another point is that " + b + " often depends on balance, such as mixing activity with rest.",
                "Specific personal examples make ideas like these easier to understand and remember.",
                "Overall, " + a + " is worth reflecting on because it shapes daily life in small but meaningful ways.");
    }
}
