require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB...");

  try {
    // 1. Cleanup old test user
    await User.deleteMany({ email: 'test@example.com' });

    // 2. Create user (Hashing happens here)
    const user = await User.create({
      fullName: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'admin'
    });
    console.log("✅ User created successfully");

    // 3. Test password matching
    const isMatch = await user.matchPassword('password123');
    console.log("✅ Password match test:", isMatch ? "PASSED" : "FAILED");

    // 4. Test exclusion of password in query
    const foundUser = await User.findOne({ email: 'test@example.com' });
    console.log("✅ Password hidden in query:", foundUser.password === undefined ? "YES" : "NO");

  } catch (err) {
    console.error("❌ Test failed:", err.message);
  } finally {
    await mongoose.connection.close();
  }
}
test();