// src/middleware/not-found.middleware.ts
import { Request, Response, NextFunction } from 'express';

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  // Log the 404 attempt for monitoring
  console.warn('404 Not Found:', {
    method: req.method,
    url: req.url,
    originalUrl: req.originalUrl,
    path: req.path,
    query: req.query,
    params: req.params,
    headers: {
      'user-agent': req.get('User-Agent'),
      'referer': req.get('Referer'),
      'x-forwarded-for': req.get('X-Forwarded-For'),
      'x-real-ip': req.get('X-Real-IP')
    },
    ip: req.ip,
    timestamp: new Date().toISOString(),
    userId: req.user?.id || 'anonymous'
  });

  // Check if it's an API request
  const isApiRequest = req.path.startsWith('/api/') || 
                       req.get('Content-Type')?.includes('application/json') ||
                       req.get('Accept')?.includes('application/json');

  if (isApiRequest) {
    // Return JSON response for API requests
    return res.status(404).json({
      success: false,
      message: `API endpoint not found: ${req.method} ${req.path}`,
      code: 'ENDPOINT_NOT_FOUND',
      details: {
        method: req.method,
        path: req.path,
        availableEndpoints: getAvailableEndpoints()
      },
      timestamp: new Date().toISOString()
    });
  }

  // For non-API requests (web pages), you could redirect to a 404 page
  // or return a simple HTML response
  res.status(404).type('text/html').send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>404 - Page Not Found</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          padding: 40px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-align: center;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          max-width: 600px;
          background: rgba(255, 255, 255, 0.1);
          padding: 40px;
          border-radius: 20px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        h1 {
          font-size: 4rem;
          margin: 0 0 20px 0;
          font-weight: 300;
        }
        h2 {
          font-size: 1.5rem;
          margin: 0 0 20px 0;
          font-weight: 400;
        }
        p {
          font-size: 1.1rem;
          margin: 0 0 30px 0;
          opacity: 0.9;
        }
        .btn {
          display: inline-block;
          padding: 12px 30px;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          text-decoration: none;
          border-radius: 25px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          transition: all 0.3s ease;
          font-weight: 500;
        }
        .btn:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: translateY(-2px);
        }
        .details {
          margin-top: 30px;
          font-size: 0.9rem;
          opacity: 0.7;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>The page you're looking for doesn't exist or has been moved.</p>
        <a href="/" class="btn">Go Home</a>
        <div class="details">
          <strong>Path:</strong> ${req.path}<br>
          <strong>Method:</strong> ${req.method}<br>
          <strong>Time:</strong> ${new Date().toLocaleString()}
        </div>
      </div>
    </body>
    </html>
  `);
};

// Helper function to provide available endpoints information
function getAvailableEndpoints(): string[] {
  return [
    'POST /api/auth/register',
    'POST /api/auth/login',
    'POST /api/auth/logout',
    'POST /api/auth/forgot-password',
    'POST /api/auth/reset-password',
    'GET /api/auth/profile',
    'PUT /api/auth/profile',
    'POST /api/auth/change-password',
    
    'POST /api/onramp/onboard',
    'GET /api/onramp/wallets',
    'GET /api/onramp/wallets/balances',
    'GET /api/onramp/wallets/:network/balance',
    'GET /api/onramp/wallets/check-balance',
    'POST /api/onramp/requests',
    'GET /api/onramp/requests',
    'POST /api/onramp/requests/:requestId/process',
    'POST /api/onramp/liquidity-provider/register',
    'POST /api/onramp/withdraw',
    'GET /api/onramp/withdraw',
    'GET /api/onramp/withdraw/:requestId',
    'POST /api/onramp/withdraw/:requestId/process',
    'DELETE /api/onramp/withdraw/:requestId',
    'GET /api/onramp/withdraw/estimate-fee',
    'GET /api/onramp/stats',
    
    'GET /health'
  ];
}

// Alternative simple not found handler for minimal applications
export const simpleNotFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
};