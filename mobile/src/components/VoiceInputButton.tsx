import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../context/ThemeContext';
import { authorizedFetch } from '../lib/api';

interface VoiceInputButtonProps {
  disabled?: boolean;
  onTranscript: (text: string) => void;
}

export default function VoiceInputButton({ disabled, onTranscript }: VoiceInputButtonProps) {
  const { theme } = useTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const startRecording = async () => {
    if (disabled || recording || transcribing) return;

    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) return;

    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  };

  const stopRecording = async () => {
    if (!recording) return;
    setRecording(false);
    setTranscribing(true);

    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('No recording captured.');

      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const { text } = await authorizedFetch<{ text: string }>('/chat/transcribe', {
        method: 'POST',
        body: JSON.stringify({ audioBase64: base64, mimeType: 'audio/m4a' }),
      });

      if (text) onTranscript(text);
    } catch {
      // Silently drop - the user can just type instead if transcription fails.
    } finally {
      setTranscribing(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, recording && { backgroundColor: theme.colors.danger }]}
      onPressIn={startRecording}
      onPressOut={stopRecording}
      disabled={disabled || transcribing}
    >
      {transcribing ? (
        <ActivityIndicator size="small" color={theme.colors.textPrimary} />
      ) : (
        <Text style={styles.icon}>{recording ? '●' : '🎤'}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 16 },
});
