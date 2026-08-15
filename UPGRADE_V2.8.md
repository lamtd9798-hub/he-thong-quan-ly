# NÂNG CẤP TỪ V2.7 LÊN V2.8

## 1. Cập nhật GitHub

Giải nén:

`he-thong-quan-ly-v2.8-full.zip`

Copy đè toàn bộ nội dung lên root repository.

Khi đúng bản mới, góc trái phải hiện:

`Company Hub · V2.8`

## 2. Firebase Rules — BẮT BUỘC

Firebase Console → Realtime Database → Quy tắc / Rules

1. Ctrl+A xóa Rules hiện tại.
2. Mở `FIREBASE_RULES_V2.8_COPY.txt`.
3. Copy toàn bộ.
4. Dán vào Firebase.
5. Bấm `Xuất bản / Publish`.

V2.8 thêm quyền cho:
- `/v2/quantityBoqRevisions`
- cập nhật Baseline khi quản lý kích hoạt R1/R2/R3.

Rules vẫn giữ fix đọc `/v2/users`.

## 3. Với dự án trong ảnh hiện tại chưa có Baseline

Vào:

`Triển khai → Kiểm soát khối lượng`

Bấm:

`Khởi tạo R0 từ BOQ hiện tại`

nếu BOQ hiện tại đúng là BOQ đấu thầu/trúng thầu.

Sau đó tab sẽ xuất hiện:
`BOQ Revision`.

## 4. Tải BOQ hợp đồng R1

Trong `Kiểm soát khối lượng`:

1. Bấm `＋ Tải BOQ Revision`.
2. Chọn `BOQ Hợp đồng`.
3. Đặt tên, ví dụ:
   `R1 - BOQ Hợp đồng số 15/2026`.
4. Chọn ngày hiệu lực.
5. Chọn file CSV.
6. Bấm `Tải & So sánh`.

Revision R1 CHƯA được áp dụng ngay.

## 5. File CSV

Tối thiểu cần:

- Mô tả.
- Khối lượng.

Khuyến nghị có:

- STT/Mã.
- Hệ.
- Nhóm.
- Mô tả.
- Thông số.
- ĐVT.
- Khối lượng.
- Giá chào/ĐVT.

Nếu không có giá chào mới, hệ thống kế thừa giá của đầu mục đã map từ Revision trước.

Có nút `Tải mẫu CSV` ngay trong cửa sổ Upload.

## 6. Kiểm tra Mapping

Sau khi Upload, hệ thống mở bảng so sánh.

Nếu dòng có:
`CHƯA MAP`

bấm:
`Map lại`

và chọn đầu mục tương ứng của R0/R1 trước đó.

Sau khi mapping đúng, mở lại So sánh để kiểm tra.

## 7. Kích hoạt R1

Sau khi kiểm tra xong:

bấm:
`Áp dụng R1 làm Baseline`

Hệ thống hỏi xác nhận và hiển thị:
- số đầu mục thay đổi,
- Δ giá trị so Revision đang dùng,
- Δ giá trị so Tender R0,
- số phiếu đặt hàng cũ sẽ được tính lại.

Xác nhận xong, R1 trở thành Baseline đang áp dụng.

## 8. Test ví dụ

R0:
- DN50 = 1.000 m
- Đơn giá = 120.000đ/m

R1:
- DN50 = 1.200 m

Công trường đặt:
- 1.260 m

Kết quả phải là:

- Tender R0 = 1.000 m
- Baseline R1 = 1.200 m
- Δ HĐ = +200 m
- Đã đặt = 1.260 m
- Vượt công trường = +60 m
- Giá trị Δ HĐ = +24.000.000đ
- Giá trị vượt công trường = +7.200.000đ

Hai loại chênh không được cộng lẫn nhau.

## 9. R2 / Phụ lục

Tải tiếp file mới → hệ thống tự tạo R2.

Quy trình vẫn:

`Upload → Mapping → So sánh → Xác nhận áp dụng`.

R0/R1 không bị xóa và có thể xem lịch sử.

## Dữ liệu cũ

Dữ liệu V2.0 → V2.7 vẫn được giữ nguyên.
