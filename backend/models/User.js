const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      match: /^\S+@\S+\.\S+$/,
    },
    username: {
      type: String,
      sparse: true,
      unique: true,
      index: true,
      lowercase: true,
      match: /^[a-z0-9_.-]{3,15}$/,
    },
    name: { type: String, default: '' },
    upiId: { type: String, default: '', match: /^([\w.\-]+@[\w]+)?$/ },
    avatar: { type: String, default: '' },
    fcmToken: { type: String, default: '' },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

UserSchema.virtual('initials').get(function () {
  return (this.name || '').split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
});

UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

UserSchema.methods.toPublicJSON = function () {
  return {
    _id: this._id,
    email: this.isDeleted ? '' : this.email,
    username: this.isDeleted ? '' : this.username,
    name: this.isDeleted ? 'Deleted user' : this.name,
    upiId: this.isDeleted ? '' : this.upiId,
    avatar: this.isDeleted ? '?' : (this.avatar || this.initials),
    initials: this.isDeleted ? '?' : this.initials,
    isDeleted: this.isDeleted,
  };
};

module.exports = mongoose.model('User', UserSchema);
