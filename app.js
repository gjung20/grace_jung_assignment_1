require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');

const saltRounds = 12;

const port = process.env.PORT || 3000;

const app = express();

const Joi = require("joi");

const expireTime = 24 * 60 * 60 * 1000; //expires after 1 day  (hours * minutes * seconds * millis)

/* secret information section */
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;

const node_session_secret = process.env.NODE_SESSION_SECRET;
/* END secret section */

app.use(session({
    secret: 'secret123',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    }
  }));  

// Connect to MongoDB
module.exports = async () => {
    try {
        await mongoose.connect(process.env.DB_URL, {});
        console.log("CONNECTED TO DATABASE SUCCESSFULLY");
    } catch (error) {
        console.error('COULD NOT CONNECT TO DATABASE:', error.message);
    }
};

// Home Page
app.get('/', (req, res) => {
  const user = req.session.user;
  res.render('home', { user });
});

// Sign up page
app.post('./signup', async (req, res) => {
    const { name, email, password } = req.body;
  
    const existing = await User.findOne({ email });
    if (existing) return res.send('User already exists');
  
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const user = await User.create({ name, email, password: hashedPassword });
  
    req.session.user = user;
    res.redirect('/');
  });  

// Handle sign up
app.post('./signup', async (req, res) => {
  const { name, email, password } = req.body;
  const existing = await User.findOne({ email });
  if (existing) return res.send('User already exists');
  const user = await User.create({ name, email, password });
  req.session.user = user;
  res.redirect('/');
});

// Login page
app.post('./login', async (req, res) => {
    const { email, password } = req.body;
  
    const user = await User.findOne({ email });
    if (!user) return res.send('Invalid email or password');
  
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return res.send('Invalid email or password');
  
    req.session.user = user;
    res.redirect('/');
  });

// Handle login
app.post('./login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email, password });
  if (!user) return res.send('Invalid credentials');
  req.session.user = user;
  res.redirect('/');
});

// Logout
app.get('./logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Start server
app.listen(3000, () => console.log('Server running on http://localhost:3000'));

// Checks if the user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.user) {
      return next();
    } else {
      res.redirect('./login');
    }
  }
  
  // If the user is an authenticated member
  // they will be taken to the members page
  app.get('./members', isAuthenticated, (req, res) => {
    res.render('members', { user: req.session.user });
  });