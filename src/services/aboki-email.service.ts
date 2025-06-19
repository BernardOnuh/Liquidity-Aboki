// src/services/aboki-email.service.ts
import * as SibApiV3Sdk from '@sendinblue/client';

export interface EmailRecipient {
  email: string;
  name: string;
}

export interface EmailData {
  subject: string;
  recipients: EmailRecipient[];
  htmlContent?: string;
  textContent?: string;
  templateId?: number;
  params?: Record<string, any>;
  sender?: {
    name: string;
    email: string;
  };
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  recipient: string;
  error?: any;
}

export interface BulkEmailResult {
  summary: {
    total: number;
    sent: number;
    failed: number;
    emailType: string;
  };
  results: Array<{
    user: string;
    name: string;
    index: number;
    total: number;
    success: boolean;
    error?: string | undefined;
    messageId?: string | undefined;
  }>;
}

export interface User {
  email: string;
  name: string;
}

export class AbokiEmailService {
  private apiInstance: SibApiV3Sdk.TransactionalEmailsApi;
  private defaultSender: { name: string; email: string };

  constructor() {
    // Initialize Brevo API client with API key
    this.apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    
    // Configure API key
    this.apiInstance.setApiKey(
      SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, 
      process.env.BREVO_API_KEY || ''
    );
    
    // Default sender configuration
    this.defaultSender = {
      name: process.env.BREVO_SENDER_NAME || "ABOKI",
      email: process.env.BREVO_SENDER_EMAIL || "noreply@aboki.com"
    };
    
    console.log('ABOKI Email Service initialized');
  }

