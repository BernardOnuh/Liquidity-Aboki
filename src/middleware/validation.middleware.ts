// src/middleware/validation.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { validationResult, FieldValidationError } from 'express-validator';

export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => {
      // Handle different types of validation errors
      if (error.type === 'field') {
        const fieldError = error as FieldValidationError;
        return {
          field: fieldError.path,
          message: fieldError.msg,
          value: fieldError.value
        };
      }
      
      return {
        field: 'unknown',
        message: error.msg,
        value: undefined
      };
    });

    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors
    });
    return;
  }
  
  next();
};