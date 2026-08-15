# NÂNG CẤP V2.10 → V2.11

## Cập nhật

Giải nén:
`he-thong-quan-ly-v2.11-full.zip`

Copy đè toàn bộ lên GitHub.

Kiểm tra góc trái:
`Company Hub · V2.11`

Sau đó:
`Ctrl + F5`

## Firebase

Không cần đổi Rules nếu V2.10 đang kết nối Firebase bình thường.

## Trường hợp file trong ảnh

Nếu file có:
- 2 cột giống `Diễn giải`,
- `Khối lượng`,
- `KL Tuấn Nguyễn`,
- tiêu đề dòng 7–8 nhưng hệ thống từng chọn 7–9,

V2.11 sẽ kiểm tra dữ liệu phía dưới.

Ví dụ:
- Diễn giải cột 1: trống.
- Diễn giải cột 2: có nội dung.
- Khối lượng: ít/không có số.
- KL Tuấn Nguyễn: có số.

Hệ thống sẽ tự chọn:
- Diễn giải cột 2.
- KL Tuấn Nguyễn.

Preview phải hiển thị:
`Đã nhận ... dòng BOQ`

Nếu cấu hình 3 hàng cho ra 0 dòng, khi bấm Lưu hệ thống tự thử lại 2 hàng.
