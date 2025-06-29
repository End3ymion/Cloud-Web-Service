const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

const app = express();

// S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-1', // Set your region
});

const BUCKET_NAME = 'my-bucket-test-168';

// Configure paths
const DB_PATH = path.join(__dirname, 'mongodb_data');
const TEMP_UPLOADS_PATH = path.join(__dirname, 'temp_uploads'); // Temporary local storage

// Ensure directories exist
[DB_PATH, TEMP_UPLOADS_PATH].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from client directory
app.use(express.static(path.join(__dirname, 'client')));

// File upload configuration - store temporarily locally before uploading to S3
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_UPLOADS_PATH);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

// Database connection
mongoose.connect('mongodb://localhost:27017/clouddrive')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Models
const User = mongoose.model('User', new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true } // In production, hash passwords!
}));

const File = mongoose.model('File', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  name: { type: String, required: true },
  size: { type: Number, required: true },
  type: { type: String, required: true },
  s3Key: { type: String, required: true }, // S3 object key instead of local path
  uploadDate: { type: Date, default: Date.now }
}));

// Helper function to generate S3 key
function generateS3Key(userId, originalName) {
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(8).toString('hex');
  const extension = path.extname(originalName);
  const baseName = path.basename(originalName, extension);
  return `users/${userId}/${timestamp}-${randomSuffix}-${baseName}${extension}`;
}

// Helper function to upload file to S3
async function uploadToS3(filePath, s3Key, contentType) {
  const fileStream = fs.createReadStream(filePath);
  
  const uploadParams = {
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: fileStream,
    ContentType: contentType,
  };

  const command = new PutObjectCommand(uploadParams);
  await s3Client.send(command);
}

// Helper function to delete file from S3
async function deleteFromS3(s3Key) {
  const deleteParams = {
    Bucket: BUCKET_NAME,
    Key: s3Key,
  };

  const command = new DeleteObjectCommand(deleteParams);
  await s3Client.send(command);
}

// Helper function to generate signed URL for downloads
async function generateSignedUrl(s3Key, fileName) {
  const getObjectParams = {
    Bucket: BUCKET_NAME,
    Key: s3Key,
    ResponseContentDisposition: `attachment; filename="${fileName}"`,
  };

  const command = new GetObjectCommand(getObjectParams);
  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour expiry
  return signedUrl;
}

// API Routes
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // In production, hash the password before storing
    const user = new User({ name, email, password });
    await user.save();
    
    res.status(201).json({ 
      message: 'User created successfully',
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // In production, compare hashed passwords
    const user = await User.findOne({ email, password });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({ 
      userId: user._id,
      name: user.name,
      email: user.email
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/files', upload.array('files'), async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = [];
    const tempFilesToClean = [];

    try {
      for (const file of req.files) {
        // Generate S3 key
        const s3Key = generateS3Key(userId, file.originalname);
        
        // Upload to S3
        await uploadToS3(file.path, s3Key, file.mimetype);
        
        // Save file metadata to database
        const fileDoc = new File({
          userId,
          name: file.originalname,
          size: file.size,
          type: file.mimetype,
          s3Key: s3Key
        });
        
        const savedFile = await fileDoc.save();
        uploadedFiles.push(savedFile);
        tempFilesToClean.push(file.path);
      }

      // Clean up temporary files
      tempFilesToClean.forEach(tempPath => {
        fs.unlink(tempPath, (err) => {
          if (err) console.error('Error deleting temp file:', err);
        });
      });

      res.status(201).json(uploadedFiles);
    } catch (uploadError) {
      // Clean up temporary files on error
      tempFilesToClean.forEach(tempPath => {
        fs.unlink(tempPath, (err) => {
          if (err) console.error('Error deleting temp file:', err);
        });
      });
      
      // Try to clean up any S3 objects that were created
      for (const file of uploadedFiles) {
        try {
          await deleteFromS3(file.s3Key);
          await File.findByIdAndDelete(file._id);
        } catch (cleanupError) {
          console.error('Error cleaning up S3 object:', cleanupError);
        }
      }
      
      throw uploadError;
    }
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/files/:userId', async (req, res) => {
  try {
    const files = await File.find({ userId: req.params.userId })
      .sort({ uploadDate: -1 });
      
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/files/download/:id', async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Generate signed URL for download
    const signedUrl = await generateSignedUrl(file.s3Key, file.name);
    
    // Redirect to signed URL
    res.redirect(signedUrl);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/files/:id', async (req, res) => {
  try {
    const file = await File.findByIdAndDelete(req.params.id);
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete from S3
    try {
      await deleteFromS3(file.s3Key);
    } catch (s3Error) {
      console.error('Error deleting from S3:', s3Error);
      // Continue anyway - file metadata is already deleted from DB
    }

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    bucket: BUCKET_NAME,
    timestamp: new Date().toISOString()
  });
});

// Client-side routing - must be last!
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`MongoDB data directory: ${DB_PATH}`);
  console.log(`S3 Bucket: ${BUCKET_NAME}`);
  console.log(`Temp uploads directory: ${TEMP_UPLOADS_PATH}`);
  console.log(`Access your app at: http://localhost:${PORT}`);
});;
