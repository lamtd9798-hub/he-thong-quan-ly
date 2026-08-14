# HỆ THỐNG QUẢN LÝ CÔNG TY — V2

Đây là bản xây lại từ đầu, dùng cho GitHub Pages + Firebase.

## Chức năng đã có

- Đăng nhập Firebase Authentication.
- Dashboard quản trị.
- Danh mục dự án.
- Pipeline đấu thầu.
- RFQ / Hỏi giá nhà cung cấp.
- Trình giá nhiều phiên bản.
- Giám đốc duyệt / từ chối giá.
- Trúng thầu → bàn giao kỹ thuật.
- Theo dõi triển khai và % tiến độ.
- Báo cáo tuần / tháng.
- Người dùng & phân quyền.
- Nhật ký hoạt động.
- Responsive cho laptop/màn hình nhỏ.

## Dữ liệu V2

Dữ liệu mới lưu riêng dưới:

- `/v2/users`
- `/v2/projects`
- `/v2/rfqs`
- `/v2/approvals`
- `/v2/execution`
- `/v2/reports`
- `/v2/activities`

Dữ liệu cũ không bị ghi đè.

## Cách thay web cũ trên GitHub

1. Backup repo cũ nếu cần.
2. Xóa nội dung cũ trên branch `main`.
3. Copy TOÀN BỘ file/thư mục của bộ V2 này lên root repo.
4. Commit + Push.
5. Nếu GitHub Pages đang chạy `main / root` thì trang V2 sẽ được publish.

## Firebase

Bản này dùng lại Firebase project hiện tại và tài khoản Authentication cũ.

Admin bootstrap:
`lamtd9798@gmail.com`

Tài khoản khác đăng nhập lần đầu sẽ tự tạo profile V2 với role `EMPLOYEE`.
Admin vào **Người dùng & phân quyền** để đổi role.

Role:
- ADMIN
- DIRECTOR
- MANAGER
- TENDER
- PROCUREMENT
- TECHNICAL
- EMPLOYEE
- VIEWER

## QUAN TRỌNG: Database Rules

Upload `database.rules.json` lên GitHub KHÔNG làm rules Firebase thay đổi.

Cần vào:
Firebase Console → Realtime Database → Rules

Sau đó copy nội dung `database.rules.json` và Publish.

Nếu hệ thống V1 vẫn cần chạy tạm, hãy backup rules cũ trước khi thay.

## Chạy local

Không mở `index.html` bằng `file://` vì JavaScript dùng ES Modules.
Dùng VS Code Live Server hoặc GitHub Pages.

## Hướng phát triển tiếp theo

- BOQ line-item chi tiết.
- So sánh 3–5 báo giá NCC.
- File upload báo giá/hồ sơ.
- Material/Shopdrawing register.
- Task & Gantt.
- PO/Mua hàng.
- Nghiệm thu/khối lượng/thanh toán.
- Export Excel/PDF.
