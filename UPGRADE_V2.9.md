# NÂNG CẤP TỪ V2.8 LÊN V2.9

## 1. Cập nhật GitHub

Giải nén:

`he-thong-quan-ly-v2.9-full.zip`

Copy đè toàn bộ nội dung lên repository.

Khi đúng bản mới, góc trái phải hiện:

`Company Hub · V2.9`

Sau đó nhấn:

`Ctrl + F5`

## 2. Firebase Rules

V2.9 không thay đổi Rules so với V2.8.

Nếu V2.8 của bạn đang chạy bình thường thì KHÔNG cần dán lại Firebase Rules.

File `FIREBASE_RULES_V2.9_COPY.txt` vẫn được kèm theo để lưu trữ/đối chiếu.

## 3. Test Excel

Vào:

`Triển khai → Kiểm soát khối lượng`

Chọn:

`Tải BOQ Revision`

Kiểm tra ô file phải ghi:

`File BOQ Excel / CSV`

và chọn được:

- `.xlsx`
- `.xls`
- `.csv`

## 4. Excel nhiều Sheet

Chọn một file có nhiều Sheet.

Sau khi chọn file phải xuất hiện:

`Sheet cần nhập`

Chọn đúng Sheet, ví dụ:

- PCCC
- CTN
- HVAC
- BOQ Tổng

## 5. Dòng tiêu đề

Nếu bảng BOQ không bắt đầu ở dòng 1, kiểm tra ô:

`Dòng tiêu đề`

Hệ thống sẽ tự dò trong 40 dòng đầu. Có thể nhập số dòng thủ công nếu nhận sai.

## 6. Preview

Trước khi bấm `Tải & So sánh`, giao diện phải hiển thị:

- File.
- Sheet.
- Dòng tiêu đề.
- Các tên cột.
- Trạng thái đã nhận được Mô tả + Khối lượng hay chưa.

## 7. Mẫu Excel

Bấm:

`Tải mẫu Excel`

phải tải file:

`MAU_BOQ_REVISION.xlsx`

## 8. Quy trình sau Import

Không thay đổi:

`Upload → Mapping → So sánh R0/R1/R2 → Áp dụng Baseline`

Excel không tự ghi đè Baseline khi vừa chọn file.
