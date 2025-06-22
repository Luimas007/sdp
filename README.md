# 🎒 BUP Lost-Found Bulletin

A simple Node.js-powered authentication system for managing lost & found reports within BUP.

---

## 🚀 Getting Started

Follow the steps below to run the project locally:

---

### ✅ Prerequisites

- [Node.js](https://nodejs.org/) must be installed  
- Use **MongoDB Atlas** _or_ install **MongoDB locally**

---

### 📦 Installation Steps

1. **Clone the repository** (or download the source)

2. **Set up MongoDB**

   - **Option A**: Use a **MongoDB Atlas** connection string  
   - **Option B**: Install **MongoDB locally**, then ensure it's running  
   - Replace the default MongoDB URL in your `.env` file like so:

     ```env
     MONGO_URI=your_mongodb_connection_string_here
     ```

3. **Install dependencies**

   ```bash
   npm install
   ```

4. **Run the server**

   ```bash
   node server.js
   ```

> 💡 All commands must be run from the **project root directory**.

---

### 🛠 Common Issues

If MongoDB connection fails while using **local MongoDB**, open **PowerShell as Administrator** and run:

```powershell
net start MongoDB
```

---

### 📨 Need Help?

If you're still having issues running the project, feel free to reach out:

📬 **samisiddique0@gmail.com**

---

### 📁 Project Structure

```
project-root/
│
├── server.js
├── .env
├── package.json
└── ...
```

---

### ✅ You're all set!

Now go ahead and build out your **Lost & Found** platform 🚀


---

### 🌐 Live Project (Localhost)

Once the server is running, open your browser and visit:

👉 [http://localhost:5000](http://localhost:5000)

This is where the BUP Lost-Found Bulletin will be accessible locally.

