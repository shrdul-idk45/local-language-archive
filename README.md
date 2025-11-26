# 🌍 Local Language Archive  
A modern, crowd-sourced platform to collect, explore, and preserve local words, dialects, pronunciations, and regional expressions — enhanced with AI.

---

## ✨ What this project is about

Languages carry culture.  
Every region, every village, every community has unique words, accents, slang, and expressions that often don’t appear in traditional dictionaries.

**Local Language Archive** is a full-stack project built to preserve that richness.

It lets people:

- Add words from any language  
- Upload or record their pronunciation  
- Provide meanings & real usage examples  
- Mark tags, regions, and dialects  
- Explore entries created by others  
- Vote, rate, comment, and save favourites  
- Use AI to auto-generate meanings & examples  
- Enjoy a beautiful, modern, glass-morphism UI in light/dark mode  

The result is a **living, growing, community-powered dictionary**.

---

## 🚀 Features At a Glance

### 📝 Word Entries
- Add/edit/delete entries  
- Meaning, example, tags  
- Category selection  
- Region, latitude, longitude (for dialect mapping)  

### 🔊 Pronunciation
- Upload audio  
- Record directly from browser  
- Clean inline audio player  

### 🤖 AI Enhancements
- Auto-suggest meaning  
- Auto-suggest example sentence  
- Generate additional sample sentences  

### ⭐ User Interactions
- Upvote & remove vote  
- Rate 1–5 stars  
- Add comments  
- Share entries via public links  
- Save to favourites  
- Recently viewed list  

### 🎨 UI & Theme
- Smooth glass-morphism cards  
- Gradient hero banner  
- Background image with vignette  
- Fully responsive  
- Light & Dark themes  

### 🔐 Authentication
- Register/Login  
- JWT-based auth  
- Protected routes  

### 🧰 Developer-Friendly
- Clean architecture  
- SQLite backend  
- Multer uploads  
- OpenAI integration  
- Simple environment config  

---

## 🧩 Tech Stack

**Frontend**  
React • Vite • TailwindCSS • Browser Media APIs • LocalStorage • Context/Reducers

**Backend**  
Node.js • Express • SQLite (better-sqlite3) • JWT • Multer • OpenAI API

---

## 📦 Folder Structure

local-language-archive/
│
├── backend/
│ ├── index.js
│ ├── db.sqlite
│ ├── uploads/
│ ├── .env.example
│ └── ...
│
├── frontend/
│ ├── src/
│ ├── public/
│ ├── .env.example
│ └── ...
│
└── README.md


---

## 🔧 Installation & Setup

### 1️⃣ Clone the repo

```bash
git clone https://github.com/shrdul-idk45/local-language-archive.git
cd local-language-archive

cd backend
npm install

OPENAI_API_KEY=your_openai_key_here
JWT_SECRET=your_secret_here

npm run dev

http://localhost:4000

cd ../frontend
npm install

VITE_API_BASE=http://localhost:4000

npm run dev

http://localhost:5173

API Outline

POST /auth/register  
POST /auth/login

GET    /entries
POST   /entries
PUT    /entries/:id
DELETE /entries/:id

POST /entries/:id/upvote
POST /entries/:id/unupvote
POST /entries/:id/rate

POST /entries/:id/comments
GET  /entries/:id/comments

POST /ai/suggest
POST /ai/sentences

@ Future Possibilities

These would make the project even more impressive:
Interactive dialect map
User profiles + badges
Leaderboards
Translation features
Multi-language UI (Marathi, Hindi, Tamil, Bengali, etc.)
Offline PWA support
Export/import user data

🤝 Contributing

Contributions, ideas, and improvements are welcome!
Feel free to open an issue or PR.

🧑‍💻 Author

Shardul Chavanke
GitHub: https://github.com/shrdul-idk45



