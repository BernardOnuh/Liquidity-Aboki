// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        userId: string;
        email: string;
      };
    }
  }
}

// Public routes that don't need authentication
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register', 
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/health',
  '/api/ping'
];

/**
 * Main authentication middleware
 * Verifies JWT tokens and sets req.user
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const path = req.path;
  const method = req.method;
  
  console.log('🔐 [AUTH MIDDLEWARE] Called for:', method, req.originalUrl);
  console.log('🔐 [AUTH MIDDLEWARE] Path:', path);
  
  // Skip authentication for public routes
  if (isPublicRoute(path)) {
    console.log('✅ [AUTH MIDDLEWARE] Public route, skipping auth:', path);
    return next();
  }
  
  // Skip authentication for OPTIONS requests (CORS preflight)
  if (method === 'OPTIONS') {
    console.log('✅ [AUTH MIDDLEWARE] OPTIONS request, skipping auth');
    return next();
  }
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    console.log('❌ [AUTH MIDDLEWARE] No authorization header for:', req.originalUrl);
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required',
      error: 'MISSING_TOKEN'
    });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('❌ [AUTH MIDDLEWARE] JWT_SECRET not configured');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    const decoded = jwt.verify(token, jwtSecret) as any;
    
    // Ensure consistent user object structure
    req.user = {
      id: decoded.id || decoded.userId,
      userId: decoded.userId || decoded.id,
      email: decoded.email
    };
    
    console.log('✅ [AUTH MIDDLEWARE] Token verified for user:', req.user.email);
    next();
  } catch (error: any) {
    console.log('❌ [AUTH MIDDLEWARE] Token verification failed:', error.message);
    
    let message = 'Invalid or expired token';
    let errorCode = 'INVALID_TOKEN';
    
    if (error.name === 'TokenExpiredError') {
      message = 'Token has expired';
      errorCode = 'TOKEN_EXPIRED';
    } else if (error.name === 'JsonWebTokenError') {
      message = 'Invalid token format';
      errorCode = 'MALFORMED_TOKEN';
    }
    
    return res.status(401).json({ 
      success: false, 
      message,
      error: errorCode
    });
  }
};

/**
 * Check if a route is public (doesn't require authentication)
 */
const isPublicRoute = (path: string): boolean => {
  // Clean the path first - remove trailing spaces and slashes
  const cleanPath = path.trim().replace(/\/+$/, '') || '/';
  
  return PUBLIC_ROUTES.some(route => {
    const cleanRoute = route.trim().replace(/\/+$/, '') || '/';
    
    // Handle exact matches
    if (cleanPath === cleanRoute) return true;
    
    // Handle route patterns with trailing slashes
    if (cleanPath === cleanRoute + '/') return true;
    if (cleanRoute === cleanPath + '/') return true;
    
    // Handle routes that start with the public route path
    if (cleanPath.startsWith(cleanRoute + '/')) return true;
    
    return false;
  });
};

/**
 * Optional middleware - only apply auth if token is present
 * Useful for routes that can work with or without authentication
 */
export const optionalAuth = (req: Request, _: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    console.log('ℹ️ [OPTIONAL AUTH] No token provided, continuing without auth');
    return next();
  }
  
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('❌ [OPTIONAL AUTH] JWT_SECRET not configured');
      return next(); // Continue without auth rather than failing
    }

    const decoded = jwt.verify(token, jwtSecret) as any;
    req.user = {
      id: decoded.id || decoded.userId,
      userId: decoded.userId || decoded.id,
      email: decoded.email
    };
    
    console.log('✅ [OPTIONAL AUTH] Token verified for user:', req.user.email);
  } catch (error: any) {
    console.log('⚠️ [OPTIONAL AUTH] Invalid token provided, continuing without auth:', error.message);
    // Don't set req.user, but don't fail the request
  }
  
  next();
};

/**
 * Admin-only middleware
 * Requires authentication and admin role
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  // First check if user is authenticated
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      error: 'UNAUTHENTICATED'
    });
  }
  
  // Add admin check logic here if you have admin roles
  // For now, just pass through - you can add role checking later
  console.log('🔑 [ADMIN MIDDLEWARE] Admin access granted to:', req.user.email);
  return next();
};

/**
 * Rate limiting middleware helper
 * Can be used with express-rate-limit
 */
export const createRateLimitKeyGenerator = () => {
  return (req: Request): string => {
    // Use user ID if authenticated, otherwise use IP
    if (req.user) {
      return `user:${req.user.id}`;
    }
    return `ip:${req.ip}`;
  };
};

/**
 * Middleware to log all requests (optional)
 */
export const requestLogger = (req: Request, _: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  const userInfo = req.user ? `User: ${req.user.email}` : 'Anonymous';
  
  console.log(`📝 [${timestamp}] ${req.method} ${req.originalUrl} - ${userInfo}`);
  next();
};

/**
 * Error handler middleware specifically for auth errors
 */
export const authErrorHandler = (error: any, _: Request, res: Response, next: NextFunction) => {
  if (error.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      error: 'UNAUTHORIZED'
    });
  }
  
  return next(error);
};

// Export the main middleware with alias for backward compatibility
export const authMiddleware = authenticateToken;

// Export all middlewares as a single object for easy importing
export const AuthMiddleware = {
  authenticate: authenticateToken,
  optional: optionalAuth,
  requireAdmin,
  requestLogger,
  authErrorHandler,
  createRateLimitKeyGenerator
};

export default authenticateToken;