  /**
   * Core email sending function
   */
  async sendEmail(emailData: EmailData): Promise<EmailResult> {
    if (!process.env.BREVO_API_KEY) {
      throw new Error('BREVO_API_KEY not found in environment variables');
    }

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    
    sendSmtpEmail.subject = emailData.subject;
    sendSmtpEmail.sender = emailData.sender || this.defaultSender;
    sendSmtpEmail.to = emailData.recipients;
    sendSmtpEmail.htmlContent = emailData.htmlContent ?? '';
    sendSmtpEmail.textContent = emailData.textContent ?? '';
    
    if (emailData.templateId) {
      sendSmtpEmail.templateId = emailData.templateId;
      sendSmtpEmail.params = emailData.params;
    }

    try {
      const response = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log(`Email sent successfully to ${emailData.recipients[0].email}`);
      return { 
        success: true, 
        messageId: (response as any).body?.messageId || 'sent',
        recipient: emailData.recipients[0].email
      };
    } catch (error: any) {
      console.error('Email sending failed:', error.response?.body || error.message);
      return { 
        success: false, 
        error: error.response?.body || error.message,
        recipient: emailData.recipients[0].email
      };
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(userEmail: string, userName: string, resetToken: string): Promise<EmailResult> {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    const emailData: EmailData = {
      subject: "Reset Your ABOKI Password 🔑",
      recipients: [{ email: userEmail, name: userName }],
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #FF6B6B; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Password Reset Request 🔑</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333;">Hello ${userName}!</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              We received a request to reset your ABOKI account password. If you made this request, 
              click the button below to reset your password.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: #FF6B6B; color: white; padding: 15px 30px; text-decoration: none; 
                        border-radius: 5px; font-weight: bold; display: inline-block; font-size: 16px;">
                Reset My Password
              </a>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="color: #856404; margin: 0; font-size: 14px;">
                <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour for your security. 
                If you didn't request this password reset, please ignore this email.
              </p>
            </div>
            
            <p style="color: #666; font-size: 14px; line-height: 1.5;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #FF6B6B; word-break: break-all;">${resetUrl}</a>
            </p>
            
            <p style="color: #666; font-size: 14px;">
              If you didn't request this password reset, please contact our support team immediately.
            </p>
            
            <p style="color: #666;">
              Best regards,<br>
              <strong>The ABOKI Security Team</strong>
            </p>
          </div>
          <div style="background: #333; color: #ccc; padding: 20px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">This is an automated security email from ABOKI.</p>
            <p style="margin: 5px 0 0 0;">If you have questions, contact us at support@aboki.com</p>
          </div>
        </div>
      `,
      textContent: `Password Reset Request\n\nHello ${userName},\n\nWe received a request to reset your ABOKI account password. If you made this request, click the link below to reset your password:\n\n${resetUrl}\n\nThis link will expire in 1 hour for your security. If you didn't request this password reset, please ignore this email.\n\nIf you didn't request this password reset, please contact our support team immediately.\n\nBest regards,\nThe ABOKI Security Team`
    };

    return await this.sendEmail(emailData);
  }

  /**
   * Send password reset confirmation email
   */
  async sendPasswordResetConfirmation(userEmail: string, userName: string): Promise<EmailResult> {
    const emailData: EmailData = {
      subject: "Password Reset Successful - ABOKI ✅",
      recipients: [{ email: userEmail, name: userName }],
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #4CAF50; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Password Reset Successful! ✅</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333;">Hello ${userName}!</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Your ABOKI account password has been successfully reset. You can now log in 
              with your new password.
            </p>
            
            <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="color: #155724; margin: 0; font-size: 14px;">
                <strong>🔒 Security Tip:</strong> For your account security, make sure to:
              </p>
              <ul style="color: #155724; margin: 10px 0 0 20px; font-size: 14px;">
                <li>Use a strong, unique password</li>
                <li>Don't share your password with anyone</li>
                <li>Consider enabling two-factor authentication</li>
              </ul>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              If you didn't reset your password, please contact our support team immediately 
              at support@aboki.com or through the app.
            </p>
            
            <div style="text-align: center; margin: 25px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" 
                 style="background: #4CAF50; color: white; padding: 12px 25px; text-decoration: none; 
                        border-radius: 5px; font-weight: bold; display: inline-block;">
                Login to Your Account
              </a>
            </div>
            
            <p style="color: #666;">
              Welcome back to ABOKI!<br>
              <strong>The ABOKI Team</strong>
            </p>
          </div>
        </div>
      `,
      textContent: `Password Reset Successful!\n\nHello ${userName},\n\nYour ABOKI account password has been successfully reset. You can now log in with your new password.\n\nSecurity Tip: Use a strong, unique password and don't share it with anyone. Consider enabling two-factor authentication.\n\nIf you didn't reset your password, please contact our support team immediately at support@aboki.com.\n\nWelcome back to ABOKI!\nThe ABOKI Team`
    };

    return await this.sendEmail(emailData);
  }

  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(userEmail: string, userName: string): Promise<EmailResult> {
    const emailData: EmailData = {
      subject: "Welcome to ABOKI! 🎉",
      recipients: [{ email: userEmail, name: userName }],
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Welcome to ABOKI! 🚀</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333;">Hello ${userName}!</h2>
            <p style="color: #666; line-height: 1.6;">
              We're thrilled to have you join the ABOKI family! You've just taken the first step 
              towards smarter financial management.
            </p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #667eea;">What's Next?</h3>
              <ul style="color: #666;">
                <li>Complete your profile setup</li>
                <li>Make your first deposit</li>
                <li>Explore our features</li>
                <li>Start your financial journey</li>
              </ul>
            </div>
            <p style="color: #666;">
              If you have any questions, our support team is here to help!
            </p>
            <p style="color: #666;">
              Best regards,<br>
              <strong>The ABOKI Team</strong>
            </p>
          </div>
        </div>
      `,
      textContent: `Welcome to ABOKI! Hello ${userName}, We're thrilled to have you join the ABOKI family! You've just taken the first step towards smarter financial management. Complete your profile, make your first deposit, and start exploring our features. If you have any questions, our support team is here to help! Best regards, The ABOKI Team`
    };

    return await this.sendEmail(emailData);
  }

  /**
   * Send deposit confirmation email
   */
  async sendDepositConfirmation(
    userEmail: string, 
    userName: string, 
    amount: number, 
    transactionId: string, 
    paymentMethod: string = 'Bank Transfer'
  ): Promise<EmailResult> {
    const formattedAmount = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount);

    const emailData: EmailData = {
      subject: "Deposit Confirmed - ABOKI ✅",
      recipients: [{ email: userEmail, name: userName }],
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #4CAF50; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Deposit Confirmed! ✅</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333;">Hello ${userName}!</h2>
            <p style="color: #666; font-size: 16px;">
              Great news! Your deposit has been successfully processed and added to your ABOKI account.
            </p>
            <div style="background: white; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #4CAF50;">
              <h3 style="color: #4CAF50; margin-top: 0;">Transaction Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Amount:</td>
                  <td style="padding: 8px 0; color: #333; font-size: 18px; font-weight: bold;">${formattedAmount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Transaction ID:</td>
                  <td style="padding: 8px 0; color: #333;">${transactionId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Payment Method:</td>
                  <td style="padding: 8px 0; color: #333;">${paymentMethod}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Date:</td>
                  <td style="padding: 8px 0; color: #333;">${new Date().toLocaleDateString('en-NG')}</td>
                </tr>
              </table>
            </div>
            <p style="color: #666;">
              Your funds are now available in your account and ready for use!
            </p>
            <p style="color: #666;">
              Thank you for choosing ABOKI!
            </p>
          </div>
        </div>
      `,
      textContent: `Deposit Confirmed! Hello ${userName}, Your deposit of ${formattedAmount} has been successfully processed. Transaction ID: ${transactionId}. Payment Method: ${paymentMethod}. Date: ${new Date().toLocaleDateString('en-NG')}. Your funds are now available! Thank you for choosing ABOKI!`
    };

    return await this.sendEmail(emailData);
  }

  /**
   * Send transaction completion email
   */
  async sendTransactionComplete(
    userEmail: string, 
    userName: string, 
    transactionType: string, 
    amount: number, 
    recipient: string | null, 
    transactionId: string
  ): Promise<EmailResult> {
    const formattedAmount = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount);

    const emailData: EmailData = {
      subject: `${transactionType} Completed - ABOKI ✅`,
      recipients: [{ email: userEmail, name: userName }],
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #2196F3; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Transaction Completed! ✅</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333;">Hello ${userName}!</h2>
            <p style="color: #666; font-size: 16px;">
              Your ${transactionType.toLowerCase()} has been completed successfully.
            </p>
            <div style="background: white; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2196F3;">
              <h3 style="color: #2196F3; margin-top: 0;">Transaction Summary</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Type:</td>
                  <td style="padding: 8px 0; color: #333;">${transactionType}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Amount:</td>
                  <td style="padding: 8px 0; color: #333; font-size: 18px; font-weight: bold;">${formattedAmount}</td>
                </tr>
                ${recipient ? `<tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Recipient:</td>
                  <td style="padding: 8px 0; color: #333;">${recipient}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Transaction ID:</td>
                  <td style="padding: 8px 0; color: #333;">${transactionId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Status:</td>
                  <td style="padding: 8px 0; color: #4CAF50; font-weight: bold;">Completed</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Date:</td>
                  <td style="padding: 8px 0; color: #333;">${new Date().toLocaleString('en-NG')}</td>
                </tr>
              </table>
            </div>
            <p style="color: #666;">
              If you have any questions about this transaction, please don't hesitate to contact our support team.
            </p>
            <p style="color: #666;">
              Thank you for using ABOKI!
            </p>
          </div>
        </div>
      `,
      textContent: `Transaction Completed! Hello ${userName}, Your ${transactionType.toLowerCase()} of ${formattedAmount} has been completed successfully. ${recipient ? `Recipient: ${recipient}. ` : ''}Transaction ID: ${transactionId}. Status: Completed. Date: ${new Date().toLocaleString('en-NG')}. Thank you for using ABOKI!`
    };

    return await this.sendEmail(emailData);
  }

  /**
   * Send monthly greeting
   */
  async sendMonthlyGreeting(userEmail: string, userName: string): Promise<EmailResult> {
    const currentDate = new Date();
    const month = currentDate.toLocaleString('default', { month: 'long' });
    const year = currentDate.getFullYear();

    const monthlyMessages = [
      `Welcome to ${month}! Let's make this month financially successful! 💰`,
      `${month} is here! Time to achieve your financial goals! 🎯`,
      `Happy new month! May ${month} bring you prosperity and growth! 🌱`,
      `${month} ${year} - Another month, another opportunity to excel! ⭐`,
      `Cheers to ${month}! Let's make every day count towards your financial freedom! 🎉`
    ];

    const randomMessage = monthlyMessages[Math.floor(Math.random() * monthlyMessages.length)];

    const emailData: EmailData = {
      subject: `Happy New Month - ${month} ${year}! 🎉`,
      recipients: [{ email: userEmail, name: userName }],
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #ff6b6b 0%, #feca57 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Happy New Month! 🎉</h1>
            <h2 style="color: white; margin: 10px 0 0 0;">${month} ${year}</h2>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333;">Hello ${userName}!</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              ${randomMessage}
            </p>
            <div style="background: white; padding: 25px; border-radius: 8px; margin: 25px 0;">
              <h3 style="color: #ff6b6b;">This Month's Focus:</h3>
              <ul style="color: #666; line-height: 1.8;">
                <li>Review your financial goals</li>
                <li>Track your spending habits</li>
                <li>Save more with ABOKI</li>
                <li>Explore new investment opportunities</li>
              </ul>
            </div>
            <p style="color: #666;">
              We're here to support you every step of the way. Let's make ${month} amazing together!
            </p>
            <p style="color: #666;">
              Best wishes,<br>
              <strong>The ABOKI Team</strong>
            </p>
          </div>
        </div>
      `,
      textContent: `Happy New Month! Hello ${userName}, ${randomMessage} This month, focus on reviewing your financial goals, tracking spending habits, saving more with ABOKI, and exploring new investment opportunities. We're here to support you every step of the way. Let's make ${month} amazing together! Best wishes, The ABOKI Team`
    };

    return await this.sendEmail(emailData);
  }

  /**
   * Send Monday motivation email
   */
  async sendMondayMotivation(userEmail: string, userName: string): Promise<EmailResult> {
    const motivationalMessages = [
      {
        title: "Start Strong! 💪",
        message: "Monday is your canvas - paint it with determination and success!"
      },
      {
        title: "New Week, New Wins! 🏆",
        message: "Every Monday is a fresh start. Make this week count towards your financial goals!"
      },
      {
        title: "Monday Motivation! ⚡",
        message: "Success starts with a positive Monday mindset. You've got this!"
      },
      {
        title: "Rise and Shine! 🌅",
        message: "Turn your Monday blues into Monday opportunities. Let's achieve greatness!"
      },
      {
        title: "Monday Magic! ✨",
        message: "The week ahead is full of possibilities. Start strong and finish stronger!"
      }
    ];

    const randomMotivation = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];

    const emailData: EmailData = {
      subject: `${randomMotivation.title} - ABOKI`,
      recipients: [{ email: userEmail, name: userName }],
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">${randomMotivation.title}</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333;">Hello ${userName}!</h2>
            <div style="background: white; padding: 25px; border-radius: 8px; margin: 25px 0; text-align: center; border-left: 4px solid #667eea;">
              <h3 style="color: #667eea; font-size: 20px; margin-bottom: 15px;">💡 Monday Inspiration</h3>
              <p style="color: #333; font-size: 18px; font-style: italic; line-height: 1.6;">
                "${randomMotivation.message}"
              </p>
            </div>
            <p style="color: #666; font-size: 16px;">
              Start your week strong with ABOKI by your side. Whether it's saving, investing, or managing your finances, 
              we're here to help you achieve your goals!
            </p>
            <div style="background: #667eea; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <h4 style="margin: 0 0 10px 0;">This Week's Challenge:</h4>
              <p style="margin: 0;">Set one financial goal and take the first step towards achieving it!</p>
            </div>
            <p style="color: #666;">
              Have a productive and successful week ahead!
            </p>
            <p style="color: #666;">
              Cheers to your success,<br>
              <strong>The ABOKI Team</strong>
            </p>
          </div>
        </div>
      `,
      textContent: `${randomMotivation.title} Hello ${userName}, "${randomMotivation.message}" Start your week strong with ABOKI by your side. Whether it's saving, investing, or managing your finances, we're here to help you achieve your goals! This Week's Challenge: Set one financial goal and take the first step towards achieving it! Have a productive and successful week ahead! Cheers to your success, The ABOKI Team`
    };

    return await this.sendEmail(emailData);
  }

  /**
   * Send re-engagement email for inactive users
   */
  async sendReEngagementEmail(userEmail: string, userName: string): Promise<EmailResult> {
    const emailData: EmailData = {
      subject: "We Miss You at ABOKI! Come Back! 💙",
      recipients: [{ email: userEmail, name: userName }],
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">We Miss You! 💙</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333;">Hello ${userName}!</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              We noticed you haven't been active on ABOKI lately, and we wanted to reach out. 
              Your financial journey is important to us, and we're here to help you get back on track!
            </p>
            
            <div style="background: white; padding: 25px; border-radius: 8px; margin: 25px 0;">
              <h3 style="color: #667eea;">What's New at ABOKI:</h3>
              <ul style="color: #666; line-height: 1.8;">
                <li>Enhanced security features</li>
                <li>Improved user interface</li>
                <li>New investment opportunities</li>
                <li>Better customer support</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 25px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" 
                 style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; 
                        border-radius: 5px; font-weight: bold; display: inline-block; font-size: 16px;">
                Welcome Back to ABOKI
              </a>
            </div>
            
            <p style="color: #666;">
              Your financial goals are waiting for you. Let's continue building your future together!
            </p>
            
            <p style="color: #666;">
              We're here for you,<br>
              <strong>The ABOKI Team</strong>
            </p>
          </div>
        </div>
      `,
      textContent: `We Miss You! Hello ${userName}, We noticed you haven't been active on ABOKI lately, and we wanted to reach out. Your financial journey is important to us, and we're here to help you get back on track! What's New: Enhanced security, improved interface, new investments, better support. Your financial goals are waiting. Let's continue building your future together! The ABOKI Team`
    };

    return await this.sendEmail(emailData);
  }

  /**
   * Send bulk emails with rate limiting
   */
  async sendBulkEmails(emailType: string, userList: User[], delayMs: number = 200): Promise<BulkEmailResult> {
    console.log(`Starting bulk ${emailType} email send to ${userList.length} users...`);
    const results = [];
    
    for (let i = 0; i < userList.length; i++) {
      const user = userList[i];
      let result: EmailResult;
      
      try {
        switch (emailType) {
          case 'monthly':
            result = await this.sendMonthlyGreeting(user.email, user.name);
            break;
            
          case 'monday':
            result = await this.sendMondayMotivation(user.email, user.name);
            break;
            
          case 'welcome':
            result = await this.sendWelcomeEmail(user.email, user.name);
            break;
            
          case 'reengagement':
            result = await this.sendReEngagementEmail(user.email, user.name);
            break;
            
          default:
            result = { success: false, error: 'Unknown email type', recipient: user.email };
        }
        
        results.push({
          user: user.email,
          name: user.name,
          index: i + 1,
          total: userList.length,
          success: result.success,
          error: result.error,
          messageId: result.messageId
        });
        
        // Log progress
        console.log(`Sent ${emailType} email ${i + 1}/${userList.length} to ${user.email}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
        
      } catch (error: any) {
        results.push({
          user: user.email,
          name: user.name,
          index: i + 1,
          total: userList.length,
          success: false,
          error: error.message
        });
        console.error(`Failed to send ${emailType} email to ${user.email}:`, error.message);
      }
      
      // Add delay to avoid rate limiting (Brevo allows 300 emails/day on free plan)
      if (i < userList.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    console.log(`Bulk ${emailType} email complete: ${successCount} sent, ${failCount} failed`);
    
    return {
      summary: {
        total: userList.length,
        sent: successCount,
        failed: failCount,
        emailType
      },
      results
    };
  }

  /**
   * Send using Brevo template (for advanced templates created in dashboard)
   */
  async sendTemplateEmail(templateId: number, userEmail: string, userName: string, templateParams: Record<string, any> = {}): Promise<EmailResult> {
    const emailData: EmailData = {
      templateId,
      recipients: [{ email: userEmail, name: userName }],
      params: {
        name: userName,
        firstName: userName.split(' ')[0],
        ...templateParams
      },
      subject: '' // Subject will be from template
    };

    return await this.sendEmail(emailData);
  }

  /**
   * Send custom notification email
   */
  async sendNotificationEmail(
    userEmail: string, 
    userName: string, 
    subject: string, 
    message: string, 
    type: 'info' | 'warning' | 'success' | 'error' = 'info'
  ): Promise<EmailResult> {
    const colors = {
      info: '#2196F3',
      warning: '#FF9800',
      success: '#4CAF50',
      error: '#F44336'
    };

    const icons = {
      info: 'ℹ️',
      warning: '⚠️',
      success: '✅',
      error: '❌'
    };

    const emailData: EmailData = {
      subject: `${icons[type]} ${subject} - ABOKI`,
      recipients: [{ email: userEmail, name: userName }],
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${colors[type]}; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">${icons[type]} ${subject}</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333;">Hello ${userName}!</h2>
            <div style="background: white; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid ${colors[type]};">
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0;">
                ${message}
              </p>
            </div>
            <p style="color: #666;">
              If you have any questions, please don't hesitate to contact our support team.
            </p>
            <p style="color: #666;">
              Best regards,<br>
              <strong>The ABOKI Team</strong>
            </p>
          </div>
        </div>
      `,
      textContent: `${subject}\n\nHello ${userName},\n\n${message}\n\nIf you have any questions, please contact our support team.\n\nBest regards,\nThe ABOKI Team`
    };

    return await this.sendEmail(emailData);
  }

  /**
   * Send account verification email
   */
  async sendAccountVerificationEmail(userEmail: string, userName: string, verificationToken: string): Promise<EmailResult> {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-account?token=${verificationToken}`;
    
    const emailData: EmailData = {
      subject: "Verify Your ABOKI Account 📧",
      recipients: [{ email: userEmail, name: userName }],
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #667eea; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Verify Your Account 📧</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333;">Hello ${userName}!</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Thank you for creating your ABOKI account! To complete your registration and secure your account, 
              please verify your email address by clicking the button below.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; 
                        border-radius: 5px; font-weight: bold; display: inline-block; font-size: 16px;">
                Verify My Account
              </a>
            </div>
            
            <div style="background: #e3f2fd; border: 1px solid #bbdefb; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="color: #1565c0; margin: 0; font-size: 14px;">
                <strong>📋 Note:</strong> This verification link will expire in 24 hours. 
                If you didn't create this account, please ignore this email.
              </p>
            </div>
            
            <p style="color: #666; font-size: 14px; line-height: 1.5;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${verificationUrl}" style="color: #667eea; word-break: break-all;">${verificationUrl}</a>
            </p>
            
            <p style="color: #666;">
              Welcome to the ABOKI family!<br>
              <strong>The ABOKI Team</strong>
            </p>
          </div>
        </div>
      `,
      textContent: `Verify Your Account\n\nHello ${userName},\n\nThank you for creating your ABOKI account! To complete your registration, please verify your email address by clicking this link:\n\n${verificationUrl}\n\nThis link will expire in 24 hours. If you didn't create this account, please ignore this email.\n\nWelcome to ABOKI!\nThe ABOKI Team`
    };

    return await this.sendEmail(emailData);
  }

  /**
   * Send security alert email
   */
  async sendSecurityAlertEmail(
    userEmail: string, 
    userName: string, 
    alertType: string, 
    details: string, 
    ipAddress?: string, 
    location?: string
  ): Promise<EmailResult> {
    const emailData: EmailData = {
      subject: `🚨 Security Alert - ${alertType} - ABOKI`,
      recipients: [{ email: userEmail, name: userName }],
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #F44336; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">🚨 Security Alert</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333;">Hello ${userName}!</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              We detected ${alertType.toLowerCase()} on your ABOKI account and wanted to alert you immediately.
            </p>
            
            <div style="background: #ffebee; border: 1px solid #f44336; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #f44336; margin-top: 0;">Alert Details:</h3>
              <p style="color: #333; margin: 10px 0;"><strong>Type:</strong> ${alertType}</p>
              <p style="color: #333; margin: 10px 0;"><strong>Details:</strong> ${details}</p>
              ${ipAddress ? `<p style="color: #333; margin: 10px 0;"><strong>IP Address:</strong> ${ipAddress}</p>` : ''}
              ${location ? `<p style="color: #333; margin: 10px 0;"><strong>Location:</strong> ${location}</p>` : ''}
              <p style="color: #333; margin: 10px 0;"><strong>Time:</strong> ${new Date().toLocaleString('en-NG')}</p>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="color: #856404; margin: 0; font-size: 14px;">
                <strong>🔐 What to do:</strong> If this was not you, please change your password immediately 
                and contact our support team. If this was you, you can safely ignore this alert.
              </p>
            </div>
            
            <div style="text-align: center; margin: 25px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/change-password" 
                 style="background: #F44336; color: white; padding: 12px 25px; text-decoration: none; 
                        border-radius: 5px; font-weight: bold; display: inline-block; margin-right: 10px;">
                Change Password
              </a>
              <a href="mailto:support@aboki.com" 
                 style="background: #666; color: white; padding: 12px 25px; text-decoration: none; 
                        border-radius: 5px; font-weight: bold; display: inline-block;">
                Contact Support
              </a>
            </div>
            
            <p style="color: #666;">
              Your security is our priority,<br>
              <strong>The ABOKI Security Team</strong>
            </p>
          </div>
        </div>
      `,
      textContent: `Security Alert - ${alertType}\n\nHello ${userName},\n\nWe detected ${alertType.toLowerCase()} on your ABOKI account.\n\nDetails: ${details}\n${ipAddress ? `IP: ${ipAddress}\n` : ''}${location ? `Location: ${location}\n` : ''}Time: ${new Date().toLocaleString('en-NG')}\n\nIf this was not you, please change your password immediately and contact support. If this was you, you can ignore this alert.\n\nYour security is our priority,\nThe ABOKI Security Team`
    };

    return await this.sendEmail(emailData);
  }

  /**
   * Validate email configuration
   */
  validateConfig(): boolean {
    const requiredVars = ['BREVO_API_KEY'];
    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    return true;
  }

  /**
   * Get email service statistics
   */
  getServiceStats(): {
    configured: boolean;
    apiKey: boolean;
    sender: { name: string; email: string };
    frontendUrl: string;
  } {
    return {
      configured: !!process.env.BREVO_API_KEY,
      apiKey: !!process.env.BREVO_API_KEY,
      sender: this.defaultSender,
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
    };
  }
}