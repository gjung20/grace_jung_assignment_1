require('dotenv').config();
require("./utils.js");

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const { connectToDatabase } = require('./databaseConnection');
const Joi = require('joi');
const bcrypt = require('bcrypt');
const MongoStore = require('connect-mongo');
const { ObjectId } = require('mongodb');

const saltRounds = 10;

const port = process.env.PORT || 3000;

const app = express();
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

/* secret information section */
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;
/* END secret section */

// Initialize variables
let db, usersCollection;

// Session middleware
app.use(session({
  secret: node_session_secret || 'fallback_secret', // Added fallback
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/${mongodb_database}?retryWrites=true&w=majority`,
    crypto: { 
      secret: mongodb_session_secret || 'fallback_crypto_secret'
    },
    ttl: 60 * 60 // 1 hour
  }),
  cookie: { maxAge: 3600000 }
}));

app.set('view engine', 'ejs');

// Basic route that works before DB connection
app.get('/', (req, res) => {
  const user = req.session.user;
  res.render('home', { 
    user: user || null,
    isAdmin: user && user.type === 'admin'
  });
});

connectToDatabase().then(database => {
  db = database;
  usersCollection = db.collection('users');

  console.log('Successfully connected to MongoDB');

  // Authentication middleware
  function isAuthenticated(req, res, next) {
    if (req.session.user) return next();
    res.redirect('/login');
  }
  
  function isAdmin(req, res, next) {
    if (!req.session.user) return res.redirect('/login');
    if (req.session.user.type !== 'admin') return res.status(403).send('Not authorized');
    next();
  }

  // Validation schemas
  const schema = Joi.object({
    name: Joi.string().max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(100).required()
  });

  const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(100).required()
  });

  const adminSchema = Joi.object({
    userId: Joi.string().required(),
    action: Joi.string().valid('promote', 'demote').required()
  });  

  // Routes
  app.get('/signup', (req, res) => res.render('signup'));

  app.post('/signup', async (req, res) => {
    const { name, email, password,type } = req.body;
  
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).send("Invalid input: " + error.details[0].message);
    }
  
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) return res.send('User already exists');
  
    const hashedPassword = await bcrypt.hash(password, saltRounds);
  
    const newUser = {
      name,
      email,
      password: hashedPassword,
      type: 'user' // Add default user type
    };
  
    await usersCollection.insertOne(newUser);
    req.session.user = { name: newUser.name, email: newUser.email }; // Don't store hashed password in session
  
    res.redirect('/');
  });  

  app.get('/login', (req, res) => {
    // Pass an empty error initially
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    const { error } = loginSchema.validate(req.body);
    if (error) {
        return res.render('login', { 
            error: "Invalid input format. Please check your email and password." 
        });
    }

    const user = await usersCollection.findOne({ email });
    if (!user) {
        return res.render('login', { 
            error: "Invalid email/password combination" 
        });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
        return res.render('login', { 
            error: "Invalid email/password combination" 
        });
    }
    req.session.user = { 
      _id: user._id, // Important for admin checks
      name: user.name, 
      email: user.email,
      type: user.type || 'user' // Include user type in session
    };
    res.redirect('/');


}); 

  app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
  });

  app.get('/members', isAuthenticated, (req, res) => {
    const images = [
      { src: 'cutie1.jpg', alt: 'Cute cat 1', title: 'Fluffy' },
      { src: 'cutie2.jpg', alt: 'Cute cat 2', title: 'Whiskers' },
      { src: 'cutie3.jpg', alt: 'Cute cat 3', title: 'Mittens' },
      // Add more images as needed
    ];
    
    res.render('members', {
      user: req.session.user,
      images: images // Pass all images instead of random one
    });
  });

  // Admin Page
  app.get('/admin', isAdmin, async (req, res) => {
    try {
      const users = await usersCollection.find({}, { projection: { password: 0 } }).toArray();
      res.render('admin', { 
        users: users,
        currentUser: req.session.user
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });
  
  app.post('/admin/update-user', isAdmin, async (req, res) => {
    try {
      const { error } = adminSchema.validate(req.body);
      if (error) return res.status(400).send('Invalid request');
  
      const { userId, action } = req.body;
      
      // Prevent self-demotion
      if (action === 'demote' && userId === req.session.user._id.toString()) {
        return res.status(400).send('Cannot demote yourself');
      }
  
      const newType = action === 'promote' ? 'admin' : 'user';
      await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { type: newType } }
      );
  
      res.redirect('/admin');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  // 404 handler - must be inside the .then() block
  app.use(function (req, res) {
    res.status(404).render('404');
  });

  app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
  });
}).catch(err => {
  console.error("Failed to connect to MongoDB:", err);
  // You might want to start the server anyway in a degraded mode
  app.listen(3000, () => {
    console.log('Server running in degraded mode (no database)');
  });
});