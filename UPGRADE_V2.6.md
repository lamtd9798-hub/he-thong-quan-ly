# NÂNG CẤP TỪ V2.5 LÊN V2.6

## Bước 1 — GitHub

Giải nén `he-thong-quan-ly-v2.6-full.zip`.

Copy đè TOÀN BỘ nội dung bên trong lên root repository GitHub.

Khi đúng bản mới, góc trái phải hiện:

`Company Hub · V2.6`

V2.6 có thêm cache version cho cả CSS và JS.

## Bước 2 — Firebase Rules (BẮT BUỘC)

Firebase Console → Realtime Database → Quy tắc / Rules

1. Ctrl+A xóa Rules cũ.
2. Mở `FIREBASE_RULES_V2.6_COPY.txt`.
3. Copy toàn bộ.
4. Dán vào Firebase.
5. Bấm `Xuất bản / Publish`.

Rules V2.6 vẫn giữ sửa lỗi đọc `/v2/users`.

## Bước 3 — Test logic Forecast

Mở `Tài chính dự án`.

Nếu:
- Budget = 200.000đ
- Actual = 30.000đ
- Forecast Budget đang để 0

thì Forecast V2.6 phải tự trở về ít nhất:
- Budget 200.000đ nếu chưa có PO/Actual vượt Budget, hoặc
- Actual + PO còn cam kết nếu con số này lớn hơn Budget/Forecast kế hoạch.

Không còn trường hợp Forecast = 0 và LN = 100% khi đã có Budget.

## Bước 4 — Test PO → Actual

Triển khai → Vật tư & Mua hàng:
- Tạo 1 PO.

Tài chính → Chi phí & Công nợ NCC:
- Ghi nhận chi phí.
- Chọn PO liên quan.

Forecast phải giảm phần PO còn cam kết tương ứng, không cộng trùng toàn bộ PO + Actual.

## Bước 5 — Test Nghiệm thu / Billing

Tài chính → Xuất HĐ & Thu tiền:

Ví dụ:
- Nghiệm thu: 100.000.000
- Giữ lại: 5%
- Thu hồi tạm ứng: 10.000.000
- VAT: 10%

Hệ thống phải tính:
- Giữ lại = 5.000.000
- Đủ xuất trước VAT = 85.000.000
- Tổng gồm VAT = 93.500.000

## Bước 6 — Cash Flow

Tổng quan tài chính → `Điều chỉnh kế hoạch`.

Nhập kế hoạch thu/chi bổ sung.

Kiểm tra bảng Cash Flow 6 tháng:
- Thu tự động.
- Chi tự động.
- Điều chỉnh.
- Net tháng.
- Số dư dự kiến.

## Bước 7 — Dashboard Giám đốc

Mở Dashboard.

Kiểm tra phần:
`BẢNG ĐIỀU HÀNH GIÁM ĐỐC`

Dự án phải có trạng thái:
- XANH
- VÀNG
- ĐỎ

và hiển thị cảnh báo chính.

## Dữ liệu mới

- `/v2/cashFlowPlans`
- `/v2/financeAudit`

Dữ liệu V2.0 → V2.5 vẫn giữ nguyên.
