# NÂNG CẤP V2.12 → V2.13

## 1. Cập nhật GitHub

Giải nén:
`he-thong-quan-ly-v2.13-full.zip`

Copy đè toàn bộ lên repository.

Kiểm tra góc trái:
`Company Hub · V2.13`

Sau đó:
`Ctrl + F5`

## 2. Firebase

Không cần đổi Rules nếu V2.12 đang chạy bình thường.

## 3. Với BOQ đã upload trước đây

Vào:

`Triển khai → Kiểm soát khối lượng → BOQ gốc`

Bấm:

`Nạp lại BOQ gốc`

Chọn:
- file Excel gốc,
- đúng Sheet.

Hệ thống sẽ lưu nguyên snapshot Sheet.

Không cần tạo Revision mới chỉ để sửa cách hiển thị.

## 4. Kết quả cần kiểm tra

Nếu Excel có vùng A1:R354, BOQ gốc trên web phải tạo lại đủ vùng đó.

Các điểm cần giống:
- số hàng;
- số cột;
- vị trí nội dung;
- ô merge;
- độ rộng cột;
- chiều cao dòng;
- các dòng title/ghi chú/hệ thống/khu vực;
- các cột riêng như KL Tuấn Nguyễn, Ghi chú...

Bảng quản lý `Tổng hợp BOQ` vẫn là bảng riêng và không thay thế BOQ gốc.
