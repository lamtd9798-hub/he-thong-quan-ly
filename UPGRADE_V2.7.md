# NÂNG CẤP TỪ V2.6 LÊN V2.7

## 1. GitHub

Giải nén:

`he-thong-quan-ly-v2.7-full.zip`

Copy đè toàn bộ nội dung lên root repository GitHub.

Khi đúng bản mới, góc trái phải hiện:

`Company Hub · V2.7`

## 2. Firebase Rules — BẮT BUỘC

Firebase Console → Realtime Database → Quy tắc / Rules

1. Ctrl+A xóa Rules hiện tại.
2. Mở file `FIREBASE_RULES_V2.7_COPY.txt`.
3. Copy toàn bộ.
4. Dán vào Firebase.
5. Bấm `Xuất bản / Publish`.

Rules V2.7 vẫn giữ sửa lỗi đọc `/v2/users`.

## 3. Dự án mới trúng thầu

Ở:

`Đấu thầu → Trúng thầu → Bàn giao`

V2.7 tự khóa BOQ hiện tại thành **Baseline BOQ** trước khi chuyển sang Triển khai.

## 4. Dự án đã bàn giao trước V2.7

Vào:

`Triển khai → Kiểm soát khối lượng`

Nếu chưa có Baseline:

bấm **Khởi tạo Baseline từ BOQ hiện tại**.

Chỉ thực hiện khi BOQ của dự án đã đúng khối lượng trúng thầu.

## 5. Test phiếu

Tạo phiếu:

`DDH-2026-001`

Ví dụ BOQ:

- Ống DN50: 1.000 m
- Giá chào: 120.000đ/m

Phiếu 1:
- 400 m → Duyệt.

Phiếu 2:
- 350 m → Duyệt.

Phiếu 3:
- 300 m → trước khi duyệt hệ thống phải cảnh báo:
  - Tổng sau phiếu: 1.050 m.
  - Vượt: 50 m.
  - Giá trị vượt: 6.000.000đ.

Sau khi duyệt:
- Dòng DN50 chuyển đỏ.
- Tổng đã đặt = 1.050 m.
- Chênh = +50 m.
- GT vượt = +6.000.000đ.

## 6. Test quy đổi

Ví dụ:

- BOQ: m.
- Đơn vị đặt: cây.
- Hệ số: 6.
- Số lượng: 20.

Hệ thống phải quy đổi:

`20 cây × 6 = 120 m BOQ`

## 7. Test ngoài BOQ

Trong phiếu:

- Chọn `+ ĐẦU MỤC NGOÀI BOQ`.
- Nhập vật tư.
- Nhập ĐVT.
- Nhập giá chào và giá mua dự kiến.
- Chọn lý do.

Sau khi phiếu được duyệt, đầu mục phải xuất hiện tại tab:

`Ngoài BOQ`

và được cảnh báo đỏ.

## 8. Test Variation

Tại đầu mục vượt:

bấm `Tạo VO`.

Kiểm tra:

`Tài chính dự án → Phát sinh`

phải có Variation nháp được tạo từ kiểm soát khối lượng.

## Dữ liệu mới

- `/v2/quantityBaseline`
- `/v2/quantityBaselineMeta`
- `/v2/orderRequests`
- `/v2/quantityAudit`

Dữ liệu từ V2.0 → V2.6 vẫn giữ nguyên.
