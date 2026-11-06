# API tra cứu bảo hành

Hàm `lookupWarranty` cho phép máy chủ của website đối tác tra cứu bằng `GET`:

```sh
curl -H 'x-api-key: API_KEY_CUA_BAN' 'https://us-central1-PROJECT_ID.cloudfunctions.net/lookupWarranty?code=UC11503'
```

Phản hồi JSON có mã bảo hành, tên và số điện thoại khách hàng, tên và địa chỉ nha khoa, `teeth` là vị trí gộp của các dòng, và `restorations` gồm dòng sứ, vị trí, số lượng, thời hạn, ngày, hình thể, trạng thái, ghi chú, đơn giá và thành tiền của từng dòng. Vị trí giữ nguyên cách ghi; phần giống hệt được gộp một lần. Các dòng cùng mã nhưng khác khách hàng, nha khoa hoặc labo trả lỗi 409 để tránh ghép nhầm hồ sơ. Mã cần được lưu bằng chữ hoa trong Firestore.

Mã lỗi: 400 mã không hợp lệ, 401 thiếu hoặc sai khóa, 404 không tìm thấy, 405 sai phương thức, 409 mã không xác định duy nhất hoặc quá 100 dòng, 503 Firestore không khả dụng.

Khóa được lưu trong Firebase Secret Manager dưới tên `WARRANTY_API_CONFIG`, chứa JSON với `apiKey` và `ownerId` của labo. Đặt khóa ngẫu nhiên mạnh và mã labo bằng `firebase functions:secrets:set WARRANTY_API_CONFIG --format=json --project PROJECT_ID`, sau đó triển khai riêng `firebase deploy --project PROJECT_ID --only functions:lookupWarranty`. Không đưa khóa vào mã frontend hay Git. Website gọi API từ máy chủ của mình và cấp cho trình duyệt một endpoint riêng. CORS không được bật; cần giới hạn tần suất truy cập trên hạ tầng trước khi cấp quyền rộng rãi.
