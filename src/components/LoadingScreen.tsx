import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({ message = '載入中...' }: LoadingScreenProps) {
  const [timeoutError, setTimeoutError] = useState(false);

  useEffect(() => {
    // 10秒後如果仲係loading，顯示錯誤
    const timer = setTimeout(() => {
      setTimeoutError(true);
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  if (timeoutError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>載入失敗</Text>
        <Text style={styles.errorMessage}>請檢查網絡連接，然後重新開啟 App</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ff3b30',
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});