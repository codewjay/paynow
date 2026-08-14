const Group = require('../models/Group');

// Membership check before joining a group room — prevents arbitrary clients
// from snooping on a group's activity by guessing the ID.
async function userInGroup(userId, groupId) {
  if (!userId || !groupId) return false;
  const exists = await Group.exists({ _id: groupId, members: userId });
  return !!exists;
}

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`[socket] connected user=${userId} id=${socket.id}`);

    // Each user automatically joins a personal room so the server can push to
    // them by user id (e.g. settlement notifications across devices).
    socket.join(`user:${userId}`);

    socket.on('join_group', async (groupId, ack) => {
      try {
        if (!(await userInGroup(userId, groupId))) {
          ack && ack({ ok: false, error: 'Not a member of that group' });
          return;
        }
        socket.join(`group:${groupId}`);
        ack && ack({ ok: true });
      } catch (err) {
        ack && ack({ ok: false, error: err.message });
      }
    });

    socket.on('leave_group', (groupId, ack) => {
      socket.leave(`group:${groupId}`);
      ack && ack({ ok: true });
    });

    socket.on('disconnect', (reason) => {
      console.log(`[socket] disconnected user=${userId} id=${socket.id} reason=${reason}`);
    });
  });
}

module.exports = { registerSocketHandlers };
