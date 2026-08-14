import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import EmailLoginScreen from '../screens/auth/EmailLoginScreen';
import ProfileSetupScreen from '../screens/auth/ProfileSetupScreen';

const Stack = createStackNavigator();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="EmailLogin"
      screenOptions={{ headerShown: false, animationEnabled: true }}
    >
      <Stack.Screen name="EmailLogin" component={EmailLoginScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
    </Stack.Navigator>
  );
}
