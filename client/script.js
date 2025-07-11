document.getElementById('loginFormElement').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorElement = document.getElementById('loginError');
    const submitButton = e.target.querySelector('button[type="submit"]');
    
    errorElement.textContent = '';
    errorElement.classList.add('hidden');
    
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
    submitButton.disabled = true;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        
        if (response.ok) {
            sessionStorage.setItem('authToken', data.token);
            sessionStorage.setItem('userEmail', email);
            if (data.name) {
                sessionStorage.setItem('userName', data.name);
            }
            window.location.reload();
        } else {
            let errorMessage = 'Login failed';
            
            if (response.status === 401) {
                errorMessage = 'Invalid email or password';
            } else if (response.status === 404) {
                errorMessage = 'Account not found. Please check your email or create an account.';
            } else if (response.status === 429) {
                errorMessage = 'Too many login attempts. Please try again later.';
            } else if (response.status >= 500) {
                errorMessage = 'Server error. Please try again later.';
            } else if (data.error) {
                errorMessage = data.error;
            }
            
            errorElement.textContent = errorMessage;
            errorElement.classList.remove('hidden');
            errorElement.style.padding = '16px';
        }
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'Connection error. Please check your internet connection and try again.';
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = 'Unable to connect to server. Please try again later.';
        }
        
        errorElement.textContent = errorMessage;
        errorElement.classList.remove('hidden');
        errorElement.style.padding = '16px';
    } finally {
        submitButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        submitButton.disabled = false;
        submitButton.style.backgroundColor = '';
    }
});

document.getElementById('registerFormElement').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorElement = document.getElementById('registerError');
    const submitButton = e.target.querySelector('button[type="submit"]');

    errorElement.textContent = '';
    errorElement.classList.add('hidden');

    if (password !== confirmPassword) {
        errorElement.textContent = 'Passwords do not match';
        errorElement.classList.remove('hidden');
        errorElement.style.padding = '16px';
        return;
    }

    if (password.length < 6) {
        errorElement.textContent = 'Password must be at least 6 characters long';
        errorElement.classList.remove('hidden');
        errorElement.style.padding = '16px';
        return;
    }

    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
    submitButton.disabled = true;

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('registerForm').classList.add('hidden');
            document.getElementById('loginForm').classList.remove('hidden');
        } else {
            let errorMessage = 'Registration failed';
            
            if (response.status === 409) {
                errorMessage = 'An account with this email already exists. Please use a different email or try logging in.';
            } else if (response.status === 400) {
                if (data.error && data.error.includes('email')) {
                    errorMessage = 'Please enter a valid email address';
                } else if (data.error && data.error.includes('password')) {
                    errorMessage = 'Password must be at least 6 characters long';
                } else if (data.error && data.error.includes('name')) {
                    errorMessage = 'Please enter your full name';
                } else {
                    errorMessage = data.error || 'Please check your information and try again';
                }
            } else if (response.status === 429) {
                errorMessage = 'Too many registration attempts. Please try again later.';
            } else if (response.status >= 500) {
                errorMessage = 'Server error. Please try again later.';
            } else if (data.error) {
                errorMessage = data.error;
            }
            
            errorElement.textContent = errorMessage;
            errorElement.classList.remove('hidden');
            errorElement.style.padding = '16px';
        }
    } catch (error) {
        console.error('Registration error:', error);
        let errorMessage = 'Connection error. Please check your internet connection and try again.';
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = 'Unable to connect to server. Please try again later.';
        }
        
        errorElement.textContent = errorMessage;
        errorElement.classList.remove('hidden');
        errorElement.style.padding = '16px';
    } finally {
        submitButton.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
        submitButton.disabled = false;
        submitButton.style.backgroundColor = '';
    }
});

window.showRegister = () => {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
    document.getElementById('loginError').classList.add('hidden');
    document.getElementById('registerError').classList.add('hidden');
};

window.showLogin = () => {
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('loginError').classList.add('hidden');
    document.getElementById('registerError').classList.add('hidden');
};

window.logout = () => {
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('userEmail');
    sessionStorage.removeItem('userName');
    window.location.reload();
};

window.showProfile = () => {
    const modal = document.getElementById('profileModal');
    const nameInput = document.getElementById('profileName');
    const emailInput = document.getElementById('profileEmail');
    
    nameInput.value = sessionStorage.getItem('userName') || 'User';
    emailInput.value = sessionStorage.getItem('userEmail') || '';
    modal.classList.remove('hidden');
};

