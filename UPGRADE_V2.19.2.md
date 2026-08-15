# NÂNG CẤP V2.19.1 → V2.19.2

## Sửa upload báo giá vật tư

V2.19.2 xử lý file báo giá không đồng nhất giữa các NCC.

### Nhận diện linh hoạt hơn

Không còn bắt buộc tiêu đề phải đúng chữ:
- Mô tả / Tên hàng
- Đơn giá

Hệ thống sẽ kết hợp:
1. Tên cột.
2. Kiểu dữ liệu phía dưới.
3. Mật độ text của cột mô tả.
4. Mật độ số và độ lớn tiền của cột giá.
5. Các dòng có Mô tả + Giá xuất hiện cùng nhau.

Tự loại trừ:
- Số lượng / Khối lượng.
- Thành tiền / Tổng tiền.
- VAT / Thuế.
- Chiết khấu / %.

Hỗ trợ tiêu đề 1–4 hàng và quét 80 dòng đầu.

## Nhiều file trong một lần

Mỗi file được xử lý độc lập.

Ví dụ chọn 9 file:
- 6 file đọc được → vẫn lưu đủ 6 file.
- 3 file chưa nhận được → bỏ qua và báo riêng.
- Một file lỗi không còn làm hỏng cả lượt upload.

Preview hiển thị:
- Sheet được chọn.
- Dòng tiêu đề.
- Số dòng giá.
- Cột Mô tả hệ thống nhận.
- Cột Giá hệ thống nhận.

## Firebase

Không cần thay Firebase Rules.
