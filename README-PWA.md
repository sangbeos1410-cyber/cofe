# Cheng Coffee PWA

Bản này dùng chung iPhone + Android.

Sau khi thay file:
```bash
git add .
git commit -m "nang cap pwa"
git push
```

## iPhone
1. Xóa icon Cheng Coffee cũ khỏi màn hình chính.
2. Mở Safari.
3. Mở `/admin.html`.
4. Share → Add to Home Screen.
5. Mở lại từ icon mới.
6. Đăng nhập Admin → Bật thông báo.

## Android
1. Mở bằng Chrome.
2. Menu Chrome → Install app / Add to Home Screen.
3. Mở app từ icon.
4. Đăng nhập Admin → Bật thông báo.

## Kiểm tra
- `/manifest.json` phải mở được.
- `/firebase-messaging-sw.js` phải mở được, không 404.
