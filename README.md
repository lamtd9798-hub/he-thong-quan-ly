# HỆ THỐNG QUẢN LÝ CÔNG TY — V2.6

Đây là bản xây lại từ đầu, dùng cho GitHub Pages + Firebase.






## Nâng cấp V2.6 — Chuẩn hóa tài chính + Dashboard Giám đốc

V2.6 tập trung sửa logic quản trị thay vì mở thêm nhiều menu.

### 1. Sửa Forecast Cost và lợi nhuận ảo

Logic mới:

`Forecast hiệu lực = MAX(Forecast kế hoạch, Actual Cost + PO còn cam kết)`

- Nếu Forecast của một Budget để 0, hệ thống mặc định lấy Budget.
- Actual Cost liên kết với PO sẽ tự giảm phần PO còn cam kết.
- Forecast không thể thấp hơn phần chi phí đã thực tế phát sinh + phần PO chưa thành Actual.
- Chấm dứt tình trạng Budget > 0 nhưng Forecast = 0 và lợi nhuận dự kiến = 100%.

### 2. PO → Actual Cost

Khi ghi nhận chi phí thực tế có thể chọn PO liên quan.

Hệ thống tự lấy:
- NCC.
- Nội dung.
- Giá trị tham khảo.
- Số PO.

Liên kết này giúp không cộng trùng:
`PO cam kết + hóa đơn thực tế của cùng PO`.

### 3. Dashboard Giám đốc

Dashboard có **Bảng điều hành Giám đốc**:

- Tổng giá trị hợp đồng.
- Forecast Cost.
- Lợi nhuận dự kiến.
- Phải thu.
- Số dự án Đỏ.
- Số dự án Vàng.

Mỗi dự án tự đánh giá:

- **XANH**: trong ngưỡng kiểm soát.
- **VÀNG**: cần theo dõi.
- **ĐỎ**: cần can thiệp.

Cảnh báo dựa trên:
- Forecast lỗ.
- Forecast vượt Budget.
- Công nợ khách hàng quá hạn.
- Tiến độ dự án trễ.
- Công việc quá hạn.
- Hồ sơ kỹ thuật trễ.
- Vật tư trễ.

### 4. Cash Flow 6 tháng

Tự dự báo theo tháng từ:
- Công nợ khách hàng đến hạn.
- Công nợ NCC đến hạn.
- PO còn cam kết chưa thành Actual.
- Điều chỉnh thu/chi thủ công.

Hiển thị:
- Thu dự kiến.
- Chi dự kiến.
- Net Cash Flow tháng.
- Số dư dự kiến.
- Cảnh báo số dư âm.

### 5. Nghiệm thu → Hóa đơn → Thu tiền

Billing V2.6 tách rõ:

`Giá trị nghiệm thu`
`- Giữ lại bảo hành`
`- Thu hồi tạm ứng`
`= Giá trị đủ điều kiện xuất trước VAT`
`+ VAT`
`= Tổng hóa đơn`

Theo dõi riêng:
- Giá trị đã nghiệm thu.
- Giữ lại bảo hành.
- Thu hồi tạm ứng.
- Giá trị đã xuất hóa đơn.
- Đã thu.
- Còn phải thu.

### 6. Audit Log tài chính

Tự lưu lịch sử:
- Sửa hợp đồng.
- Sửa Budget / Forecast.
- Tạo/sửa chi phí.
- Thanh toán NCC.
- Tạo/sửa/duyệt Variation.
- Tạo/sửa hóa đơn.
- Thu tiền khách hàng.
- Điều chỉnh Cash Flow.

Mỗi log lưu:
- Người thao tác.
- Thời điểm.
- Loại dữ liệu.
- Dữ liệu trước.
- Dữ liệu sau.

### 7. Sửa cache giao diện

CSS và JavaScript đều dùng version `2.6.0`.
Khi nâng cấp sẽ hạn chế trường hợp GitHub đã có code mới nhưng trình duyệt vẫn hiển thị CSS/JS cũ.

### Firebase mới
- `/v2/cashFlowPlans/{projectId}/{YYYY-MM}`
- `/v2/financeAudit/{projectId}/{auditId}`

## Nâng cấp V2.5 — Tài chính dự án

Thêm menu **Tài chính dự án** theo vòng đời:

`Giá trị hợp đồng → Budget → PO/Chi phí → Phát sinh → Xuất hóa đơn → Thu tiền → Lợi nhuận`

### 1. Hợp đồng & Budget
- Giá trị hợp đồng gốc trước VAT.
- VAT, ngày ký, hạn hợp đồng, tạm ứng, giữ lại bảo hành.
- Giá trị hợp đồng tự lấy mặc định từ giá đã duyệt/trúng thầu.
- Phát sinh đã duyệt tự cộng/trừ để ra **HĐ điều chỉnh**.
- Nút **Tạo Budget từ BOQ**:
  - Vật tư.
  - Nhân công.
  - Thầu phụ.
  - Chi phí khác.
  - Chi phí chung.
  - Dự phòng.
