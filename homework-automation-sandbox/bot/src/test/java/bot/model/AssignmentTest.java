package bot.model;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AssignmentTest {

    private static Assignment make(String title, String due) {
        return new Assignment("Test", title, title, LocalDate.parse(due), AssignmentStatus.NOT_STARTED, "http://localhost/x");
    }

    @Test
    void compareToOrdersByDueDate() {
        Assignment early = make("B", "2026-10-01");
        Assignment late = make("A", "2026-10-20");
        assertTrue(early.compareTo(late) < 0);
        assertTrue(late.compareTo(early) > 0);
    }

    @Test
    void sameDueDateFallsBackToTitle() {
        Assignment a = make("Algebra", "2026-10-05");
        Assignment b = make("Biology", "2026-10-05");
        assertTrue(a.compareTo(b) < 0);
        assertEquals(0, a.compareTo(make("Algebra", "2026-10-05")));
    }

    @Test
    void collectionsSortUsesCompareTo() {
        ArrayList<Assignment> list = new ArrayList<>();
        list.add(make("Third", "2026-12-01"));
        list.add(make("First", "2026-01-15"));
        list.add(make("Second", "2026-06-30"));
        Collections.sort(list);
        assertEquals("First", list.get(0).getTitle());
        assertEquals("Second", list.get(1).getTitle());
        assertEquals("Third", list.get(2).getTitle());
    }

    @Test
    void statusLabelsFromEveryPlatformAreUnderstood() {
        assertEquals(AssignmentStatus.NOT_STARTED, AssignmentStatus.fromLabel("not started"));
        assertEquals(AssignmentStatus.NOT_STARTED, AssignmentStatus.fromLabel("  Not   Started "));
        assertEquals(AssignmentStatus.IN_PROGRESS, AssignmentStatus.fromLabel("Draft saved"));
        assertEquals(AssignmentStatus.DONE, AssignmentStatus.fromLabel("Completed"));
        assertEquals(AssignmentStatus.DONE, AssignmentStatus.fromLabel("Submitted"));
        assertThrows(IllegalArgumentException.class, () -> AssignmentStatus.fromLabel("Exploded"));
    }
}
