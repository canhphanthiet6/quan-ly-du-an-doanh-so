# Hải Sản Cảng Phan Thiết · Cổng điều hành nội bộ

Website nội bộ quản lý đơn hàng, khách hàng, doanh số và công việc của công ty kinh doanh hải sản.

## Chức năng chính

- Đăng nhập riêng cho từng nhân sự.
- Giám đốc xem và chỉnh sửa toàn bộ đơn hàng; nhân viên chỉ chỉnh sửa đơn hàng do mình phụ trách hoặc tạo.
- Theo dõi đơn hàng/cơ hội bán theo 4 giai đoạn: Khách mới, Đang báo giá, Sắp chốt, Đã chốt đơn.
- Danh mục hải sản gợi ý: cá nục, cá bạc má, cá ngừ, cá thu, mực ống, mực trứng, bạch tuộc, ghẹ, tôm và combo hải sản.
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

## Triển khai trên Railway

1. Kết nối repository GitHub với Railway.
2. Thêm dịch vụ PostgreSQL trong cùng project Railway.
3. Trong dịch vụ website, tạo biến `DATABASE_URL` và chọn tham chiếu `DATABASE_URL` của PostgreSQL.
4. Build command: `npm run build`
5. Start command: `npm run start`
6. Deploy lại dịch vụ.

Lần đầu mở website, hệ thống sẽ yêu cầu tạo tài khoản Giám đốc. Tài khoản này có toàn quyền quản trị.
