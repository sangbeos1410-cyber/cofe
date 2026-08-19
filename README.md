# Quán nước QR - Dashboard + Mật khẩu Admin

## Mật khẩu mặc định
Sau khi chạy `setup()`, mật khẩu Admin mặc định là:

123456

Bạn nên đổi ngay.

## Đổi mật khẩu
Trong Apps Script, chạy thủ công:

setAdminPassword("mat-khau-moi")

Ví dụ:
setAdminPassword("QuanNuoc@2026")

Lưu ý: trong giao diện Apps Script bạn không thể truyền tham số trực tiếp khi bấm Run.
Cách đơn giản:
1. Tạm tạo hàm:

function doiMatKhau() {
  setAdminPassword("QuanNuoc@2026");
}

2. Chạy hàm `doiMatKhau()` một lần.
3. Có thể xóa hàm đó sau khi đổi xong.

## Cài đặt
1. Copy `google-apps-script/Code.gs` vào Google Apps Script.
2. Chạy `setup()` một lần.
3. Deploy lại Web App bằng New version.
4. Dán URL Web App vào `public/config.js`.
5. Chạy website bằng Live Server.
6. Mở `public/admin.html`.
7. Đăng nhập bằng mật khẩu Admin.

## Bảo mật
- Mật khẩu nằm trong Script Properties, không nằm trong HTML/JS.
- Sau khi đăng nhập, trình duyệt giữ một token tạm thời trong sessionStorage.
- Token hết hạn sau 120 phút.
- Các API chỉnh menu, dashboard và lịch sử đều yêu cầu token.


## Đổi mật khẩu ngay trong Admin

Sau khi đăng nhập, Admin có thêm khu vực:
- Mật khẩu hiện tại
- Mật khẩu mới
- Nhập lại mật khẩu mới

Hệ thống kiểm tra mật khẩu hiện tại ở Google Apps Script rồi mới cập nhật Script Properties.

Sau khi thay `Code.gs`, nhớ:
Deploy > Manage deployments > Edit > New version > Deploy
