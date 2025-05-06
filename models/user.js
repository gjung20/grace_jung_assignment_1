const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String // ⚠️ For demo only — use hashed passwords in production!
});

module.exports = mongoose.model('User', userSchema);