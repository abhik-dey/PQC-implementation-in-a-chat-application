const { Schema, model, models } = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new Schema({
  username: {
    type: String,
    required: [true, 'Username is required.'],
    unique: [true, 'Username already exists.'],
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required.'],
    select: false,
  },
  // --- NEW: Store the PQC Public Key ---
  publicKey: {
    type: String,
    default: "" // Allow empty for old users, but required for PQC chat
  }
  // -------------------------------------
}, { timestamps: true });

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = models.User || model('User', UserSchema);
module.exports = User;