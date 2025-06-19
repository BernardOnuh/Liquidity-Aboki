// src/routes/auth.routes.ts
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { body } from 'express-validator';
import { validateRequest } from '../middleware/validation.middleware';

const router = Router();
const authController = new AuthController();

// Handle trailing slashes middleware
router.use((req, res, next) => {
  if (req.path.endsWith('/') && req.path.length > 1) {
    req.url = req.url.slice(0, -1);
  }
  next();
});

// Validation schemas
const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('name')
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long')
];

// Password reset validations
const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
];

const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    })
];

const updateProfileValidation = [
  body('name')
    .optional()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Valid email is required')
];

// =========================================
// PUBLIC ROUTES (NO AUTHENTICATION REQUIRED)
// =========================================

// Authentication routes
router.post('/login', loginValidation, validateRequest, authController.login);
router.post('/register', registerValidation, validateRequest, authController.register);

// Password reset routes (MUST BE BEFORE authMiddleware)
router.post('/forgot-password', forgotPasswordValidation, validateRequest, authController.forgotPassword);
router.post('/reset-password', resetPasswordValidation, validateRequest, authController.resetPassword);

// Development/testing routes (if needed)
if (process.env.NODE_ENV === 'development') {
  router.post('/test/welcome-email', authController.testWelcomeEmail);
  router.get('/email-stats', authController.getEmailStats);
}

// Health check
router.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    service: 'auth',
    timestamp: new Date().toISOString()
  });
});

// =========================================
// PROTECTED ROUTES (AUTHENTICATION REQUIRED)
// =========================================

// Apply auth middleware to all routes below this point
router.use(authMiddleware);

// Protected routes
router.get('/profile', authController.getProfile);
router.put('/profile', updateProfileValidation, validateRequest, authController.updateProfile);
router.post('/change-password', changePasswordValidation, validateRequest, authController.changePassword);
router.post('/logout', authController.logout);

export default router;