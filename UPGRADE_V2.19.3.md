# NÂNG CẤP V2.19.2 → V2.19.3

## Sửa BOQ bị mất cột trong Lập giá đấu thầu

Nguyên nhân:
Module Lập giá còn kế thừa giới hạn cũ chỉ lưu 11 cột A→K.

V2.19.3 bỏ hoàn toàn giới hạn này trong module Lập giá.

### Excel
Hệ thống giữ toàn bộ cột thực sự có dữ liệu trong Sheet:
- Vật tư chính
- Nhân công / vật tư phụ
- Tổng cộng
- Thành tiền
- Ghi chú
- và các cột khác có trong BOQ

Các cột trống dư do Excel từng format xa bên phải sẽ tự được bỏ.

### CSV
Giữ toàn bộ cột có dữ liệu, không còn cắt 11 cột đầu.

## Quan trọng với BOQ đã upload bằng V2.19.2

sourceGrid hiện tại đã bị lưu mất cột từ lần upload cũ.

Sau khi cập nhật V2.19.3:
1. Vào Lập giá đấu thầu → 1. BOQ.
2. Bấm Thay BOQ.
3. Chọn lại file Excel gốc và đúng Sheet.

Lúc đó bảng mới được lưu lại đầy đủ cột.

## Firebase
Không cần thay Rules.
