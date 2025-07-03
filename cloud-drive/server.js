require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET;

// S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client')));

// DB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Models
const User = mongoose.model('User', new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}));

const File = mongoose.model('File', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  name: { type: String, required: true },
  size: { type: Number, required: true },
  type: { type: String, required: true },
  s3Key: { type: String, required: true },
  uploadDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' }
}));

// Helper Functions
function generateS3Key(userId, originalName) {
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(8).toString('hex');
  const extension = path.extname(originalName);
  const baseName = path.basename(originalName, extension);
  return `users/${userId}/${timestamp}-${randomSuffix}-${baseName}${extension}`;
}

async function generatePresignedUploadUrl(s3Key, contentType) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    ContentType: contentType
  });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

async function deleteFromS3(s3Key) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key
  });
  await s3Client.send(command);
}

async function generateSignedUrl(s3Key, fileName) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    ResponseContentDisposition: `attachment; filename="${fileName}"`
  });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

// Auth Middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Auth Routes
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });

  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashed });
    await user.save();
    res.status(201).json({ message: 'User created' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ 
      token,
      name: user.name
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// File Routes
app.post('/api/files/initiate-upload', authMiddleware, async (req, res) => {
  try {
    const { files } = req.body;
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const uploadData = await Promise.all(files.map(async file => {
      const s3Key = generateS3Key(req.user.userId, file.name);
      const uploadUrl = await generatePresignedUploadUrl(s3Key, file.type);

      const fileDoc = new File({
        userId: req.user.userId,
        name: file.name,
        size: file.size,
        type: file.type,
        s3Key,
        status: 'pending'
      });
      
      await fileDoc.save();

      return {
        fileId: fileDoc._id,
        uploadUrl,
        s3Key
      };
    }));

    res.json(uploadData);
  } catch (error) {
    console.error('Upload initiation error:', error);
    res.status(500).json({ error: 'Failed to initiate upload' });
  }
});

app.post('/api/files/complete-upload', authMiddleware, async (req, res) => {
  try {
    const { fileId } = req.body;
    if (!fileId) return res.status(400).json({ error: 'File ID required' });

    const file = await File.findOneAndUpdate(
      { _id: fileId, userId: req.user.userId },
      { status: 'completed' },
      { new: true }
    );

    if (!file) return res.status(404).json({ error: 'File not found' });
    res.json({ message: 'Upload completed', file });
  } catch (error) {
    console.error('Complete upload error:', error);
    res.status(500).json({ error: 'Failed to complete upload' });
  }
});

app.get('/api/files', authMiddleware, async (req, res) => {
  try {
    const files = await File.find({ 
      userId: req.user.userId,
      status: 'completed' 
    }).sort({ uploadDate: -1 });
    res.json(files);
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ error: 'Failed to get files' });
  }
});

app.get('/api/files/download/:id', authMiddleware, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (file.userId.toString() !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });

    const downloadUrl = await generateSignedUrl(file.s3Key, file.name);
    res.json({ downloadUrl, fileName: file.name });
  } catch (error) {
    console.error('Download URL error:', error);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

app.delete('/api/files/:id', authMiddleware, async (req, res) => {
  try {
    const file = await File.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user.userId 
    });
    
    if (!file) return res.status(404).json({ error: 'File not found' });

    await deleteFromS3(file.s3Key);
    res.json({ message: 'File deleted' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// User Info
app.get('/api/user', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    res.json({
      email: user.email,
      name: user.name
    });
  } catch (error) {
    console.error('User info error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Client Route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
