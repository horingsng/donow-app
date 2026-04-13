import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MyTasksScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>我的任務</Text>
      <Text style={styles.info}>呢度係我的任務列表。</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  info: { fontSize: 16, color: '#666' },
});