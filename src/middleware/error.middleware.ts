// src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export const errorHandler = (
  error: CustomError,
  req: Request,
  res: Response
) => {
  console.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params,
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });

  // Default error response
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal server error';
  let code = error.code || 'INTERNAL_ERROR';
  let details = error.details || null;

  // Handle Prisma database errors
  if (error instanceof PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        // Unique constraint violation
        statusCode = 409;
        message = 'Resource already exists';
        code = 'DUPLICATE_RESOURCE';
        details = {
          field: error.meta?.target,
          constraint: 'unique_violation'
        };
        break;
      
      case 'P2025':
        // Record not found
        statusCode = 404;
        message = 'Resource not found';
        code = 'RESOURCE_NOT_FOUND';
        break;
      
      case 'P2003':
        // Foreign key constraint violation
        statusCode = 400;
        message = 'Invalid reference to related resource';
        code = 'INVALID_REFERENCE';
        break;
      
      case 'P2014':
        // Required relation violation
        statusCode = 400;
        message = 'Required relationship missing';
        code = 'MISSING_RELATION';
        break;
      
      default:
        statusCode = 500;
        message = 'Database operation failed';
        code = 'DATABASE_ERROR';
        break;
    }
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
    code = 'INVALID_TOKEN';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
    code = 'TOKEN_EXPIRED';
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Invalid input data';
    code = 'VALIDATION_ERROR';
    details = error.details;
  }

  // Handle blockchain/network errors
  if (error.message.includes('insufficient funds')) {
    statusCode = 400;
    message = 'Insufficient funds for transaction';
    code = 'INSUFFICIENT_FUNDS';
  } else if (error.message.includes('network')) {
    statusCode = 503;
    message = 'Blockchain network temporarily unavailable';
    code = 'NETWORK_ERROR';
  } else if (error.message.includes('gas')) {
    statusCode = 400;
    message = 'Transaction gas estimation failed';
    code = 'GAS_ESTIMATION_ERROR';
  }

  // Handle rate limiting errors
  if (error.message.includes('Too many requests')) {
    statusCode = 429;
    message = 'Too many requests, please try again later';
    code = 'RATE_LIMIT_EXCEEDED';
  }

  // Handle file/upload errors
  if (error.message.includes('file too large')) {
    statusCode = 413;
    message = 'File size exceeds maximum allowed limit';
    code = 'FILE_TOO_LARGE';
  }

  // Handle wallet/encryption errors
  if (error.message.includes('decrypt')) {
    statusCode = 500;
    message = 'Failed to decrypt wallet data';
    code = 'DECRYPTION_ERROR';
  } else if (error.message.includes('Invalid private key')) {
    statusCode = 400;
    message = 'Invalid wallet private key format';
    code = 'INVALID_PRIVATE_KEY';
  }

  // Handle external API errors
  if (error.message.includes('API')) {
    statusCode = 502;
    message = 'External service temporarily unavailable';
    code = 'EXTERNAL_API_ERROR';
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'An unexpected error occurred';
    details = null;
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    code,
    ...(details && { details }),
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      originalError: error.message
    }),
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  });
};

// Async error wrapper for route handlers
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Custom error classes
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code: string = 'APP_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, 'CONFLICT_ERROR');
    this.name = 'ConflictError';
  }
}

export class BlockchainError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 503, 'BLOCKCHAIN_ERROR', details);
    this.name = 'BlockchainError';
  }
}