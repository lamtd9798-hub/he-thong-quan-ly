# NÂNG CẤP V2.14 → V2.15

## Mục tiêu

V2.15 không thay đổi dữ liệu BOQ và không thêm lại các cột quản lý.

Bản này chỉ cải thiện trải nghiệm bảng BOQ gốc.

## Giao diện mới

Bảng BOQ được làm lại gần kiểu Excel hơn:

- grid line nhẹ hơn;
- chữ lớn và rõ hơn;
- thanh công cụ riêng;
- header cột/hàng rõ ràng;
- click ô có khung chọn màu xanh;
- header hàng/cột đang chọn được highlight;
- scrollbar gọn hơn.

## Chỉnh độ rộng cột bằng tay

Đưa chuột vào mép phải của tiêu đề cột A/B/C...

Khi con trỏ thành resize:

`Kéo trái / phải`

để thay đổi độ rộng cột.

Độ rộng được nhớ trên trình duyệt theo:
- dự án;
- Revision;
- Sheet.

Reload trang vẫn giữ kích thước đã chỉnh trên máy đó.

## AutoFit

Nhấp đúp vào mép phải tiêu đề cột.

Hệ thống tự tính độ rộng theo nội dung của cột.

Các ô merge nhiều cột được bỏ qua khi AutoFit để tránh làm cột rộng bất thường.

## Zoom

Thanh công cụ có:

- `−`
- `100%`
- `＋`
- `Vừa màn hình`
- `Khôi phục cột`

`Vừa màn hình` tự thu bảng để nhìn được nhiều cột hơn.

`Khôi phục cột` trả độ rộng về kích thước lấy từ file Excel gốc.

## Firebase

Không cần thay Firebase Rules.
Các thay đổi độ rộng và Zoom được lưu trên trình duyệt, không sửa file BOQ gốc.
