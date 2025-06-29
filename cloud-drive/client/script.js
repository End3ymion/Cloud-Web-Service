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
      // Store JWT token
      localStorage.setItem('authToken', data.token);
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
  localStorage.removeItem('authToken');
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
  const token = localStorage.getItem('authToken');

  if (!token) return alert('Please login first');
  if (files.length === 0) return alert('Select files first');

  const uploadText = document.querySelector('.upload-text');
  const originalText = uploadText.textContent;
  uploadText.textContent = 'Uploading to S3...';

  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }

  try {
    const response = await fetch('/api/files', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    if (response.ok) {
      alert('Files uploaded successfully!');
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
  const token = localStorage.getItem('authToken');
  if (!token) return;

  try {
    const response = await fetch('/api/files', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
    grid.innerHTML = '<p class="no-files">No files uploaded yet.</p>';
    return;
  }

  grid.innerHTML = files.map(file => `
    <div class="file-item">
      <div class="file-icon">${getFileIcon(file.type)}</div>
      <div class="file-name" title="${file.name}">${file.name}</div>
      <div class="file-size">${formatFileSize(file.size)}</div>
      <div class="file-date">${formatDate(file.uploadDate)}</div>
      <div class="file-actions">
        <button onclick="downloadFile('${file._id}','${file.name}')" class="btn-small btn-download">📥 Download</button>
        <button onclick="deleteFile('${file._id}')" class="btn-small btn-delete">🗑️ Delete</button>
      </div>
    </div>
  `).join('');
}

window.downloadFile = async (fileId, fileName) => {
  const token = localStorage.getItem('authToken');
  if (!token) return alert('Please login first');

  // Show loading state
  const button = event.target;
  const originalText = button.textContent;
  button.textContent = '⏳ Downloading...';
  button.disabled = true;

  try {
    const response = await fetch(`/api/files/download/${fileId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const error = await response.json();
      alert(error.error || 'Download failed');
      return;
    }

    // Get the signed URL from the response
    const data = await response.json();
    
    // Create invisible anchor element for clean download
    const link = document.createElement('a');
    link.href = data.downloadUrl;
    link.download = fileName;
    link.style.display = 'none';
    
    // Append, click, and remove immediately
    document.body.appendChild(link);
    link.click();
    
    // Clean up after a short delay
    setTimeout(() => {
      document.body.removeChild(link);
    }, 100);
    
  } catch (error) {
    console.error('Download error:', error);
    alert('Download failed');
  } finally {
    // Restore button state
    button.textContent = originalText;
    button.disabled = false;
  }
};

window.deleteFile = async (fileId) => {
  if (!confirm('Delete this file from S3? This cannot be undone.')) return;
  const token = localStorage.getItem('authToken');
  if (!token) return alert('Please login first');

  try {
    const response = await fetch(`/api/files/${fileId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
      alert('File deleted successfully!');
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
  if (type.includes('word')) return '📝';
  if (type.includes('excel')) return '📊';
  if (type.includes('powerpoint')) return '📊';
  if (type.includes('zip')) return '📦';
  if (type.includes('text')) return '📃';
  return '📁';
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Health Check
async function checkServerHealth() {
  try {
    const response = await fetch('/api/health');
    const health = await response.json();
    console.log('Server health:', health);
  } catch (error) {
    console.error('Health check failed:', error);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await checkServerHealth();
  const token = localStorage.getItem('authToken');
  if (token) {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('userName').textContent = 'Logged in';
    loadFiles();
  }
});

// Drag & Drop
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
