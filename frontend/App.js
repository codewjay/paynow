import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { paperTheme, colors } from './app/theme';
import { useStore } from './app/store/useStore';
import { userApi } from './app/services/api';
import { getDeviceFcmToken } from './app/services/notifications';
import AppNavigator from './app/navigation/AppNavigator';
import AuthNavigator from './app/navigation/AuthNavigator';

export default function App() {
  const [bootDone, setBootDone] = useState(false);
  const currentUser = useStore((s) => s.currentUser);
  const profileComplete = useStore((s) => s.profileComplete);
  const bootstrap = useStore((s) => s.bootstrap);
  const registeredNotificationUser = useRef(null);

  useEffect(() => {
    bootstrap().finally(() => setBootDone(true));
  }, [bootstrap]);

  useEffect(() => {
    if (!currentUser?._id || !profileComplete || registeredNotificationUser.current === currentUser._id) return;

    let active = true;
    (async () => {
      try {
        const fcmToken = await getDeviceFcmToken();
        if (active && fcmToken) {
          await userApi.update({ fcmToken });
          registeredNotificationUser.current = currentUser._id;
        }
      } catch (err) {
        console.warn('[notifications] token registration failed:', err?.message);
      }
    })();

    return () => {
      active = false;
    };
  }, [currentUser?._id, profileComplete]);

  if (!bootDone) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const signedInWithProfile = currentUser && profileComplete;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={paperTheme}>
          <NavigationContainer>
            <StatusBar style="dark" />
            {signedInWithProfile ? <AppNavigator /> : <AuthNavigator />}
          </NavigationContainer>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
