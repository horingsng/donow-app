import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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
import AuthScreen from './src/screens/AuthScreen'; // For combined Login/Signup

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Auth">
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: '即做' }} />
          <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: '任務詳情' }} />
          <Stack.Screen name="CreateTask" component={CreateTaskScreen} options={{ title: '發布任務' }} />
          <Stack.Screen name="ChatList" component={ChatListScreen} options={{ title: '聊天' }} />
          <Stack.Screen name="Chat" component={ChatScreen} options={{ title: '聊天' }} />
          <Stack.Screen name="Wallet" component={WalletScreen} options={{ title: '錢包' }} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: '我的' }} />
          <Stack.Screen name="MyTasks" component={MyTasksScreen} options={{ title: '我的任務' }} />
          <Stack.Screen name="IdVerification" component={IdVerificationScreen} options={{ title: '身份驗證' }} />
          <Stack.Screen name="RiskAcknowledgment" component={RiskAcknowledgmentScreen} options={{ title: '風險確認' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}