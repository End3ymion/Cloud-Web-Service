# CloudDrive - Local File Storage

A simple local file storage application with web interface.

## Prerequisites Installation

### 🐧 Arch Linux

```bash
# Install Node.js and npm
sudo pacman -S nodejs npm

# Install MongoDB
yay -S mongodb-bin mongosh-bin  # or use official package
```

### 🖥️ Ubuntu/Debian

```bash
# Install Node.js and npm
sudo apt-get install -y nodejs

# Install MongoDB
sudo apt-get install -y mongodb-org
```

## Setup Instructions

### 1. Clone and install dependencies

```bash
git clone https://github.com/End3ymion/clouddrive.git
cd clouddrive
npm install
```

### 2. Start MongoDB
*(in a separate terminal)*

```bash
mkdir mongodb_data
systemctl start mongodb
```

### 3. Run the application

```bash
node server.js
```

**Access the application at:** http://localhost:3000