window.closeProfileModal = () => {
    const modal = document.getElementById('profileModal');
    modal.classList.add('hidden');
};

window.goHome = (e) => {
    e.preventDefault();
    window.location.href = '/';
};

document.getElementById('gridViewBtn').addEventListener('click', () => {
    document.getElementById('filesGrid').classList.remove('list-view');
    document.getElementById('gridViewBtn').classList.add('active');
    document.getElementById('listViewBtn').classList.remove('active');
});

document.getElementById('listViewBtn').addEventListener('click', () => {
    document.getElementById('filesGrid').classList.add('list-view');
    document.getElementById('listViewBtn').classList.add('active');
    document.getElementById('gridViewBtn').classList.remove('active');
});

document.getElementById('fileInput').addEventListener('change', function() {
    const files = Array.from(this.files);
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadText = document.querySelector('.upload-text h3');
    const fileInput = document.getElementById('fileInput');
    
    if (files.length > 0) {
        uploadText.textContent = `${files.length} file(s) selected`;
        uploadBtn.disabled = false;
        uploadBtn.classList.remove('disabled');
    } else {
        uploadText.textContent = 'Drop files here or click to upload';
        uploadBtn.disabled = true;
        uploadBtn.classList.add('disabled');
        fileInput.value = '';
    }
});

document.getElementById('uploadArea').addEventListener('click', function() {
    document.getElementById('fileInput').click();
});

