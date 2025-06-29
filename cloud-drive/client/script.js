// Authentication Functions
document.getElementById('loginFormElement').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    if (response.ok) {
      localStorage.setItem('currentUser', JSON.stringify(data));
      window.location.reload();
    } else {
      document.getElementById('loginError').textContent = data.error || 'Login failed';
    }
  } catch (error) {
    document.getElementById('loginError').textContent = 'Server error';
  }
});

document.getElementById('registerFormElement').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('registerName').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (password !== confirmPassword) {
    document.getElementById('registerError').textContent = 'Passwords must match';
    return;
  }

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json();
    if (response.ok) {
      document.getElementById('registerSuccess').textContent = 'Registration successful!';
      setTimeout(() => {
        document.getElementById('registerForm').classList.add('hidden');
        document.getElementById('loginForm').classList.remove('hidden');
      }, 1500);
    } else {
      document.getElementById('registerError').textContent = data.error || 'Registration failed';
    }
  } catch (error) {
    document.getElementById('registerError').textContent = 'Server error';
  }
});

// UI Functions
window.showRegister = () => {
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('registerForm').classList.remove('hidden');
};

window.showLogin = () => {
  document.getElementById('registerForm').classList.add('hidden');
  document.getElementById('loginForm').classList.remove('hidden');
};

window.logout = () => {
  localStorage.removeItem('currentUser');
  window.location.reload();
};

// File Upload Functions
document.getElementById('fileInput').addEventListener('change', function() {
  const files = Array.from(this.files);
  if (files.length > 0) {
    document.querySelector('.upload-text').textContent = `${files.length} file(s) selected`;
  } else {
    document.querySelector('.upload-text').textContent = '📁 Click to upload files';
  }
});

window.uploadFiles = async () => {
  const fileInput = document.getElementById('fileInput');
  const files = fileInput.files;
  const user = JSON.parse(localStorage.getItem('currentUser'));
  
  if (!user) return alert('Please login first');
  if (files.length === 0) return alert('Select files first');

  // Show upload progress
  const uploadText = document.querySelector('.upload-text');
  const originalText = uploadText.textContent;
  uploadText.textContent = 'Uploading to S3...';
  
  const formData = new FormData();
  formData.append('userId', user.userId);
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }

  try {
    const response = await fetch('/api/files', {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      alert('Files uploaded successfully to S3!');
      fileInput.value = '';
      uploadText.textContent = '📁 Click to upload files';
      loadFiles();
    } else {
      const error = await response.json();
      alert(error.error || 'Upload failed');
      uploadText.textContent = originalText;
    }
  } catch (error) {
    console.error('Upload error:', error);
    alert('Server error during upload');
    uploadText.textContent = originalText;
  }
};

// File Management
async function loadFiles() {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  if (!user) return;

  try {
    const response = await fetch(`/api/files/${user.userId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const files = await response.json();
    renderFiles(files);
  } catch (error) {
    console.error('Failed to load files', error);
    document.getElementById('filesGrid').innerHTML = '<p>Failed to load files</p>';
  }
}

function renderFiles(files) {
  const grid = document.getElementById('filesGrid');
  
  if (files.length === 0) {
    grid.innerHTML = '<p class="no-files">No files uploaded yet. Upload some files to get started!</p>';
    return;
  }
  
  grid.innerHTML = files.map(file => `
    <div class="file-item">
      <div class="file-icon">${getFileIcon(file.type)}</div>
      <div class="file-name" title="${file.name}">${file.name}</div>
      <div class="file-size">${formatFileSize(file.size)}</div>
      <div class="file-date">${formatDate(file.uploadDate)}</div>
      <div class="file-actions">
        <button onclick="downloadFile('${file._id}','${file.name}')" class="btn-small btn-download" title="Download from S3">📥 Download</button>
        <button onclick="deleteFile('${file._id}')" class="btn-small btn-delete" title="Delete from S3">🗑️ Delete</button>
      </div>
    </div>
  `).join('');
}

window.downloadFile = async (fileId, fileName) => {
  try {
    // The server will redirect to a signed S3 URL
    const downloadUrl = `/api/files/download/${fileId}`;
    
    // Create a temporary link and click it
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.target = '_blank'; // Open in new tab to handle redirects properly
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Note: Due to CORS and redirect handling, the download might open in a new tab
    console.log('Download initiated for:', fileName);
  } catch (error) {
    console.error('Download error:', error);
    alert('Download failed');
  }
};

window.deleteFile = async (fileId) => {
  if (!confirm('Delete this file from S3? This action cannot be undone.')) return;
  
  try {
    const response = await fetch(`/api/files/${fileId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      alert('File deleted successfully from S3!');
      loadFiles();
    } else {
      const error = await response.json();
      alert(error.error || 'Delete failed');
    }
  } catch (error) {
    console.error('Delete error:', error);
    alert('Delete failed');
  }
};

// Helper Functions
function getFileIcon(type) {
  if (!type) return '📁';
  if (type.startsWith('image/')) return '🖼️';
  if (type.startsWith('video/')) return '🎥';
  if (type.startsWith('audio/')) return '🎵';
  if (type.includes('pdf')) return '📄';
  if (type.includes('word') || type.includes('document')) return '📝';
  if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
  if (type.includes('powerpoint') || type.includes('presentation')) return '📊';
  if (type.includes('zip') || type.includes('archive')) return '📦';
  if (type.includes('text')) return '📃';
  return '📁';
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

// Health check function
async function checkServerHealth() {
  try {
    const response = await fetch('/api/health');
    const health = await response.json();
    console.log('Server health:', health);
    return health;
  } catch (error) {
    console.error('Health check failed:', error);
    return null;
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Check server health on startup
  const health = await checkServerHealth();
  if (health) {
    console.log(`Connected to S3 bucket: ${health.bucket}`);
  }
  
  const user = JSON.parse(localStorage.getItem('currentUser'));
  if (user) {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('userName').textContent = `Welcome, ${user.name}! (Files stored in S3)`;
    loadFiles();
  }
});

// Handle drag and drop for file uploads
const uploadArea = document.querySelector('.upload-area');
if (uploadArea) {
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    const fileInput = document.getElementById('fileInput');
    fileInput.files = files;
    
    if (files.length > 0) {
      document.querySelector('.upload-text').textContent = `${files.length} file(s) selected`;
    }
  });
}
