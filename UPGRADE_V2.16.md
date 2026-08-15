# NÂNG CẤP V2.15 → V2.16

## Mục tiêu

V2.16 bổ sung Ribbon và các thao tác giống Excel cho BOQ gốc.

## 1. Ribbon theo tab

Thanh chức năng được gom thành:

### TRANG CHỦ
- Font chữ.
- Cỡ chữ.
- In đậm.
- In nghiêng.
- Căn trái.
- Căn giữa.
- Căn phải.
- Xuống dòng.

### CHÈN
- Chèn hàng phía trên.
- Chèn hàng phía dưới.
- Chèn cột bên trái.
- Chèn cột bên phải.

### HIỂN THỊ
- Cố định tại ô đang chọn.
- Cố định hàng đầu.
- Cố định cột đầu.
- Bỏ cố định.
- Zoom.
- Vừa màn hình.

### DỮ LIỆU
- Group hàng.
- Ungroup hàng.
- Group cột.
- Ungroup cột.

## 2. Chọn ô / vùng

- Click ô: chọn một ô.
- Shift + click ô khác: chọn một vùng.
- Click số hàng: chọn cả hàng.
- Shift + click số hàng: chọn nhiều hàng.
- Click chữ cột A/B/C: chọn cả cột.
- Shift + click cột khác: chọn nhiều cột.

Format được áp dụng lên toàn bộ vùng đang chọn.

## 3. Font và định dạng

Hỗ trợ:
- Arial
- Calibri
- Times New Roman
- Tahoma
- Verdana

Cỡ:
8, 9, 10, 11, 12, 14, 16, 18, 20, 24.

## 4. Cố định hàng/cột

`Cố định tại ô chọn` hoạt động theo nguyên tắc Freeze Panes:

Ví dụ chọn D8:
- cố định các hàng phía trên dòng 8;
- cố định các cột bên trái cột D.

Thiết lập Freeze được nhớ trên trình duyệt.

## 5. Chèn hàng/cột

Khi chèn:
- dữ liệu cũ được dịch đúng vị trí;
- merge phía sau được dịch;
- merge bị chèn ở giữa được mở rộng;
- style được dịch theo;
- group được dịch theo;
- vùng dữ liệu A1:R... được tính lại.

## 6. Group

Chọn từ 2 hàng/cột trở lên rồi bấm Group.

Hệ thống tạo nút +/- trên header để:
- thu gọn;
- mở rộng.

Group được lưu vào BOQ khi bấm `Lưu thay đổi`.

## 7. Lưu thay đổi

Format, chèn hàng/cột và Group KHÔNG ghi Firebase ngay.

Khi có thay đổi, góc phải Ribbon báo:
`● Chưa lưu`

Bấm:
`Lưu thay đổi`

để ghi `sourceGrid` mới vào Revision.

Độ rộng cột, Zoom và Freeze vẫn là tùy chọn hiển thị riêng trên trình duyệt.

## Firebase

Không cần thay Rules nếu V2.15 đang hoạt động bình thường.
