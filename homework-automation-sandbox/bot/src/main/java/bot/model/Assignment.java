package bot.model;

import java.time.LocalDate;

/**
 * One assignment discovered on a platform's dashboard.
 *
 * DESIGN NOTE (Comparable):
 * Assignment implements Comparable&lt;Assignment&gt; so a list of assignments can
 * be sorted with Collections.sort(list). The "natural order" we define is
 * earliest due date first, which is the order a sensible student would work in.
 * When two assignments are due the same day, we break the tie by title so the
 * order is always predictable.
 */
public class Assignment implements Comparable<Assignment> {

    private final String platformName;
    private final String id;          // the platform's own id, e.g. "md-1"
    private final String title;
    private final LocalDate dueDate;
    private final AssignmentStatus status;
    private final String url;         // absolute URL of the assignment page

    public Assignment(String platformName, String id, String title, LocalDate dueDate,
                      AssignmentStatus status, String url) {
        this.platformName = platformName;
        this.id = id;
        this.title = title;
        this.dueDate = dueDate;
        this.status = status;
        this.url = url;
    }

    public String getPlatformName() { return platformName; }
    public String getId() { return id; }
    public String getTitle() { return title; }
    public LocalDate getDueDate() { return dueDate; }
    public AssignmentStatus getStatus() { return status; }
    public String getUrl() { return url; }

    public boolean isDone() { return status == AssignmentStatus.DONE; }

    /**
     * Negative if this assignment should come BEFORE other, positive if after,
     * zero if they are equivalent in order.
     */
    @Override
    public int compareTo(Assignment other) {
        int byDate = this.dueDate.compareTo(other.dueDate);
        if (byDate != 0) {
            return byDate;
        }
        return this.title.compareTo(other.title);
    }

    @Override
    public String toString() {
        return "[" + platformName + "] " + title + " (due " + dueDate + ", " + status + ")";
    }
}
