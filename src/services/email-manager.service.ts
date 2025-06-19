// src/services/email-manager.service.ts
import { AbokiEmailService, BulkEmailResult } from './aboki-email.service';
import * as cron from 'node-cron';

interface EmailLogEntry {
  timestamp: string;
  type: string;
  recipient: string;
  success: boolean;
  error: string | undefined;
}

interface EmailStats {
  total: number;
  successful: number;
  failed: number;
  types: Record<string, {
    total: number;
    successful: number;
    failed: number;
  }>;
}

interface User {
  email: string;
  name: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  recipient: string;
  error?: any;
}

// Removed the redefinition of BulkEmailResult to avoid conflicts

export class EmailManager {
  private emailService: AbokiEmailService;
  private emailLog: EmailLogEntry[];
  
  constructor() {
    this.emailService = new AbokiEmailService();
    this.emailLog = [];
    
    console.log('EmailManager initialized');
  }

  // Helper method to log email activity
  private logEmail(type: string, recipient: string, success: boolean, error?: string): void {
    const logEntry: EmailLogEntry = {
      timestamp: new Date().toISOString(),
      type,
      recipient,
      success,
      error
    };
    
    this.emailLog.push(logEntry);
    
    // Keep only last 1000 entries
    if (this.emailLog.length > 1000) {
      this.emailLog = this.emailLog.slice(-1000);
    }
    
    console.log(`📧 Email ${type}: ${recipient} - ${success ? 'SUCCESS' : 'FAILED'}${error ? ` (${error})` : ''}`);
  }

  // Get email statistics
  getEmailStats(hours: number = 24): EmailStats {
    const cutoff = new Date(Date.now() - (hours * 60 * 60 * 1000));
    const recentEmails = this.emailLog.filter(log => new Date(log.timestamp) > cutoff);
    
    const stats: EmailStats = {
      total: recentEmails.length,
      successful: recentEmails.filter(log => log.success).length,
      failed: recentEmails.filter(log => !log.success).length,
      types: {}
    };
    
    recentEmails.forEach(log => {
      if (!stats.types[log.type]) {
        stats.types[log.type] = { total: 0, successful: 0, failed: 0 };
      }
      stats.types[log.type].total++;
      if (log.success) {
        stats.types[log.type].successful++;
      } else {
        stats.types[log.type].failed++;
      }
    });
    
    return stats;
  }

  // User registration welcome email
  async handleUserRegistration(userEmail: string, userName: string): Promise<EmailResult> {
    try {
      const result = await this.emailService.sendWelcomeEmail(userEmail, userName);
      this.logEmail('welcome', userEmail, result.success, result.error);
      return result;
    } catch (error: any) {
      this.logEmail('welcome', userEmail, false, error.message);
      throw error;
    }
  }

  // Password reset email
  async sendPasswordResetEmail(userEmail: string, userName: string, resetToken: string): Promise<EmailResult> {
    try {
      const result = await this.emailService.sendPasswordResetEmail(userEmail, userName, resetToken);
      this.logEmail('password_reset', userEmail, result.success, result.error);
      return result;
    } catch (error: any) {
      this.logEmail('password_reset', userEmail, false, error.message);
      throw error;
    }
  }

  // Password reset confirmation email
  async sendPasswordResetConfirmation(userEmail: string, userName: string): Promise<EmailResult> {
    try {
      const result = await this.emailService.sendPasswordResetConfirmation(userEmail, userName);
      this.logEmail('password_reset_confirmation', userEmail, result.success, result.error);
      return result;
    } catch (error: any) {
      this.logEmail('password_reset_confirmation', userEmail, false, error.message);
      throw error;
    }
  }

  // Deposit confirmation
  async handleUserDeposit(
    userEmail: string, 
    userName: string, 
    amount: number, 
    transactionId: string, 
    paymentMethod: string = 'Bank Transfer'
  ): Promise<EmailResult> {
    try {
      const result = await this.emailService.sendDepositConfirmation(
        userEmail, 
        userName, 
        amount, 
        transactionId, 
        paymentMethod
      );
      this.logEmail('deposit', userEmail, result.success, result.error);
      return result;
    } catch (error: any) {
      this.logEmail('deposit', userEmail, false, error.message);
      throw error;
    }
  }

  // Transaction completion
  async handleTransactionComplete(
    userEmail: string, 
    userName: string, 
    transactionType: string, 
    amount: number, 
    recipient: string | null, 
    transactionId: string
  ): Promise<EmailResult> {
    try {
      const result = await this.emailService.sendTransactionComplete(
        userEmail, 
        userName, 
        transactionType, 
        amount, 
        recipient, 
        transactionId
      );
      this.logEmail('transaction', userEmail, result.success, result.error);
      return result;
    } catch (error: any) {
      this.logEmail('transaction', userEmail, false, error.message);
      throw error;
    }
  }

