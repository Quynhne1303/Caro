const socket = io();

let playerName = '';
let mySymbol = '';
let currentRoom = '';
let gameMode = '';
let canvas, ctx;
let cellSize = 50; // Tăng kích thước ô cho dễ click trên mobile
let offsetX = 0;
let offsetY = 0;
let zoom = 1;
let isDragging = false;
let isPointerDown = false;
let dragStartTime = 0;
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
    offsetX = canvas.width / 2 - cellSize / 2;
    offsetY = canvas.height / 2 - cellSize / 2;
    
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

    // Nền trắng như giấy
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const scaledCellSize = cellSize * zoom;
    const gridSize = 50; // Số ô hiển thị
    
    // Vẽ lưới màu xanh nhạt
    ctx.strokeStyle = '#6fb6ff';
    ctx.lineWidth = 1.5;
    
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
    
    // Vẽ lại lưới để nổi bật
    ctx.strokeStyle = '#6fb6ff';
    ctx.lineWidth = 1.5;
    for (let i = -gridSize; i <= gridSize; i++) {
        ctx.beginPath();
        ctx.moveTo(offsetX + i * scaledCellSize, offsetY - gridSize * scaledCellSize);
        ctx.lineTo(offsetX + i * scaledCellSize, offsetY + gridSize * scaledCellSize);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(offsetX - gridSize * scaledCellSize, offsetY + i * scaledCellSize);
        ctx.lineTo(offsetX + gridSize * scaledCellSize, offsetY + i * scaledCellSize);
        ctx.stroke();
    }
    
    // Vẽ các quân cờ vào giữa ô vuông
    for (let key in board) {
        const [row, col] = key.split(',').map(Number);
        const x = offsetX + col * scaledCellSize + scaledCellSize / 2;
        const y = offsetY + row * scaledCellSize + scaledCellSize / 2;
        
        const symbol = board[key];
        
        if (symbol === 'X') {
            // Vẽ X với đường chéo
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 4 * zoom;
            const padding = scaledCellSize * 0.2;
            
            ctx.beginPath();
            ctx.moveTo(x - scaledCellSize / 2 + padding, y - scaledCellSize / 2 + padding);
            ctx.lineTo(x + scaledCellSize / 2 - padding, y + scaledCellSize / 2 - padding);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(x + scaledCellSize / 2 - padding, y - scaledCellSize / 2 + padding);
            ctx.lineTo(x - scaledCellSize / 2 + padding, y + scaledCellSize / 2 - padding);
            ctx.stroke();
        } else {
            // Vẽ O với vòng tròn
            ctx.strokeStyle = '#3498db';
            ctx.lineWidth = 4 * zoom;
            const radius = scaledCellSize * 0.3;
            
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

// Mouse events
function onMouseDown(e) {
    dragStartTime = Date.now();
    isPointerDown = true;
    isDragging = false;
    lastX = e.clientX;
    lastY = e.clientY;
}

function onMouseMove(e) {
    if (!isPointerDown) return;
    const deltaX = e.clientX - lastX;
    const deltaY = e.clientY - lastY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (distance > 5) {
        isDragging = true;
    }
    
    if (isDragging) {
        offsetX += deltaX;
        offsetY += deltaY;
        
        lastX = e.clientX;
        lastY = e.clientY;
        
        drawBoard();
    }
}

function onMouseUp() {
    isDragging = false;
    isPointerDown = false;
}

function onCanvasClick(e) {
    if (isDragging) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const scaledCellSize = cellSize * zoom;
    const col = Math.floor((x - offsetX) / scaledCellSize);
    const row = Math.floor((y - offsetY) / scaledCellSize);
    
    socket.emit('make-move', { row, col });
}

// Touch events
function onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        lastX = touch.clientX;
        lastY = touch.clientY;
        dragStartTime = Date.now();
        isPointerDown = true;
        isDragging = false;
    }
}

function onTouchMove(e) {
    e.preventDefault();
    if (!isPointerDown) return;
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        const deltaX = touch.clientX - lastX;
        const deltaY = touch.clientY - lastY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance > 5) {
            isDragging = true;
        }
        
        if (isDragging) {
            offsetX += deltaX;
            offsetY += deltaY;
            
            lastX = touch.clientX;
            lastY = touch.clientY;
            
            drawBoard();
        }
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
        const col = Math.floor((x - offsetX) / scaledCellSize);
        const row = Math.floor((y - offsetY) / scaledCellSize);
        
        socket.emit('make-move', { row, col });
    }
    isDragging = false;
    isPointerDown = false;
}

// Pinch-to-zoom support
let lastDistance = 0;

function getDistance(touches) {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
        lastDistance = getDistance(e.touches);
        isPointerDown = true;
        isDragging = false;
    } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        lastX = touch.clientX;
        lastY = touch.clientY;
        dragStartTime = Date.now();
        isPointerDown = true;
        isDragging = false;
    }
}

function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
        // Pinch zoom
        const currentDistance = getDistance(e.touches);
        if (lastDistance > 0) {
            const zoomFactor = currentDistance / lastDistance;
            zoom = Math.max(0.5, Math.min(zoom * zoomFactor, 3));
            drawBoard();
        }
        lastDistance = currentDistance;
        isDragging = false;
    } else if (e.touches.length === 1 && isPointerDown) {
        const touch = e.touches[0];
        const deltaX = touch.clientX - lastX;
        const deltaY = touch.clientY - lastY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance > 5) {
            isDragging = true;
        }
        
        if (isDragging) {
            offsetX += deltaX;
            offsetY += deltaY;
            
            lastX = touch.clientX;
            lastY = touch.clientY;
            
            drawBoard();
        }
    }
}

function onTouchEnd(e) {
    e.preventDefault();
    lastDistance = 0;
    if (e.changedTouches.length === 1 && !isDragging) {
        const touch = e.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        const scaledCellSize = cellSize * zoom;
        const col = Math.floor((x - offsetX) / scaledCellSize);
        const row = Math.floor((y - offsetY) / scaledCellSize);
        
        socket.emit('make-move', { row, col });
    }
    isDragging = false;
    isPointerDown = false;
}

// Enter key submit
document.getElementById('player-name')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitName();
});

document.getElementById('room-code')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinRoom();
});
