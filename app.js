const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const { connectToDatabase } = require('./databaseConnection');

const app = express();
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: 'secret123',
  resave: false,
  saveUninitialized: false
}));

let db, usersCollection;

// Middleware
function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

connectToDatabase().then(database => {
  db = database;
  usersCollection = db.collection('users');

  // Routes

  app.get('/', (req, res) => {
    const user = req.session.user;
    res.render('home', { user });
  });

  app.get('/signup', (req, res) => res.render('signup'));

  app.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;
    const existing = await usersCollection.findOne({ email });
    if (existing) return res.send('User already exists');
    const result = await usersCollection.insertOne({ name, email, password });
    req.session.user = result.ops ? result.ops[0] : { name, email }; // fallback
    res.redirect('/');
  });

  app.get('/login', (req, res) => res.render('login'));

  app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await usersCollection.findOne({ email, password });
    if (!user) return res.send(`
      <p>Invalid password/email combination.</p>
      <a href="/login">Back to Login</a>
    `);
    req.session.user = user;
    res.redirect('/');
  });

  app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
  });

  app.get('/members', isAuthenticated, (req, res) => {
    const images = ['cutie1.jpg', 'cutie2.jpg', 'cutie3.jpg'];
    const randomImage = images[Math.floor(Math.random() * images.length)];
    res.render('members', {
      user: req.session.user,
      image: randomImage
    });
  });

  app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
  });

// 404 handler (must come last)
app.use(function (req, res) {
  res.status(404).render('404');
});

}).catch(err => {
  console.error("Failed to connect to MongoDB:", err);
});