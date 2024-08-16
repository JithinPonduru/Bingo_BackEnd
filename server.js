const Board = require("./utilities/Board");
const Player = require("./utilities/Player");
const { generateRoomCode, getRandomArrangement, getRandomFirst } = require("./utilities/Others");
const express = require("express");
const cors = require("cors");
const http = require("http");
const socketio = require("socket.io");

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: "*", // Allow all origins
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true
  }
});
const PORT = process.env.PORT || 3000;3

const rooms = new Map();
const socketIds = new Set();

const timeInterval = 1000 * 60 * 10; 

function checkActivity() {
  setInterval(() => {
    rooms.forEach((room, roomCode) => {
      if (Date.now() - room.lastActivity > timeInterval) {
        socketIds.delete(room.players[0].id);
        socketIds.delete(room.players[1].id);
        rooms.delete(roomCode); 
        io.to(roomCode).emit("OpponentLeft", { ended: true});
      }
    });
  }, timeInterval);
}


checkActivity();
// Create Room
const createRoom = (resolve) => {
  let newRoomCode = generateRoomCode();
  while (rooms.has(newRoomCode)) {
    newRoomCode = generateRoomCode();
  }
  rooms.set(newRoomCode, { roodCode: newRoomCode, players: [], board: null, lastActivity : Date.now() });
  resolve(newRoomCode);
};

// Join Room
const joinRoom = (player, roomCode) => {
  rooms.get(roomCode).players.push(player);
};

// Kick Player
const kickPlayer = (roomCode) => {
  rooms.get(roomCode).players.pop();
};

// Get Player Count
const getPlayerCount = (roomCode) => {
  return rooms.get(roomCode).players.length;
};

// Give board to a room
const giveBoard = (roomCode) => {
  rooms.get(roomCode).board = new Board();
};

// Give Arrangement
const giveArrangements = (roomCode) => {
  rooms.get(roomCode).players[0].pMap = getRandomArrangement();
  console.log(rooms.get(roomCode).players[0].pMap);
  rooms.get(roomCode).players[1].pMap = getRandomArrangement();
  console.log(rooms.get(roomCode).players[1].pMap);
};

// Get Lines Count
const getCount = (gameSet, pMap) => {
  let count = 0;
  let board =  Array.from({ length: 5 }, () => Array(5).fill(0));
  for (let [key, value] of pMap.entries()) {
    board[value.x][value.y] = key;
  }
  for (let i = 0; i < 5; i++) {
    let row = true;
    let col = true;
    for (let j = 0; j < 5; j++) {
      if (!gameSet.has(board[i][j])) {
        row = false;
      }
      if (!gameSet.has(board[j][i])) {
        col = false;
      }
    }
    if (row) {
      count++;
    }
    if (col) {
      count++;
    }
  }
  let diag1 = true;
  let diag2 = true;
  for (let i = 0; i < 5; i++) {
    if (!gameSet.has(board[i][i])) {
      diag1 = false;
    }
    if (!gameSet.has(board[i][4 - i])) {
      diag2 = false;
    }
  }
  if (diag1) {
    count++;
  }
  if (diag2) {
    count++;
  }

  return count;
};

// Check Winner
const checkWinner = (roomCode) => {
  let gameSet = rooms.get(roomCode).board.gameSet;
  let p1Map = rooms.get(roomCode).players[0].pMap;
  let p2Map = rooms.get(roomCode).players[1].pMap;
  let p1Count = getCount(gameSet, p1Map);
  let p2Count = getCount(gameSet, p2Map);
  if (p1Count === 5 && p2Count === 5) {
    return 2;
  } else if (p1Count === 5) {
    return 0;
  } else if (p2Count === 5) {
    return 1;
  } else {
    return -1;
  }
};

// Update data
function updateData(roomCode, event) {
  let room = rooms.get(roomCode);
  let turn = room.board.turn;
  let playerData1 = {
    turn : turn === 0
  }
  let playerData2 = {
    turn : turn === 1
  }

  if(event === "GameStart") {
    playerData1.arrangement = Object.fromEntries(room.players[0].pMap);
    playerData2.arrangement = Object.fromEntries(room.players[1].pMap);
  }
  io.to(room.players[0].id).emit("PlayerData", playerData1);
  io.to(room.players[1].id).emit("PlayerData", playerData2);
  let gameSet = room.board.gameSet;
  io.to(roomCode).emit(`${event}`, { gameSet: Array.from(gameSet) });
  rooms.get(roomCode).lastActivity = Date.now();
}

// Socket Connection
io.on("connection", (socket) => {

  socket.on("GetRoomsCount", () => {
    socket.emit("RoomsCount", rooms.size);
  });

  socket.on("ClearAllRooms", () => {
    rooms.clear();
  });
  
  socket.on("CreateRoom", ({playerName}) => {
    if (socketIds.has(socket.id)) {
      socket.emit("Error", "You are already in a room");
      return;
    }
    new Promise((resolve) => {
      createRoom(resolve);
    }).then((roomCode) => {
      socket.join(roomCode);
      socketIds.add(socket.id);
      let player = new Player(playerName, roomCode, socket.id);
      joinRoom(player, roomCode);
      socket.emit("RoomCode", roomCode);
    });
  });

  socket.on("JoinRoom", ({roomCode, playerName}) => {
    if (roomCode === "" || roomCode === null || roomCode === undefined) {
      socket.emit("Error", "Room Code is required");
    }

    let playerCount = getPlayerCount(roomCode);

    if (playerCount >= 2) {
      socket.emit("Error", "Room is Full");
    } else {
      socket.join(roomCode);
      socketIds.add(socket.id);
      let player = new Player(playerName, roomCode, socket.id);
      joinRoom(player, roomCode);
      giveBoard(roomCode);
      giveArrangements(roomCode);
      updateData(roomCode,"GameStart");
    }
  });

  socket.on("Mark", ({roomCode, number}) => {
    if(roomCode === null || roomCode === "" || rooms.has(roomCode) === false) {
      socket.emit("Error", "Room does not exist");
      return;
    }
    try {
      let room = rooms.get(roomCode);
      room.board.mark(number);
      let winner = checkWinner(roomCode); 
      if (winner === -1) {
        room.board.toggleTurn();
        updateData(roomCode,"Update");
      } else if (winner === 2) {
        io.to(roomCode).emit("Draw", {ended: true});
      } else {
        io.to(roomCode).emit("Winner", { winner: room.players[winner].name, id : socket.id, ended: true });
      }
    } catch (error) {
      socket.emit("Error", error.message);
      return;
    }
  });


  socket.on("Disconnect", ({roomCode}) => {
    console.log("Dis")
    if (rooms.has(roomCode) === false) {
      socket.emit("Error", "Room does not exist");
      return;
    }
    if(rooms.get(roomCode).players.length === 1) {
      io.to(roomCode).emit("OpponentLeft", { ended: true });
    }
    rooms.delete(roomCode);
    socketIds.delete(socket.id);
    return;
  });

});

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
