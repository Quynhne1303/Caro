const socket = io();

let playerName = '';
let mySymbol = '';
let currentRoom = '';
let gameMode = '';
let canvas, ctx;
let cellSize = 40;
let offsetX = 0;
let offsetY = 0;
let zoom = 1;
let isDragging = false;
let lastX = 0;
let lastY = 0;
let board = {};

// Lấy tham số room từ URL
const urlParams = new URLSearchParams(window.location.search);
const roomFromUrl = urlParams.get('room');

// Xử lý submit tên
function submitName() {
    const nameInput = document.getElementById('player-name');
    playerName = nameInput.value.trim();
    
    if (!playerName) {
        alert('Vui lòng nhập tên của bạn!');
        return;
    }
    
    document.getElementById('display-name').textContent = playerName;
    
    // Nếu có mã phòng trong URL, tự động tham gia
    if (roomFromUrl) {
        showScreen('lobby-screen');
        setTimeout(() => {
            document.getElementById('room-code').value = roomFromUrl;
            joinRoom();
        }, 500);
    } else {
        showScreen('lobby-screen');
    }
}

// Tạo phòng mới
function createRoom() {
    const selectedMode = document.getElementById('game-mode').value;
    const baseUrl = window.location.origin + window.location.pathname;
    
    socket.emit('create-room', {
        playerName: playerName,
        gameMode: selectedMode,
        baseUrl: baseUrl
    });
}

// Tham gia phòng
function joinRoom() {
    const roomCode = document.getElementById('room-code').value.trim().toUpperCase();
    
    if (!roomCode) {
        alert('Vui lòng nhập mã phòng!');
        return;
    }
    
    socket.emit('join-room', {
        roomId: roomCode,
        playerName: playerName
    });
}

// Copy link phòng
function copyRoomUrl() {
    const roomUrl = document.getElementById('room-url');
    roomUrl.select();
    document.execCommand('copy');
    alert('Đã copy link phòng!');
}

// Quay về lobby
function backToLobby() {
    location.reload();
}

// Hiển thị màn hình
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Socket events
socket.on('room-created', (data) => {
    currentRoom = data.roomId;
    document.getElementById('room-id-display').textContent = data.roomId;
    document.getElementById('qr-code-img').src = data.qrCode;
    document.getElementById('room-url').value = data.roomUrl;
    mySymbol = 'X';
    showScreen('qr-screen');
});

socket.on('game-start', (data) => {
    gameMode = data.gameMode;
    
    // Xác định symbol của mình
    const myPlayer = data.players.find(p => p.id === socket.id);
    mySymbol = myPlayer.symbol;
    
    // Hiển thị thông tin người chơi
    document.getElementById('player-x-name').textContent = data.players[0].name;
    document.getElementById('player-o-name').textContent = data.players[1].name;
    
    // Hiển thị chế độ chơi
    const modeText = gameMode === 'basic' ? 'Basic (5 quân liên tiếp)' : 'Chặn 2 đầu (5 quân + 1 đầu hở)';
    document.getElementById('current-game-mode').textContent = modeText;
    
    updateTurnIndicator(data.currentTurn);
    
    showScreen('game-screen');
    initBoard();
});

socket.on('move-made', (data) => {
    board[`${data.row},${data.col}`] = data.symbol;
    drawBoard();
    updateTurnIndicator(data.currentTurn);
});

socket.on('timer-update', (data) => {
    document.getElementById('timer').textContent = data.timeLeft;
    updateTurnIndicator(data.currentTurn);
});

socket.on('game-over', (data) => {
    if (data.reason === 'timeout') {
        document.getElementById('win-reason').textContent = 'Đối thủ hết thời gian!';
    } else {
        document.getElementById('win-reason').textContent = 'Đã xếp được 5 quân liên tiếp!';
    }
    
    document.getElementById('winner-symbol').textContent = data.winnerSymbol;
    document.getElementById('winner-name').textContent = data.winner;
    
    showScreen('game-over-screen');
});

socket.on('player-left', (data) => {
    alert(data.message);
    backToLobby();
});

socket.on('error', (data) => {
    alert(data.message);
});

// Cập nhật chỉ báo lượt chơi
function updateTurnIndicator(currentTurn) {
    const playerXInfo = document.getElementById('player-x-info');
    const playerOInfo = document.getElementById('player-o-info');
    const turnText = document.getElementById('current-player-turn');
    
    playerXInfo.classList.remove('active');
    playerOInfo.classList.remove('active');
    
    if (currentTurn === 'X') {
        playerXInfo.classList.add('active');
        turnText.textContent = document.getElementById('player-x-name').textContent;
    } else {
        playerOInfo.classList.add('active');
        turnText.textContent = document.getElementById('player-o-name').textContent;
    }
}

