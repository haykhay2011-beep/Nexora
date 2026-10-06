package bot.config;

import java.util.ArrayList;
import java.util.List;

/** The whole platforms.json file: global settings plus one entry per platform. */
public class BotConfig {

    private final BotSettings settings;
    private final ArrayList<PlatformConfig> platforms;

    public BotConfig(BotSettings settings, ArrayList<PlatformConfig> platforms) {
        this.settings = settings;
        this.platforms = platforms;
    }

    public BotSettings getSettings() { return settings; }

    /** Returns a copy, so callers can't add or remove platforms behind our back. */
    public List<PlatformConfig> getPlatforms() { return new ArrayList<>(platforms); }
}
