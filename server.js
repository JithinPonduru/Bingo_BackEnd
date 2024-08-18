const Board = require("./utilities/Board");
const Player = require("./utilities/Player");
const { generateRoomCode, generateId, getRandomArrangement } = require("./utilities/Others");
const express = require("express");
const cors = require("cors");
const http = require("http");
const socketio = require("socket.io");

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"],
    credentials: true
  }
});
const PORT = process.env.PORT || 3000;

const rooms = new Map();
const players = new Map();

const timeInterval = 1000 * 60 * 10; 

function checkActivity() {
  setInterval(() => {
    rooms.forEach((room, roomCode) => {
      if (Date.now() - room.lastActivity > timeInterval) {
        room.players.forEach(player => playerIds.delete(player.id));
        rooms.delete(roomCode);
        io.to(roomCode).emit("OpponentLeft", { ended: true });
      }
    });
  }, timeInterval);
}

checkActivity();

// Create Room
const createRoom = () => {
  let newRoomCode = generateRoomCode();
  while (rooms.has(newRoomCode)) { newRoomCode = generateRoomCode(); }
  rooms.set(newRoomCode, { roomCode: newRoomCode, playerIds: [], board: null, lastActivity: Date.now() });
  return newRoomCode;
};

// Join Room
const joinRoom = (roomCode, playerId) => { rooms.get(roomCode).playerIds.push(playerId); };

// Kick Player
const kickPlayer = (roomCode) => { rooms.get(roomCode).playerIds.pop(); };

// Get Player Count
const getPlayerCount = (roomCode) => {
  return rooms.get(roomCode).playerIds.length;
};

// Give board to a room
const giveBoard = (roomCode) => {
  rooms.get(roomCode).board = new Board();
};

// Give Arrangement
const giveArrangements = (roomCode) => {
  const playerIds = rooms.get(roomCode).playerIds;
  players.get(playerIds[0]).pMap = getRandomArrangement();
  players.get(playerIds[1]).pMap = getRandomArrangement();
};

// Get Lines Count
const getCount = (gameSet, pMap) => {
  let count = 0;
  let board = Array.from({ length: 5 }, () => Array(5).fill(0));
  for (let [key, value] of pMap.entries()) { board[value.x][value.y] = key; }
  for (let i = 0; i < 5; i++) {
    let row = true;
    let col = true;
    for (let j = 0; j < 5; j++) {
      if (!gameSet.has(board[i][j])) { row = false; }
      if (!gameSet.has(board[j][i])) { col = false; }
    }
    if (row) count++;
    if (col) count++;
  }
  let diag1 = true;
  let diag2 = true;
  for (let i = 0; i < 5; i++) {
    if (!gameSet.has(board[i][i])) diag1 = false;
    if (!gameSet.has(board[i][4 - i])) diag2 = false;
  }
  if (diag1) count++;
  if (diag2) count++;
  return count;
};

// Check Winner
const checkWinner = (roomCode) => {
  const room = rooms.get(roomCode);
  const gameSet = room.board.gameSet;
  const playerIds = room.playerIds;
  const p1Map = players.get(playerIds[0]).pMap;
  const p2Map = players.get(playerIds[1]).pMap;
  const p1Count = getCount(gameSet, p1Map);
  const p2Count = getCount(gameSet, p2Map);
  if (p1Count === 5 && p2Count === 5) { return 2;
  } else if (p1Count === 5) { return 0;
  } else if (p2Count === 5) { return 1;
  } else { return -1; }
};

// Update data
function updateData(roomCode, event) {
  const room = rooms.get(roomCode);
  const playerIds = room.playerIds;
  const turn = room.board.turn;
  const player1Data = { turn: turn == 0 };
  const player2Data = { turn: turn == 1 };
  if (event === "GameStart") {
    player1Data.arrangement = Object.fromEntries(players.get(playerIds[0]).pMap);
    player2Data.arrangement = Object.fromEntries(players.get(playerIds[1]).pMap);
    player1Data.playerId = playerIds[0];
    player2Data.playerId = playerIds[1];
  }
  io.to(players.get(playerIds[0]).socketId).emit("PlayerData", player1Data);
  io.to(players.get(playerIds[1]).socketId).emit("PlayerData", player2Data);
  const gameSet = room.board.gameSet;
  io.to(roomCode).emit(`${event}`, { gameSet: Array.from(gameSet) });
  rooms.get(roomCode).lastActivity = Date.now();
}

// Socket Connection
io.on("connection", (socket) => {
  socket.on("GetRoomsCount", () => { socket.emit("RoomsCount", rooms.size); });

  socket.on("ClearAllRooms", () => { rooms.clear(); });

  socket.on("RegisterNewSocketId", ({ roomCode, playerId }) => {
    if (!players.has(playerId)) { socket.emit("Error", "Player does not exist"); return; }
    players.get(playerId).socketId = socket.id;
    socket.join(roomCode)
  })

  socket.on("CreateRoom", async ({ playerName }) => {
    const roomCode = createRoom(); socket.join(roomCode);
    const player = new Player(playerName, roomCode, socket.id);
    const playerId = generateId(); players.set(playerId, player);
    joinRoom(roomCode, playerId);
    socket.emit("RoomCode", roomCode);
  });

  socket.on("JoinRoom", ({ roomCode, playerName }) => {
    if (!roomCode) { socket.emit("Error", "Room Code is required"); return; }
    if (!rooms.has(roomCode)) { socket.emit("Error", "Room does not exist"); return; }
    const playerCount = getPlayerCount(roomCode);
    if (playerCount >= 2) { socket.emit("Error", "Room is Full"); return; }
    socket.join(roomCode);
    const player = new Player(playerName, roomCode, socket.id);
    const playerId = generateId(); players.set(playerId, player);
    joinRoom(roomCode, playerId); giveBoard(roomCode); giveArrangements(roomCode);
    updateData(roomCode, "GameStart");
  });

  socket.on("Mark", ({ roomCode, number }) => {
    if (!roomCode || !rooms.has(roomCode)) {
      socket.emit("Error", "Room does not exist");
      return;
    }
      const room = rooms.get(roomCode);
      const playerIds = room.playerIds;
      room.board.mark(number);
      const winner = checkWinner(roomCode);
      if (winner === -1) {
        room.board.toggleTurn();
        updateData(roomCode, "Update");
      } else if (winner === 2) {
        io.to(roomCode).emit("Draw", { draw: true, ended: true });
      } else {
        io.to(roomCode).emit("Winner", { winneName: players[playerIds[winner]].name, winnerId: playerIds[0], ended: true });
      }
  });

  // socket.on("Disconnect", ({playerId}) => {
  //   if(!players.has(playerId)) { return; }
  //   for (const [roomCode, room] of rooms) {
  //     const playerIndex = room.players.findIndex(player => player.id === playerId);
  //     if (playerIndex !== -1) {
  //       room.players.splice(playerIndex, 1);
  //       if (room.players.length === 0) {
  //         rooms.delete(roomCode);
  //       } else {
  //         io.to(roomCode).emit("OpponentLeft", { ended: true });
  //       }
  //       break;
  //     }
  //   }
  //   playerIds.delete(playerId);
  // });
});

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
