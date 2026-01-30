const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

// Lưu trữ các phòng chơi
const rooms = new Map();

// Tạo mã phòng ngẫu nhiên
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Kiểm tra thắng thua
function checkWin(board, row, col, player, gameMode) {
  const directions = [
    [0, 1],   // ngang
    [1, 0],   // dọc
    [1, 1],   // chéo phải
    [1, -1]   // chéo trái
  ];

  for (let [dx, dy] of directions) {
    let count = 1;
    let openEnds = 0;
    
    // Đếm về phía trước
    let i = 1;
    while (true) {
      const key = `${row + dx * i},${col + dy * i}`;
      if (board[key] === player) {
        count++;
        i++;
      } else {
        if (!board[key]) openEnds++;
        break;
      }
    }
    
    // Đếm về phía sau
    i = 1;
    while (true) {
      const key = `${row - dx * i},${col - dy * i}`;
      if (board[key] === player) {
        count++;
        i++;
      } else {
        if (!board[key]) openEnds++;
        break;
      }
    }
    
    // Chế độ basic: chỉ cần 5 quân liên tiếp
    if (gameMode === 'basic' && count >= 5) {
      return true;
    }
    
    // Chế độ chặn 2 đầu: cần 5 quân liên tiếp và ít nhất 1 đầu hở
    if (gameMode === 'block-both-ends' && count >= 5 && openEnds > 0) {
      return true;
    }
  }
  
  return false;
}

io.on('connection', (socket) => {
  console.log('Người chơi kết nối:', socket.id);

  // Tạo phòng mới
  socket.on('create-room', async (data) => {
    const { playerName, gameMode } = data;
    const roomId = generateRoomId();
    
    rooms.set(roomId, {
      id: roomId,
      players: [{
        id: socket.id,
        name: playerName,
        symbol: 'X'
      }],
      gameMode: gameMode,
      board: {},
      currentTurn: 'X',
      gameStarted: false,
      timer: null,
      timeLeft: 30
    });

    socket.join(roomId);
    socket.roomId = roomId;

    // Tạo QR code
    const roomUrl = `${data.baseUrl}?room=${roomId}`;
    const qrCode = await QRCode.toDataURL(roomUrl);

    socket.emit('room-created', {
      roomId: roomId,
      qrCode: qrCode,
      roomUrl: roomUrl
    });

    console.log(`Phòng ${roomId} được tạo bởi ${playerName} (${gameMode})`);
  });

  // Tham gia phòng
  socket.on('join-room', (data) => {
    const { roomId, playerName } = data;
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit('error', { message: 'Phòng không tồn tại!' });
      return;
    }

    if (room.players.length >= 2) {
      socket.emit('error', { message: 'Phòng đã đầy!' });
      return;
    }

    if (room.gameStarted) {
      socket.emit('error', { message: 'Trận đấu đã bắt đầu!' });
      return;
    }

    room.players.push({
      id: socket.id,
      name: playerName,
      symbol: 'O'
    });

    socket.join(roomId);
    socket.roomId = roomId;
    room.gameStarted = true;

    // Thông báo cho cả 2 người chơi
    io.to(roomId).emit('game-start', {
      players: room.players,
      gameMode: room.gameMode,
      currentTurn: room.currentTurn
    });

    // Bắt đầu timer cho người chơi đầu tiên
    startTimer(roomId);

    console.log(`${playerName} tham gia phòng ${roomId}`);
  });

  // Người chơi đánh cờ
  socket.on('make-move', (data) => {
    const { row, col } = data;
    const room = rooms.get(socket.roomId);

    if (!room || !room.gameStarted) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    if (room.currentTurn !== player.symbol) {
      socket.emit('error', { message: 'Chưa đến lượt của bạn!' });
      return;
    }

    const key = `${row},${col}`;
    if (room.board[key]) {
      socket.emit('error', { message: 'Ô này đã có quân cờ!' });
      return;
    }

    // Đặt quân cờ
    room.board[key] = player.symbol;

    // Kiểm tra thắng
    const hasWon = checkWin(room.board, row, col, player.symbol, room.gameMode);

    if (hasWon) {
      clearInterval(room.timer);
      io.to(socket.roomId).emit('game-over', {
        winner: player.name,
        winnerSymbol: player.symbol,
        row: row,
        col: col
      });
      return;
    }

    // Chuyển lượt
    room.currentTurn = room.currentTurn === 'X' ? 'O' : 'X';
    room.timeLeft = 30;

    io.to(socket.roomId).emit('move-made', {
      row: row,
      col: col,
      symbol: player.symbol,
      currentTurn: room.currentTurn
    });

    // Restart timer cho người chơi tiếp theo
    clearInterval(room.timer);
    startTimer(socket.roomId);
  });

  // Ngắt kết nối
  socket.on('disconnect', () => {
    console.log('Người chơi ngắt kết nối:', socket.id);
    
    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        clearInterval(room.timer);
        io.to(socket.roomId).emit('player-left', {
          message: 'Người chơi đã rời khỏi phòng'
        });
        rooms.delete(socket.roomId);
      }
    }
  });
});

// Hàm đếm ngược thời gian
function startTimer(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.timeLeft = 30;
  
  room.timer = setInterval(() => {
    room.timeLeft--;
    
    io.to(roomId).emit('timer-update', {
      timeLeft: room.timeLeft,
      currentTurn: room.currentTurn
    });

    if (room.timeLeft <= 0) {
      clearInterval(room.timer);
      
      // Người chơi hết thời gian = thua
      const currentPlayer = room.players.find(p => p.symbol === room.currentTurn);
      const otherPlayer = room.players.find(p => p.symbol !== room.currentTurn);
      
      io.to(roomId).emit('game-over', {
        winner: otherPlayer.name,
        winnerSymbol: otherPlayer.symbol,
        reason: 'timeout'
      });
    }
  }, 1000);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
