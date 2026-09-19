import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { AppTheme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { authorizedFetch } from '../lib/api';

interface TodayData {
  events: { id: string; summary: string; start: string }[];
  eventsConnected: boolean;
  tasks: { id: string; title: string }[];
  tasksConnected: boolean;
  unreadEmailCount: number | null;
}

function formatTime(iso: string) {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function TodayDashboard() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const load = () => {
    setLoading(true);
    authorizedFetch<TodayData>('/dashboard/today')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) {
    return (
      <BlurView intensity={30} tint={theme.mode === 'dark' ? 'dark' : 'light'} style={styles.card}>
        <ActivityIndicator size="small" color={theme.colors.textSecondary} />
      </BlurView>
    );
  }

  if (!data || (!data.eventsConnected && !data.tasksConnected && data.unreadEmailCount === null)) {
    return null;
  }

  return (
    <BlurView intensity={30} tint={theme.mode === 'dark' ? 'dark' : 'light'} style={styles.card}>
      <TouchableOpacity style={styles.headerRow} onPress={() => setCollapsed((v) => !v)}>
        <Text style={styles.title}>Today</Text>
        <Text style={styles.chevron}>{collapsed ? '▾' : '▴'}</Text>
      </TouchableOpacity>

      {!collapsed && (
        <View style={styles.body}>
          {data.eventsConnected ? (
            <Text style={styles.line}>
              📅 {data.events.length === 0 ? 'No events today' : `${data.events.length} event${data.events.length === 1 ? '' : 's'}`}
              {data.events[0] ? ` — next: ${data.events[0].summary} at ${formatTime(data.events[0].start)}` : ''}
            </Text>
          ) : null}

          {data.tasksConnected ? (
            <Text style={styles.line}>
              ✅ {data.tasks.length === 0 ? 'No open tasks' : `${data.tasks.length} open task${data.tasks.length === 1 ? '' : 's'}`}
            </Text>
          ) : null}

          {data.unreadEmailCount !== null ? (
            <Text style={styles.line}>✉️ {data.unreadEmailCount} unread email{data.unreadEmailCount === 1 ? '' : 's'}</Text>
          ) : null}
        </View>
      )}
    </BlurView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.glassBorder,
      overflow: 'hidden',
      padding: 14,
      marginBottom: 12,
    },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { color: theme.colors.textPrimary, fontWeight: '700', fontSize: 14 },
    chevron: { color: theme.colors.textSecondary, fontSize: 14 },
    body: { marginTop: 10, gap: 6 },
    line: { color: theme.colors.textSecondary, fontSize: 13 },
  });
}
