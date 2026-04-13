import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

// 任務類型定義
interface Task {
  id: string;
  title: string;
  description: string;
  budget: number;
  location: string;
  deadline: string;
  status: 'open' | 'in_progress' | 'completed';
  posterName: string;
}

// 模擬任務數據
const MOCK_TASKS: Task[] = [
  {
    id: '1',
    title: '幫手搬運傢俬',
    description: '由屯門搬運一張梳化到荃灣，約2小時工作量',
    budget: 300,
    location: '屯門 → 荃灣',
    deadline: '2026-04-15',
    status: 'open',
    posterName: '陳先生',
  },
  {
    id: '2',
    title: '需要幫手排隊買演唱會飛',
    description: '幫手單買張學友演唱會門飛，预计排隊4-6小時',
    budget: 500,
    location: '紅磡體育館',
    deadline: '2026-04-14',
    status: 'open',
    posterName: '李小姐',
  },
  {
    id: '3',
    title: '家居清潔服務',
    description: '400呎單位深層清潔，包括廁所廚房',
    budget: 400,
    location: '旺角',
    deadline: '2026-04-16',
    status: 'open',
    posterName: '張先生',
  },
  {
    id: '4',
    title: '臨時活動工作人員',
    description: '婚禮現場幫手，負責接待同協調',
    budget: 800,
    location: '尖沙咀酒店',
    deadline: '2026-04-20',
    status: 'open',
    posterName: '黃小姐',
  },
];

export default function HomeScreen() {
  const navigation = useNavigation();
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'nearby' | 'urgent'>('all');

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const renderTaskCard = ({ item }: { item: Task }) => (
    <TouchableOpacity 
      style={styles.taskCard}
      onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}
      activeOpacity={0.9}
    >
      <View style={styles.taskHeader}>
        <View style={styles.posterInfo}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{item.posterName[0]}</Text>
          </View>
          <Text style={styles.posterName}>{item.posterName}</Text>
        </View>
        <View style={[styles.statusBadge, styles.statusOpen]}>
          <Text style={styles.statusText}>招募中</Text>
        </View>
      </View>

      <Text style={styles.taskTitle}>{item.title}</Text>
      <Text style={styles.taskDescription} numberOfLines={2}>{item.description}</Text>

      <View style={styles.taskFooter}>
        <View style={styles.infoItem}>
          <Ionicons name="cash-outline" size={16} color="#6366f1" />
          <Text style={styles.budgetText}>${item.budget}</Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="location-outline" size={16} color="#6b7280" />
          <Text style={styles.locationText}>{item.location}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 頂部搜尋欄 */}
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#9ca3af" />
          <Text style={styles.searchPlaceholder}>搜尋任務...</Text>
        </View>
        <TouchableOpacity style={styles.filterButton}>
          <Ionicons name="options-outline" size={24} color="#6366f1" />
        </TouchableOpacity>
      </View>

      {/* 篩選標籤 */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {['all', 'nearby', 'urgent'].map((filter) => (
            <TouchableOpacity 
              key={filter}
              style={[styles.filterTab, selectedFilter === filter && styles.filterTabActive]}
              onPress={() => setSelectedFilter(filter as any)}
            >
              <Text style={[styles.filterText, selectedFilter === filter && styles.filterTextActive]}>
                {filter === 'all' ? '全部' : filter === 'nearby' ? '附近' : '急單'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 任務列表 */}
      <FlatList
        data={tasks}
        renderItem={renderTaskCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.taskList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
        }
      />

      {/* 發布任務按鈕 */}
      <TouchableOpacity 
        style={styles.fabButton}
        onPress={() => navigation.navigate('CreateTask')}
      >
        <Ionicons name="add" size={28} color="#fff" />
        <Text style={styles.fabText}>發布任務</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 12,
  },
  searchPlaceholder: {
    color: '#9ca3af',
    marginLeft: 8,
    fontSize: 16,
  },
  filterButton: {
    padding: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterScroll: {
    paddingHorizontal: 16,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  filterTabActive: {
    backgroundColor: '#6366f1',
  },
  filterText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  taskList: {
    padding: 16,
    paddingBottom: 100,
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  posterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  posterName: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusOpen: {
    backgroundColor: '#dcfce7',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 6,
  },
  taskDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  budgetText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6366f1',
    marginLeft: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 4,
  },
  fabButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  fabText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});