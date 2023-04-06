const socketio = require('socket.io');

var io;
const sockets = {};
const socketCallbacks = {};
const emitQueue = [];
var QUEUE_TIMEOUT = 5000;

const QUEUE_EMIT = 0;
const QUEUE_TRANSFER = 1;

exports.init = (http, queueTimeout=5000, queuePollInterval=1000) => {
  io = socketio(http);
  io.on("connection", onConnection);
  on("disconnect", onDisconnection);

  QUEUE_TIMEOUT = queueTimeout;
  setInterval(checkQueue, queuePollInterval);
}

function checkQueue() {
  const now = (new Date()).getTime();
  for (let i = 0; i < emitQueue.length; i++) {
    const item = emitQueue[i];
    if (item.id in sockets) { // socket ready to receive emit
      if (item.type == QUEUE_EMIT) sockets[item.id].emit(item.channel, item.arg);
      else if (item.type == QUEUE_TRANSFER) sockets[item.id].join(item.room);
      emitQueue.splice(i,1); // remove from queue
      i--; // adjust queue length
    }
    else if (now > item.timeout) { // queue item too old, so remove it
      emitQueue.splice(i,1); // remove from queue
      i--; // adjust queue length
    }
  }
}

function onConnection(socket) {
  socket.on("init", (sessionId) => {
    if (sessionId.length == 0 || sessionId in sockets) return; // session not yet initialized // sockets already has this socket
    sockets[sessionId] = socket;
    for (let callbackType in socketCallbacks) {
      sockets[sessionId].on(callbackType, (arg) => { socketCallbacks[callbackType](arg, sessionId, socket); });
    }
  });
}

function on(emitType, callback) {
  socketCallbacks[emitType] = callback;
  for (let sessionId in sockets) {
    sockets[sessionId].on(emitType, (arg) => {
      callback(arg, sessionId, sockets[sessionId]);
    });
  }
}

function onDisconnection(arg, id, socket) {
  delete sockets[id];
}

function emitTo(sessionId, channel, arg, queueable=true) {
  if (sessionId in sockets) { sockets[sessionId.emit(channel)]; }
  else if (queueable) {
    emitQueue.push({
      timeout: (new Date()).getTime() + QUEUE_TIMEOUT,
      message: channel,
      arg: arg,
      id: sessionId,
      type: QUEUE_EMIT
    });
  }
}

function emitToRoom(channel, arg, ...rooms) {
  for (const room of rooms) {
    io.to(room).emit(channel, arg);
  }
}

function moveToRoom(sessionId, room, queueable=true) {
  if (sessionId in sockets) { sockets[sessionId.emit(channel)]; }
  else if (queueable) {
    emitQueue.push({
      timeout: (new Date()).getTime() + QUEUE_TIMEOUT,
      room,
      id: sessionId,
      type: QUEUE_TRANSFER
    });
  }
}

exports.on = on;
exports.emitTo = emitTo;
exports.emitToRoom = emitToRoom;
exports.moveToRoom = moveToRoom;