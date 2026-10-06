package bot.config;

/**
 * Everything the bot needs to know about ONE platform: where it lives, how
 * to log in, and which adapter class understands its pages.
 *
 * DESIGN NOTE (separation of config from code):
 * None of these values are typed into the Java code. They are all read from
 * platforms.json by {@link ConfigLoader}, so changing a port, a password or
 * adding a whole new platform never requires recompiling.
 *
 * DESIGN NOTE (encapsulation):
 * All fields are private and final, there are only getters, and the
 * constructor is the one place values are set. Once a PlatformConfig exists
 * it can't be changed by accident somewhere else in the program.
 */
public class PlatformConfig {

    private final String name;          // human-readable name, e.g. "MathDrill"
    private final String adapterClass;  // simple class name of the adapter, e.g. "MathDrillAdapter"
    private final String baseUrl;       // e.g. "http://localhost:4001" (no trailing slash)
    private final String loginPath;     // e.g. "/login"
    private final String dashboardPath; // e.g. "/dashboard"
    private final String username;
    private final String password;

    public PlatformConfig(String name, String adapterClass, String baseUrl, String loginPath,
                          String dashboardPath, String username, String password) {
        this.name = name;
        this.adapterClass = adapterClass;
        // Remove a trailing "/" so baseUrl + "/path" never produces "//path".
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        this.loginPath = loginPath;
        this.dashboardPath = dashboardPath;
        this.username = username;
        this.password = password;
    }

    public String getName() { return name; }
    public String getAdapterClass() { return adapterClass; }
    public String getBaseUrl() { return baseUrl; }
    public String getLoginPath() { return loginPath; }
    public String getDashboardPath() { return dashboardPath; }
    public String getUsername() { return username; }
    public String getPassword() { return password; }

    /** Build an absolute URL on this platform, e.g. url("/quiz/qz-1"). */
    public String url(String path) {
        return baseUrl + path;
    }

    public String getLoginUrl() { return url(loginPath); }
    public String getDashboardUrl() { return url(dashboardPath); }

    /** Note: the password is deliberately left out so it never ends up in logs. */
    @Override
    public String toString() {
        return name + " (" + baseUrl + ", adapter=" + adapterClass + ")";
    }
}
