import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../services/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';

// 分類對應
const CATEGORY_NAMES: { [key: string]: string } = {
  grocery: '代買',
  queueing: '排隊',
  delivery: '送遞',
  pickup: '取件',
  instant_help: '即時幫手',
};

export default function MyTasksScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<'posted' | 'accepted'>('posted');
  const [postedTasks, setPostedTasks] = useState<any[]>([]);
  const [acceptedTasks, setAcceptedTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const currentUser = auth.currentUser;

  // 監聽我發的任務
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const postedQuery = query(
      collection(db, 'tasks'),
      where('posterUid', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribePosted = onSnapshot(postedQuery, (snapshot) => {
      const tasks = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPostedTasks(tasks);
      setLoading(false);
    });

    const acceptedQuery = query(
      collection(db, 'tasks'),
      where('workerUid', '==', currentUser.uid),
      orderBy('acceptedAt', 'desc')
    );

    const unsubscribeAccepted = onSnapshot(acceptedQuery, (snapshot) => {
      const tasks = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setAcceptedTasks(tasks);
      setLoading(false);
    });

    return () => {
      unsubscribePosted();
      unsubscribeAccepted();
    };
  }, [currentUser]);

  // 下拉刷新
  const onRefresh = async () => {
    setRefreshing(true);
    if (currentUser) {
      // 重新獲取數據
      const postedQuery = query(
        collection(db, 'tasks'),
        where('posterUid', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const postedSnap = await getDocs(postedQuery);
      setPostedTasks(postedSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

      const acceptedQuery = query(
        collection(db, 'tasks'),
        where('workerUid', '==', currentUser.uid),
        orderBy('acceptedAt', 'desc')
      );
      const acceptedSnap = await getDocs(acceptedQuery);
      setAcceptedTasks(acceptedSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    }
    setRefreshing(false);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'open': return '#6366f1';
      case 'accepted': return '#f59e0b';
      case 'in_progress': return '#3b82f6';
      case 'pending_confirmation': return '#8b5cf6';
      case 'completed': return '#22c55e';
      case 'cancelled': return '#ef4444';
      default: return '#9ca3af';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'open': return '招募中';
      case 'accepted': return '已接單';
      case 'in_progress': return '進行中';
      case 'pending_confirmation': return '等待確認';
      case 'completed': return '已完成';
      case 'cancelled': return '已取消';
      default: return '未知';
    }
  };

  const renderTaskItem = ({ item }: { item: any }) => {
    const category = CATEGORY_NAMES[item.category] || '其他';
    const workerNetAmount = item.rewardAmount - item.workerFee;
    const isPoster = item.posterUid === currentUser?.uid;

    return (
      <TouchableOpacity
        style={styles.taskCard}
        onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}
      >
        <View style={styles.taskHeader}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{category}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>

        <Text style={styles.taskTitle}>{item.title}</Text>
        
        <View style={styles.taskMeta}>
          <Ionicons name="location-outline" size={14} color="#6b7280" />
          <Text style={styles.metaText}>{item.district}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>{item.taskTimeType === 'immediate' ? '即時' : '預約'}</Text>
        </View>

        <View style={styles.taskFooter}>
          <View style={styles.rewardSection}>
            <Text style={styles.rewardLabel}>{isPoster ? '支付' : '收入'}</Text>
            <Text style={styles.rewardAmount}>
              ${isPoster ? item.posterPayTotal : workerNetAmount}
            </Text>
          </View>
          
          {!isPoster && item.purchaseRequired && (
            <View style={styles.purchaseBadge}>
              <Ionicons name="cash-outline" size={12} color="#92400e" />
              <Text style={styles.purchaseText}>需代付 ${item.estimatedPurchaseAmount}</Text>
            </View>
          )}
        </View>

        {item.workerName && (
          <View style={styles.workerRow}>
            <Ionicons name="person-circle" size={16} color="#6366f1" />
            <Text style={styles.workerText}>接單者: {item.workerName}</Text>
          </View>
        )}

        {item.status === 'completed' && item.confirmedAt && (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
            <Text style={styles.completedText}>已完成並結算</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const currentTasks = activeTab === 'posted' ? postedTasks : acceptedTasks;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>我的任務</Text>
        </View>
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 頂部標題 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>我的任務</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{postedTasks.length}</Text>
            <Text style={styles.statLabel}>我發的</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{acceptedTasks.length}</Text>
            <Text style={styles.statLabel}>我接的</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {postedTasks.filter(t => t.status === 'completed').length + 
               acceptedTasks.filter(t => t.status === 'completed').length}
            </Text>
            <Text style={styles.statLabel}>已完成</Text>
          </View>
        </View>
      </View>

      {/* Tab 切換 */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'posted' && styles.activeTab]}
          onPress={() => setActiveTab('posted')}
        >
          <Text style={[styles.tabText, activeTab === 'posted' && styles.activeTabText]}>
            我發的任務
          </Text>
          {postedTasks.filter(t => ['open', 'accepted', 'in_progress'].includes(t.status)).length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>
                {postedTasks.filter(t => ['open', 'accepted', 'in_progress'].includes(t.status)).length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'accepted' && styles.activeTab]}
          onPress={() => setActiveTab('accepted')}
        >
          <Text style={[styles.tabText, activeTab === 'accepted' && styles.activeTabText]}>
            我接的任務
          </Text>
          {acceptedTasks.filter(t => ['accepted', 'in_progress'].includes(t.status)).length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>
                {acceptedTasks.filter(t => ['accepted', 'in_progress'].includes(t.status)).length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* 任務列表 */}
      <FlatList
        data={currentTasks}
        renderItem={renderTaskItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="clipboard-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>
              {activeTab === 'posted' ? '你暫時未有發布任務' : '你暫時未有接單'}
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate(activeTab === 'posted' ? 'CreateTask' : 'Home')}
            >
              <Text style={styles.emptyButtonText}>
                {activeTab === 'posted' ? '去發布任務' : '去瀏覽任務'}
              </Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
  statsRow: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 4,
    margin: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#6366f1',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#fff',
  },
  tabBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  listContainer: {
    padding: 16,
    paddingTop: 0,
  },
  taskCard: {
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
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 11,
    color: '#6366f1',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  metaText: {
    fontSize: 13,
    color: '#6b7280',
    marginLeft: 4,
  },
  metaDot: {
    fontSize: 13,
    color: '#9ca3af',
    marginHorizontal: 6,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  rewardSection: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  rewardLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  rewardAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6366f1',
  },
  purchaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  purchaseText: {
    fontSize: 11,
    color: '#92400e',
    fontWeight: '500',
  },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  workerText: {
    fontSize: 13,
    color: '#374151',
    marginLeft: 6,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 4,
  },
  completedText: {
    fontSize: 13,
    color: '#22c55e',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 16,
  },
  emptyButton: {
    marginTop: 20,
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});