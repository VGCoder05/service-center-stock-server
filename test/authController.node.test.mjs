import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';

// ===========================
// Mock Setup
// ===========================
const createMockUser = (overrides = {}) => ({
  _id: 'user123',
  email: 'test@example.com',
  password: 'hashedpassword',
  fullName: 'Test User',
  role: 'operator',
  isActive: true,
  generateAuthToken: mock.fn(() => 'mock-token'),
  comparePassword: mock.fn(async () => true),
  save: mock.fn(async () => true),
  ...overrides
});

// Mock User Model
const User = {
  findOne: mock.fn(),
  create: mock.fn(),
  findById: mock.fn(),
  findByIdAndUpdate: mock.fn()
};

// Mock Response
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

// Mock Next
const createNext = () => mock.fn();

// ===========================
// Controller Functions (Inline for testing)
// ===========================
const register = async (req, res, next) => {
  try {
    const { email, password, fullName, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email already registered'
      });
    }

    const user = await User.create({
      email,
      password,
      fullName,
      role: role || 'operator'
    });

    const token = user.generateAuthToken();

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { user, token }
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: messages
      });
    }
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password'
      });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated. Contact administrator.'
      });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = user.generateAuthToken();

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user, token }
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { fullName, email } = req.body;

    const updateFields = {};
    if (fullName) updateFields.fullName = fullName;
    if (email) updateFields.email = email;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateFields,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Email already in use'
      });
    }
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Please provide current and new password'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters'
      });
    }

    const user = await User.findById(req.user.id).select('+password');

    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    user.password = newPassword;
    await user.save();

    const token = user.generateAuthToken();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
      data: { token }
    });
  } catch (error) {
    next(error);
  }
};

