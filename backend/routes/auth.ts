import express, { Request, Response } from 'express';
import User from '../models/User';
import { generateToken } from '../utils/jwt';

const router = express.Router();

// Signup route - direct registration without OTP
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, name, role } = req.body;

    console.log('📝 Signup attempt:', { email, name, role });

    // Validation
    if (!email || !password || !name || !role) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('⚠️  User already exists:', email);
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }

    // Create user (password will be hashed by mongoose pre-save hook)
    const user = new User({
      email,
      password,
      name,
      role,
      isEmailVerified: true, // Auto-verify
    });

    console.log('💾 Saving user to MongoDB...');
    await user.save();
    console.log('✅ User saved successfully:', user._id);

    // Generate token
    const token = generateToken(user);

    const userData = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    };

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: userData,
      token,
    });
  } catch (error: any) {
    console.error('❌ Signup error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create account',
    });
  }
});

// Login route - direct login without OTP
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Find user with password field
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Generate token
    const token = generateToken(user);

    const userData = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    };

    res.json({
      success: true,
      message: 'Login successful',
      user: userData,
      token,
    });
  } catch (error: any) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to login',
    });
  }
});

export default router;
