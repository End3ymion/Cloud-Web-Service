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
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MongoDB
sudo apt-get install -y mongodb-org
```

## Setup Instructions

### 1. Clone and install dependencies

```bash
git clone https://github.com/yourusername/clouddrive.git
cd clouddrive
npm install
```

### 2. Start MongoDB
*(in a separate terminal)*

```bash
mkdir mongodb_data
mongod --dbpath ./mongodb_data
```

### 3. Run the application

```bash
node server.js
```

**Access the application at:** http://localhost:3000

## Maintenance

### To reset the database

```bash
rm -rf mongodb_data/
mkdir mongodb_data
```

### To stop the application

1. Press `Ctrl+C` in both terminals (Node and MongoDB)
2. For Arch system MongoDB: `sudo systemctl stop mongodb`