// Khởi tạo bàn cờ
function initBoard() {
    canvas = document.getElementById('game-board');
    ctx = canvas.getContext('2d');
    
    // Kích thước canvas lớn để mô phỏng bàn cờ vô tận
    canvas.width = 2000;
    canvas.height = 2000;
    
    // Đặt offset để bắt đầu từ giữa
    offsetX = canvas.width / 2;
    offsetY = canvas.height / 2;
    
    board = {};
    
    drawBoard();
    
    // Event listeners
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('click', onCanvasClick);
    
    // Touch events for mobile
    canvas.addEventListener('touchstart', onTouchStart);
    canvas.addEventListener('touchmove', onTouchMove);
    canvas.addEventListener('touchend', onTouchEnd);
}

// Vẽ bàn cờ
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const scaledCellSize = cellSize * zoom;
    const gridSize = 50; // Số ô hiển thị
    
    // Vẽ lưới
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    
    for (let i = -gridSize; i <= gridSize; i++) {
        // Dọc
        ctx.beginPath();
        ctx.moveTo(offsetX + i * scaledCellSize, offsetY - gridSize * scaledCellSize);
        ctx.lineTo(offsetX + i * scaledCellSize, offsetY + gridSize * scaledCellSize);
        ctx.stroke();
        
        // Ngang
        ctx.beginPath();
        ctx.moveTo(offsetX - gridSize * scaledCellSize, offsetY + i * scaledCellSize);
        ctx.lineTo(offsetX + gridSize * scaledCellSize, offsetY + i * scaledCellSize);
        ctx.stroke();
    }
    
    // Vẽ các quân cờ
    ctx.font = `bold ${scaledCellSize * 0.7}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (let key in board) {
        const [row, col] = key.split(',').map(Number);
        const x = offsetX + col * scaledCellSize;
        const y = offsetY + row * scaledCellSize;
        
        if (board[key] === 'X') {
            ctx.fillStyle = '#e74c3c';
        } else {
            ctx.fillStyle = '#3498db';
        }
        
        ctx.fillText(board[key], x, y);
    }
}

// Mouse events
function onMouseDown(e) {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
}

function onMouseMove(e) {
    if (isDragging) {
        const deltaX = e.clientX - lastX;
        const deltaY = e.clientY - lastY;
        
        offsetX += deltaX;
        offsetY += deltaY;
        
        lastX = e.clientX;
        lastY = e.clientY;
        
        drawBoard();
    }
}

function onMouseUp() {
    isDragging = false;
}

function onCanvasClick(e) {
    if (isDragging) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const scaledCellSize = cellSize * zoom;
    const col = Math.round((x - offsetX) / scaledCellSize);
    const row = Math.round((y - offsetY) / scaledCellSize);
    
    socket.emit('make-move', { row, col });
}

// Touch events
function onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        lastX = touch.clientX;
        lastY = touch.clientY;
        isDragging = true;
    }
}

function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1 && isDragging) {
        const touch = e.touches[0];
        const deltaX = touch.clientX - lastX;
        const deltaY = touch.clientY - lastY;
        
        offsetX += deltaX;
        offsetY += deltaY;
        
        lastX = touch.clientX;
        lastY = touch.clientY;
        
        drawBoard();
    }
}

function onTouchEnd(e) {
    e.preventDefault();
    if (e.changedTouches.length === 1 && !isDragging) {
        const touch = e.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        const scaledCellSize = cellSize * zoom;
        const col = Math.round((x - offsetX) / scaledCellSize);
        const row = Math.round((y - offsetY) / scaledCellSize);
        
        socket.emit('make-move', { row, col });
    }
    isDragging = false;
}

// Zoom controls
function zoomIn() {
    zoom = Math.min(zoom + 0.2, 3);
    drawBoard();
}

function zoomOut() {
    zoom = Math.max(zoom - 0.2, 0.5);
    drawBoard();
}

function resetView() {
    zoom = 1;
    offsetX = canvas.width / 2;
    offsetY = canvas.height / 2;
    drawBoard();
}

// Enter key submit
document.getElementById('player-name')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitName();
});

document.getElementById('room-code')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinRoom();
});
