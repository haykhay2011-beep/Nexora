package bot.config;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ConfigLoaderTest {

    private static final Path BASE = Path.of("/tmp/sandbox");

    private static String platform(String baseUrl) {
        return "{\"name\":\"Demo\",\"adapter\":\"DemoAdapter\",\"baseUrl\":\"" + baseUrl + "\","
                + "\"loginPath\":\"/login\",\"dashboardPath\":\"/home\",\"username\":\"u\",\"password\":\"p\"}";
    }

    @Test
    void parsesSettingsAndPlatforms() {
        String json = "{\"settings\":{\"headless\":false,\"waitTimeoutSeconds\":7,\"reportFile\":\"out.txt\"},"
                + "\"platforms\":[" + platform("http://localhost:4999/") + "]}";
        BotConfig config = ConfigLoader.parse(json, BASE);
        assertFalse(config.getSettings().isHeadless());
        assertEquals(7, config.getSettings().getWaitTimeoutSeconds());
        assertEquals(BASE.resolve("out.txt"), config.getSettings().getReportFile());
        assertEquals(BASE.resolve("screenshots"), config.getSettings().getScreenshotDir()); // default

        PlatformConfig p = config.getPlatforms().get(0);
        assertEquals("Demo", p.getName());
        assertEquals("http://localhost:4999", p.getBaseUrl()); // trailing slash removed
        assertEquals("http://localhost:4999/login", p.getLoginUrl());
        assertEquals("http://localhost:4999/home", p.getDashboardUrl());
        assertFalse(p.toString().contains("p)"), "toString must not leak the password");
    }

    @Test
    void loadsTheRealPlatformsJson() {
        BotConfig config = ConfigLoader.load(Path.of("..", "platforms.json"));
        assertEquals(3, config.getPlatforms().size());
        for (PlatformConfig p : config.getPlatforms()) {
            assertTrue(p.getBaseUrl().startsWith("http://localhost:"), p.toString());
        }
    }

    @Test
    void refusesNonLocalhostUrls() {
        for (String url : new String[]{"https://example.com", "http://192.168.1.5:4001", "ftp://localhost", "localhost:4001"}) {
            String json = "{\"platforms\":[" + platform(url) + "]}";
            assertThrows(ConfigLoader.ConfigException.class, () -> ConfigLoader.parse(json, BASE), url);
        }
        // 127.0.0.1 is fine
        ConfigLoader.parse("{\"platforms\":[" + platform("http://127.0.0.1:4001") + "]}", BASE);
    }

    @Test
    void reportsMissingFieldsAndBadJson() {
        String missing = "{\"platforms\":[{\"name\":\"X\",\"baseUrl\":\"http://localhost:1\"}]}";
        ConfigLoader.ConfigException e = assertThrows(ConfigLoader.ConfigException.class, () -> ConfigLoader.parse(missing, BASE));
        assertTrue(e.getMessage().contains("adapter"), e.getMessage());
        assertThrows(ConfigLoader.ConfigException.class, () -> ConfigLoader.parse("{not json", BASE));
        assertThrows(ConfigLoader.ConfigException.class, () -> ConfigLoader.parse("{\"platforms\":[]}", BASE));
    }

    @Test
    void loadResolvesOutputPathsNextToTheFile() throws Exception {
        Path dir = Files.createTempDirectory("cfg");
        Path file = dir.resolve("platforms.json");
        Files.writeString(file, "{\"platforms\":[" + platform("http://localhost:4001") + "]}");
        BotConfig config = ConfigLoader.load(file);
        assertEquals(dir.resolve("run-report.txt"), config.getSettings().getReportFile());
    }
}
