import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { WalletProvider } from './src/contexts/WalletContext';
import ErrorBoundary from './src/components/ErrorBoundary';

import HomeScreen from './src/screens/HomeScreen';
import TaskDetailScreen from './src/screens/TaskDetailScreen';
import CreateTaskScreen from './src/screens/CreateTaskScreen';
import ChatListScreen from './src/screens/ChatListScreen';
import ChatScreen from './src/screens/ChatScreen';
import WalletScreen from './src/screens/WalletScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import MyTasksScreen from './src/screens/MyTasksScreen';
import IdVerificationScreen from './src/screens/IdVerificationScreen';
import RiskAcknowledgmentScreen from './src/screens/RiskAcknowledgmentScreen';
import AuthScreen from './src/screens/AuthScreen';

const Stack = createNativeStackNavigator();

// 🔥 根據登入狀態決定顯示邊個 Stack
function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return null; // 或者顯示 Loading 畫面
  }

  return (
    <Stack.Navigator>
      {user ? (
        // 🔓 已登入用戶 - 顯示主 App（冇返回去 Auth 嘅路）
        <>
          <Stack.Screen 
            name="Home" 
            component={HomeScreen} 
            options={{ 
              title: '即做',
              headerBackVisible: false, // 隱藏返回按鈕
            }} 
          />
          <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: '任務詳情' }} />
          <Stack.Screen name="CreateTask" component={CreateTaskScreen} options={{ title: '發布任務' }} />
          <Stack.Screen name="ChatList" component={ChatListScreen} options={{ title: '聊天' }} />
          <Stack.Screen name="Chat" component={ChatScreen} options={{ title: '聊天' }} />
          <Stack.Screen name="Wallet" component={WalletScreen} options={{ title: '錢包' }} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: '我的' }} />
          <Stack.Screen name="MyTasks" component={MyTasksScreen} options={{ title: '我的任務' }} />
          <Stack.Screen name="IdVerification" component={IdVerificationScreen} options={{ title: '身份驗證' }} />
          <Stack.Screen name="RiskAcknowledgment" component={RiskAcknowledgmentScreen} options={{ title: '風險確認' }} />
        </>
      ) : (
        // 🔒 未登入用戶 - 顯示登入頁
        <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <WalletProvider>
          <SafeAreaProvider>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </SafeAreaProvider>
        </WalletProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
