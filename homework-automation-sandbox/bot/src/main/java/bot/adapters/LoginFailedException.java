package bot.adapters;

/**
 * Thrown when a login attempt doesn't land on the dashboard. We use our own
 * exception type (instead of a generic RuntimeException) so the error message
 * and the report make it obvious WHICH step failed.
 */
public class LoginFailedException extends RuntimeException {
    public LoginFailedException(String message) {
        super(message);
    }
}
