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




---

## 🔗 API Endpoints (v1)

### 🔐 Authentication

```http
POST   /api/v1/auth/register     # Register new user
POST   /api/v1/auth/login        # Login user
POST   /api/v1/auth/logout       # Logout user
POST   /api/v1/auth/refresh      # Refresh access token
GET    /api/v1/auth/me           # Get logged-in user
```

### 📹 Videos

```http
GET    /api/v1/videos            # Get all published videos (paginated)
POST   /api/v1/videos            # Upload new video (auth required)
GET    /api/v1/videos/:videoId   # Get single video
PUT    /api/v1/videos/:videoId   # Update video (owner only)
DELETE /api/v1/videos/:videoId   # Delete video (owner only)
```

### 📊 Query Parameters (Videos)

```http
GET /api/v1/videos?page=1&limit=10&sort=views
```

| Param | Description     |
| ----- | --------------- |
| page  | Page number     |
| limit | Videos per page |
| sort  | views / latest  |





