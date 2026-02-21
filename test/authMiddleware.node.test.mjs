import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';

// ===========================
// Mock JWT
// ===========================
const jwt = {
  verify: mock.fn()
};

// ===========================
// Mock User Model
// ===========================
const User = {
  findById: mock.fn()
};

// Mock process.env
process.env.JWT_SECRET = 'test-secret';

// ===========================
// Mock Response Helper
// ===========================
const createRes = () => {
  const res = {};
  res.statusCode = null;
  res.jsonData = null;
  res.status = mock.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = mock.fn((data) => {
    res.jsonData = data;
    return res;
  });
  return res;
};

const createNext = () => mock.fn();

// ===========================
// Middleware Functions (Inline)
// ===========================
const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized. No token provided.'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found. Token invalid.'
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          error: 'Account is deactivated. Contact administrator.'
        });
      }

      req.user = {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      };

      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expired. Please login again.'
        });
      }
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Invalid token.'
        });
      }

      throw error;
    }
  } catch (error) {
    next(error);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized. Please login.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Role '${req.user.role}' is not authorized to access this resource.`
      });
    }

    next();
  };
};

const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized. Please login.'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Admin privileges required.'
    });
  }

  next();
};

const canModify = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized. Please login.'
    });
  }

  if (req.user.role === 'viewer') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Viewers have read-only access.'
    });
  }

  next();
};

// ===========================
// PROTECT MIDDLEWARE TESTS
// ===========================
describe('Auth Middleware', () => {
  
  beforeEach(() => {
    jwt.verify.mock.resetCalls();
    User.findById.mock.resetCalls();
  });

  describe('protect', () => {
    
    it('should call next and attach user on valid token', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'operator',
        isActive: true
      };

      jwt.verify.mock.mockImplementation(() => ({ id: 'user123' }));
      User.findById.mock.mockImplementation(async () => mockUser);

      const req = { headers: { authorization: 'Bearer valid-token' } };
      const res = createRes();
      const next = createNext();

      await protect(req, res, next);

      assert.strictEqual(next.mock.calls.length, 1);
      assert.deepStrictEqual(req.user, {
        id: mockUser._id,
        email: mockUser.email,
        fullName: mockUser.fullName,
        role: mockUser.role
      });
    });

    it('should return 401 if no token provided', async () => {
      const req = { headers: {} };
      const res = createRes();
      const next = createNext();

      await protect(req, res, next);

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.jsonData.error, 'Not authorized. No token provided.');
      assert.strictEqual(next.mock.calls.length, 0);
    });

    it('should return 401 if authorization header does not start with Bearer', async () => {
      const req = { headers: { authorization: 'Basic some-token' } };
      const res = createRes();
      const next = createNext();

      await protect(req, res, next);

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.jsonData.error, 'Not authorized. No token provided.');
    });

    it('should return 401 if token is expired', async () => {
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';
      
      jwt.verify.mock.mockImplementation(() => { throw expiredError; });

      const req = { headers: { authorization: 'Bearer expired-token' } };
      const res = createRes();
      const next = createNext();

      await protect(req, res, next);

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.jsonData.error, 'Token expired. Please login again.');
    });

    it('should return 401 if token is invalid', async () => {
      const invalidError = new Error('Invalid token');
      invalidError.name = 'JsonWebTokenError';
      
      jwt.verify.mock.mockImplementation(() => { throw invalidError; });

      const req = { headers: { authorization: 'Bearer invalid-token' } };
      const res = createRes();
      const next = createNext();

      await protect(req, res, next);

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.jsonData.error, 'Invalid token.');
    });

    it('should return 401 if user not found', async () => {
      jwt.verify.mock.mockImplementation(() => ({ id: 'user123' }));
      User.findById.mock.mockImplementation(async () => null);

      const req = { headers: { authorization: 'Bearer valid-token' } };
      const res = createRes();
      const next = createNext();

      await protect(req, res, next);

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.jsonData.error, 'User not found. Token invalid.');
    });

    it('should return 401 if user is deactivated', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        isActive: false
      };

      jwt.verify.mock.mockImplementation(() => ({ id: 'user123' }));
      User.findById.mock.mockImplementation(async () => mockUser);

      const req = { headers: { authorization: 'Bearer valid-token' } };
      const res = createRes();
      const next = createNext();

      await protect(req, res, next);

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.jsonData.error, 'Account is deactivated. Contact administrator.');
    });

    it('should call next with error for unexpected errors', async () => {
      const unexpectedError = new Error('Unexpected error');
      
      jwt.verify.mock.mockImplementation(() => ({ id: 'user123' }));
      User.findById.mock.mockImplementation(async () => { throw unexpectedError; });

      const req = { headers: { authorization: 'Bearer valid-token' } };
      const res = createRes();
      const next = createNext();

      await protect(req, res, next);

      assert.strictEqual(next.mock.calls.length, 1);
      assert.strictEqual(next.mock.calls[0].arguments[0], unexpectedError);
    });
  });

  // ===========================
  // AUTHORIZE MIDDLEWARE TESTS
  // ===========================
  describe('authorize', () => {
    
    it('should call next if user has authorized role', () => {
      const req = { user: { role: 'admin' } };
      const res = createRes();
      const next = createNext();
      
      const middleware = authorize('admin', 'operator');
      middleware(req, res, next);

      assert.strictEqual(next.mock.calls.length, 1);
    });

    it('should call next if user role is one of multiple allowed roles', () => {
      const req = { user: { role: 'operator' } };
      const res = createRes();
      const next = createNext();
      
      const middleware = authorize('admin', 'operator');
      middleware(req, res, next);

      assert.strictEqual(next.mock.calls.length, 1);
    });

    it('should return 401 if no user on request', () => {
      const req = {};
      const res = createRes();
      const next = createNext();
      
      const middleware = authorize('admin');
      middleware(req, res, next);

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.jsonData.error, 'Not authorized. Please login.');
      assert.strictEqual(next.mock.calls.length, 0);
    });

    it('should return 403 if user role is not authorized', () => {
      const req = { user: { role: 'viewer' } };
      const res = createRes();
      const next = createNext();
      
      const middleware = authorize('admin', 'operator');
      middleware(req, res, next);

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.jsonData.error, "Access denied. Role 'viewer' is not authorized to access this resource.");
    });
  });

  // ===========================
  // ADMIN ONLY MIDDLEWARE TESTS
  // ===========================
  describe('adminOnly', () => {
    
    it('should call next if user is admin', () => {
      const req = { user: { role: 'admin' } };
      const res = createRes();
      const next = createNext();

      adminOnly(req, res, next);

      assert.strictEqual(next.mock.calls.length, 1);
    });

    it('should return 401 if no user on request', () => {
      const req = {};
      const res = createRes();
      const next = createNext();

      adminOnly(req, res, next);

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.jsonData.error, 'Not authorized. Please login.');
    });

    it('should return 403 if user is operator', () => {
      const req = { user: { role: 'operator' } };
      const res = createRes();
      const next = createNext();

      adminOnly(req, res, next);

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.jsonData.error, 'Access denied. Admin privileges required.');
    });

    it('should return 403 if user is viewer', () => {
      const req = { user: { role: 'viewer' } };
      const res = createRes();
      const next = createNext();

      adminOnly(req, res, next);

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.jsonData.error, 'Access denied. Admin privileges required.');
    });
  });

  // ===========================
  // CAN MODIFY MIDDLEWARE TESTS
  // ===========================
  describe('canModify', () => {
    
    it('should call next if user is admin', () => {
      const req = { user: { role: 'admin' } };
      const res = createRes();
      const next = createNext();

      canModify(req, res, next);

      assert.strictEqual(next.mock.calls.length, 1);
    });

    it('should call next if user is operator', () => {
      const req = { user: { role: 'operator' } };
      const res = createRes();
      const next = createNext();

      canModify(req, res, next);

      assert.strictEqual(next.mock.calls.length, 1);
    });

    it('should return 401 if no user on request', () => {
      const req = {};
      const res = createRes();
      const next = createNext();

      canModify(req, res, next);

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.jsonData.error, 'Not authorized. Please login.');
    });

    it('should return 403 if user is viewer', () => {
      const req = { user: { role: 'viewer' } };
      const res = createRes();
      const next = createNext();

      canModify(req, res, next);

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.jsonData.error, 'Access denied. Viewers have read-only access.');
    });
  });
});