// src/controllers/auth.controller.ts
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { EmailManager } from '../services/email-manager.service';

export class AuthController {
  private authService: AuthService;
  private emailManager: EmailManager;

  constructor() {
    this.authService = new AuthService();
    this.emailManager = new EmailManager();
  }

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      
      const result = await this.authService.login(email, password);

      res.json({
        success: true,
        data: result,
        message: 'Login successful'
      });
    } catch (error) {
      next(error);
    }
  };

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, name } = req.body;
      
      const result = await this.authService.register({ email, password, name });

      // Send welcome email after successful registration
      try {
        await this.emailManager.handleUserRegistration(email, name);
        console.log(`Welcome email sent to ${email}`);
      } catch (emailError: any) {
        console.error('Failed to send welcome email:', emailError.message);
        // Don't fail registration if email fails
      }

      res.status(201).json({
        success: true,
        data: result,
        message: 'User registered successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  // NEW: Forgot Password - Send reset email
  forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      // Generate password reset token and save to database
      const resetData = await this.authService.generatePasswordResetToken(email);

      if (!resetData) {
        // Don't reveal if email exists or not for security
        return res.json({
          success: true,
          message: 'If the email exists, a password reset link has been sent'
        });
      }

      // Send password reset email
      try {
        await this.emailManager.sendPasswordResetEmail(
          resetData.email,
          resetData.name,
          resetData.resetToken
        );
        console.log(`Password reset email sent to ${resetData.email}`);
      } catch (emailError: any) {
        console.error('Failed to send password reset email:', emailError.message);
        return res.status(500).json({
          success: false,
          message: 'Failed to send password reset email. Please try again.'
        });
      }

      return res.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      return next(error);
    }
  };

  // NEW: Reset Password - Using the token from email
  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Token and new password are required'
        });
      }

      // Validate token and reset password
      await this.authService.resetPassword(token, newPassword);

      return res.json({
        success: true,
        message: 'Password reset successfully. You can now login with your new password.'
      });
    } catch (error: any) {
      console.error('Reset password error:', error);
      
      // Handle specific error cases
      if (error.message.includes('expired')) {
        return res.status(400).json({
          success: false,
          message: 'Reset token has expired. Please request a new password reset.'
        });
      }
      
      if (error.message.includes('Invalid')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reset token. Please request a new password reset.'
        });
      }

      return next(error);
    }
  };

  getProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const profile = await this.authService.getProfile(userId!);

      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const updateData = req.body;
      
      const updatedProfile = await this.authService.updateProfile(userId!, updateData);

      res.json({
        success: true,
        data: updatedProfile,
        message: 'Profile updated successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user?.id;
      
      await this.authService.changePassword(userId!, currentPassword, newPassword);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (_: Request, res: Response, next: NextFunction) => {
    try {
      // In a real app, you might want to invalidate the token
      // For now, we'll just return success
      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      next(error);
    }
  };

  // BONUS: Email testing endpoints for development
  testWelcomeEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, name } = req.body;

      if (!email || !name) {
        return res.status(400).json({
          success: false,
          message: 'Email and name are required'
        });
      }

      const result = await this.emailManager.handleUserRegistration(email, name);

      return res.json({
        success: true,
        data: result,
        message: 'Test welcome email sent'
      });
    } catch (error) {
      return next(error);
    }
  };

  // Get email statistics
  getEmailStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const stats = this.emailManager.getEmailStats(hours);
      const recentLogs = this.emailManager.getRecentEmailLogs(20);

      res.json({
        success: true,
        data: {
          stats,
          recentLogs
        }
      });
    } catch (error) {
      next(error);
    }
  };
}