import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const MORNING_BRIEFING_TAG = 'morning-briefing';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Schedules a repeating daily local notification reminding the user to check
 * their briefing in the app. Note: Expo Go can't run background fetch, so
 * this can't pull live calendar/task data into the notification body itself -
 * it's a nudge that opens the app, where the Today dashboard shows the real
 * data. A full data-filled push would need a custom dev build + a server-side
 * push scheduler.
 */
export async function setupMorningBriefing(hour = 8, minute = 0) {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const alreadyScheduled = existing.find((n) => n.content.data?.tag === MORNING_BRIEFING_TAG);
  if (alreadyScheduled) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Good morning ☀️',
      body: "Open Jarvis to see today's calendar, tasks, and unread email.",
      data: { tag: MORNING_BRIEFING_TAG },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function disableMorningBriefing() {
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    existing
      .filter((n) => n.content.data?.tag === MORNING_BRIEFING_TAG)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}
