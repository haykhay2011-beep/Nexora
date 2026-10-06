package bot.config;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonSyntaxException;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;

/**
 * Reads platforms.json and turns it into {@link BotConfig} objects.
 *
 * It also enforces the project's most important SAFETY RULE: every platform
 * URL must point at this computer (localhost / 127.0.0.1). If someone edits
 * platforms.json to point at a real website, the bot refuses to start.
 * The sandbox exists so we only ever automate sites we built ourselves.
 */
public class ConfigLoader {

    /** Thrown when platforms.json is missing, malformed, or unsafe. */
    public static class ConfigException extends RuntimeException {
        public ConfigException(String message) { super(message); }
    }

    /**
     * Load a config file from disk. Relative output paths (screenshots,
     * report) are resolved against the folder that contains the file.
     */
    public static BotConfig load(Path file) {
        try {
            String json = Files.readString(file);
            Path baseDir = file.toAbsolutePath().normalize().getParent();
            return parse(json, baseDir);
        } catch (IOException e) {
            throw new ConfigException("Could not read " + file + ": " + e.getMessage());
        }
    }

    /** Parse JSON text. Separate from load() so unit tests don't need files. */
    public static BotConfig parse(String json, Path baseDir) {
        JsonObject root;
        try {
            root = JsonParser.parseString(json).getAsJsonObject();
        } catch (JsonSyntaxException | IllegalStateException e) {
            throw new ConfigException("platforms.json is not valid JSON: " + e.getMessage());
        }

        BotSettings settings = parseSettings(root.getAsJsonObject("settings"), baseDir);

        JsonArray list = root.getAsJsonArray("platforms");
        if (list == null || list.size() == 0) {
            throw new ConfigException("platforms.json must contain a non-empty \"platforms\" array");
        }
        ArrayList<PlatformConfig> platforms = new ArrayList<>();
        for (JsonElement element : list) {
            platforms.add(parsePlatform(element.getAsJsonObject()));
        }
        return new BotConfig(settings, platforms);
    }

    private static BotSettings parseSettings(JsonObject obj, Path baseDir) {
        // Every setting has a sensible default, so the "settings" block is optional.
        boolean headless = true;
        int timeout = 10;
        String screenshots = "screenshots";
        String report = "run-report.txt";
        if (obj != null) {
            if (obj.has("headless")) headless = obj.get("headless").getAsBoolean();
            if (obj.has("waitTimeoutSeconds")) timeout = obj.get("waitTimeoutSeconds").getAsInt();
            if (obj.has("screenshotDir")) screenshots = obj.get("screenshotDir").getAsString();
            if (obj.has("reportFile")) report = obj.get("reportFile").getAsString();
        }
        if (timeout <= 0) throw new ConfigException("waitTimeoutSeconds must be positive");
        return new BotSettings(headless, timeout, baseDir.resolve(screenshots), baseDir.resolve(report));
    }

    private static PlatformConfig parsePlatform(JsonObject obj) {
        String name = requireString(obj, "name", "(unnamed platform)");
        String adapter = requireString(obj, "adapter", name);
        String baseUrl = requireString(obj, "baseUrl", name);
        String loginPath = requireString(obj, "loginPath", name);
        String dashboardPath = requireString(obj, "dashboardPath", name);
        String username = requireString(obj, "username", name);
        String password = requireString(obj, "password", name);

        requireLocalhost(baseUrl, name);
        if (!loginPath.startsWith("/") || !dashboardPath.startsWith("/")) {
            throw new ConfigException(name + ": loginPath and dashboardPath must start with \"/\"");
        }
        return new PlatformConfig(name, adapter, baseUrl, loginPath, dashboardPath, username, password);
    }

    /** Read a required, non-blank string field or explain exactly what is missing. */
    private static String requireString(JsonObject obj, String key, String platformName) {
        JsonElement value = obj.get(key);
        if (value == null || value.isJsonNull() || value.getAsString().isBlank()) {
            throw new ConfigException(platformName + ": missing required field \"" + key + "\"");
        }
        return value.getAsString().trim();
    }

    /** SAFETY RULE: only http(s)://localhost or 127.0.0.1 is allowed. */
    static void requireLocalhost(String baseUrl, String platformName) {
        try {
            URI uri = new URI(baseUrl);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            boolean httpScheme = "http".equals(scheme) || "https".equals(scheme);
            boolean local = "localhost".equals(host) || "127.0.0.1".equals(host);
            if (!httpScheme || !local) {
                throw new ConfigException(platformName + ": baseUrl \"" + baseUrl
                        + "\" is not on localhost. This bot only runs against the local mock platforms.");
            }
        } catch (URISyntaxException e) {
            throw new ConfigException(platformName + ": baseUrl \"" + baseUrl + "\" is not a valid URL");
        }
    }
}
