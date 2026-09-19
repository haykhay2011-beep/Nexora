import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as WebBrowser from 'expo-web-browser';
import { theme } from '../theme';
import { authorizedFetch, getAccessToken } from '../lib/api';
import { API_BASE_URL } from '../lib/config';
import { useAuth } from '../context/AuthContext';
import PlaidLinkWebView from './PlaidLinkWebView';

type Provider = 'google' | 'yahoo' | 'plaid';

interface IntegrationsModalProps {
  visible: boolean;
  onClose: () => void;
}

const YAHOO_DOMAINS = ['yahoo.com', 'yahoo.co.uk', 'ymail.com', 'rocketmail.com'];

function detectEmailProvider(email: string | undefined): 'google' | 'yahoo' | null {
  const domain = email?.split('@')[1]?.toLowerCase();
  if (!domain) return null;
  if (domain === 'gmail.com' || domain === 'googlemail.com') return 'google';
  if (YAHOO_DOMAINS.includes(domain)) return 'yahoo';
  return null;
}

export default function IntegrationsModal({ visible, onClose }: IntegrationsModalProps) {
  const { session } = useAuth();
  // Only surface the email integration that actually matches the account the
  // user signed up with - a Gmail address never needs the Yahoo option and
  // vice versa. Unrecognized domains (work email, etc.) fall back to showing
  // both, since we can't tell which mail host is behind them.
  const detectedEmailProvider = detectEmailProvider(session?.user.email);
  const showGoogle = detectedEmailProvider !== 'yahoo';
  const showYahoo = detectedEmailProvider !== 'google';

  const [connected, setConnected] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyProvider, setBusyProvider] = useState<Provider | null>(null);
  const [yahooFormVisible, setYahooFormVisible] = useState(false);
  const [yahooEmail, setYahooEmail] = useState('');
  const [yahooAppPassword, setYahooAppPassword] = useState('');
  const [yahooError, setYahooError] = useState<string | null>(null);
  const [plaidLinkToken, setPlaidLinkToken] = useState<string | null>(null);

  const refreshStatus = async () => {
    setLoading(true);
    try {
      const res = await authorizedFetch<{ connected: Provider[] }>('/integrations');
      setConnected(res.connected);
    } catch {
      // Silently ignore - the connect buttons will surface errors on use.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) refreshStatus();
  }, [visible]);

  const isConnected = (provider: Provider) => connected.includes(provider);

  const handleConnectGoogle = async () => {
    setBusyProvider('google');
    try {
      const token = await getAccessToken();
      const url = `${API_BASE_URL}/auth/google?access_token=${encodeURIComponent(token)}`;
      await WebBrowser.openAuthSessionAsync(url, undefined);
      await refreshStatus();
    } finally {
      setBusyProvider(null);
    }
  };

  const handleConnectYahoo = async () => {
    setYahooError(null);
    setBusyProvider('yahoo');
    try {
      await authorizedFetch('/integrations/yahoo', {
        method: 'POST',
        body: JSON.stringify({ email: yahooEmail.trim(), appPassword: yahooAppPassword }),
      });
      setYahooFormVisible(false);
      setYahooEmail('');
      setYahooAppPassword('');
      await refreshStatus();
    } catch (err: any) {
      setYahooError(err.message ?? 'Could not connect Yahoo Mail.');
    } finally {
      setBusyProvider(null);
    }
  };

  const handleConnectBank = async () => {
    setBusyProvider('plaid');
    try {
      const res = await authorizedFetch<{ linkToken: string }>('/plaid/create-link-token', { method: 'POST' });
      setPlaidLinkToken(res.linkToken);
    } catch {
      setBusyProvider(null);
    }
  };

  const handlePlaidSuccess = async (publicToken: string) => {
    setPlaidLinkToken(null);
    try {
      await authorizedFetch('/plaid/exchange-public-token', {
        method: 'POST',
        body: JSON.stringify({ publicToken }),
      });
      await refreshStatus();
    } finally {
      setBusyProvider(null);
    }
  };

  const handlePlaidExit = () => {
    setPlaidLinkToken(null);
    setBusyProvider(null);
  };

  const handleDisconnect = async (provider: Provider) => {
    setBusyProvider(provider);
    try {
      await authorizedFetch(`/integrations/${provider}`, { method: 'DELETE' });
      await refreshStatus();
    } finally {
      setBusyProvider(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <BlurView intensity={60} tint="dark" style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Integrations</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeText}>Done</Text>
            </TouchableOpacity>
          </View>

          {loading ? <ActivityIndicator color={theme.colors.textSecondary} style={{ marginVertical: 12 }} /> : null}

          {showGoogle ? (
            <IntegrationRow
              label="Google"
              description="Gmail, Calendar & Tasks"
              connected={isConnected('google')}
              busy={busyProvider === 'google'}
              onConnect={handleConnectGoogle}
              onDisconnect={() => handleDisconnect('google')}
            />
          ) : null}

          {showYahoo ? (
            <IntegrationRow
              label="Yahoo Mail"
              description="Connect with an App Password"
              connected={isConnected('yahoo')}
              busy={busyProvider === 'yahoo'}
              onConnect={() => setYahooFormVisible((v) => !v)}
              onDisconnect={() => handleDisconnect('yahoo')}
            />
          ) : null}

          {showYahoo && yahooFormVisible ? (
            <View style={styles.yahooForm}>
              <TextInput
                style={styles.input}
                placeholder="Yahoo email"
                placeholderTextColor={theme.colors.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
                value={yahooEmail}
                onChangeText={setYahooEmail}
              />
              <TextInput
                style={styles.input}
                placeholder="App password"
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry
                value={yahooAppPassword}
                onChangeText={setYahooAppPassword}
              />
              {yahooError ? <Text style={styles.errorText}>{yahooError}</Text> : null}
              <TouchableOpacity style={styles.smallButton} onPress={handleConnectYahoo} disabled={busyProvider === 'yahoo'}>
                {busyProvider === 'yahoo' ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.smallButtonText}>Connect</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}

          <IntegrationRow
            label="Bank Account"
            description="Balances & transactions via Plaid"
            connected={isConnected('plaid')}
            busy={busyProvider === 'plaid'}
            onConnect={handleConnectBank}
            onDisconnect={() => handleDisconnect('plaid')}
          />
        </BlurView>
      </View>

      <PlaidLinkWebView
        visible={!!plaidLinkToken}
        linkToken={plaidLinkToken}
        onSuccess={handlePlaidSuccess}
        onExit={handlePlaidExit}
      />
    </Modal>
  );
}

function IntegrationRow({
  label,
  description,
  connected,
  busy,
  onConnect,
  onDisconnect,
}: {
  label: string;
  description: string;
  connected: boolean;
  busy: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <TouchableOpacity
        style={[styles.pill, connected ? styles.pillConnected : styles.pillDefault]}
        onPress={connected ? onDisconnect : onConnect}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.pillText}>{connected ? 'Connected' : 'Connect'}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    overflow: 'hidden',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary },
  closeText: { color: theme.colors.accent, fontSize: 15, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.glassBorder,
  },
  rowLabel: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '600' },
  rowDescription: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, minWidth: 96, alignItems: 'center' },
  pillDefault: { backgroundColor: theme.colors.accent },
  pillConnected: { backgroundColor: 'rgba(93, 224, 160, 0.2)', borderWidth: 1, borderColor: theme.colors.success },
  pillText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  yahooForm: { paddingVertical: 12, gap: 10 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    marginBottom: 8,
  },
  errorText: { color: theme.colors.danger, fontSize: 12, marginBottom: 8 },
  smallButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  smallButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
