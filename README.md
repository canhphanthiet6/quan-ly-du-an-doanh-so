# Hải Sản Cảng Phan Thiết · Cổng điều hành nội bộ

Website nội bộ quản lý đơn hàng, khách hàng, doanh số và công việc của công ty kinh doanh hải sản.

## Chức năng chính

- Đăng nhập riêng cho từng nhân sự.
- Giám đốc xem và chỉnh sửa toàn bộ đơn hàng; nhân viên chỉ chỉnh sửa đơn hàng do mình phụ trách hoặc tạo.
- Theo dõi đơn hàng/cơ hội bán theo 4 giai đoạn: Khách mới, Đang báo giá, Sắp chốt, Đã chốt đơn.
- Một đơn hàng có thể gồm nhiều loại hải sản; mỗi dòng nhập số lượng theo đơn vị của sản phẩm.
- Đơn giá tự lấy từ giá bán hiện tại trong Kho hàng, tự tính thành tiền từng dòng và cộng tổng giá trị đơn hàng.
- Giá bán và ngày chốt giá được lưu theo từng dòng, vì vậy việc đổi giá trong Kho hàng sau này không làm thay đổi đơn hàng cũ.
- Tách riêng tên khách hàng, số điện thoại, loại khách hàng và kênh bán hàng trên mỗi báo giá/đơn hàng.
- Tự động tạo Data khách hàng khi lưu báo giá hoặc đơn hàng mới.
- Ghi chính xác ngày và giờ khách hàng được tự động lưu vào Data khách hàng.
- Nhận diện khách cũ khi trùng cả tên và số điện thoại; hiển thị số lần khách quay lại ngay trên biểu mẫu.
- Thư mục Hợp đồng liên kết với đơn hàng, khách hàng và Sales phụ trách.
- Doanh số chỉ được ghi nhận khi Giám đốc duyệt hợp đồng sang trạng thái `Đã ký`; hệ thống tự cộng cho người bán được phân công trên đơn hàng.
- Bảng tổng hợp doanh số theo từng Sales và lịch sử hợp đồng của từng khách hàng.
- Menu Kênh bán hàng riêng, có thể chọn từng tháng để xem số khách, số đơn/báo giá, giá trị dự kiến, hợp đồng đã ký và doanh số thực tế của từng kênh.
- Xếp hạng kênh hiệu quả nhất theo doanh số hợp đồng đã ký trong tháng: Trực tiếp, Facebook, Zalo, TikTok, khách giới thiệu, khách cũ quay lại, điện thoại và các kênh khác.
- Danh mục hải sản gợi ý: cá nục, cá bạc má, cá ngừ, cá thu, mực ống, mực trứng, bạch tuộc, ghẹ, tôm và combo hải sản.
- Hệ thống tự bổ sung sẵn 10 mặt hàng chính nếu Kho đang thiếu: cá nục, cá bạc má, cá bã trầu, cá ngừ, cá thu, bạch tuộc, mực ống, mực trứng, mực khô và mực 1 nắng.
- Mặt hàng được bổ sung có giá ban đầu bằng 0 và được đánh dấu “Cần cập nhật giá bán”; cần nhập giá trong Kho hàng trước khi đưa vào đơn.
- Quản lý xuất kho, nhập kho, điều chỉnh tăng/giảm và tự động tính tồn kho.
- Theo dõi giá nhập, giá bán, lãi dự kiến và giá trị hàng tồn.
- Phân loại hàng bán chạy, bán chậm theo lượng xuất trong 30 ngày.
- Tự đề xuất số lượng nên nhập dựa trên sức bán, tồn hiện tại và mức tồn tối thiểu.
- Hàng hết được tô đỏ, hàng sắp hết được tô vàng.
- Thiết lập tháng béo ngon nhất và ghi chú mùa vụ cho từng loại hải sản.
- Báo cáo công việc, kế hoạch tuần, công văn đi/đến, lịch họp, lịch hẹn và công tác.
- Thông báo việc sắp đến hạn hoặc đã quá hạn.
- Quản lý vai trò: Giám đốc, Admin, Sales, Kế toán, Hành chính.

Giám đốc, Admin và Kế toán được cập nhật kho. Sales và Hành chính được xem dữ liệu kho nhưng không được tạo phiếu.

## Quy tắc khách hàng và hợp đồng

- Một khách hàng được nhận diện bằng cặp `Tên khách hàng + Số điện thoại` sau khi hệ thống chuẩn hóa cách viết.
- Trước khi tạo đơn hàng, cần khai báo sản phẩm và giá bán trong Kho hàng. Tổng tiền đơn hàng không nhập thủ công mà do hệ thống tự tính.
- Lần đầu lưu là khách mới. Mỗi báo giá/đơn hàng mới có cùng tên và số điện thoại sẽ được ghi nhận là quay lại lần 1, lần 2, lần 3...
- Sales chỉ được tạo hợp đồng từ đơn hàng của mình. Admin và Kế toán có thể nhập hợp đồng; chỉ Giám đốc được duyệt, sửa trạng thái hoặc hủy.
- Hợp đồng `Chờ duyệt` chưa được tính doanh số. Hợp đồng `Đã ký` mới được cộng vào doanh số của Sales phụ trách.

## Triển khai trên Railway

1. Kết nối repository GitHub với Railway.
2. Thêm dịch vụ PostgreSQL trong cùng project Railway.
3. Trong dịch vụ website, tạo biến `DATABASE_URL` và chọn tham chiếu `DATABASE_URL` của PostgreSQL.
4. Build command: `npm run build`
5. Start command: `npm run start`
6. Deploy lại dịch vụ.

Lần đầu mở website, hệ thống sẽ yêu cầu tạo tài khoản Giám đốc. Tài khoản này có toàn quyền quản trị.