  // Setup automated email campaigns
  setupAutomatedCampaigns(): void {
    // Monthly greetings - 1st of every month at 9 AM
    cron.schedule('0 9 1 * *', async () => {
      console.log('🗓️ Running monthly greeting campaign...');
      try {
        // Import AuthService dynamically to avoid circular dependency
        const { AuthService } = await import('./auth.service');
        const authService = new AuthService();
        const users = await authService.getActiveUsersForEmail();
        
        if (users.length > 0) {
          const result = await this.emailService.sendBulkEmails('monthly', users);
          console.log(`📧 Monthly greetings sent: ${result.summary.sent}/${result.summary.total}`);
          
          // Log campaign results
          result.results.forEach(res => {
            this.logEmail('campaign_monthly', res.user, res.success, res.error);
          });
        }
      } catch (error: any) {
        console.error('❌ Monthly greeting campaign failed:', error.message);
      }
    });

    // Monday motivation - Every Monday at 8 AM
    cron.schedule('0 8 * * 1', async () => {
      console.log('💪 Running Monday motivation campaign...');
      try {
        const { AuthService } = await import('./auth.service');
        const authService = new AuthService();
        const users = await authService.getRecentlyActiveUsers(30); // Active in last 30 days
        
        if (users.length > 0) {
          const result = await this.emailService.sendBulkEmails('monday', users);
          console.log(`📧 Monday motivation sent: ${result.summary.sent}/${result.summary.total}`);
          
          // Log campaign results
          result.results.forEach(res => {
            this.logEmail('campaign_monday', res.user, res.success, res.error);
          });
        }
      } catch (error: any) {
        console.error('❌ Monday motivation campaign failed:', error.message);
      }
    });

    // Weekly welcome emails for new users - Every Sunday at 10 AM
    cron.schedule('0 10 * * 0', async () => {
      console.log('👋 Running new user welcome campaign...');
      try {
        const { AuthService } = await import('./auth.service');
        const authService = new AuthService();
        const newUsers = await authService.getNewUsers(7); // Users registered in last 7 days
        
        if (newUsers.length > 0) {
          const result = await this.emailService.sendBulkEmails('welcome', newUsers);
          console.log(`📧 Welcome emails sent: ${result.summary.sent}/${result.summary.total}`);
          
          // Log campaign results
          result.results.forEach(res => {
            this.logEmail('campaign_welcome', res.user, res.success, res.error);
          });
        }
      } catch (error: any) {
        console.error('❌ Welcome email campaign failed:', error.message);
      }
    });

    // Cleanup expired password reset tokens - Every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      console.log('🧹 Cleaning up expired password reset tokens...');
      try {
        const { AuthService } = await import('./auth.service');
        const authService = new AuthService();
        const cleanedCount = await authService.cleanupExpiredTokens();
        console.log(`✅ Cleaned up ${cleanedCount} expired password reset tokens`);
      } catch (error: any) {
        console.error('❌ Token cleanup failed:', error.message);
      }
    });

    console.log('⏰ Automated email campaigns scheduled');
  }

  // Send custom campaign
  async sendCustomCampaign(emailType: string, userFilter: string = 'all'): Promise<BulkEmailResult> {
    try {
      const { AuthService } = await import('./auth.service');
      const authService = new AuthService();
      let users: User[];
      
      switch (userFilter) {
        case 'active':
          users = await authService.getRecentlyActiveUsers(30);
          break;
        case 'new':
          users = await authService.getNewUsers(7);
          break;
        case 'inactive':
          users = await authService.getInactiveUsers(90);
          break;
        case 'all':
        default:
          users = await authService.getActiveUsersForEmail();
      }
      
      if (users.length === 0) {
        return { 
          success: true, 
          message: 'No users found for campaign', 
          summary: { total: 0, sent: 0, failed: 0, emailType },
          results: []
        } as any;
      }
      
      const result = await this.emailService.sendBulkEmails(emailType, users);
      
      // Log campaign results
      result.results.forEach(res => {
        this.logEmail(`campaign_${emailType}`, res.user, res.success, res.error);
      });
      
      return result;
    } catch (error: any) {
      console.error(`Campaign ${emailType} failed:`, error.message);
      throw error;
    }
  }

  // Utility methods
  async testEmailConfiguration(): Promise<{
    configValid: boolean;
    testEmailSent: boolean;
    message: string;
  }> {
    try {
      this.emailService.validateConfig();
      
      // Send test email to verify everything works
      const testResult = await this.emailService.sendEmail({
        subject: 'ABOKI Email Service Test',
        recipients: [{ email: process.env.TEST_EMAIL || 'admin@aboki.com', name: 'Admin' }],
        htmlContent: '<h2>Email Service Test</h2><p>If you receive this, the email service is working correctly!</p>',
        textContent: 'Email Service Test. If you receive this, the email service is working correctly!'
      });
      
      return {
        configValid: true,
        testEmailSent: testResult.success,
        message: testResult.success ? 'Email service is working correctly' : 'Email sending failed'
      };
    } catch (error: any) {
      return {
        configValid: false,
        testEmailSent: false,
        message: error.message
      };
    }
  }

  // Manual trigger methods for testing
  async triggerMonthlyGreetings(): Promise<BulkEmailResult> {
    try {
      const { AuthService } = await import('./auth.service');
      const authService = new AuthService();
      const users = await authService.getActiveUsersForEmail();
      return await this.emailService.sendBulkEmails('monthly', users);
    } catch (error: any) {
      console.error('Error triggering monthly greetings:', error);
      throw error;
    }
  }

  async triggerMondayMotivation(): Promise<BulkEmailResult> {
    try {
      const { AuthService } = await import('./auth.service');
      const authService = new AuthService();
      const users = await authService.getRecentlyActiveUsers(30);
      return await this.emailService.sendBulkEmails('monday', users);
    } catch (error: any) {
      console.error('Error triggering Monday motivation:', error);
      throw error;
    }
  }

  async triggerWelcomeEmails(): Promise<BulkEmailResult> {
    try {
      const { AuthService } = await import('./auth.service');
      const authService = new AuthService();
      const users = await authService.getNewUsers(7);
      return await this.emailService.sendBulkEmails('welcome', users);
    } catch (error: any) {
      console.error('Error triggering welcome emails:', error);
      throw error;
    }
  }

  // Email queue management (for high-volume scenarios)
  async queueEmail(emailType: string, emailData: { recipient: string; [key: string]: any }): Promise<void> {
    // TODO: Implement email queue for high-volume sending
    // This could use Redis, database, or message queue like Bull or Agenda
    console.log(`Queued ${emailType} email for ${emailData.recipient}`);
    
    /* Example with Bull Queue:
    import Queue from 'bull';
    const emailQueue = new Queue('email processing');
    
    await emailQueue.add('send-email', {
      type: emailType,
      data: emailData
    });
    */
  }

  async processEmailQueue(): Promise<void> {
    // TODO: Process queued emails in batches
    console.log('Processing email queue...');
    
    /* Example queue processor:
    emailQueue.process('send-email', async (job) => {
      const { type, data } = job.data;
      
      switch (type) {
        case 'welcome':
          return await this.handleUserRegistration(data.email, data.name);
        case 'password_reset':
          return await this.sendPasswordResetEmail(data.email, data.name, data.token);
        case 'deposit':
          return await this.handleUserDeposit(data.email, data.name, data.amount, data.transactionId, data.paymentMethod);
        case 'transaction':
          return await this.handleTransactionComplete(data.email, data.name, data.transactionType, data.amount, data.recipient, data.transactionId);
        default:
          throw new Error(`Unknown email type: ${type}`);
      }
    });
    */
  }

  // Get recent email logs
  getRecentEmailLogs(limit: number = 100): EmailLogEntry[] {
    return this.emailLog.slice(-limit).reverse();
  }

  // Clear email logs
  clearEmailLogs(): void {
    this.emailLog = [];
    console.log('Email logs cleared');
  }

  // Get campaign statistics
  async getCampaignStats(): Promise<{
    totalCampaigns: number;
    successfulCampaigns: number;
    failedCampaigns: number;
    recentCampaigns: EmailLogEntry[];
  }> {
    const campaignLogs = this.emailLog.filter(log => log.type.startsWith('campaign_'));
    
    return {
      totalCampaigns: campaignLogs.length,
      successfulCampaigns: campaignLogs.filter(log => log.success).length,
      failedCampaigns: campaignLogs.filter(log => !log.success).length,
      recentCampaigns: campaignLogs.slice(-10).reverse()
    };
  }

  // Send re-engagement email to inactive users
  async sendReEngagementCampaign(): Promise<BulkEmailResult> {
    try {
      const { AuthService } = await import('./auth.service');
      const authService = new AuthService();
      const inactiveUsers = await authService.getInactiveUsers(90); // 90 days inactive
      
      if (inactiveUsers.length === 0) {
        return {
          summary: { total: 0, sent: 0, failed: 0, emailType: 're-engagement' },
          results: []
        };
      }

      // You can create a specific re-engagement email template in the email service
      // For now, we'll use the Monday motivation as a re-engagement email
      const result = await this.emailService.sendBulkEmails('monday', inactiveUsers);
      
      // Log campaign results
      result.results.forEach(res => {
        this.logEmail('campaign_reengagement', res.user, res.success, res.error);
      });
      
      return result;
    } catch (error: any) {
      console.error('Error sending re-engagement campaign:', error);
      throw error;
    }
  }
}