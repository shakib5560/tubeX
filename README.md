# TubeX

An open-source backend REST API for a video sharing platform, built with Node.js, Express, and MongoDB.

## Features

- **Video Management**: Upload, view, and manage videos
- **User Authentication**: Secure user registration and login system
- **Modern Tech Stack**: Built with the latest JavaScript (ESM modules)
- **Database**: MongoDB with Mongoose ODM
- **Environment Configuration**: Easy configuration using environment variables

## API Endpoints

### Authentication

```http
POST /api/auth/register
POST /api/auth/login
```

### Videos

```http
GET    /api/videos          # Get all videos
POST   /api/videos          # Upload a new video
GET    /api/videos/:id      # Get video by ID
PUT    /api/videos/:id      # Update video
DELETE /api/videos/:id      # Delete video
```

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or remote instance)
- npm or yarn

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/tubex.git
   cd tubex
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create a `.env` file in the root directory and add your environment variables:
   ```

   PORT=8000
   DB_URL=mongodb+srv://tubeX:<DB_PASSWORD>@tubex.bhmza1s.mongodb.net/
   CLIENT_URL=http://localhost:3000
   LIMIT=16kb
   JWT_SECRET=snl
   ACCESS_TOKEN_EXPIRY=1d
   REFRESH_TOKEN_SECRET=snl2
   REFRESH_TOKEN_EXPIRY=7d


   CLOUD_NAME=dlxyiewtr
   API_KEY=*****
   API_SECRET=****
   API_ENV_VER=CLOUDINARY_URL=cloudinary://*****5698221946:******@dlxyiewtr
   
   # Add other environment variables as needed
   ```

4. Start the development server:
   ```bash
   npm start
   # or
   yarn start
   ```

5. The API will be available at `http://localhost:3000`

## Project Structure

```
tubex/
├── config/           # Configuration files
│   └── db.js        # Database connection
├── controllers/      # Request handlers
├── middlewares/      # Custom middleware
├── models/           # Database models
├── routes/           # Route definitions
├── utils/            # Utility functions
├── app.js            # Main application file
├── package.json      # Project dependencies
└── .env              # Environment variables
```

## Available Scripts

- `npm start`: Start the application in production mode
- `npm run dev`: Start the application in development mode with nodemon
- `npm test`: Run tests (if any)

## Technologies Used

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **Environment Management**: dotenv

## Using Middleware

1. dotenv
2. cookie-parser
3. express
4. cors
5. multer

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue in the GitHub repository.
