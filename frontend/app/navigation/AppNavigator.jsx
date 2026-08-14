import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import GroupSettingsScreen from '../screens/GroupSettingsScreen';
import SettleUpScreen from '../screens/SettleUpScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';
import ActivityScreen from '../screens/ActivityScreen';
import AddFriendScreen from '../screens/AddFriendScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';

import { colors } from '../theme';

const Stack = createStackNavigator();
const Tabs = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.borderSoft },
        tabBarIcon: ({ focused, color, size }) => {
          const name =
            route.name === 'Home' ? (focused ? 'home' : 'home-outline')
            : route.name === 'Activity' ? (focused ? 'pulse' : 'pulse-outline')
            : 'ellipse-outline';
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Activity" component={ActivityScreen} />
    </Tabs.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={MainTabs} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
      <Stack.Screen name="GroupSettings" component={GroupSettingsScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="AddExpense" component={AddExpenseScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="SettleUp" component={SettleUpScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="AddFriend" component={AddFriendScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
