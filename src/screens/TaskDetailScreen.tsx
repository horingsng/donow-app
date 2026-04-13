import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../services/firebase';
import {
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  runTransaction,
  collection,
} from 'firebase/firestore';

// 分類對應
const CATEGORY_NAMES: { [key: string]: { name: string; color: string } } = {
  grocery: { name: '代買', color: '#22c55e' },
  queueing: { name: '排隊', color: '#f59e0b' },
  delivery: { name: '送遞', color: '#3b82f6' },
  pickup: { name: '取件', color: '#8b5cf6' },
  instant_help: { name: '即時幫手', color: '#ef4444' },
};

export default function TaskDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { taskId } = route.params as { taskId: string };

  const [task, setTask] = useState<any>(null);
  const [poster, setPoster] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const user = auth.currentUser;
    setCurrentUser(user);

    // 實時監聽任務變化
    const unsubscribe = onSnapshot(doc(db, 'tasks', taskId), async (taskDoc) => {
      if (taskDoc.exists()) {
        const taskData = { id: taskDoc.id, ...taskDoc.data() };
        setTask(taskData);

        // 獲取發單者資料
        const posterDoc = await getDoc(doc(db, 'users', taskData.posterUid));
        if (posterDoc.exists()) {
          setPoster(posterDoc.data());
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [taskId]);

  const handleAccept = async () => {
    if (!currentUser) {
      Alert.alert('錯誤', '請先登入');
      return;
    }

    if (currentUser.uid === task.posterUid) {
      Alert.alert('錯誤', '唔可以接自己發嘅任務');
      return;
    }

    setAccepting(true);
    try {
      await runTransaction(db, async (transaction) => {
        const taskRef = doc(db, 'tasks', taskId);
        const taskSnap = await transaction.get(taskRef);

        if (!taskSnap.exists()) throw new Error('任務不存在');
        if (taskSnap.data().status !== 'open') throw new Error('任務已被接或已過期');

        // 獲取接單者名稱
        const workerDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const workerName = workerDoc.exists() ? workerDoc.data().name || '用戶' : '用戶';

        transaction.update(taskRef, {
          workerUid: currentUser.uid,
          workerName,
          status: 'accepted',
          acceptedAt: serverTimestamp(),
        });

        // 創建聊天室
        const chatRef = doc(collection(db, 'chats'));
        transaction.set(chatRef, {
          chatId: chatRef.id,
          taskId: taskId,
          posterUid: task.posterUid,
          workerUid: currentUser.uid,
          posterName: task.posterName,
          workerName,
          taskTitle: task.title,
          lastMessage: '任務已被接受，開始聊天',
          lastMessageType: 'system',
          lastSenderUid: 'system',
          unreadCountPoster: 1,
          unreadCountWorker: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const messageRef = doc(collection(db, 'chat_messages'));
        transaction.set(messageRef, {
          messageId: messageRef.id,
          chatId: chatRef.id,
          senderUid: 'system',
          type: 'system',
          text: '任務已被接受，開始聊天',
          createdAt: serverTimestamp(),
        });
      });

      Alert.alert('✅ 接單成功', '你已成功接單，可以開始同發單者溝通', [
        { text: '去聊天', onPress: () => navigation.navigate('ChatList') },
        { text: '留在呢度' },
      ]);
    } catch (error: any) {
      Alert.alert('❌ 接單失敗', error.message);
    } finally {
      setAccepting(false);
    }
  };

  const handleStartTask = async () => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'in_progress',
        startedAt: serverTimestamp(),
      });
      Alert.alert('✅ 已開始', '任務狀態已更新為進行中');
    } catch (error) {
      Alert.alert('❌ 更新失敗');
    }
  };

  const handleCompleteTask = async () => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'pending_confirmation',
        completedAt: serverTimestamp(),
      });
      Alert.alert('✅ 已標記完成', '請等待發單者確認');
    } catch (error) {
      Alert.alert('❌ 更新失敗');
    }
  };

  const handleConfirmCompletion = async () => {
    try {
      await runTransaction(db, async (transaction) => {
        const taskRef = doc(db, 'tasks', taskId);
        transaction.update(taskRef, { status: 'completed', confirmedAt: serverTimestamp() });

        // 入帳俾接單者
        const workerRef = doc(db, 'users', task.workerUid);
        const workerDoc = await transaction.get(workerRef);
        
        if (workerDoc.exists()) {
          const netAmount = task.rewardAmount - task.workerFee;
          transaction.update(workerRef, {
            walletWithdrawable: (workerDoc.data().walletWithdrawable || 0) + netAmount,
            earnedTotal: (workerDoc.data().earnedTotal || 0) + netAmount,
          });
        }

        // 解凍發單者資金
        const posterRef = doc(db, 'users', task.posterUid);
        const posterDoc = await transaction.get(posterRef);
        if (posterDoc.exists()) {
          transaction.update(posterRef, {
            walletHeld: Math.max(0, (posterDoc.data().walletHeld || 0) - task.posterPayTotal),
          });
        }
      });

      Alert.alert('✅ 確認完成', '任務已完成，款項已結算');
    } catch (error) {
      Alert.alert('❌ 確認失敗');
    }
  };

  if (loading) return <SafeAreaView style={styles.container}><ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 100 }} /></SafeAreaView>;
  if (!task) return <SafeAreaView style={styles.container}><Text style={{ textAlign: 'center', marginTop: 100 }}>任務不存在</Text></SafeAreaView>;

  const isPoster = currentUser?.uid === task.posterUid;
  const isWorker = currentUser?.uid === task.workerUid;
  const workerNetAmount = task.rewardAmount - task.workerFee;
  const category = CATEGORY_NAMES[task.category] || { name: '其他', color: '#999' };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* 頂部 */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(task.status) }]}>
            <Text style={styles.statusText}>{getStatusText(task.status)}</Text>
          </View>
        </View>

        {/* 任務標題 */}
        <View style={styles.section}>
          <View style={styles.categoryBadge}>
            <Ionicons name="pricetag" size={12} color={category.color} />
            <Text style={[styles.categoryText, { color: category.color }]}>{category.name}</Text>
          </View>
          <Text style={styles.title}>{task.title}</Text>
          <Text style={styles.timeType}>{task.taskTimeType === 'immediate' ? '⚡ 即時任務' : '📅 預約任務'}</Text>
        </View>

        {/* 發單者 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>發單者</Text>
          <View style={styles.posterRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(poster?.name || task.posterName || '?')[0]}</Text>
            </View>
            <View>
              <Text style={styles.posterName}>{poster?.name || task.posterName || '用戶'}</Text>
              <Text style={styles.posterRating}>⭐ {poster?.rating || '5.0'} · 已完成 {poster?.completedCount || 0} 單</Text>
            </View>
          </View>
        </View>

        {/* 描述 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>任務詳情</Text>
          <Text style={styles.description}>{task.description}</Text>
        </View>

        {/* 圖片 */}
        {task.images && task.images.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>任務圖片</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {task.images.map((uri: string, index: number) => (
                <Image key={index} source={{ uri }} style={styles.taskImage} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* 地區 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>地區</Text>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color="#6366f1" />
            <Text style={styles.infoText}>{task.district} {task.subArea ? `· ${task.subArea}` : ''}</Text>
          </View>
        </View>

        {/* 報酬 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>報酬</Text>
          <View style={styles.rewardBox}>
            <Text style={styles.rewardLabel}>任務報酬</Text>
            <Text style={styles.rewardAmount}>${task.rewardAmount}</Text>
          </View>
          
          {!isPoster && task.status === 'open' && (
            <View style={styles.netEarningBox}>
              <Text style={styles.netEarningLabel}>你實收（已扣10%平台費）</Text>
              <Text style={styles.netEarningAmount}>${workerNetAmount}</Text>
            </View>
          )}

          {task.purchaseRequired && (
            <View style={styles.purchaseBox}>
              <Text style={styles.purchaseLabel}>需代付：${task.estimatedPurchaseAmount}</Text>
              <Text style={styles.purchaseNote}>代付金額會報銷，唔計入收入</Text>
            </View>
          )}
        </View>

        {/* 操作按鈕 */}
        <View style={styles.actionSection}>
          {task.status === 'open' && !isPoster && (
            <TouchableOpacity style={styles.acceptButton} onPress={handleAccept} disabled={accepting}>
              {accepting ? <ActivityIndicator color="#fff" /> : <>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
                <Text style={styles.actionButtonText}>立即接單</Text>
              </>}
            </TouchableOpacity>
          )}

          {task.status === 'accepted' && isWorker && (
            <TouchableOpacity style={styles.startButton} onPress={handleStartTask}>
              <Ionicons name="play-circle" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>開始任務</Text>
            </TouchableOpacity>
          )}

          {task.status === 'in_progress' && isWorker && (
            <TouchableOpacity style={styles.completeButton} onPress={handleCompleteTask}>
              <Ionicons name="checkmark-done-circle" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>標記完成</Text>
            </TouchableOpacity>
          )}

          {task.status === 'pending_confirmation' && isPoster && (
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmCompletion}>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>確認完成並付款</Text>
            </TouchableOpacity>
          )}

          {(isWorker || isPoster) && task.status !== 'open' && task.status !== 'completed' && (
            <TouchableOpacity style={styles.chatButton} onPress={() => navigation.navigate('ChatList')}>
              <Ionicons name="chatbubble-ellipses" size={24} color="#6366f1" />
              <Text style={styles.chatButtonText}>打開聊天室</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'open': return '#6366f1';
    case 'accepted': return '#f59e0b';
    case 'in_progress': return '#3b82f6';
    case 'pending_confirmation': return '#8b5cf6';
    case 'completed': return '#22c55e';
    default: return '#999';
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'open': return '招募中';
    case 'accepted': return '已接單';
    case 'in_progress': return '進行中';
    case 'pending_confirmation': return '等待確認';
    case 'completed': return '已完成';
    default: return '未知';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  scrollView: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#6366f1',
  },
  backButton: { padding: 8 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  statusText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
    gap: 4,
  },
  categoryText: { fontSize: 12, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1f2937', marginBottom: 8 },
  timeType: { fontSize: 14, color: '#6b7280' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#6b7280', marginBottom: 12 },
  posterRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  posterName: { fontSize: 16, fontWeight: '600', color: '#374151' },
  posterRating: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  description: { fontSize: 15, color: '#374151', lineHeight: 22 },
  taskImage: { width: 200, height: 150, borderRadius: 12, marginRight: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  infoText: { fontSize: 15, color: '#374151', marginLeft: 8 },
  rewardBox: { backgroundColor: '#f3f4f6', padding: 16, borderRadius: 12, marginBottom: 12 },
  rewardLabel: { fontSize: 13, color: '#6b7280' },
  rewardAmount: { fontSize: 28, fontWeight: 'bold', color: '#1f2937', marginTop: 4 },
  netEarningBox: { backgroundColor: '#dcfce7', padding: 16, borderRadius: 12 },
  netEarningLabel: { fontSize: 13, color: '#166534' },
  netEarningAmount: { fontSize: 24, fontWeight: 'bold', color: '#166534', marginTop: 4 },
  purchaseBox: { backgroundColor: '#fef3c7', padding: 12, borderRadius: 12, marginTop: 12 },
  purchaseLabel: { fontSize: 14, color: '#92400e', fontWeight: '500' },
  purchaseNote: { fontSize: 12, color: '#a16207', marginTop: 4 },
  actionSection: { padding: 16 },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    padding: 18,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    padding: 18,
    borderRadius: 12,
    gap: 8,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    padding: 18,
    borderRadius: 12,
    gap: 8,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    padding: 18,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 2,
    borderColor: '#6366f1',
    gap: 8,
  },
  chatButtonText: { color: '#6366f1', fontSize: 16, fontWeight: '600' },
  bottomPadding: { height: 32 },
});