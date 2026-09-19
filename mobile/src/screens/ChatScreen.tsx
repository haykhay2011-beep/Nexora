import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { ChatTurn, sendChatMessage } from '../lib/api';
import IntegrationsModal from '../components/IntegrationsModal';

interface Message extends ChatTurn {
  id: string;
}

export default function ChatScreen() {
  const { signOut } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      content: "Hi, I'm Jarvis. Connect your accounts from the menu and ask me anything about your day.",
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [integrationsVisible, setIntegrationsVisible] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMessage: Message = { id: `${Date.now()}-user`, role: 'user', content: text };
    const history: ChatTurn[] = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSending(true);

    try {
      const reply = await sendChatMessage(text, history);
      setMessages((prev) => [...prev, { id: `${Date.now()}-model`, role: 'model', content: reply }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-error`, role: 'model', content: `⚠️ ${err.message ?? 'Something went wrong.'}` },
      ]);
    } finally {
      setSending(false);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  };

  return (
    <LinearGradient colors={[theme.colors.backgroundTop, theme.colors.backgroundBottom]} style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Jarvis</Text>
          <Text style={styles.headerSubtitle}>Personal AI OS</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setIntegrationsVisible(true)}>
            <Text style={styles.iconText}>⚙︎</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={signOut}>
            <Text style={styles.iconText}>⏻</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => <MessageBubble message={item} />}
      />

      {sending ? (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color={theme.colors.textSecondary} />
          <Text style={styles.typingText}>Jarvis is thinking…</Text>
        </View>
      ) : null}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={20}>
        <BlurView intensity={50} tint="dark" style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask Jarvis anything…"
            placeholderTextColor={theme.colors.textSecondary}
            multiline
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={sending}>
            <Text style={styles.sendButtonText}>↑</Text>
          </TouchableOpacity>
        </BlurView>
      </KeyboardAvoidingView>

      <IntegrationsModal visible={integrationsVisible} onClose={() => setIntegrationsVisible(false)} />
    </LinearGradient>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowModel]}>
      <BlurView
        intensity={35}
        tint="dark"
        style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleModel]}
      >
        <Text style={styles.bubbleText}>{message.content}</Text>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: theme.colors.textPrimary },
  headerSubtitle: { fontSize: 12, color: theme.colors.textSecondary },
  headerActions: { flexDirection: 'row', gap: 10 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.glass,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  iconText: { color: theme.colors.textPrimary, fontSize: 16 },
  messageList: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  bubbleRow: { flexDirection: 'row', marginBottom: 4 },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowModel: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  bubbleUser: { backgroundColor: theme.colors.accentSoft },
  bubbleModel: { backgroundColor: theme.colors.glass },
  bubbleText: { color: theme.colors.textPrimary, fontSize: 15, lineHeight: 21 },
  typingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 6, gap: 8 },
  typingText: { color: theme.colors.textSecondary, fontSize: 12 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginHorizontal: 16,
    marginBottom: Platform.OS === 'ios' ? 30 : 16,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 15,
    maxHeight: 120,
    paddingVertical: 6,
    paddingRight: 10,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
