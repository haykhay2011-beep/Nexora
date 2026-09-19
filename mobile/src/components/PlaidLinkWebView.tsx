import React, { useMemo } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { theme } from '../theme';

interface PlaidLinkWebViewProps {
  visible: boolean;
  linkToken: string | null;
  onSuccess: (publicToken: string) => void;
  onExit: () => void;
}

/**
 * The official Plaid React Native SDK needs a custom dev client, which would
 * break Expo Go. Instead we load Plaid Link's own web bundle inside a
 * WebView and bridge its callbacks back over postMessage.
 */
export default function PlaidLinkWebView({ visible, linkToken, onSuccess, onExit }: PlaidLinkWebViewProps) {
  const html = useMemo(() => {
    if (!linkToken) return '';
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"></script>
        </head>
        <body style="margin:0;background:#0B0F1F;">
          <script>
            window.onerror = function (message) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'exit', error: String(message) }));
            };
            var handler = Plaid.create({
              token: ${JSON.stringify(linkToken)},
              onSuccess: function (public_token, metadata) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'success', publicToken: public_token }));
              },
              onExit: function (err, metadata) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'exit', error: err }));
              },
            });
            handler.open();
          </script>
        </body>
      </html>
    `;
  }, [linkToken]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'success' && data.publicToken) {
        onSuccess(data.publicToken);
      } else if (data.type === 'exit') {
        onExit();
      }
    } catch {
      onExit();
    }
  };

  return (
    <Modal visible={visible && !!linkToken} animationType="slide" onRequestClose={onExit}>
      <View style={styles.container}>
        <View style={styles.closeBar}>
          <TouchableOpacity onPress={onExit}>
            <Text style={styles.closeText}>Cancel</Text>
          </TouchableOpacity>
        </View>
        {linkToken ? (
          <WebView
            // A baseUrl gives the page a real https origin instead of an
            // opaque/null one - without it, Plaid Link's internal iframe
            // postMessage handshake never completes and it spins forever.
            source={{ html, baseUrl: 'https://cdn.plaid.com' }}
            originWhitelist={['*']}
            onMessage={handleMessage}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundTop },
  closeBar: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 12 },
  closeText: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '600' },
});
