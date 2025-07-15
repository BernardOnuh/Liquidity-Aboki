// src/services/balance.service.ts
import { ethers } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';

export interface WalletBalance {
  network: 'BASE' | 'SOLANA';
  address: string;
  usdcBalance: string;
  nativeBalance: string;
  usdcBalanceRaw: string;
  nativeBalanceRaw: string;
  lastUpdated: Date;
}

export class BalanceService {
  private baseProvider: ethers.JsonRpcProvider;
  private solanaConnection: Connection;

  constructor() {
    this.baseProvider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
    this.solanaConnection = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');
  }

  // Get Base network balances
  async getBaseBalance(address: string): Promise<WalletBalance> {
    try {
      console.log(`Fetching Base balance for address: ${address}`);

      // Validate address
      if (!ethers.isAddress(address)) {
        throw new Error('Invalid Ethereum address');
      }

      // Get ETH balance
      const ethBalance = await this.baseProvider.getBalance(address);
      const ethBalanceFormatted = ethers.formatEther(ethBalance);

      // Get USDC balance
      const usdcAddress = process.env.BASE_USDC_ADDRESS;
      const usdcABI = [
        'function balanceOf(address account) external view returns (uint256)',
        'function decimals() external view returns (uint8)'
      ];

      const usdcContract = new ethers.Contract(usdcAddress!, usdcABI, this.baseProvider);
      const usdcBalance = await usdcContract.balanceOf(address);
      const usdcBalanceFormatted = ethers.formatUnits(usdcBalance, 6); // USDC has 6 decimals

      console.log(`Base balances - ETH: ${ethBalanceFormatted}, USDC: ${usdcBalanceFormatted}`);

      return {
        network: 'BASE',
        address,
        usdcBalance: usdcBalanceFormatted,
        nativeBalance: ethBalanceFormatted,
        usdcBalanceRaw: usdcBalance.toString(),
        nativeBalanceRaw: ethBalance.toString(),
        lastUpdated: new Date()
      };

    } catch (error) {
      console.error('Error fetching Base balance:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to fetch Base balance: ${error.message}`);
      } else {
        throw new Error('Failed to fetch Base balance: Unknown error');
      }
    }
  }

  // Get Solana network balances
  async getSolanaBalance(address: string): Promise<WalletBalance> {
    try {
      console.log(`Fetching Solana balance for address: ${address}`);

      // Validate address
      let publicKey: PublicKey;
      try {
        publicKey = new PublicKey(address);
      } catch {
        throw new Error('Invalid Solana address');
      }

      // Get SOL balance
      const solBalance = await this.solanaConnection.getBalance(publicKey);
      const solBalanceFormatted = (solBalance / 1e9).toString(); // SOL has 9 decimals

      // Get USDC balance
      const usdcMint = new PublicKey(process.env.SOLANA_USDC_MINT!);
      const usdcTokenAccount = await getAssociatedTokenAddress(usdcMint, publicKey);

      let usdcBalance = '0';
      let usdcBalanceRaw = '0';

      try {
        const tokenAccountInfo = await getAccount(this.solanaConnection, usdcTokenAccount);
        usdcBalanceRaw = tokenAccountInfo.amount.toString();
        usdcBalance = (Number(tokenAccountInfo.amount) / 1e6).toString(); // USDC has 6 decimals
      } catch (error) {
        // Token account doesn't exist, balance is 0
        console.log('USDC token account does not exist, balance is 0');
      }

      console.log(`Solana balances - SOL: ${solBalanceFormatted}, USDC: ${usdcBalance}`);

      return {
        network: 'SOLANA',
        address,
        usdcBalance,
        nativeBalance: solBalanceFormatted,
        usdcBalanceRaw,
        nativeBalanceRaw: solBalance.toString(),
        lastUpdated: new Date()
      };

    } catch (error) {
      console.error('Error fetching Solana balance:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to fetch Solana balance: ${error.message}`);
      } else {
        throw new Error('Failed to fetch Solana balance: Unknown error');
      }
    }
  }

