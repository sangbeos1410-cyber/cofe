# Admin xem đơn hàng chi tiết

Bản này thêm phần "Đơn hàng hôm nay" trong Admin.

Mỗi đơn hiển thị:
- Mã đơn
- Số bàn
- Thời gian đặt
- Từng món
- Số lượng
- Đơn giá
- Thành tiền từng món
- Tổng tiền của đơn

## Cập nhật
1. Thay `Code.gs` trên Google Apps Script.
2. Deploy > Manage deployments > Edit > New version > Deploy.
3. Cập nhật các file `public` lên GitHub/Vercel:
```bash
git add .
git commit -m "admin xem don hang chi tiet"
git push
```

Trang Admin vẫn giữ:
- mật khẩu
- Firebase Push
- PWA iPhone/Android
- menu
- dashboard
- lịch sử
- reset mỗi ngày
