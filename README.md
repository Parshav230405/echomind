# 🎙️ EchoMind - AI Meeting Assistant MVP

EchoMind is a developer-friendly, beautiful, and fully featured AI Meeting Assistant. Upload audio recordings of meetings to transcribe speech with Groq Whisper, extract structured TL;DR summaries, key decisions, action-item checklists, and chat directly with your meeting transcript using a context-aware chatbot.

Designed for simplicity, readability, and ease of debugging, it keeps file fragmentation low and makes setup effortless.

---

## 🛠️ Tech Stack
- **Frontend**: React (Vite) + Tailwind CSS + Framer Motion (Animations) + Lucide Icons
- **Backend**: Node.js + Express
- **Database**: MySQL (using `mysql2` connection pool)
- **AI Integrations**: Groq Whisper API (`whisper-large-v3`) & LLaMA 3.3 (`llama-3.3-70b-versatile`)

---

## 🚀 Getting Started

### 📋 Prerequisites
1. **Node.js** (v18 or higher recommended)
2. **MySQL Server** (running locally or remotely)
3. **Groq API Key** (with credits to run transcriptions and chat requests)

---

### 📂 Setup Instructions

#### Step 1: Initialize the MySQL Database
Create the database and schema. Run the following command in your MySQL terminal (or import `schema.sql` inside tools like phpMyAdmin, MySQL Workbench, or DBeaver):

```bash
mysql -u root -p < schema.sql
```
*Note: This creates the database `echomind` and the three necessary tables: `users`, `meetings`, and `chats`.*

#### Step 2: Configure Environment Variables
Open the `.env` file in the root directory (created automatically) and fill in your credentials:

```ini
# MySQL Database Configs
DB_USER=root
DB_PASSWORD=your_mysql_password   # Add your MySQL password here
DB_NAME=echomind

# Groq API Config
GROQ_API_KEY=your_groq_api_key_here  # Add your Groq API key
```

#### Step 3: Install Dependencies
Since we are using **npm workspaces**, you can install all backend, frontend, and root-level dependencies with a single command from the root directory:

```bash
npm install
```

#### Step 4: Run the Development Servers
Launch both the Express backend API and the Vite React frontend client concurrently by running:

```bash
npm run dev
```

Your browser should automatically open the interface at **`http://localhost:3000`** (the Vite proxy is configured to route all `/api` requests to the Express server running on port `5000` automatically).

---

## 📁 Key Files Reference

### Backend (`server/`)
- [server.js](file:///c:/Users/Dell/Desktop/echomind/server/server.js): Main API routing hub (Auth, uploads, Whisper & LLM calls, chats).
- [db.js](file:///c:/Users/Dell/Desktop/echomind/server/db.js): Promise-based MySQL pool configuration with automatic error/startup diagnostics.

### Frontend (`client/`)
- [App.jsx](file:///c:/Users/Dell/Desktop/echomind/client/src/App.jsx): Main coordinator; runs page routing based on auth state.
- [AuthContext.jsx](file:///c:/Users/Dell/Desktop/echomind/client/src/context/AuthContext.jsx): Stores session tokens, profiles, and provides the `apiFetch` wrapper.
- [Auth.jsx](file:///c:/Users/Dell/Desktop/echomind/client/src/pages/Auth.jsx): Login and signup screens combined.
- [Dashboard.jsx](file:///c:/Users/Dell/Desktop/echomind/client/src/pages/Dashboard.jsx): Metrics summary, drag-and-drop audio uploader, and meeting list feed.
- [Meeting.jsx](file:///c:/Users/Dell/Desktop/echomind/client/src/pages/Meeting.jsx): Highlights tab views (Summary, Actions checklist, Decisions, Transcript) and includes the Meeting Chat panel.

---

## 🛠️ Troubleshooting & Debugging

- **Database Connection Failure**: The terminal running the backend will output a massive, readable error box highlighting exactly what parameter is incorrect (e.g. Host, user, password, port) if the database fails to link.
- **Audio Upload size error**: The frontend validates audio files *before* uploading to prevent massive wait times, alerting users if they exceed the 25MB limit allowed by Groq's Whisper API.
- **Unauthorized API responses**: If user sessions expire, the `apiFetch` helper automatically intercepts `401` or `403` status codes and logs the user out to a clean sign-in screen, preventing runtime crashes.