- Mỗi Budget có **Budget Amount** và **Forecast Cost**.

### 2. PO / Cam kết chi phí
- Hệ thống đọc trực tiếp dữ liệu PO từ module **Triển khai → Vật tư & Mua hàng**.
- Tự tổng hợp giá trị PO đang cam kết.

### 3. Chi phí thực tế & Công nợ NCC
- Ngày ghi nhận.
- Nhóm chi phí.
- Hệ thống.
- NCC / Thầu phụ.
- Nội dung.
- Số hóa đơn / chứng từ.
- Giá trị trước VAT.
- VAT.
- Hạn thanh toán.
- Ghi nhận nhiều lần thanh toán cho cùng một chứng từ.
- Tự tính:
  - Tổng phải trả.
  - Đã trả.
  - Còn nợ.
  - Khoản quá hạn.

### 4. Phát sinh / Variation
- Phát sinh tăng hoặc giảm.
- Trạng thái Nháp / Đã trình / Đã duyệt / Từ chối.
- Chỉ phát sinh **Đã duyệt** mới làm thay đổi giá trị hợp đồng.
- Có ngày duyệt và tham chiếu CĐT.

### 5. Xuất hóa đơn & Thu tiền
- Số hóa đơn / đợt.
- Ngày xuất.
- Hạn thanh toán.
- Giá trị trước VAT.
- VAT.
- Ghi nhận nhiều lần thu tiền.
- Tự tính:
  - Đã xuất hóa đơn.
  - Đã thu.
  - Còn phải thu.
  - Hóa đơn quá hạn.

### 6. Hiệu quả dự án
Tự tính:
- HĐ điều chỉnh.
- Budget.
- PO cam kết.
- Actual Cost.
- Forecast Cost.
- Forecast Profit.
- Forecast Margin %.
- Phải thu khách hàng.
- Phải trả NCC.
- Dòng tiền ròng đã thu - đã trả.

Dashboard cũng có thêm **Tài chính danh mục dự án** cho Giám đốc/Quản lý.

### Dữ liệu Firebase mới
- `/v2/financeSettings/{projectId}`
- `/v2/budgets/{projectId}/{id}`
- `/v2/actualCosts/{projectId}/{id}`
- `/v2/supplierPayments/{projectId}/{id}`
- `/v2/variations/{projectId}/{id}`
- `/v2/billings/{projectId}/{id}`
- `/v2/receipts/{projectId}/{id}`

## Nâng cấp V2.4 — Quản lý triển khai sau khi trúng thầu

Module **Triển khai** được xây lại theo luồng:

`Trúng thầu → Bàn giao Tender → Kỹ thuật → Hồ sơ kỹ thuật → Vật tư/Mua hàng → Thi công → Nghiệm thu → Hoàn thành`

### 1. Bàn giao Tender → Kỹ thuật

Checklist 8 nội dung:
- Phạm vi hợp đồng.
- BOQ / Giá trúng thầu.
- Clarification / Exclusion.
- Báo giá NCC / Thầu phụ.
- Cơ sở thiết kế / Spec / Tiêu chuẩn.
- Liên hệ CĐT / TVGS / Tổng thầu.
- Yêu cầu tiến độ hợp đồng.
- Điều kiện thương mại cần lưu ý.

Có người bàn giao, người nhận, ngày bàn giao, link thư mục hồ sơ và ghi chú.

### 2. Hồ sơ kỹ thuật

Theo dõi:
- Shopdrawing.
- Material Submission.
- RFI.
- Biện pháp thi công.
- Hồ sơ khác.

Mỗi hồ sơ có mã, hệ, revision, người phụ trách, deadline, ngày trình, trạng thái và comment.

Trạng thái:
- Đang chuẩn bị.
- Đã trình.
- Yêu cầu sửa.
- Đã duyệt.

### 3. Vật tư & Mua hàng

Theo dõi:
- Hạng mục.
- Hệ thống.
- NCC.
- Số PO.
- Giá trị.
- Ngày cần tại công trường.
- Ngày PO.
- Ngày dự kiến giao.
- Trạng thái giao hàng.

Cảnh báo tự động nếu quá ngày cần mà vật tư chưa về.

### 4. Thi công & Nghiệm thu

Theo dõi:
- Mốc/công việc.
- Nhóm.
- Người phụ trách.
- Ngày bắt đầu.
- Deadline.
- % tiến độ.
- Trạng thái.
- Vướng mắc.
- Kết quả nghiệm thu / Biên bản.

Có nút **Tạo bộ mốc triển khai** tự sinh 8 mốc chuẩn từ Kickoff đến ngày mục tiêu.

### Dữ liệu mới

- `/v2/handover/{projectId}`
- `/v2/executionDocs/{projectId}/{id}`
- `/v2/procurement/{projectId}/{id}`
- `/v2/milestones/{projectId}/{id}`

## Nâng cấp V2.3 — Giao việc & Tiến độ

Đã bổ sung module **Giao việc & Tiến độ**:

