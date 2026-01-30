# 🎮 Caro Online - Game 2 Người

Website chơi caro trực tuyến cho 2 người chơi với QR code và nhiều tính năng thú vị!

## ✨ Tính năng

- 🎯 **Bàn cờ vô tận**: Kéo và zoom để di chuyển trên bàn cờ
- 🔗 **QR Code**: Tạo phòng và chia sẻ bằng mã QR
- ⏱️ **Timer**: Mỗi nước đi có 30 giây
- 🎲 **2 Chế độ chơi**:
  - **Basic**: 5 quân liên tiếp để thắng
  - **Chặn 2 đầu**: 5 quân liên tiếp + ít nhất 1 đầu hở
- 📱 **Responsive**: Hỗ trợ cả desktop và mobile
- 🎨 **Giao diện đẹp**: Thiết kế hiện đại, dễ sử dụng

## 🚀 Cài đặt

1. **Cài đặt Node.js** (nếu chưa có): https://nodejs.org/

2. **Cài đặt dependencies**:
```bash
npm install
```

## ▶️ Chạy ứng dụng

```bash
npm start
```

Server sẽ chạy tại: `http://localhost:3000`

## 📖 Hướng dẫn chơi

1. **Nhập tên** của bạn
2. **Tạo phòng** và chọn chế độ chơi
3. **Chia sẻ QR code** hoặc link cho bạn bè
4. **Bắt đầu chơi** khi có đủ 2 người
5. Mỗi người có **30 giây** để đi một nước
6. **Người thắng**: Xếp được 5 quân liên tiếp (tùy chế độ)

## 🎮 Cách chơi

- **Click** vào ô để đánh cờ
- **Kéo** để di chuyển bàn cờ
- **Zoom** bằng các nút +/- hoặc cuộn chuột
- Quân **X** màu đỏ, quân **O** màu xanh

## 🛠️ Công nghệ sử dụng

- **Frontend**: HTML5, CSS3, JavaScript (Canvas API)
- **Backend**: Node.js, Express.js
- **Real-time**: Socket.IO
- **QR Code**: qrcode library

## 📁 Cấu trúc dự án

```
caro/
├── public/
│   ├── index.html      # Giao diện chính
│   ├── style.css       # Styling
│   └── game.js         # Logic client
├── server.js           # Server & game logic
├── package.json        # Dependencies
└── README.md           # Hướng dẫn
```

## 🎯 Chế độ chơi

### Basic
- Xếp được 5 quân liên tiếp (ngang, dọc, chéo) = Thắng
- Không cần quan tâm đến việc bị chặn

### Chặn 2 đầu
- Xếp được 5 quân liên tiếp
- Ít nhất 1 trong 2 đầu phải hở (không bị chặn)
- Khó hơn và đòi hỏi chiến thuật cao

## 🌐 Deploy

Bạn có thể deploy lên:
- **Heroku**: `heroku create && git push heroku main`
- **Render**: Import repo và deploy
- **Railway**: Connect GitHub repo
- **Vercel/Netlify**: Cần config cho WebSocket

## 📝 Ghi chú

- Port mặc định: 3000 (có thể thay đổi bằng biến môi trường PORT)
- Hỗ trợ nhiều phòng chơi cùng lúc
- Tự động dọn dẹp khi người chơi rời đi

## 🤝 Đóng góp

Mọi đóng góp đều được hoan nghênh! Feel free to open issues hoặc pull requests.

## 📄 License

MIT License - Tự do sử dụng và chỉnh sửa

---

**Chúc bạn chơi vui vẻ! 🎉**
