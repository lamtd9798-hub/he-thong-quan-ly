# NÂNG CẤP V2.19 → V2.19.1

## Báo giá vật tư tải bổ sung theo từng đợt

Không cần tải toàn bộ file giá cùng lúc.

Quy trình mới:
1. Upload BOQ trước.
2. Khi NCC nào gửi báo giá thì vào tab `2. Báo giá vật tư`.
3. Bấm `+ Thêm báo giá mới`.
4. Tải 1 file hoặc nhiều file vừa nhận được.
5. Các file mới được nối thêm vào kho giá của dự án; file cũ không bị xóa.
6. Hệ thống chỉ tự điền các dòng BOQ đang chưa có giá và có độ khớp >=95%.
7. Dòng đã có giá/đã chọn trước đó không bị ghi đè tự động. Báo giá mới vẫn xuất hiện ở tab `3. Ráp giá` để người dùng chủ động chọn nếu muốn đổi giá.

## Hotfix BOQ gốc

Sửa lỗi `Cannot read properties of undefined (reading 'qty')` khi bảng BOQ gốc có những hàng không map vào item dữ liệu.

## Firebase

Không đổi Rules so với V2.19.
