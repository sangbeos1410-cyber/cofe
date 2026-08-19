# CÀI FIREBASE PUSH

## 1. Google Apps Script
- Copy `google-apps-script/Code.gs` lên Apps Script.
- Chạy `setup()` một lần.
- Deploy > Manage deployments > Edit > New version > Deploy.
- Sẽ có thêm sheet `FCM_TOKENS`.

## 2. Firebase Web App
Firebase Console > Create project > Add app > Web.

Copy firebaseConfig vào:
`public/firebase-config.js`

## 3. VAPID key
Firebase Console > Project settings > Cloud Messaging > Web Push certificates.
Tạo key pair và copy PUBLIC VAPID KEY vào:
`public/firebase-config.js`

## 4. Service Account bí mật
Firebase Console > Project settings > Service accounts > Generate new private key.

Mở JSON và lấy:
- project_id
- client_email
- private_key

Trong `Code.gs`, tạm điền chúng vào hàm:
`setupFirebaseServiceAccount()`

Chạy hàm này MỘT LẦN.

Sau đó phải xóa dữ liệu thật khỏi Code.gs, trả lại `DIEN_...`, Save và Deploy New version.
KHÔNG upload file Service Account JSON hoặc private key lên GitHub/Vercel.

## 5. Push website
Các file mới:
- firebase-config.js
- firebase-messaging-sw.js
- icon-192.png
- icon-512.png

Terminal:
```bash
git add .
git commit -m "them firebase push"
git push
```

## 6. Bật trên điện thoại
Mở `https://TEN-VERCEL.vercel.app/admin.html`
- Đăng nhập
- Bấm `Bật thông báo`
- Chọn `Allow / Cho phép`
- Sau đó bấm `Gửi thử thông báo`

Nếu thành công, sheet `FCM_TOKENS` có token của điện thoại.

## 7. Khi khách đặt món
Apps Script:
- lưu DON_HANG
- gọi Firebase Cloud Messaging HTTP v1
- điện thoại Admin nhận push

## Lưu ý iPhone
Trên iPhone, nên mở site bằng Safari > Share > Add to Home Screen,
sau đó mở từ biểu tượng ngoài màn hình chính và bật thông báo.
