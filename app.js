const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const nocache = require("nocache")
const flash = require('express-flash');

const db = require('./config/db');
const mongoose = require('mongoose');

const cookieParser = require('cookie-parser');

app.use(bodyParser.urlencoded({ extended: true }) );
app.use(flash()); 
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());



// Load environment variables from .env file
require('dotenv').config();

// Middleware
// app.use(express.static(path.join(__dirname, 'views', 'evara-frontend'))); // Serve static files from the 'evara-frontend' directory
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'))

app.use((req, res, next) => {
    res.header('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
    next();
});

// Configure session middleware with a secret key
app.use(
    session({
        secret: process.env.SESSION_SECRET, // Use a secret key from environment variables
        resave: false,
        saveUninitialized: true,
        cookie: {
            maxAge: 72 * 60 * 60 * 1000,
            httpOnly: true
        }
    })
);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, "public")))

// Define routes
// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, 'views', 'evara-backend', 'index.html'));
// });
const userRoute = require("./routers/userRouter")
const adminRoutes = require("./routers/adminRouter")
app.use('/', userRoute);
app.use("/admin", adminRoutes)
// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
