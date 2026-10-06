package bot.writing;

/**
 * Anything that can write a free-response answer for a WriteWell prompt.
 *
 * ===================== OPTIONAL HOOK =====================
 * The bot ships with {@link TemplateTextGenerator}, which fills in
 * hand-written templates. It needs no internet, no API key and no secrets,
 * so the whole project runs offline.
 *
 * Because WriteWellAdapter only depends on this INTERFACE, a different
 * generator (for example, one backed by a real text-generation service)
 * could be plugged in later by writing a class that implements these two
 * methods and passing it to WriteWellAdapter. No other code would change.
 * That's the same "program to an interface" idea as PlatformAdapter.
 * ==========================================================
 */
public interface TextGenerator {

    /** Write a first, concise draft for the prompt. */
    GeneratedText draft(String prompt);

    /** Return a longer version of a draft with at least minWords words. */
    GeneratedText lengthen(GeneratedText draft, int minWords);
}
