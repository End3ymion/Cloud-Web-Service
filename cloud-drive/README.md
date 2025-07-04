---

# CloudDrive – AWS S3 File Storage

Secure cloud file storage with user authentication and AWS S3 integration.

---

## Features

* JWT authentication
* File uploads, downloads (pre-signed URLs), deletion
* AWS S3 storage
* User-specific file isolation
* Responsive web interface

---

## Prerequisites

Got it. Here’s the updated **Prerequisites** section including **Amazon Linux** setup with the proper MongoDB repo import and install commands, along with Arch and Ubuntu/Debian:

---

## Prerequisites

### Amazon Linux 2

```bash
sudo yum update -y
# Import MongoDB GPG key for 6.0 (adjust for 7.0 if needed)
sudo rpm --import https://pgp.mongodb.com/server-6.0.asc

# Add MongoDB repo
echo "[mongodb-org-6.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/amazon/2/mongodb-org/6.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://pgp.mongodb.com/server-6.0.asc" | sudo tee /etc/yum.repos.d/mongodb-org-6.0.repo

# Install mongosh client only
sudo yum install -y mongodb-mongosh

sudo yum install -y gcc-c++ make nodejs git
```

### Arch Linux

```bash
sudo pacman -S nodejs npm
yay -S mongodb-bin mongosh-bin
```

### Ubuntu / Debian

```bash
sudo apt-get install -y nodejs npm
sudo apt-get install -y mongodb-org
```

---

## AWS S3 Setup

### 1. Create S3 Bucket

```bash
aws s3 mb s3://your-bucket-name
```

### 2. Configure CORS

Create `cors.json`:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag", "x-amz-meta-custom-header"],
    "MaxAgeSeconds": 3000
  }
]
```

Apply it:

```bash
aws s3api put-bucket-cors \
  --bucket your-bucket-name \
  --cors-configuration file://cors.json
```

---

## Database Setup Options

Choose **one**:

---

### Option 1 – Local MongoDB

1. Start MongoDB:

```bash
sudo systemctl start mongodb
```

2. Test connection:

```bash
mongosh
```

3. Example `.env` MongoDB URI:

```
MONGODB_URI=mongodb://localhost:27017/clouddrive
```

---

### Option 2 – AWS DocumentDB

> **Note:** If using DocumentDB, you **must replace** `MONGODB_URI` in `.env`.

1. **Download the DocumentDB TLS certificate:**

```bash
wget https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
```

2. **Test shell connection:**

```bash
mongosh "mongodb://<insertYourUsername>@mongodb.cluster-cpe4wk80efuk.ap-southeast-1.docdb.amazonaws.com:27017/?tls=true&retryWrites=false" \
  --tls \
  --tlsCAFile global-bundle.pem \
  --username <insertYourUsername> \
  --password <insertYourPassword>
```

3. **Example connection URI (for `.env`):**

```
MONGODB_URI=mongodb://<insertYourUsername>:<insertYourPassword>@mongodb.cluster-cpe4wk80efuk.ap-southeast-1.docdb.amazonaws.com:27017/?tls=true&tlsCAFile=global-bundle.pem&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false
```

**Important:**

* Replace `<insertYourUsername>` and `<insertYourPassword>` with your actual username/password.
* If you saved the certificate elsewhere, adjust `tlsCAFile` path accordingly.

---

## Application Setup

### 1. Clone and Install

```bash
git clone https://github.com/End3ymion/clouddrive.git
cd clouddrive
npm install
```

---

### 2. Configure `.env`

Create `.env` in the project root:

```env
# MongoDB URI
# Use this for local MongoDB:
# MONGODB_URI=mongodb://localhost:27017/clouddrive

# Or this for DocumentDB (replace credentials accordingly):
# MONGODB_URI=mongodb://endy:<insertYourPassword>@mongodb.cluster-cpe4wk80efuk.ap-southeast-1.docdb.amazonaws.com:27017/?tls=true&tlsCAFile=global-bundle.pem&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false

# JWT Secret
JWT_SECRET=your-secure-jwt-secret

# AWS
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_BUCKET_NAME=your-bucket-name

# Server Port
# Use 3000 (default) or 80 for HTTP
PORT=3000
```

**Note:**
If you set `PORT=80`, you may need `sudo node server.js` to bind to port 80.

---

### 3. Start the Server

```bash
node server.js
```

---

## Access

* Port 3000: `http://localhost:3000`
* Port 80: `http://localhost`

---
Sure—here’s the **short and concise** version with only commands and essential notes:

---

## Run as systemd Service

### 1. Create the service file

```bash
sudo nano /etc/systemd/system/clouddrive.service
```

Paste:

```ini
[Unit]
Description=Cloud Drive Node.js Server
After=network.target

[Service]
User=ec2-user
WorkingDirectory=/home/ec2-user/Cloud-Web-Service/cloud-drive
ExecStart=/usr/bin/node /home/ec2-user/Cloud-Web-Service/cloud-drive/server.js
Restart=always
EnvironmentFile=/home/ec2-user/Cloud-Web-Service/cloud-drive/.env
Environment=PATH=/usr/bin:/usr/local/bin
Environment=NODE_ENV=production

# Allow binding to port 80 without root:
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

> **Note:** Adjust paths and `User=` as needed.

---

### 2. Reload systemd

```bash
sudo systemctl daemon-reload
```

---

### 3. Enable and start

```bash
sudo systemctl enable clouddrive
sudo systemctl start clouddrive
```

---

### 4. Check status and logs

```bash
sudo systemctl status clouddrive
journalctl -u clouddrive -f
```

---

## Troubleshooting

**MongoDB/DocumentDB Connection Issues**

* Local: check with `systemctl status mongodb`
* DocumentDB: ensure security group allows inbound traffic
* Double-check TLS certificate and credentials
* Confirm connection string format

**S3 Errors**

* Validate credentials
* Confirm bucket exists
* Check IAM permissions (`s3:PutObject`, `s3:GetObject`, etc.)

**CORS Errors**

* Reapply CORS policy
* Verify region and bucket name

---

## Project Structure

```
clouddrive/
├── server.js          # Backend server
├── script.js          # Client-side JavaScript
├── index.html         # Web interface
├── .env               # Environment config
├── package.json       # Dependencies
```

---
