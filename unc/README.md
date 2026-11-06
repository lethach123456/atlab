# Trang tra cứu chứng nhận UNC

Giao diện UNC dùng `data.php` tra cứu qua API bảo hành AT Dental Lab. Các dòng cùng mã trả vị trí răng gộp; khi có nhiều dòng sứ hoặc thời hạn, các giá trị được liệt kê trong mẫu UNC. Dữ liệu không có trong API hiển thị “Chưa cập nhật”.

Máy chủ PHP cần cURL và hai biến môi trường `WARRANTY_API_URL` (địa chỉ HTTPS của hàm lookupWarranty) và `WARRANTY_API_KEY` (khóa được cấp). Không đặt khóa trong HTML hoặc Git. Chạy cục bộ bằng `npm start`; trang ở `/kiem-tra-chung-nhan-xuat-xu`. Có thể đặt `PHP_BINARY` theo đường dẫn PHP. Cấu hình hạn mức truy cập trên máy chủ trước khi công khai.

Mẫu giao diện kết quả và bước xác nhận của người dùng được giữ lại. Nguồn Google Sheet và tiến trình tải dữ liệu nền không còn được sử dụng khi tra cứu.
