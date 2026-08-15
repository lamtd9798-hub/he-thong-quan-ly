# NÂNG CẤP V2.11 → V2.12

## 1. GitHub

Giải nén:
`he-thong-quan-ly-v2.12-full.zip`

Copy đè toàn bộ lên repository.

Góc trái phải hiện:
`Company Hub · V2.12`

Sau đó:
`Ctrl + F5`

## 2. Firebase

Không cần thay Rules nếu V2.11 đang chạy bình thường.

## 3. Với R0 anh đã upload ở V2.11

KHÔNG cần tạo R1 chỉ để sửa giao diện.

Vào:

`Triển khai → Kiểm soát khối lượng → BOQ chi tiết`

Bấm:

`Tải lại cấu trúc từ Excel / CSV`

Chọn đúng file BOQ gốc.

Chức năng này chỉ bổ sung cấu trúc hiển thị, không thay Baseline hiện tại.

## 4. Kết quả mong đợi với file trong ảnh

Phải thấy theo thứ tự:

`GHI CHÚ CHUNG`
→ các dòng note
→ `1.0 HỆ THỐNG CHỮA CHÁY SPRINKER + VÁCH TƯỜNG`
→ `1.1 Khu vực hầm`
→ `1.101 Tủ điều khiển bơm`
→ `1.102 Bơm chữa cháy chính`
→ ...

Tab `BOQ chi tiết` phải giữ các cột nguồn như:
- Mục
- Diễn giải
- Đơn vị
- Khối lượng
- KL Tuấn Nguyễn
- Model/Thông số
- Nhãn hiệu
- Xuất xứ
- Vật tư chính
- Nhân công và vật tư phụ
- Tổng cộng
- Thành tiền
- Ghi chú

## 5. Trường hợp KL

Nếu `Khối lượng` trống nhưng `KL Tuấn Nguyễn = 2`,
đầu mục vẫn phải được nhận là ITEM với KL = 2.
