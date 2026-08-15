# NÂNG CẤP TỪ V2.4.1 LÊN V2.5

## 1. Copy code lên GitHub
Giải nén `he-thong-quan-ly-v2.5-full.zip`.

Copy đè TOÀN BỘ nội dung bên trong lên root repository GitHub.

Khi đúng bản mới, góc trái hiện:

`Company Hub · V2.5`

## 2. Firebase Rules — BẮT BUỘC

Firebase Console → Realtime Database → Quy tắc / Rules

- Ctrl+A xóa Rules cũ.
- Mở `FIREBASE_RULES_V2.5_COPY.txt`.
- Copy toàn bộ.
- Dán vào Firebase.
- Bấm **Xuất bản / Publish**.

Rules V2.5 vẫn giữ bản sửa lỗi `/v2/users`, nên các menu Giao việc / Triển khai / Người dùng không bị lỗi permission như trước.

## 3. Test V2.5

1. Mở `Tài chính dự án`.
2. Chọn dự án đang triển khai.
3. Bấm `Cấu hình hợp đồng`.
4. Kiểm tra giá trị HĐ có lấy từ giá đã duyệt hay không.
5. Sang `Hợp đồng & Budget`.
6. Bấm `Tạo Budget từ BOQ`.
7. Sang `Chi phí & Công nợ NCC` → ghi một chi phí.
8. Bấm `Thanh toán` → ghi một lần thanh toán.
9. Sang `Phát sinh` → tạo một VO và duyệt.
10. Sang `Xuất HĐ & Thu tiền` → tạo hóa đơn → ghi nhận thu tiền.
11. Quay về `Tổng quan` kiểm tra Forecast Profit, Phải thu và Phải trả.
12. Mở Dashboard kiểm tra phần `Tài chính danh mục dự án`.

## 4. Dữ liệu cũ
Dữ liệu V2.0 → V2.4.1 vẫn giữ nguyên. V2.5 chỉ bổ sung các nhánh tài chính mới.
