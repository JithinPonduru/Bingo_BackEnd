const Board = require("./utilities/Board");
const Player = require("./utilities/Player");
const {
  generateRoomCode,
  getRandomArrangement,
  getRandomFirst,
} = require("./utilities/Others");
const express = require("express");
const cors = require("cors");
const http = require("http");
const socketio = require("socket.io");

const app = express();
const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const io = socketio(server);

app.use(cors());

const rooms = new Map();

// Create Room

const createRoom = (resolve) => {
  let newRoomCode = generateRoomCode();
  while (rooms.has(newRoomCode)) {
    newRoomCode = generateRoomCode();
  }

  rooms.set(newRoomCode, { roodCode: newRoomCode, players: [], board: null });
  resolve(newRoomCode);
};

// Join Room

const joinRoom = (player, roomCode) => {
  rooms.get(roomCode).players.push(player);
};

// Kick

const kickPlayer = (roomCode) => {
  rooms.get(roomCode).players.pop();
};

// Get Player Count

const getPlayerCount = (roomCode) => {
  return rooms.get(roomCode).players.length;
};

// Giving board to a room

const giveBoard = (roomCode) => {
  rooms.get(roomCode).board = new Board();
};

// Give Arrangement

const giveArrangements = (roomCode) => {
  rooms.get(roomCode).players[0].pMap = getRandomArrangement();
  rooms.get(roomCode).players[1].pMap = getRandomArrangement();
};

// Check Winner

const getCount = (gameSet, pMap) => {
  let count = 0;
  let board = new Array(5).map(() => new Array(5).fill(0));
  for (let [key, value] of pMap) {
    board[value.x][value.y] = key;
  }
  // return number of rows + columns + center diagonals in which all the numbers are marked
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
  // now check the two diagonals
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
  let turn = rooms.get(roomCode).board.turn;
  io.to(rooms[roomCode].players[0].id).emit("Your Turn", {
    turn: turn === 0,
    arrangement: rooms.get(roomCode).players[0].pMap,
  });

  io.to(rooms[roomCode].players[1].id).emit("Your Turn", {
    turn: turn === 1,
    arrangement: rooms.get(roomCode).players[1].pMap,
  });

  let gameSet = rooms.get(roomCode).board.gameSet;
  io.to(roomCode).emit(`${event}`, { gameSet });
}

// Socket Connection

io.on("connection", (socket) => {
  socket.on("CreateRoom", () => {
    new Promise((resolve) => {
      createRoom(resolve);
    }).then((roomCode) => {
      socket.emit("RoomCode", roomCode);
    });
  });

  socket.on("JoinRoom", (roomCode, playerName) => {
    if (roomCode === "" || roomCode === null || roomCode === undefined) {
      socket.emit("Error", "Room Code is required");
    }

    socket.join(roomCode);
    let player = new Player(playerName, roomCode, socket.id);
    joinRoom(player, roomCode);

    if (getPlayerCount(roomCode) === 1) {
      socket.emit("Waiting", "Waiting for another player to join");
    }

    if (getPlayerCount(roomCode) === 2) {
      giveBoard(roomCode);
      giveArrangements(roomCode);

      // Emitting to both players

      updateData(roomCode,"GameStart");
    }

    if (getPlayerCount(roomCode) > 2) {
      socket.leave(roomCode);
      kickPlayer(roomCode);
      socket.emit("Error", "Room is Full");
    }
  });

  socket.on("mark", (roomCode, number) => {
    rooms.get(roomCode).board.mark(number);
    let winner = checkWinner(roomCode);
    if (winner === -1) {
      rooms.get(roomCode).board.toggleTurn();
      updateData(roomCode,"Update");
    } else if (winner === 2) {
      io.to(roomCode).emit("Draw", {ended: true});
    } else {
      io.to(roomCode).emit("Winner", { winner: rooms[roomCode].players[winner].name,id : socket.id, ended: true });
    }
  });


  socket.on("disconnect", () => {
    for (let [roomCode, room] of rooms) {
      for (let i = 0; i < room.players.length; i++) {
        if (room.players[i].id === socket.id) {
          io.to(roomCode).emit("Opponent Left", { ended: true });
          rooms.delete(roomCode);
        }
      }
    }
  });
});

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
