import React, { ReactNode } from 'react';
import { Modal } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import LoadingScreen from './LoadingScreen';

interface LoadingProviderProps {
  children: ReactNode;
}

const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
  const { isLoading, loadingMessage } = useSelector((state: RootState) => state.ui);

  return (
    <>
      {children}
      <Modal
        visible={isLoading}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
      >
        <LoadingScreen message={loadingMessage} showLogo={false} />
      </Modal>
    </>
  );
};

export default LoadingProvider;