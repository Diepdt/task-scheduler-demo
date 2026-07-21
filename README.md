# Demo Cron Scheduler - NestJS + Redis & BullMQ

Demo hệ thống Scheduler sử dụng NestJS tích hợp **Redis & BullMQ** nhằm giải quyết bài toán kiểm tra Cron Expression, đẩy tác vụ vào hàng chờ (Job Queue) và thực thi xử lý bất đồng bộ ngầm bằng Worker.

Dự án được thực hiện nhằm tìm hiểu cách:
- Validate Cron Expression và tính thời gian chạy tiếp theo (`nextRun`)
- Đăng ký Cron Job động trong runtime bằng NestJS `@nestjs/schedule`
- Quản lý hàng chờ (Message Queue) & phân tải công việc bằng **Redis & BullMQ** (`@nestjs/bullmq`)
- Tự động thực thi, thử lại khi gặp lỗi (Retry with backoff) và lưu lịch sử chạy (`TaskLog`) qua **Prisma ORM**

---

## Mô Tả Dự Án

**Cron Scheduler Demo** tập trung vào các yêu cầu cốt lõi:

1. **Validate Cron Expression**: Kiểm tra cú pháp Cron Expression và tính toán thời gian chạy tiếp theo
2. **Hàng chờ & Worker thực thi ngầm (Redis & BullMQ)**: 
   - Khi đến giờ Cron reo, **`SchedulerService` (Producer)** chỉ ném Job vào **Redis Queue**.
   - **`TaskProcessor` (Worker / Consumer)** lắng nghe RedisQueue, nhặt công việc ra thực thi độc lập ở phía sau (Background).
   - Tự động **Retry 3 lần** (cách nhau 5s) nếu công việc bị lỗi.
3. **Lưu nhật ký thực thi (TaskLog)**: Ghi lại trạng thái (`RUNNING`, `SUCCESS`, `FAILED`), thời điểm bắt đầu, kết thúc và thời gian xử lý (`durationMs`) vào Database.
4. **Quản lý Task (CRUD)**: Quản lý danh sách tác vụ lên lịch.

---

## Kiến Trúc Xử Lý (Architecture)

```
[Người dùng / Client]
        │
        ▼ (HTTP Requests)
 [SchedulerController]
        │
        ▼
 [SchedulerService] ──(Cron reo)──► [Redis Queue (BullMQ)]
 (Producer)                                │
                                           ▼ (Lấy Job ngầm)
                                    [TaskProcessor]
                                    (Worker / Consumer)
                                           │
                                           ▼ (Ghi Log)
                                  [Database (Prisma ORM)]
```

---

## Công Nghệ Sử Dụng

- **NestJS 11.0.1**: Framework Node.js chính
- **@nestjs/bullmq & BullMQ**: Quản lý Job Queue & Worker background process
- **Redis**: In-memory Message Broker / Data Store
- **Prisma ORM**: Quản lý Database & Task History Log
- **@nestjs/schedule & cron**: Module lập lịch động
- **cron-parser**: Validate và tính biểu thức Cron
- **Swagger UI**: Tài liệu hóa API (`/api`)
- **TypeScript**: Ngôn ngữ lập trình chính

---

## Cài Đặt & Chạy Ứng Dụng

### Yêu Cầu Tiền Đề
- Node.js 18+
- npm hoặc yarn
- **Redis Server** đang chạy trên `localhost:6379` (hoặc cấu hình thông qua biến môi trường `REDIS_HOST`, `REDIS_PORT`)

> 💡 **Khởi động Redis nhanh bằng Docker**:
> ```bash
> docker run -d -p 6379:6379 --name redis-task-scheduler redis:alpine
> ```

### Các Bước Cài Đặt

1. **Clone hoặc chuyển vào thư mục dự án**
   ```bash
   cd task_schedule_v0
   ```

2. **Cài đặt dependencies**
   ```bash
   npm install
   ```

3. **Chạy Migration Database (Prisma)**
   ```bash
   npx prisma db push
   ```

4. **Chạy ứng dụng ở chế độ phát triển**
   ```bash
   npm run start:dev
   ```

   Ứng dụng sẽ khởi động tại `http://localhost:3000`
   Swagger UI xem API: `http://localhost:3000/api`

---

## Cấu Trúc Dự Án

```
task_schedule_v0/
├── src/
│   ├── main.ts                    # Entry point ứng dụng
│   ├── app.module.ts              # Root module (Cấu hình BullModule Redis)
│   ├── app.controller.ts          
│   ├── app.service.ts             
│   ├── prisma/                    # Module Prisma kết nối CSDL
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   └── scheduler/
│       ├── scheduler.module.ts    # Đăng ký Queue 'task-scheduler' & Providers
│       ├── scheduler.controller.ts # REST API Controller
│       ├── scheduler.service.ts   # Producer: Tạo Task & đẩy Job vào Redis
│       ├── task.processor.ts      # Worker/Consumer: Nhận Job từ Redis & xử lý
│       ├── dto/
│       │   ├── createTask.dto.ts
│       │   ├── updateTask.dto.ts
│       │   └── validate-cron.dto.ts
│       └── interfaces/
│           └── task.interface.ts
├── prisma/
│   └── schema.prisma              # Database Schema (Task, TaskLog)
├── package.json
└── README.md
```

---

## API Endpoints (`/scheduler`)

| Method | Endpoint | Mô Tả |
| :--- | :--- | :--- |
| `POST` | `/scheduler/validate` | Kiểm tra cú pháp Cron Expression & tính `nextRun` |
| `POST` | `/scheduler` | Tạo tác vụ lên lịch mới (Tự động kích hoạt Cron + BullMQ) |
| `GET` | `/scheduler` | Lấy danh sách tất cả các tác vụ |
| `GET` | `/scheduler/:id/logs` | Xem lịch sử nhật ký thực thi (`TaskLog`) của một tác vụ |
| `PUT` | `/scheduler/:id` | Cập nhật tên hoặc biểu thức Cron của tác vụ |
| `DELETE` | `/scheduler/:id` | Xóa tác vụ & hủy bỏ CronJob tương ứng |

---

## Cơ Chế Retry Khi Gặp Lỗi (Fault Tolerance)

Khi một Job được Worker xử lý trong `TaskProcessor`, nếu xảy ra sự cố (Database timeout, lỗi mạng, lỗi ứng dụng...):

1. **Khối Catch bắt lỗi**: Ghi nhận log `FAILED` vào DB và re-throw exception.
2. **BullMQ nhận biết thất bại**: Đưa Job vào trạng thái chờ (Delay 5 giây).
3. **Thực thi lại (Retry)**: Sau 5 giây, Worker tự động thử lại Job. Hỗ trợ tối đa **3 lần thử**.