window.uploadFiles = async () => {
    const fileInput = document.getElementById('fileInput');
    const files = fileInput.files;
    const token = sessionStorage.getItem('authToken');
    const uploadText = document.querySelector('.upload-text h3');
    const uploadBtn = document.getElementById('uploadBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressPercent = document.getElementById('progressPercent');
    const progressText = document.getElementById('progressText');
    const originalText = uploadText.textContent;

    if (!token) return alert('Please login first');
    if (files.length === 0) return alert('Select files first');

    try {
        progressContainer.classList.remove('hidden');
        uploadText.textContent = 'Preparing upload...';

        const filesData = Array.from(files).map(file => ({
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream'
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
            throw new Error(errorData.error || `Initiate upload failed: ${initiateResponse.status}`);
        }

        const uploadData = await initiateResponse.json();

        const uploadPromises = uploadData.map(async (data, index) => {
            const file = files[index];
            progressText.textContent = `Uploading ${file.name}...`;
            progressPercent.textContent = '0%';
            progressFill.style.width = '0%';

            const s3Response = await fetch(data.uploadUrl, {
                method: 'PUT',
                body: file,
                headers: {
                    'Content-Type': file.type || 'application/octet-stream'
                }
            });

            if (!s3Response.ok) {
                const errorText = await s3Response.text();
                throw new Error(`S3 upload failed for ${file.name}: ${s3Response.status} ${errorText}`);
            }

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
                throw new Error(errorData.error || `Failed to complete upload for ${file.name}: ${completeResponse.status}`);
            }

            progressPercent.textContent = '100%';
            progressFill.style.width = '100%';
            return completeResponse.json();
        });

        await Promise.all(uploadPromises);

        fileInput.value = '';
        uploadText.textContent = 'Drop files here or click to upload';
        uploadBtn.disabled = true;
        uploadBtn.classList.add('disabled');
        progressContainer.classList.add('hidden');
        fileInput.dispatchEvent(new Event('change'));
        alert('Files uploaded successfully!');
        loadFiles();
    } catch (error) {
        console.error('Upload error:', error.message);
        alert(`Upload failed: ${error.message}`);
        uploadText.textContent = originalText;
        progressContainer.classList.add('hidden');
        fileInput.value = '';
        uploadBtn.disabled = true;
        uploadBtn.classList.add('disabled');
        fileInput.dispatchEvent(new Event('change'));
    }
};

async function loadFiles() {
    const token = sessionStorage.getItem('authToken');
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
        document.getElementById('filesGrid').innerHTML = '<div class="empty-state"><i class="fas fa-folder-open"></i><h3>No Files</h3><p>Upload files to get started</p></div>';
    }
}

function renderFiles(files) {
    const grid = document.getElementById('filesGrid');

    try {
        if (files.length === 0) {
            grid.innerHTML = '<div class="empty-state"><i class="fas fa-folder-open"></i><h3>No Files</h3><p>Upload files to get started</p></div>';
            return;
        }

        grid.innerHTML = files.map(file => `
            <div class="file-item" data-id="${file._id}" onclick="toggleSelectFile(this)">
                <div class="file-icon">${getFileIcon(file.type)}</div>
                <div class="file-info">
                    <div class="file-name" title="${file.name}">${file.name}</div>
                    <div class="file-details">
                        <span class="file-size">${formatFileSize(file.size)}</span>
                    </div>
                </div>
                <div class="file-actions">
                    ${file.isFolder ? 
                        `<button onclick="viewFolder('${file._id}'); event.stopPropagation();" class="icon-btn btn-folder" title="View Folder">
                            <i class="fas fa-folder-open"></i>
                        </button>` : ''}
                    <button onclick="downloadFile('${file._id}', '${file.name}'); event.stopPropagation();" class="icon-btn btn-download" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                    <button onclick="deleteFile('${file._id}'); event.stopPropagation();" class="icon-btn btn-delete" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to render files:', error);
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-folder-open"></i><h3>Error Rendering Files</h3><p>Unable to display files. Please try again.</p></div>';
    }
}

window.toggleSelectFile = (element) => {
    const fileItem = element.closest('.file-item');
    fileItem.classList.toggle('selected');
};

window.viewFolder = async (folderId) => {
    const token = sessionStorage.getItem('authToken');
    if (!token) return alert('Please login first');

    try {
        const response = await fetch(`/api/folders/${folderId}/contents`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const files = await response.json();
        renderFiles(files);
        document.getElementById('sectionTitle').innerHTML = `
            <i class="fas fa-folder"></i>
            <h2>Folder Contents</h2>
        `;
    } catch (error) {
        console.error('Failed to load folder contents', error);
        alert('Failed to load folder contents');
    }
};

window.downloadFile = async (fileId, fileName) => {
    const token = sessionStorage.getItem('authToken');
    if (!token) return alert('Please login first');

    const button = event.target.closest('.btn-download');
    const icon = button.querySelector('i');
    const originalClass = icon.className;
    
    icon.className = 'fas fa-spinner fa-spin';
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
        
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
            document.body.removeChild(link);
        }, 100);
        
        icon.className = 'fas fa-check';
        setTimeout(() => {
            icon.className = originalClass;
        }, 1000);
        
    } catch (error) {
        console.error('Download error:', error);
        alert(error.message || 'Download failed');
        icon.className = originalClass;
    } finally {
        button.disabled = false;
    }
};

window.deleteFile = async (fileId) => {
    if (!confirm('Delete this file permanently?')) return;
    
    const token = sessionStorage.getItem('authToken');
    if (!token) return alert('Please login first');

    const button = event.target.closest('.btn-delete');
    const icon = button.querySelector('i');
    const originalClass = icon.className;
    
    icon.className = 'fas fa-spinner fa-spin';
    button.disabled = true;

    try {
        const response = await fetch(`/api/files/${fileId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Delete failed');
        }
        
        icon.className = 'fas fa-check';
        setTimeout(() => {
            loadFiles();
        }, 500);
        
    } catch (error) {
        console.error('Delete error:', error);
        alert(error.message || 'Delete failed');
        icon.className = originalClass;
        button.disabled = false;
    }
};

function updateFileCount(count) {
    document.getElementById('fileCount').textContent = `${count} file${count !== 1 ? 's' : ''}`;
}

function getFileIcon(type) {
    if (!type) return '📃';
    if (type === 'folder') return '📁';
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

async function checkServerHealth() {
    try {
        await fetch('/api/health');
    } catch (error) {
        console.error('Health check failed:', error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await checkServerHealth();
    const token = sessionStorage.getItem('authToken');
    const userEmail = sessionStorage.getItem('userEmail');
    const userName = sessionStorage.getItem('userName');
    
    if (token) {
        document.getElementById('authContainer').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        
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
        document.querySelector('.upload-text h3').textContent = 
            files.length > 0 ? `${files.length} file(s) selected` : 'Drop files here or click to upload';
        document.getElementById('uploadBtn').disabled = files.length === 0;
    });
}
