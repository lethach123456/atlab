# Trang tra cứu bảo hành

`index.html` và `lookup.php` cần được đặt chung trong một thư mục trên máy chủ PHP có cURL. Cấu hình biến môi trường `WARRANTY_API_URL` (địa chỉ HTTPS của hàm lookupWarranty sau khi triển khai) và `WARRANTY_API_KEY` (khóa tương ứng với Secret Manager). Đặt khóa ở cấu hình máy chủ, không ghi vào HTML hoặc Git.

Trang gọi `lookup.php` cùng miền; PHP gọi API Firebase bằng khóa và chỉ trả về các trường cần hiển thị trên trang. Firebase API phải được triển khai và cấu hình trước khi tra cứu dữ liệu thật. Cần cấu hình giới hạn số lần tra cứu ở máy chủ hoặc lớp bảo vệ trước khi công khai trang, vì mã bảo hành có thể đoán được. Các tài nguyên hình ảnh và logo liên kết trực tiếp tới website AT Dental Lab.
