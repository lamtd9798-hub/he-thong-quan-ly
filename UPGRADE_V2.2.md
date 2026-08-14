# NÂNG CẤP V2.2

## Cách cập nhật

1. Copy đè TOÀN BỘ source V2.2 lên root repo GitHub.
2. Vào Firebase Console → Realtime Database → Rules.
3. Copy toàn bộ `database.rules.json` V2.2 và Publish.
4. Mở lại GitHub Pages. V2.2 dùng query version `?v=2.2.0` để tránh trình duyệt giữ file JavaScript cũ.
5. Nếu tab đang mở từ trước, nhấn Ctrl+F5 một lần sau khi GitHub Pages deploy xong.

## Chức năng mới

### BOQ & Lập giá
- Chi phí chung %.
- Dự phòng %.
- Chiết khấu %.
- VAT %.
- Giá chào trước VAT và tổng sau VAT.

### Ma trận NCC
Bấm `Ma trận NCC` để xem:
- Mỗi dòng = một vật tư BOQ.
- Mỗi cột = một nhà cung cấp.
- Giá thấp nhất được đánh dấu.
- Giá đang chọn vào BOQ được đánh dấu riêng.
- Có thể chọn giá trực tiếp trong ma trận.

### Version BOQ
- `Lưu phiên bản`: khóa snapshot BOQ hiện tại.
- `Phiên bản`: xem lịch sử.
- `Xem`: xem BOQ phiên bản cũ ở chế độ chỉ đọc.
- `Khôi phục`: đưa snapshot cũ trở lại bản đang làm.

### Trình duyệt
Khi gửi duyệt giá, hệ thống tự tạo một snapshot BOQ để đảm bảo sau này BOQ đang làm có thay đổi thì hồ sơ Giám đốc đã duyệt vẫn có dấu vết chính xác.

## Nhánh dữ liệu mới
- `/v2/pricingSettings`
- `/v2/boqVersions`

Dữ liệu V2/V2.1 cũ vẫn được giữ nguyên.
