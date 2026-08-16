# NÂNG CẤP V2.19.3 → V2.19.4

## BOQ trở thành bảng chỉnh sửa trực tiếp

Vào `Lập giá đấu thầu → 1. BOQ`.

### Sửa nội dung
- Click ô rồi gõ để sửa chữ hoặc số.
- Shift + click để chọn vùng.
- Click số hàng để chọn cả hàng; Shift + click để chọn nhiều hàng.
- Click chữ cột A/B/C... để chọn cả cột.

### Định dạng
Thanh công cụ phía trên có:
- Font Arial / Calibri / Times New Roman / Tahoma / Verdana.
- Cỡ chữ 8–24.
- In đậm / in nghiêng.
- Căn trái / căn giữa / căn phải.
- Xuống dòng.

### Gộp ô
- `Gộp ô`: gộp toàn bộ vùng chữ nhật đang chọn.
- `Gộp ngang`: gộp từng hàng trong vùng chọn.
- `Bỏ gộp`: bỏ merge giao với vùng chọn.

### Hàng / cột
- Kéo mép chữ A/B/C... để đổi độ rộng cột.
- Kéo mép số hàng để đổi chiều cao hàng.
- Nhấp đúp mép cột/hàng để AutoFit.
- Chèn hàng trên / hàng dưới.
- Chèn cột trái / cột phải.
- Xóa hàng / xóa cột có xác nhận.

### Lưu
Khi có thay đổi, trạng thái hiện `● Chưa lưu`.
Bấm `Lưu BOQ` để:
1. lưu nguyên sourceGrid (nội dung, merge, style, width, height) vào Firebase;
2. tự nhận diện lại header/cột BOQ;
3. đồng bộ lại các dòng BOQ phục vụ ráp giá;
4. giữ nguồn giá cũ nếu đơn giá vật tư không thay đổi; nếu sửa giá bằng tay thì chuyển sang trạng thái MANUAL.

## Firebase
Không cần thay Rules so với V2.19.3.