- Giao việc theo dự án hoặc công việc chung.
- Chọn người phụ trách từ danh sách người dùng V2.
- Nhóm công việc: kiểm tra hồ sơ, BOQ, RFQ, lập giá, trình duyệt, nộp thầu, kỹ thuật, vật tư, thi công...
- Ngày bắt đầu và deadline.
- Ưu tiên: Thấp / Bình thường / Cao / Khẩn cấp.
- Trạng thái: Chưa thực hiện / Đang thực hiện / Đang vướng / Hoàn thành.
- % hoàn thành.
- Ghi rõ vướng mắc và hành động tiếp theo.
- Kanban 4 cột và chế độ danh sách.
- Cảnh báo công việc quá hạn.
- Lọc theo dự án, nhân viên, trạng thái, ưu tiên.
- Nút **Tạo bộ việc đấu thầu** tự sinh 6 mốc:
  1. Kiểm tra hồ sơ.
  2. Bóc / rà BOQ.
  3. RFQ / hỏi giá.
  4. Tổng hợp & lập giá.
  5. Trình duyệt.
  6. Nộp thầu.
- Deadline 6 mốc được chia tự động từ ngày hiện tại đến hạn nộp thầu.
- Dashboard hiển thị việc quá hạn, việc đang vướng và việc của người đang đăng nhập.
- Báo cáo tuần/tháng có nút **Tự tổng hợp từ Giao việc**:
  - Việc đã hoàn thành.
  - Việc đang thực hiện.
  - Kế hoạch tiếp theo.
  - Vướng mắc.
  - Việc quá hạn.
- Nhân viên có thể cập nhật công việc được giao cho chính mình.
- Role VIEWER chỉ được xem.

Dữ liệu mới:

- `/v2/tasks/{taskId}`

## Nâng cấp V2.2

Đã bổ sung module **BOQ & Lập giá**:

- Chọn dự án và quản lý BOQ theo từng dòng.
- Các trường: hệ thống, nhóm, mô tả, spec, ĐVT, khối lượng.
- Chi phí: vật tư, nhân công, thầu phụ, chi phí khác.
- Hao hụt %.
- Markup %.
- Tự tính NET/ĐVT, giá chào/ĐVT, thành tiền NET, thành tiền chào.
- Tổng giá NET, tổng giá chào, lợi nhuận gộp và tỷ lệ lợi nhuận.
- So sánh nhiều báo giá nhà cung cấp cho từng dòng BOQ.
- Lưu hãng, lead time, điều khoản thanh toán, hiệu lực báo giá.
- Chọn một báo giá → tự cập nhật giá vật tư vào dòng BOQ.
- Xuất BOQ CSV.
- Tải mẫu CSV và nhập BOQ hàng loạt từ CSV.
- Khi trình duyệt giá, hệ thống tự lấy tổng từ BOQ.
- Hồ sơ trình giá lưu snapshot BOQ tại thời điểm trình để về sau đối chiếu.
- Siết Database Rules: Đấu thầu/Trưởng phòng không thể tự đổi trạng thái hồ sơ sang APPROVED/REJECTED; quyền quyết định thuộc Giám đốc/Admin.

Dữ liệu mới:

- `/v2/boq/{projectId}/{itemId}`
- `/v2/supplierQuotes/{projectId}/{itemId}/{quoteId}`


### Nâng cấp mới V2.2

- Sửa cache/route: bấm **BOQ & Lập giá** sẽ mở đúng module, kể cả sau khi GitHub Pages vừa cập nhật.
- Chi phí chung dự án %.
- Dự phòng / Contingency %.
- Chiết khấu giá chào %.
- VAT %.
- Tách rõ NET trực tiếp, tổng chi phí dự án, giá chào trước VAT và tổng sau VAT.
- Ma trận so sánh NCC: vật tư theo hàng, nhà cung cấp theo cột, đánh dấu giá thấp nhất và giá đang chọn.
- Lưu nhiều phiên bản BOQ dạng snapshot bất biến.
- Xem chi tiết từng phiên bản và khôi phục phiên bản cũ.
- Khi trình Giám đốc, hệ thống tự tạo một snapshot BOQ và gắn vào hồ sơ phê duyệt.
- Hồ sơ duyệt lưu thêm VAT và tổng giá sau VAT.

Dữ liệu mới:
- `/v2/pricingSettings/{projectId}`
- `/v2/boqVersions/{projectId}/{versionId}`

## Chức năng đã có

- Đăng nhập Firebase Authentication.
- Dashboard quản trị.
- Danh mục dự án.
- Pipeline đấu thầu.
- BOQ & Lập giá chi tiết.
- So sánh báo giá nhiều nhà cung cấp.
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
- `/v2/boq`
- `/v2/supplierQuotes`
- `/v2/pricingSettings`
- `/v2/boqVersions`
- `/v2/approvals`
- `/v2/execution`
- `/v2/reports`
- `/v2/activities`
- `/v2/tasks`

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

- File upload báo giá/hồ sơ.
- Material/Shopdrawing register.
- Task & Gantt.
- PO/Mua hàng.
- Nghiệm thu/khối lượng/thanh toán.
- Export Excel/PDF.
