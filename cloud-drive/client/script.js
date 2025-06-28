// Authentication Functions
document.getElementById('loginFormElement').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const response = await fetch('http://localhost:3000/api/login', {
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
    const response = await fetch('http://localhost:3000/api/register', {
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
  }
});

window.uploadFiles = async () => {
  const fileInput = document.getElementById('fileInput');
  const files = fileInput.files;
  const user = JSON.parse(localStorage.getItem('currentUser'));
  
  if (!user) return alert('Please login first');
  if (files.length === 0) return alert('Select files first');

  const formData = new FormData();
  formData.append('userId', user.userId);
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }

  try {
    const response = await fetch('http://localhost:3000/api/files', {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      alert('Files uploaded successfully');
      fileInput.value = '';
      document.querySelector('.upload-text').textContent = '📁 Click to upload files';
      loadFiles();
    } else {
      const error = await response.json();
      alert(error.error || 'Upload failed');
    }
  } catch (error) {
    alert('Server error');
  }
};

// File Management
async function loadFiles() {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  if (!user) return;

  try {
    const response = await fetch(`http://localhost:3000/api/files/${user.userId}`);
    const files = await response.json();
    renderFiles(files);
  } catch (error) {
    console.error('Failed to load files', error);
  }
}

function renderFiles(files) {
  const grid = document.getElementById('filesGrid');
  grid.innerHTML = files.map(file => `
    <div class="file-item">
      <div class="file-icon">${getFileIcon(file.type)}</div>
      <div class="file-name">${file.name}</div>
      <div class="file-size">${formatFileSize(file.size)}</div>
      <div class="file-actions">
        <button onclick="downloadFile('${file._id}','${file.name}')" class="btn-small btn-download">Download</button>
        <button onclick="deleteFile('${file._id}')" class="btn-small btn-delete">Delete</button>
      </div>
    </div>
  `).join('');
}

window.downloadFile = async (fileId, fileName) => {
  try {
    const link = document.createElement('a');
    link.href = `http://localhost:3000/api/files/download/${fileId}`;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Download error:', error);
    alert('Download failed');
  }
};

window.deleteFile = async (fileId) => {
  if (!confirm('Delete this file?')) return;
  try {
    const response = await fetch(`http://localhost:3000/api/files/${fileId}`, {
      method: 'DELETE'
    });
    if (response.ok) loadFiles();
  } catch (error) {
    alert('Delete failed');
  }
};

// Helper Functions
function getFileIcon(type) {
  if (!type) return '📁';
  if (type.startsWith('image/')) return '🖼️';
  if (type.startsWith('video/')) return '🎥';
  if (type.includes('pdf')) return '📄';
  if (type.includes('word')) return '📝';
  if (type.includes('excel')) return '📊';
  if (type.includes('zip')) return '📦';
  return '📁';
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  if (user) {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('userName').textContent = `Welcome, ${user.name}!`;
    loadFiles();
  }
});
