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
  const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');
  return `users/${userId}/${timestamp}-${randomSuffix}-${sanitizedBaseName}${extension}`;
}

async function generatePresignedUploadUrl(s3Key, contentType) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    ContentType: contentType
  });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

async function generatePresignedDownloadUrl(s3Key, fileName) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    ResponseContentDisposition: `attachment; filename="${fileName}"`
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

// Auth Middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

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
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashed });
    await user.save();
    
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ 
      token,
      name: user.name,
      email: user.email
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

    // Validate file data
    for (const file of files) {
      if (!file.name || !file.size || !file.type) {
        return res.status(400).json({ error: 'Invalid file data' });
      }
      
      // File size limit (50MB)
      if (file.size > 50 * 1024 * 1024) {
        return res.status(400).json({ error: `File ${file.name} exceeds 50MB limit` });
      }
    }

    const uploadData = await Promise.all(files.map(async (file) => {
      try {
        const s3Key = generateS3Key(req.user.userId, file.name);
        const uploadUrl = await generatePresignedUploadUrl(s3Key, file.type);

        // Create file record in database
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
          s3Key,
          name: file.name
        };
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        throw error;
      }
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
    
    if (!fileId) {
      return res.status(400).json({ error: 'File ID required' });
    }

    const file = await File.findOneAndUpdate(
      { _id: fileId, userId: req.user.userId, status: 'pending' },
      { status: 'completed' },
      { new: true }
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found or already completed' });
    }

    res.json({ 
      message: 'Upload completed successfully', 
      file: {
        _id: file._id,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadDate: file.uploadDate,
        status: file.status
      }
    });
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
    res.status(500).json({ error: 'Failed to retrieve files' });
  }
});

app.get('/api/files/download/:id', authMiddleware, async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      userId: req.user.userId,
      status: 'completed'
    });
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const downloadUrl = await generatePresignedDownloadUrl(file.s3Key, file.name);
    
    res.json({ 
      downloadUrl, 
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type
    });
  } catch (error) {
    console.error('Download URL generation error:', error);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

app.delete('/api/files/:id', authMiddleware, async (req, res) => {
  try {
    const file = await File.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user.userId 
    });
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete from S3
    try {
      await deleteFromS3(file.s3Key);
    } catch (s3Error) {
      console.error('S3 delete error:', s3Error);
      // Continue even if S3 delete fails - file record is already deleted
    }

    res.json({ 
      message: 'File deleted successfully',
      fileName: file.name
    });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// User Info Route
app.get('/api/user', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      email: user.email,
      name: user.name,
      _id: user._id
    });
  } catch (error) {
    console.error('User info error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Cleanup incomplete uploads (optional - run periodically)
app.post('/api/files/cleanup', authMiddleware, async (req, res) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const incompleteFiles = await File.find({
      userId: req.user.userId,
      status: 'pending',
      uploadDate: { $lt: oneDayAgo }
    });

    for (const file of incompleteFiles) {
      try {
        await deleteFromS3(file.s3Key);
      } catch (s3Error) {
        console.error('S3 cleanup error:', s3Error);
      }
    }

    await File.deleteMany({
      userId: req.user.userId,
      status: 'pending',
      uploadDate: { $lt: oneDayAgo }
    });

    res.json({ 
      message: 'Cleanup completed',
      deletedCount: incompleteFiles.length
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

// Client Route (must be last)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
