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
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('userEmail', email);
            if (data.name) {
                localStorage.setItem('userName', data.name);
            }
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
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
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

    try {
        // Step 1: Initiate upload - get presigned URLs
        const filesData = Array.from(files).map(file => ({
            name: file.name,
            size: file.size,
            type: file.type
        }));

        const initiateResponse = await fetch('/api/files/initiate-upload', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ files: filesData })
        });

        if (!initiateResponse.ok) {
            const errorData = await initiateResponse.json();
            throw new Error(errorData.error || 'Failed to initiate upload');
        }

        const uploadData = await initiateResponse.json();

        // Step 2: Upload files to S3 using presigned URLs
        const uploadPromises = uploadData.map(async (data, index) => {
            const file = files[index];
            
            const s3Response = await fetch(data.uploadUrl, {
                method: 'PUT',
                body: file,
                headers: {
                    'Content-Type': file.type
                }
            });

            if (!s3Response.ok) {
                throw new Error(`S3 upload failed for ${file.name}`);
            }

            // Step 3: Complete upload
            const completeResponse = await fetch('/api/files/complete-upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fileId: data.fileId })
            });

            if (!completeResponse.ok) {
                const errorData = await completeResponse.json();
                throw new Error(errorData.error || `Failed to complete upload for ${file.name}`);
            }

            return completeResponse.json();
        });

        await Promise.all(uploadPromises);

        alert('Files uploaded successfully!');
        fileInput.value = '';
        uploadText.textContent = '📁 Click to upload files';
        loadFiles();
    } catch (error) {
        console.error('Upload error:', error);
        alert(error.message || 'Server error during upload');
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
        updateFileCount(files.length);
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

function updateFileCount(count) {
    document.getElementById('fileCount').textContent = `${count} file${count !== 1 ? 's' : ''}`;
}

window.downloadFile = async (fileId, fileName) => {
    const token = localStorage.getItem('authToken');
    if (!token) return alert('Please login first');

    const button = event.target;
    const originalText = button.textContent;
    button.textContent = '⏳ Downloading...';
    button.disabled = true;

    try {
        const response = await fetch(`/api/files/download/${fileId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Download failed');
        }

        const data = await response.json();
        
        // Create temporary link and trigger download
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(link);
        }, 100);
        
    } catch (error) {
        console.error('Download error:', error);
        alert(error.message || 'Download failed');
    } finally {
        button.textContent = originalText;
        button.disabled = false;
    }
};

window.deleteFile = async (fileId) => {
    if (!confirm('Delete this file permanently?')) return;
    const token = localStorage.getItem('authToken');
    if (!token) return alert('Please login first');

    try {
        const response = await fetch(`/api/files/${fileId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Delete failed');
        }
        
        alert('File deleted successfully!');
        loadFiles();
    } catch (error) {
        console.error('Delete error:', error);
        alert(error.message || 'Delete failed');
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
        await fetch('/api/health');
    } catch (error) {
        console.error('Health check failed:', error);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await checkServerHealth();
    const token = localStorage.getItem('authToken');
    const userEmail = localStorage.getItem('userEmail');
    const userName = localStorage.getItem('userName');
    
    if (token) {
        document.getElementById('authContainer').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        
        // Display user info
        if (userEmail) {
            document.getElementById('userEmail').textContent = userEmail;
        }
        if (userName) {
            document.getElementById('userName').textContent = `Welcome, ${userName}!`;
        } else {
            document.getElementById('userName').textContent = `Welcome!`;
        }
        
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
        document.querySelector('.upload-text').textContent = 
            files.length > 0 ? `${files.length} file(s) selected` : '📁 Click to upload files';
    });
}
