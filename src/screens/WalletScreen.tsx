import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWallet } from '../contexts/WalletContext';

export default function WalletScreen() {
  const { availableBalance, heldBalance, withdrawableBalance, refreshWallet } = useWallet();

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>錢包</Text>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>可用餘額</Text>
        <Text style={styles.balanceAmount}>${availableBalance}</Text>
      </View>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>凍結中</Text>
        <Text style={styles.balanceAmount}>${heldBalance}</Text>
      </View>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>可提取</Text>
        <Text style={styles.balanceAmount}>${withdrawableBalance}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  balanceCard: {
    backgroundColor: '#f5f5f5',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
  },
  balanceLabel: { fontSize: 14, color: '#666', marginBottom: 5 },
  balanceAmount: { fontSize: 28, fontWeight: 'bold', color: '#007AFF' },
});