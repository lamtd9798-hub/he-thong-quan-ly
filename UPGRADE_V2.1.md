# NÂNG CẤP TỪ V2 LÊN V2.1

## 1. Code GitHub

Copy đè TOÀN BỘ nội dung V2.1 lên root repo GitHub.

Các file mới/thay đổi quan trọng:
- index.html
- css/app.css
- js/app.js
- js/core.js
- js/modules/tender.js
- js/modules/boq.js (MỚI)
- database.rules.json
- README.md

Không cần xóa dữ liệu Firebase hiện tại.

## 2. Firebase Rules — BẮT BUỘC

Vào:
Firebase Console → Realtime Database → Rules

Copy toàn bộ nội dung `database.rules.json` của V2.1 vào và bấm Publish.

Nếu không cập nhật Rules, menu BOQ có thể báo `PERMISSION_DENIED`.

## 3. Sau khi deploy

Đăng nhập bằng tài khoản Admin / Giám đốc / Trưởng phòng / Đấu thầu.

Menu mới:
**BOQ & Lập giá**

Quy trình:
1. Chọn dự án.
2. Thêm BOQ thủ công hoặc tải mẫu CSV → nhập CSV.
3. Bấm `So giá` tại từng vật tư.
4. Thêm báo giá nhiều NCC.
5. Bấm `Chọn giá`.
6. Giá vật tư được cập nhật vào BOQ.
7. Nhập nhân công / thầu phụ / chi phí khác / hao hụt / markup.
8. Hệ thống tự tính NET, giá chào, lợi nhuận.
9. Sang `Đấu thầu → Trình & duyệt giá`.
10. Chọn dự án, tổng BOQ tự đổ vào hồ sơ trình giá.
11. Giám đốc duyệt hoặc từ chối.

## 4. Dữ liệu mới

- `/v2/boq`
- `/v2/supplierQuotes`

Dữ liệu V2 cũ:
- dự án
- RFQ
- approvals
- execution
- reports
- users

vẫn giữ nguyên.
