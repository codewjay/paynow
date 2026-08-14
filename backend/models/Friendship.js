const mongoose = require('mongoose');

const FriendshipSchema = new mongoose.Schema(
  {
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

// Optimize lookups for a user's friends
FriendshipSchema.index({ users: 1 });

module.exports = mongoose.model('Friendship', FriendshipSchema);