  // Get balance for any network
  async getBalance(address: string, network: 'BASE' | 'SOLANA'): Promise<WalletBalance> {
    if (network === 'BASE') {
      return this.getBaseBalance(address);
    } else {
      return this.getSolanaBalance(address);
    }
  }

  // Get multiple balances
  async getMultipleBalances(requests: Array<{ address: string; network: 'BASE' | 'SOLANA' }>): Promise<WalletBalance[]> {
    try {
      const balancePromises = requests.map(req => 
        this.getBalance(req.address, req.network).catch(error => {
          console.error(`Failed to get balance for ${req.address} on ${req.network}:`, error);
          return {
            network: req.network,
            address: req.address,
            usdcBalance: '0',
            nativeBalance: '0',
            usdcBalanceRaw: '0',
            nativeBalanceRaw: '0',
            lastUpdated: new Date()
          } as WalletBalance;
        })
      );

      return Promise.all(balancePromises);
    } catch (error) {
      console.error('Error fetching multiple balances:', error);
      throw new Error('Failed to fetch multiple balances');
    }
  }

  // Check if address has sufficient balance for operation
  async checkSufficientBalance(
    address: string, 
    network: 'BASE' | 'SOLANA', 
    requiredAmount: number,
    includeGas: boolean = true
  ): Promise<{
    hasSufficientUSDC: boolean;
    hasSufficientGas: boolean;
    currentUSDCBalance: number;
    currentGasBalance: number;
    requiredUSDC: number;
    estimatedGasCost: number;
  }> {
    try {
      const balance = await this.getBalance(address, network);
      
      const currentUSDCBalance = parseFloat(balance.usdcBalance);
      const currentGasBalance = parseFloat(balance.nativeBalance);
      
      // Estimate gas costs
      let estimatedGasCost = 0;
      if (includeGas) {
        if (network === 'BASE') {
          estimatedGasCost = 0.002; // ~$0.002 in ETH for Base transactions
        } else {
          estimatedGasCost = 0.0001; // ~$0.0001 in SOL for Solana transactions
        }
      }

      const hasSufficientUSDC = currentUSDCBalance >= requiredAmount;
      const hasSufficientGas = !includeGas || currentGasBalance >= estimatedGasCost;

      return {
        hasSufficientUSDC,
        hasSufficientGas,
        currentUSDCBalance,
        currentGasBalance,
        requiredUSDC: requiredAmount,
        estimatedGasCost
      };

    } catch (error) {
      console.error('Error checking sufficient balance:', error);
      throw new Error('Failed to check balance sufficiency');
    }
  }

  // Get historical balance data (mock implementation)
  async getBalanceHistory(
    address: string, 
    network: 'BASE' | 'SOLANA', 
    days: number = 30
  ): Promise<Array<{
    date: Date;
    usdcBalance: string;
    nativeBalance: string;
  }>> {
    // This is a mock implementation
    // In a real application, you would store balance snapshots in the database
    const history = [];
    const currentDate = new Date();
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(currentDate);
      date.setDate(date.getDate() - i);
      
      // Generate mock historical data
      const baseUSDC = Math.random() * 1000;
      const baseNative = Math.random() * 0.1;
      
      history.push({
        date,
        usdcBalance: baseUSDC.toFixed(6),
        nativeBalance: baseNative.toFixed(6)
      });
    }
    
    return history;
  }

  // Monitor balance changes (webhook-style)
  async monitorBalanceChanges(
    address: string, 
    network: 'BASE' | 'SOLANA',
    callback: (balance: WalletBalance) => void
  ): Promise<void> {
    // This would implement real-time balance monitoring
    // For now, it's a simple polling mechanism
    let lastBalance: WalletBalance | null = null;
    
    const checkBalance = async () => {
      try {
        const currentBalance = await this.getBalance(address, network);
        
        if (!lastBalance || 
            lastBalance.usdcBalance !== currentBalance.usdcBalance ||
            lastBalance.nativeBalance !== currentBalance.nativeBalance) {
          
          lastBalance = currentBalance;
          callback(currentBalance);
        }
      } catch (error) {
        console.error('Error monitoring balance:', error);
      }
    };

    // Check every 30 seconds
    setInterval(checkBalance, 30000);
    
    // Initial check
    checkBalance();
  }
}