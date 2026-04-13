import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../contexts/WalletContext';

export default function WalletScreen() {
  const navigation = useNavigation();
  const { availableBalance, heldBalance, withdrawableBalance } = useWallet();
  
  const [topUpModalVisible, setTopUpModalVisible] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTopUp = async () => {
    const topUpAmount = parseInt(amount);
    if (!topUpAmount || topUpAmount <= 0) {
      Alert.alert('錯誤', '請輸入有效金額');
      return;
    }
    
    setLoading(true);
    // TODO: Stripe payment integration
    setTimeout(() => {
      setLoading(false);
      setTopUpModalVisible(false);
      setAmount('');
      Alert.alert('✅ 充值成功', `已成功充值 $${topUpAmount}`);
    }, 1500);
  };

  const handleWithdraw = async () => {
    const withdrawAmount = parseInt(amount);
    if (!withdrawAmount || withdrawAmount <= 0) {
      Alert.alert('錯誤', '請輸入有效金額');
      return;
    }
    
    if (withdrawAmount > withdrawableBalance) {
      Alert.alert('餘額不足', `可提款餘額只有 $${withdrawableBalance}`);
      return;
    }
    
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setWithdrawModalVisible(false);
      setAmount('');
      Alert.alert(
        '✅ 提款申請已提交',
        '我哋會盡快處理你嘅提款申請，請留意電郵通知。'
      );
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* 頂部標題 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>我的錢包</Text>
        </View>

        {/* 總餘額卡片 */}
        <View style={styles.totalBalanceCard}>
          <Text style={styles.totalBalanceLabel}>總餘額</Text>
          <Text style={styles.totalBalanceAmount}>
            ${availableBalance + heldBalance + withdrawableBalance}
          </Text>
        </View>

        {/* 餘額分類 */}
        <View style={styles.balancesSection}>
          <View style={styles.balanceCard}>
            <View style={styles.balanceIconContainer}>
              <Ionicons name="cash-outline" size={24} color="#6366f1" />
            </View>
            <View style={styles.balanceInfo}>
              <Text style={styles.balanceLabel}>可用餘額</Text>
              <Text style={styles.balanceAmount}>${availableBalance}</Text>
              <Text style={styles.balanceDesc}>可用於發任務</Text>
            </View>
          </View>

          <View style={styles.balanceCard}>
            <View style={[styles.balanceIconContainer, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="lock-closed-outline" size={24} color="#f59e0b" />
            </View>
            <View style={styles.balanceInfo}>
              <Text style={styles.balanceLabel}>凍結中</Text>
              <Text style={[styles.balanceAmount, { color: '#f59e0b' }]}>
                ${heldBalance}
              </Text>
              <Text style={styles.balanceDesc}>進行中任務資金</Text>
            </View>
          </View>

          <View style={styles.balanceCard}>
            <View style={[styles.balanceIconContainer, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="download-outline" size={24} color="#22c55e" />
            </View>
            <View style={styles.balanceInfo}>
              <Text style={styles.balanceLabel}>可提款</Text>
              <Text style={[styles.balanceAmount, { color: '#22c55e' }]}>
                ${withdrawableBalance}
              </Text>
              <Text style={styles.balanceDesc}>已完成任務收入</Text>
            </View>
          </View>
        </View>

        {/* 操作按鈕 */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.topUpButton}
            onPress={() => setTopUpModalVisible(true)}
          >
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>充值</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.withdrawButton}
            onPress={() => setWithdrawModalVisible(true)}
          >
            <Ionicons name="download" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>提款</Text>
          </TouchableOpacity>
        </View>

        {/* 交易明細入口 */}
        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => Alert.alert('交易明細', '功能開發中...')}
        >
          <Ionicons name="list" size={24} color="#6366f1" />
          <Text style={styles.historyButtonText}>交易明細</Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      </ScrollView>

      {/* 充值 Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={topUpModalVisible}
        onRequestClose={() => setTopUpModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>充值</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="輸入金額"
              keyboardType="number-pad"
              value={amount}
              onChangeText={setAmount}
            />
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleTopUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalButtonText}>確認充值</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => {
                setTopUpModalVisible(false);
                setAmount('');
              }}
            >
              <Text style={styles.modalCancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 提款 Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={withdrawModalVisible}
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>提款</Text>
            <Text style={styles.withdrawableText}>
              可提款金額：${withdrawableBalance}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="輸入提款金額"
              keyboardType="number-pad"
              value={amount}
              onChangeText={setAmount}
            />
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleWithdraw}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalButtonText}>申請提款</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => {
                setWithdrawModalVisible(false);
                setAmount('');
              }}
            >
              <Text style={styles.modalCancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#6366f1',
    padding: 24,
    paddingTop: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  totalBalanceCard: {
    backgroundColor: '#6366f1',
    margin: 16,
    marginTop: -20,
    padding: 24,
    borderRadius: 16,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  totalBalanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  totalBalanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  balancesSection: {
    padding: 16,
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  balanceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ede9fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  balanceInfo: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6366f1',
    marginBottom: 4,
  },
  balanceDesc: {
    fontSize: 12,
    color: '#9ca3af',
  },
  actionSection: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  topUpButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  withdrawButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  historyButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#fff',
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  withdrawableText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalButton: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalCancelButton: {
    padding: 16,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#6b7280',
    fontSize: 16,
  },
});