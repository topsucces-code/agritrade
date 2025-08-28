import React from 'react';
import { StatusBar, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TamaguiProvider } from '@tamagui/core';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { store } from '@/store';
import { theme } from '@/theme';
import RootNavigator from '@/navigation/RootNavigator';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import LoadingProvider from '@/components/common/LoadingProvider';

// Ignore specific warnings in development
LogBox.ignoreLogs([
  'VirtualizedLists should never be nested',
  'Sending `onAnimatedValueUpdate` with no listeners registered',
]);

// Create QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
    mutations: {
      retry: 2,
    },
  },
});

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <TamaguiProvider config={theme}>
            <SafeAreaProvider>
              <StatusBar 
                barStyle="light-content" 
                backgroundColor="#2E7D32" 
                translucent={false}
              />
              <LoadingProvider>
                <NavigationContainer>
                  <RootNavigator />
                </NavigationContainer>
              </LoadingProvider>
            </SafeAreaProvider>
          </TamaguiProvider>
        </QueryClientProvider>
      </Provider>
    </ErrorBoundary>
  );
};

export default App;