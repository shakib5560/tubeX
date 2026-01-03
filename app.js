import createError from 'http-errors';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import { fileURLToPath } from 'url';
import connectDB from "./config/db.js";
import cors from "cors";


// constants
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });


// __dirname fix (ESM এ নেই)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express(
    {limit: process.env.LIMIT}
);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// middleware
app.use(cors(
    {
        origin: process.env.CLIENT_URL,
        credentials: true
    }
));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false, limit: process.env.LIMIT }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


// routes

// home route
app.get("/", (req, res) => {
    res.sendFile(path.resolve("public/index.html"));
});
// users route
import usersRoutes from "./routes/users.routes.js";
app.use('/api/v1.0/auth', usersRoutes);


// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
});

// error handler
app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error');
});

const startServer = async () => {
  try {
    await connectDB(); // wait for DB connection

    // app.listen(process.env.PORT || 3000, () => {
    //   console.log(`🚀 Server running on port ${process.env.PORT || 3000}`);
    // });

  } catch (error) {
    console.error("❌ DB connection failed", error);
    process.exit(1); // stop the app if DB fails
  }
};

startServer();
export default app;
