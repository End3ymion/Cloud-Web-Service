const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'; // set a real secret in prod

// S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-1',
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME || 'my-bucket-test-168';

// Configure paths
const TEMP_UPLOADS_PATH = path.join(__dirname, 'temp_uploads');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_UPLOADS_PATH)) {
  fs.mkdirSync(TEMP_UPLOADS_PATH, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from client directory
app.use(express.static(path.join(__dirname, 'client')));

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TEMP_UPLOADS_PATH),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

// DB
mongoose.connect('mongodb://localhost:27017/clouddrive')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

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
  uploadDate: { type: Date, default: Date.now }
}));

function generateS3Key(userId, originalName) {
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(8).toString('hex');
  const extension = path.extname(originalName);
  const baseName = path.basename(originalName, extension);
  return `users/${userId}/${timestamp}-${randomSuffix}-${baseName}${extension}`;
}

async function uploadToS3(filePath, s3Key, contentType) {
  const fileStream = fs.createReadStream(filePath);
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: fileStream,
    ContentType: contentType
  });
  await s3Client.send(command);
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

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });

  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ error: 'Email already exists' });

  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ name, email, password: hashed });
  await user.save();

  res.status(201).json({ message: 'User created' });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { userId: user._id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token });
});

app.post('/api/files', authMiddleware, upload.array('files'), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

  const uploadedFiles = [];

  try {
    for (const file of req.files) {
      const s3Key = generateS3Key(req.user.userId, file.originalname);
      await uploadToS3(file.path, s3Key, file.mimetype);

      const fileDoc = new File({
        userId: req.user.userId,
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
        s3Key
      });
      const saved = await fileDoc.save();
      uploadedFiles.push(saved);
    }

    req.files.forEach(f => fs.unlink(f.path, () => {}));
    res.status(201).json(uploadedFiles);
  } catch (err) {
    req.files.forEach(f => fs.unlink(f.path, () => {}));
    for (const f of uploadedFiles) {
      await deleteFromS3(f.s3Key);
      await File.findByIdAndDelete(f._id);
    }
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload' });
  }
});

app.get('/api/files', authMiddleware, async (req, res) => {
  const files = await File.find({ userId: req.user.userId }).sort({ uploadDate: -1 });
  res.json(files);
});

app.get('/api/files/download/:id', authMiddleware, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (file.userId.toString() !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });

    const downloadUrl = await generateSignedUrl(file.s3Key, file.name);
    res.json({ downloadUrl, fileName: file.name });
  } catch (error) {
    console.error('Download URL generation failed:', error);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

app.delete('/api/files/:id', authMiddleware, async (req, res) => {
  const file = await File.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
  if (!file) return res.status(404).json({ error: 'File not found' });

  try {
    await deleteFromS3(file.s3Key);
  } catch (err) {
    console.error('S3 delete error:', err);
  }

  res.json({ message: 'File deleted' });
});

// Catch-all handler: send back index.html for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
