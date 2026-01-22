# 🎥 TubeX Backend API

An open-source, scalable **REST API backend** for a video-sharing platform — inspired by YouTube — built with **Node.js, Express, and MongoDB**.

> 🚀 Designed for performance, security, and real-world production use.

---

## ✨ Features

- 🔐 **Authentication**: 
  - JWT (Access & Refresh Tokens)
  - Google OAuth 2.0 Integration (Passport.js)
- 📹 **Media Management**:
  - Image processing with **Sharp**
  - Cloudinary integration for cloud storage
  - File uploads with **Multer**
- 👤 **User Management**:
  - Registration, Login, and Logout
  - Avatar and Cover Image support
- 📄 **Advanced Database Operations**:
  - Mongoose Aggregate Paginate v2 for efficient queries
  - Clean MVC (Model-View-Controller) architecture
- 🌱 **Modern Tech**:
  - ESM-based Node.js architecture
  - Prettier for consistent code formatting

---

## 🧠 Tech Stack

| Layer        | Technology |
|-------------|------------|
| Backend     | Node.js, Express.js |
| Database    | MongoDB + Mongoose |
| Auth        | JWT, Passport.js (Google), Cookies |
| File Upload | Multer |
| Image Proc  | Sharp |
| Media Store | Cloudinary |
| Formatting  | Prettier |

---

## 📂 Project Structure

```text
tubex/
├── bin/                # Server entry point (www)
├── config/             # DB, Cloudinary, and Passport configs
├── controllers/        # Request handling logic
├── middleware/         # Auth, Multer, etc.
├── models/             # Mongoose schemas
├── public/             # Static assets
├── routes/             # API route definitions
├── utils/              # Helper functions (ApiError, ApiResponse, etc.)
├── views/              # View templates (Pug)
├── app.js              # Express app configuration
├── constants.js        # Global constants
├── .env.sample         # Template for environment variables
├── .prettierrc         # Prettier configuration
├── package.json        # Dependencies and scripts
└── README.md           # Project documentation
```

---

## 🔗 API Endpoints (v1.0)

### 🔐 Authentication (`/api/v1.0/auth`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST   | `/register` | Register new user (with Avatar/Cover) | Public |
| POST   | `/login` | Login user | Public |
| POST   | `/logout` | Logout user (Clear tokens) | Private |
| POST   | `/refresh-token` | Refresh Access Token | Public |
| GET    | `/google` | Google OAuth Login | Public |
| GET    | `/google/callback` | Google OAuth Callback | Public |

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory and populate it with the following:

```env
PORT=8000
DB_URL=your_mongodb_connection_string

CLIENT_URL=http://localhost:5173

JWT_SECRET=your_access_token_secret
ACCESS_TOKEN_EXPIRY=1d

REFRESH_TOKEN_SECRET=your_refresh_token_secret
REFRESH_TOKEN_EXPIRY=10d

CLOUD_NAME=your_cloudinary_name
API_KEY=your_cloudinary_api_key
API_SECRET=your_cloudinary_api_secret

LIMIT=16kb
```

---

## 🚀 Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/shakib5560/tubeX.git
   cd tubeX
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Modify the `.env` file as shown above.

4. **Run the server**:
   ```bash
   # Development mode (requires dotenv/config and ESM support)
   npm start
   ```

---

## 📜 License

This project is open-source. Feel free to use and contribute!
