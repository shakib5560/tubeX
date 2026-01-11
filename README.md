# 🎥 TubeX Backend API

An open-source, scalable **REST API backend** for a video-sharing platform — inspired by YouTube — built with **Node.js, Express, and MongoDB**.

> 🚀 Designed for performance, security, and real-world production use.

---

## ✨ Features

- 🔐 **JWT Authentication** (Access & Refresh Tokens)
- 📹 **Video Upload & Management**
- 👤 **User Registration & Login**
- ☁️ **Cloudinary Integration** for media storage
- 📄 **Pagination & Aggregation Support**
- 🌱 **Modern ESM-based Node.js architecture**
- 🧩 Clean MVC folder structure

---

## 🧠 Tech Stack

| Layer        | Technology |
|-------------|------------|
| Backend     | Node.js, Express.js |
| Database    | MongoDB + Mongoose |
| Auth        | JWT, Cookies |
| File Upload| Multer |
| Media       | Cloudinary |
| Config      | dotenv |

---

## 📂 Project Structure


tubex/
├── src/
│ ├── config/ # DB, cloudinary config
│ ├── controllers/ # Route logic
│ ├── middlewares/ # Auth, error handlers
│ ├── models/ # Mongoose schemas
│ ├── routes/ # API routes
│ ├── utils/ # Helpers (JWT, asyncHandler)
│ ├── app.js # Express app
│ └── server.js # Server entry
├── .env.example
├── package.json
└── README.md