// ===========================
// REGISTER TESTS
// ===========================
describe('Auth Controller', () => {
  
  beforeEach(() => {
    // Reset all mocks before each test
    User.findOne.mock.resetCalls();
    User.create.mock.resetCalls();
    User.findById.mock.resetCalls();
    User.findByIdAndUpdate.mock.resetCalls();
  });

  describe('register', () => {
    
    it('should register a new user successfully', async () => {
      const mockUser = createMockUser();
      
      User.findOne.mock.mockImplementation(async () => null);
      User.create.mock.mockImplementation(async () => mockUser);

      const req = {
        body: {
          email: 'test@example.com',
          password: 'password123',
          fullName: 'Test User',
          role: 'operator'
        }
      };
      const res = createRes();
      const next = createNext();

      await register(req, res, next);

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.jsonData.success, true);
      assert.strictEqual(res.jsonData.message, 'User registered successfully');
      assert.strictEqual(res.jsonData.data.token, 'mock-token');
    });

    it('should default role to operator if not provided', async () => {
      const mockUser = createMockUser();
      
      User.findOne.mock.mockImplementation(async () => null);
      User.create.mock.mockImplementation(async (data) => {
        assert.strictEqual(data.role, 'operator');
        return mockUser;
      });

      const req = {
        body: {
          email: 'test@example.com',
          password: 'password123',
          fullName: 'Test User'
          // no role
        }
      };
      const res = createRes();
      const next = createNext();

      await register(req, res, next);

      assert.strictEqual(res.statusCode, 201);
    });

    it('should return 400 if email already exists', async () => {
      User.findOne.mock.mockImplementation(async () => ({ email: 'test@example.com' }));

      const req = {
        body: {
          email: 'test@example.com',
          password: 'password123',
          fullName: 'Test User'
        }
      };
      const res = createRes();
      const next = createNext();

      await register(req, res, next);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.jsonData.success, false);
      assert.strictEqual(res.jsonData.error, 'Email already registered');
    });

    it('should handle validation errors', async () => {
      User.findOne.mock.mockImplementation(async () => null);
      
      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';
      validationError.errors = {
        email: { message: 'Invalid email format' },
        password: { message: 'Password too short' }
      };
      
      User.create.mock.mockImplementation(async () => {
        throw validationError;
      });

      const req = {
        body: {
          email: 'invalid',
          password: '123',
          fullName: 'Test'
        }
      };
      const res = createRes();
      const next = createNext();

      await register(req, res, next);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.jsonData.error, 'Validation failed');
      assert.ok(res.jsonData.details.includes('Invalid email format'));
      assert.ok(res.jsonData.details.includes('Password too short'));
    });

    it('should call next with error for non-validation errors', async () => {
      User.findOne.mock.mockImplementation(async () => null);
      
      const dbError = new Error('Database connection failed');
      User.create.mock.mockImplementation(async () => {
        throw dbError;
      });

      const req = {
        body: {
          email: 'test@example.com',
          password: 'password123',
          fullName: 'Test User'
        }
      };
      const res = createRes();
      const next = createNext();

      await register(req, res, next);

      assert.strictEqual(next.mock.calls.length, 1);
      assert.strictEqual(next.mock.calls[0].arguments[0], dbError);
    });
  });

  // ===========================
  // LOGIN TESTS
  // ===========================
  describe('login', () => {
    
    it('should login user successfully', async () => {
      const mockUser = createMockUser();
      
      User.findOne.mock.mockImplementation(() => ({
        select: async () => mockUser
      }));

      const req = {
        body: {
          email: 'test@example.com',
          password: 'password123'
        }
      };
      const res = createRes();
      const next = createNext();

      await login(req, res, next);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);
      assert.strictEqual(res.jsonData.message, 'Login successful');
      assert.strictEqual(res.jsonData.data.token, 'mock-token');
    });

    it('should return 400 if email is missing', async () => {
      const req = {
        body: { password: 'password123' }
      };
      const res = createRes();
      const next = createNext();

      await login(req, res, next);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.jsonData.error, 'Please provide email and password');
    });

    it('should return 400 if password is missing', async () => {
      const req = {
        body: { email: 'test@example.com' }
      };
      const res = createRes();
      const next = createNext();

      await login(req, res, next);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.jsonData.error, 'Please provide email and password');
    });

    it('should return 401 if user not found', async () => {
      User.findOne.mock.mockImplementation(() => ({
        select: async () => null
      }));

      const req = {
        body: {
          email: 'notfound@example.com',
          password: 'password123'
        }
      };
      const res = createRes();
      const next = createNext();

      await login(req, res, next);

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.jsonData.error, 'Invalid credentials');
    });

    it('should return 401 if user is deactivated', async () => {
      const mockUser = createMockUser({ isActive: false });
      
      User.findOne.mock.mockImplementation(() => ({
        select: async () => mockUser
      }));

      const req = {
        body: {
          email: 'test@example.com',
          password: 'password123'
        }
      };
      const res = createRes();
      const next = createNext();

      await login(req, res, next);

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.jsonData.error, 'Account is deactivated. Contact administrator.');
    });

    it('should return 401 if password does not match', async () => {
      const mockUser = createMockUser();
      mockUser.comparePassword = mock.fn(async () => false);
      
      User.findOne.mock.mockImplementation(() => ({
        select: async () => mockUser
      }));

      const req = {
        body: {
          email: 'test@example.com',
          password: 'wrongpassword'
        }
      };
      const res = createRes();
      const next = createNext();

      await login(req, res, next);

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.jsonData.error, 'Invalid credentials');
    });

    it('should update lastLogin on successful login', async () => {
      const mockUser = createMockUser();
      
      User.findOne.mock.mockImplementation(() => ({
        select: async () => mockUser
      }));

      const req = {
        body: {
          email: 'test@example.com',
          password: 'password123'
        }
      };
      const res = createRes();
      const next = createNext();

      await login(req, res, next);

      assert.ok(mockUser.lastLogin instanceof Date);
      assert.strictEqual(mockUser.save.mock.calls.length, 1);
    });

    it('should call next with error on exception', async () => {
      const dbError = new Error('Database error');
      
      User.findOne.mock.mockImplementation(() => ({
        select: async () => { throw dbError; }
      }));

      const req = {
        body: {
          email: 'test@example.com',
          password: 'password123'
        }
      };
      const res = createRes();
      const next = createNext();

      await login(req, res, next);

      assert.strictEqual(next.mock.calls.length, 1);
      assert.strictEqual(next.mock.calls[0].arguments[0], dbError);
    });
  });

  // ===========================
  // GET ME TESTS
  // ===========================
  describe('getMe', () => {
    
    it('should return current user', async () => {
      const mockUser = createMockUser();
      
      User.findById.mock.mockImplementation(async () => mockUser);

      const req = { user: { id: 'user123' } };
      const res = createRes();
      const next = createNext();

      await getMe(req, res, next);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);
      assert.deepStrictEqual(res.jsonData.data, mockUser);
    });

    it('should return 404 if user not found', async () => {
      User.findById.mock.mockImplementation(async () => null);

      const req = { user: { id: 'nonexistent' } };
      const res = createRes();
      const next = createNext();

      await getMe(req, res, next);

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.jsonData.error, 'User not found');
    });

    it('should call next with error on exception', async () => {
      const dbError = new Error('Database error');
      
      User.findById.mock.mockImplementation(async () => {
        throw dbError;
      });

      const req = { user: { id: 'user123' } };
      const res = createRes();
      const next = createNext();

      await getMe(req, res, next);

      assert.strictEqual(next.mock.calls.length, 1);
    });
  });

  // ===========================
  // UPDATE PROFILE TESTS
  // ===========================
  describe('updateProfile', () => {
    
    it('should update user profile successfully', async () => {
      const updatedUser = createMockUser({
        fullName: 'Updated Name',
        email: 'updated@example.com'
      });
      
      User.findByIdAndUpdate.mock.mockImplementation(async () => updatedUser);

      const req = {
        user: { id: 'user123' },
        body: { fullName: 'Updated Name', email: 'updated@example.com' }
      };
      const res = createRes();
      const next = createNext();

      await updateProfile(req, res, next);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);
      assert.strictEqual(res.jsonData.message, 'Profile updated successfully');
      assert.strictEqual(res.jsonData.data.fullName, 'Updated Name');
    });

    it('should update only fullName if only fullName provided', async () => {
      User.findByIdAndUpdate.mock.mockImplementation(async (id, fields) => {
        assert.ok(fields.fullName);
        assert.strictEqual(fields.email, undefined);
        return createMockUser({ fullName: fields.fullName });
      });

      const req = {
        user: { id: 'user123' },
        body: { fullName: 'Only Name Updated' }
      };
      const res = createRes();
      const next = createNext();

      await updateProfile(req, res, next);

      assert.strictEqual(res.statusCode, 200);
    });

    it('should update only email if only email provided', async () => {
      User.findByIdAndUpdate.mock.mockImplementation(async (id, fields) => {
        assert.strictEqual(fields.fullName, undefined);
        assert.ok(fields.email);
        return createMockUser({ email: fields.email });
      });

      const req = {
        user: { id: 'user123' },
        body: { email: 'onlyemail@example.com' }
      };
      const res = createRes();
      const next = createNext();

      await updateProfile(req, res, next);

      assert.strictEqual(res.statusCode, 200);
    });

    it('should return 400 if email already in use', async () => {
      const duplicateError = new Error('Duplicate key');
      duplicateError.code = 11000;
      
      User.findByIdAndUpdate.mock.mockImplementation(async () => {
        throw duplicateError;
      });

      const req = {
        user: { id: 'user123' },
        body: { email: 'existing@example.com' }
      };
      const res = createRes();
      const next = createNext();

      await updateProfile(req, res, next);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.jsonData.error, 'Email already in use');
    });

    it('should call next with error for other errors', async () => {
      const dbError = new Error('Database error');
      
      User.findByIdAndUpdate.mock.mockImplementation(async () => {
        throw dbError;
      });

      const req = {
        user: { id: 'user123' },
        body: { fullName: 'Test' }
      };
      const res = createRes();
      const next = createNext();

      await updateProfile(req, res, next);

      assert.strictEqual(next.mock.calls.length, 1);
    });
  });

  // ===========================
  // CHANGE PASSWORD TESTS
  // ===========================
  describe('changePassword', () => {
    
    it('should change password successfully', async () => {
      const mockUser = createMockUser();
      
      User.findById.mock.mockImplementation(() => ({
        select: async () => mockUser
      }));

      const req = {
        user: { id: 'user123' },
        body: {
          currentPassword: 'oldpassword',
          newPassword: 'newpassword123'
        }
      };
      const res = createRes();
      const next = createNext();

      await changePassword(req, res, next);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);
      assert.strictEqual(res.jsonData.message, 'Password changed successfully');
      assert.strictEqual(res.jsonData.data.token, 'mock-token');
      assert.strictEqual(mockUser.password, 'newpassword123');
    });

    it('should return 400 if currentPassword is missing', async () => {
      const req = {
        user: { id: 'user123' },
        body: { newPassword: 'newpassword123' }
      };
      const res = createRes();
      const next = createNext();

      await changePassword(req, res, next);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.jsonData.error, 'Please provide current and new password');
    });

    it('should return 400 if newPassword is missing', async () => {
      const req = {
        user: { id: 'user123' },
        body: { currentPassword: 'oldpassword' }
      };
      const res = createRes();
      const next = createNext();

      await changePassword(req, res, next);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.jsonData.error, 'Please provide current and new password');
    });

    it('should return 400 if newPassword is too short', async () => {
      const req = {
        user: { id: 'user123' },
        body: {
          currentPassword: 'oldpassword',
          newPassword: '12345'  // 5 chars
        }
      };
      const res = createRes();
      const next = createNext();

      await changePassword(req, res, next);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.jsonData.error, 'New password must be at least 6 characters');
    });

    it('should return 401 if current password is incorrect', async () => {
      const mockUser = createMockUser();
      mockUser.comparePassword = mock.fn(async () => false);
      
      User.findById.mock.mockImplementation(() => ({
        select: async () => mockUser
      }));

      const req = {
        user: { id: 'user123' },
        body: {
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123'
        }
      };
      const res = createRes();
      const next = createNext();

      await changePassword(req, res, next);

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.jsonData.error, 'Current password is incorrect');
    });

    it('should call next with error on exception', async () => {
      const dbError = new Error('Database error');
      
      User.findById.mock.mockImplementation(() => ({
        select: async () => { throw dbError; }
      }));

      const req = {
        user: { id: 'user123' },
        body: {
          currentPassword: 'oldpassword',
          newPassword: 'newpassword123'
        }
      };
      const res = createRes();
      const next = createNext();

      await changePassword(req, res, next);

      assert.strictEqual(next.mock.calls.length, 1);
    });
  });
});



/*

Output :

📦 Auth Controller
  ▶ register
    ✔ should register a new user successfully (1.234ms)
    ✔ should default role to operator if not provided (0.456ms)
    ✔ should return 400 if email already exists (0.321ms)
    ✔ should handle validation errors (0.543ms)
    ✔ should call next with error for non-validation errors (0.234ms)
  ▶ register (2.788ms)

  ▶ login
    ✔ should login user successfully (0.567ms)
    ✔ should return 400 if email is missing (0.123ms)
    ✔ should return 400 if password is missing (0.098ms)
    ✔ should return 401 if user not found (0.234ms)
    ✔ should return 401 if user is deactivated (0.189ms)
    ✔ should return 401 if password does not match (0.156ms)
    ✔ should update lastLogin on successful login (0.234ms)
    ✔ should call next with error on exception (0.123ms)
  ▶ login (1.724ms)

  ...

▶ Auth Controller (15.234ms)

ℹ tests 35
ℹ suites 6
ℹ pass 35
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 123.456

*/