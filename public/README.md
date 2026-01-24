# TubeX Backend API

This is the backend API for **TubeX**, a modern video sharing platform. The backend is built with Node.js, Express, and MongoDB.

## 🚀 Project Status
**Current State**: `In Development`
**Focus**: User Authentication & Profile Management

The project currently implements a robust user authentication system and profile management features. Video management features are planned for the next phase.

## ✅ Completed Features

### 🔐 Authentication & Security
- [x] **User Registration**: `POST /api/v1.0/auth/register` (Supports Avatar & Cover Image upload)
- [x] **User Login**: `POST /api/v1.0/auth/login` (Secure flow with Access/Refresh Tokens)
- [x] **User Logout**: `POST /api/v1.0/auth/logout` (Secure Cookie clearing)
- [x] **Refresh Token**: `POST /api/v1.0/auth/refresh-token` (Auto-refresh accessToken)
- [x] **Google OAuth**: Integrated Passport Google Strategy
- [x] **Password Management**:
    - Change Password (Secure hash validation)
    - Password Hashing (Bcrypt)

### 👤 User Profile Management
- [x] **Get Current User**: Retrieve logged-in user details.
- [x] **Update Account Details**:
    - Update Full Name
    - Update Email
    - Update Username
- [x] **Update Avatar**: Upload and update profile picture (Cloudinary).
- [x] **Update Cover Image**: Upload and update channel banner (Cloudinary).
- [x] **Channel Profile**: View any user's public channel profile (Subscribers count, etc.).
- [x] **Watch History**: Retrieve user's watch history.

## 🚧 Upcoming Features (To-Do)
- [ ] **Video Management**: Upload, Edit, Delete Videos.
- [ ] **Like/Dislike System**: Toggle likes on videos.
- [ ] **Comments System**: Add/Edit/Delete comments.
- [ ] **Subscription System**: Subscribe/Unsubscribe logic (Partially implemented in Model).
- [ ] **Playlists**: Create and manage playlists.
- [ ] **Search & Filter**: Advanced video search.

## 🛠 Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Authentication**: JWT, Passport.js (Google OAuth)
- **File Storage**: Cloudinary (Multer for upload handling)
- **Utils**: AsyncHandler, ApiError, ApiResponse (Standardized Error Handling)
