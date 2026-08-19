# Cheng Coffee V4 — Firestore + bảo mật

## Kiến trúc
- Vercel: chỉ host HTML/CSS/JS/PWA.
- Firebase Authentication:
  - Khách: Anonymous Authentication.
  - Admin: Email/Password, phiên đăng nhập lưu LOCAL.
- Firestore:
  - `menu`: menu realtime.
  - `orders`: từng đơn chi tiết.
  - `dailyStats`: số cốc + doanh thu theo ngày.
  - `adminDevices`: FCM token của Admin.
  - `requestIds`: chống tạo trùng đơn khi mạng chập chờn/retry.
- Cloud Functions:
  - `createOrder`: lấy giá từ Firestore ở server, khách không thể tự sửa giá/tổng tiền.
  - `notifyNewOrder`: tự push khi có đơn.
  - `testAdminPush`: gửi thử.
- Security Rules: deny-by-default, chỉ Admin được sửa menu/xem đơn.

## QUAN TRỌNG
Bản tối ưu bảo mật này CẦN Node.js để deploy Cloud Functions.
Website khách/Admin vẫn là HTML/CSS/JS, không cần framework.

## 1. Firebase Console
Authentication > Sign-in method:
- bật Anonymous
- bật Email/Password

Authentication > Users:
- tạo tài khoản Admin bằng email của bạn
- xác minh email Admin (email_verified phải true)

Firestore Database:
- tạo database Production mode
- location nên chọn khu vực phù hợp gần người dùng

Cloud Messaging:
- tạo Web Push certificate / VAPID key

App Check:
- đăng ký Web app với reCAPTCHA v3/Enterprise
- ban đầu để Monitoring, test xong mới Enforce

## 2. Thay 3 nơi `DIEN_EMAIL_ADMIN`
- `public/firebase-config.js`
- `firestore.rules`
- `functions/index.js`

## 3. Điền Firebase config + VAPID
`public/firebase-config.js`

## 4. Cài Firebase CLI + deploy
Tại thư mục project:
```bash
npm install -g firebase-tools
firebase login
firebase use --add
cd functions
npm install
cd ..
firebase deploy --only firestore:rules,firestore:indexes,functions
```

## 5. App Check
Cloud Functions trong bản này có `enforceAppCheck:true`.
Để test lần đầu dễ hơn:
- có thể tạm đổi thành `enforceAppCheck:false`
- deploy và kiểm tra hệ thống
- cấu hình App Check web
- sau đó đổi lại `true` và deploy

Không nên để `false` lâu dài trên production.

## 6. Menu ban đầu
Tạo collection `menu` trong Firestore. Ví dụ document ID `CF01`:
```json
{
  "name": "Cà phê sữa",
  "price": 25000,
  "active": true
}
```
Sau khi có ít nhất một món, Admin có thể quản lý menu trực tiếp.

## 7. Vercel
Push thư mục `public` như trước:
```bash
git add .
git commit -m "cheng coffee v4 firestore"
git push
```

## 8. Tại sao bản này ít timeout hơn?
- Menu đọc realtime trực tiếp từ Firestore.
- Admin nhận orders/menu/stats realtime.
- Không còn JSONP.
- Không còn Google Apps Script trên đường đặt món.
- `createOrder` là một Cloud Function ngắn, region gần Việt Nam.
- Chống double-click ở client + `requestIds` chống đơn trùng ở server.
- Push chạy bằng Firestore trigger, không làm khách chờ FCM.

## 9. Google Sheets
Không còn là database chính. Nếu vẫn muốn báo cáo Excel/Sheets, nên làm bước sau:
Firestore -> scheduled export/report -> Google Sheets.
Không để Google Sheets nằm trên đường xử lý đơn hàng.
