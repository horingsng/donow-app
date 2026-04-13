import React, { createContext, useContext, useState } from 'react';

interface WalletContextType {
  availableBalance: number;
  heldBalance: number;
  withdrawableBalance: number;
  refreshWallet: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType>({
  availableBalance: 0,
  heldBalance: 0,
  withdrawableBalance: 0,
  refreshWallet: async () => {},
});

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [availableBalance, setAvailableBalance] = useState(0);
  const [heldBalance, setHeldBalance] = useState(0);
  const [withdrawableBalance, setWithdrawableBalance] = useState(0);

  const refreshWallet = async () => {
    // TODO: Fetch from Firestore
  };

  return (
    <WalletContext.Provider value={{ availableBalance, heldBalance, withdrawableBalance, refreshWallet }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);
