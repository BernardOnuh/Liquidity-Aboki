// src/routes/auth.routes.ts - FINAL FIX
import { Router, Request, Response, NextFunction } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { body } from 'express-validator';
import { validateRequest } from '../middleware/validation.middleware';

const router = Router();
const authController = new AuthController();

// IMPORTANT: Clean up URLs first - remove trailing spaces and normalize
router.use((req, _, next) => {
  // Remove trailing spaces and slashes
  let cleanPath = req.path.trim();
  if (cleanPath.endsWith('/') && cleanPath.length > 1) {
    cleanPath = cleanPath.slice(0, -1);
  }
  
  // Update the request path
  req.url = req.url.replace(req.path, cleanPath);
  
  console.log('🧹 [ROUTE CLEANUP] Original:', req.originalUrl);
  console.log('🧹 [ROUTE CLEANUP] Cleaned:', req.url);
  
  next();
});

// Validation schemas
const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
];

const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('name').isLength({ min: 2 }).trim().withMessage('Name must be at least 2 characters long')
];

const forgotPasswordValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
];

const resetPasswordValidation = [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
];

const updateProfileValidation = [
  body('name').optional().isLength({ min: 2 }).trim().withMessage('Name must be at least 2 characters long'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required')
];

// =========================================
// PUBLIC ROUTES - NO AUTH REQUIRED
// =========================================

console.log('📝 [AUTH ROUTES] Setting up public routes...');

// Health check
router.get('/health', (req, res) => {
  console.log('✅ [HEALTH] Route hit:', req.path);
  res.json({
    status: 'ok',
    service: 'auth',
    timestamp: new Date().toISOString()
  });
});

// Authentication routes
router.post('/login', (req: Request, _res: Response, next: NextFunction) => {
  console.log('✅ [LOGIN] Route hit:', req.path);
  next();
}, loginValidation, validateRequest, authController.login);

router.post('/register', (req: Request, _res: Response, next: NextFunction) => {
  console.log('✅ [REGISTER] Route hit:', req.path);
  next();
}, registerValidation, validateRequest, authController.register);

// Password reset routes - THESE MUST BE PUBLIC
router.post('/forgot-password', (req: Request, _res: Response, next: NextFunction) => {
  console.log('✅ [FORGOT-PASSWORD] Route hit:', req.path);
  console.log('✅ [FORGOT-PASSWORD] Body:', req.body);
  next();
}, forgotPasswordValidation, validateRequest, authController.forgotPassword);

router.post('/reset-password', (req: Request, _res: Response, next: NextFunction) => {
  console.log('✅ [RESET-PASSWORD] Route hit:', req.path);
  next();
}, resetPasswordValidation, validateRequest, authController.resetPassword);

// Development/testing routes
if (process.env.NODE_ENV === 'development') {
  router.post('/test/welcome-email', (req, _res, next) => {
    console.log('✅ [TEST-EMAIL] Route hit:', req.path);
    next();
  }, authController.testWelcomeEmail);
  
  router.get('/email-stats', (req, _res, next) => {
    console.log('✅ [EMAIL-STATS] Route hit:', req.path);
    next();
  }, authController.getEmailStats);
}

console.log('📝 [AUTH ROUTES] Public routes setup complete');

// =========================================
// PROTECTED ROUTES - AUTH REQUIRED
// =========================================

console.log('🔒 [AUTH ROUTES] Setting up protected routes...');

// Apply auth middleware to all routes defined AFTER this point
router.use((req, res, next) => {
  console.log('🔒 [PROTECTED ZONE] Applying auth middleware for:', req.path);
  authenticateToken(req, res, next);
});

// All routes below this line require authentication
router.get('/profile', authController.getProfile);
router.put('/profile', updateProfileValidation, validateRequest, authController.updateProfile);
router.post('/change-password', changePasswordValidation, validateRequest, authController.changePassword);
router.post('/logout', authController.logout);

console.log('🔒 [AUTH ROUTES] Protected routes setup complete');

export default router;