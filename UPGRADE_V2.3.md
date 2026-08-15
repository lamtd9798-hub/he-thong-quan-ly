# NÂNG CẤP TỪ V2.2 LÊN V2.3

## 1. Copy code lên GitHub

Giải nén `he-thong-quan-ly-v2.3-full.zip`.

Copy đè TOÀN BỘ nội dung bên trong lên root repo GitHub.

Sau khi deploy đúng, góc trái sẽ hiện:

`Company Hub · V2.3`

## 2. Firebase Rules — BẮT BUỘC

Vào:

Firebase Console → Realtime Database → Quy tắc / Rules

Xóa rules cũ, dán toàn bộ nội dung file:

`database.rules.json`

sau đó bấm **Xuất bản / Publish**.

V2.3 có nhánh mới:

`/v2/tasks`

Nếu chưa Publish rules mới, menu Giao việc có thể báo PERMISSION_DENIED.

## 3. Test nhanh

1. Đăng nhập Admin.
2. Mở `Giao việc & Tiến độ`.
3. Bấm `Tạo bộ việc đấu thầu`.
4. Chọn dự án DA-2026-001.
5. Chọn người phụ trách.
6. Tạo 6 công việc.
7. Kiểm tra Kanban.
8. Chuyển một việc sang `Đang thực hiện`.
9. Đánh dấu một việc `Đang vướng`.
10. Sang `Báo cáo tuần / tháng` → `Tự tổng hợp từ Giao việc`.

## 4. Dữ liệu cũ

Dữ liệu V2.0 / V2.1 / V2.2 vẫn giữ nguyên.
V2.3 chỉ bổ sung module mới và không xóa dự án/BOQ/RFQ/approval hiện tại.
