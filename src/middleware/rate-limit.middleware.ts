// src/middleware/rate-limit.middleware.ts
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

// Initialize Redis client
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// General rate limiting for all onramp routes
export const rateLimitMiddleware = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) as any,
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for sensitive operations
export const strictRateLimitMiddleware = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) as any,
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 requests per hour
  message: {
    success: false,
    message: 'Too many sensitive operation requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Per-user rate limiting for withdrawals
export const withdrawalRateLimitMiddleware = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) as any,
  }),
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5, // Limit each user to 5 withdrawals per day
  keyGenerator: (req: Request) => {
    return `withdrawal_${req.user?.id || req.ip}`;
  },
  message: {
    success: false,
    message: 'Daily withdrawal limit exceeded. Please try again tomorrow.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Per-user rate limiting for onramp requests
export const onrampRateLimitMiddleware = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) as any,
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each user to 20 onramp requests per hour
  keyGenerator: (req: Request) => {
    return `onramp_${req.user?.id || req.ip}`;
  },
  message: {
    success: false,
    message: 'Hourly onramp request limit exceeded. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Custom middleware for dynamic rate limiting based on user type
export const dynamicRateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // For now, treat all users as regular users
  const isPremiumUser = false; // Remove req.user?.isPremium check
  
  const limits = isPremiumUser 
    ? { windowMs: 15 * 60 * 1000, max: 200 } // Premium: 200 requests per 15 minutes
    : { windowMs: 15 * 60 * 1000, max: 100 }; // Regular: 100 requests per 15 minutes

  const dynamicRateLimit = rateLimit({
    store: new RedisStore({
      sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) as any,
    }),
    windowMs: limits.windowMs,
    max: limits.max,
    keyGenerator: (req: Request) => {
      return `dynamic_${req.user?.id || req.ip}`;
    },
    message: {
      success: false,
      message: `Rate limit exceeded. ${isPremiumUser ? 'Premium' : 'Regular'} user limit: ${limits.max} requests per ${limits.windowMs / 60000} minutes.`
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  return dynamicRateLimit(req, res, next);
};