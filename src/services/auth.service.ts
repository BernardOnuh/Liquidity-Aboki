// src/services/auth.service.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { EmailManager } from './email-manager.service';

const prisma = new PrismaClient();

interface RegisterData {
  email: string;
  password: string;
  name: string;
}

interface ResetTokenData {
  email: string;
  name: string;
  resetToken: string;
}

export class AuthService {
  private emailManager: EmailManager;

  constructor() {
    this.emailManager = new EmailManager();
  }

  async login(email: string, password: string) {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        isActive: true
      }
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Generate JWT token
    const token = this.generateToken(user.id, user.email);

    // Return user data without password
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token
    };
  }

  async register(data: RegisterData) {
    const { email, password, name } = data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Validate password strength
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name
      },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true
      }
    });

    // Generate JWT token
    const token = this.generateToken(user.id, user.email);

    return {
      user,
      token
    };
  }

  /**
   * Generate password reset token and save to database
   */
  async generatePasswordResetToken(email: string): Promise<ResetTokenData | null> {
    try {
      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true
        }
      });
      
      if (!user) {
        // Return null but don't reveal if email exists
        return null;
      }

      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      // Generate secure random token
      const resetToken = crypto.randomBytes(32).toString('hex');
      
      // Hash the token before storing (for security)
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      
      // Set expiration time (1 hour from now)
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Delete any existing reset tokens for this user
      await prisma.passwordReset.deleteMany({
        where: { userId: user.id }
      });

      // Save reset token to database
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          token: hashedToken,
          expiresAt
        }
      });

      return {
        email: user.email,
        name: user.name,
        resetToken // Return unhashed token for email link
      };
    } catch (error: any) {
      console.error('Error generating password reset token:', error);
      throw new Error('Failed to generate password reset token');
    }
  }

  /**
   * Reset password using the token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      // Validate new password
      if (!newPassword || newPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      // Hash the provided token to match database
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      // Find user by reset token
      const resetRecord = await prisma.passwordReset.findFirst({
        where: { token: hashedToken },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              isActive: true
            }
          }
        }
      });

      if (!resetRecord) {
        throw new Error('Invalid or expired reset token');
      }

      // Check if token has expired
      if (new Date() > resetRecord.expiresAt) {
        // Clean up expired token
        await prisma.passwordReset.delete({
          where: { id: resetRecord.id }
        });
        throw new Error('Reset token has expired. Please request a new password reset.');
      }

      // Check if user account is active
      if (!resetRecord.user.isActive) {
        throw new Error('Account is deactivated');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update user password and delete reset token in a transaction
      await prisma.$transaction([
        prisma.user.update({
          where: { id: resetRecord.userId },
          data: { password: hashedPassword }
        }),
        prisma.passwordReset.delete({
          where: { id: resetRecord.id }
        })
      ]);

      // Send password reset confirmation email
      try {
        await this.emailManager.sendPasswordResetConfirmation(
          resetRecord.user.email, 
          resetRecord.user.name
        );
        console.log(`Password reset confirmation email sent to ${resetRecord.user.email}`);
      } catch (emailError: any) {
        console.error('Failed to send password reset confirmation email:', emailError);
        // Don't fail the password reset if email fails
      }

      return {
        success: true,
        message: 'Password reset successfully'
      };
    } catch (error: any) {
      console.error('Error resetting password:', error);
      throw error;
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    // Get user with current password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
        isActive: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedNewPassword
      }
    });

    return { success: true };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, updateData: { name?: string; email?: string }) {
    const { name, email } = updateData;

    // Check if user exists and is active
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true }
    });

    if (!existingUser) {
      throw new Error('User not found');
    }

    if (!existingUser.isActive) {
      throw new Error('Account is deactivated');
    }

    // If email is being updated, check if it's already taken
    if (email) {
      const emailTaken = await prisma.user.findUnique({
        where: { 
          email: email.toLowerCase(),
          NOT: { id: userId } // Exclude current user
        }
      });

      if (emailTaken) {
        throw new Error('Email is already taken');
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(email && { email: email.toLowerCase() })
      },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true
      }
    });

    return user;
  }

  async deactivateAccount(userId: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false
      },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true
      }
    });

    return user;
  }

  async reactivateAccount(userId: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: true
      },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true
      }
    });

    return user;
  }

  // Admin function to get all users
  async getAllUsers(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.user.count()
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Function to verify if user exists
  async userExists(email: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true }
    });

    return !!user;
  }

  // Function to get user by ID
  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true
      }
    });

    return user;
  }

  /**
   * Clean up expired password reset tokens (can be run as a scheduled job)
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const result = await prisma.passwordReset.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });

      console.log(`Cleaned up ${result.count} expired password reset tokens`);
      return result.count;
    } catch (error: any) {
      console.error('Error cleaning up expired tokens:', error);
      throw error;
    }
  }

  /**
   * Get password reset statistics (for admin dashboard)
   */
  async getPasswordResetStats() {
    const [total, expired, active] = await Promise.all([
      prisma.passwordReset.count(),
      prisma.passwordReset.count({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      }),
      prisma.passwordReset.count({
        where: {
          expiresAt: {
            gte: new Date()
          }
        }
      })
    ]);

    return {
      total,
      expired,
      active
    };
  }

// Update this method in your AuthService
private generateToken(userId: string, email: string): string {
  return jwt.sign(
    { 
      id: userId,      // Use "id" for consistency with req.user.id
      userId: userId,  // Keep "userId" for backward compatibility
      email 
    },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );
}

// Also update the verifyToken method
verifyToken(token: string) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
    
    // Ensure consistent user object structure
    return {
      id: decoded.id || decoded.userId,
      userId: decoded.userId || decoded.id,
      email: decoded.email
    };
  } catch (error) {
    throw new Error('Invalid token');
  }
}
  /**
   * Get users for email campaigns
   */
  async getActiveUsersForEmail(): Promise<Array<{ email: string; name: string }>> {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        // Add any other conditions like email preferences
      },
      select: {
        email: true,
        name: true
      }
    });

    return users;
  }

  /**
   * Get new users (for welcome campaigns)
   */
  async getNewUsers(days: number = 7): Promise<Array<{ email: string; name: string }>> {
    const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        createdAt: {
          gte: cutoffDate
        }
      },
      select: {
        email: true,
        name: true
      }
    });

    return users;
  }

  /**
   * Get recently active users
   */
  async getRecentlyActiveUsers(days: number = 30): Promise<Array<{ email: string; name: string }>> {
    const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        lastLoginAt: {
          gte: cutoffDate
        }
      },
      select: {
        email: true,
        name: true
      }
    });

    return users;
  }

  /**
   * Get inactive users (for re-engagement campaigns)
   */
  async getInactiveUsers(days: number = 90): Promise<Array<{ email: string; name: string }>> {
    const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          {
            lastLoginAt: {
              lt: cutoffDate
            }
          },
          {
            lastLoginAt: null,
            createdAt: {
              lt: cutoffDate
            }
          }
        ]
      },
      select: {
        email: true,
        name: true
      }
    });

    return users;
  }
}