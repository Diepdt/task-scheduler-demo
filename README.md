# Demo Cron Scheduler - NestJS

Demo hệ thống Scheduler sử dụng NestJS nhằm giải quyết bài toán kiểm tra Cron Expression và thực thi tác vụ tự động theo thời gian người dùng cấu hình.

Dự án được thực hiện nhằm tìm hiểu cách:
- Validate Cron Expression
- Tính lần chạy tiếp theo (`nextRun`)
- Đăng ký Cron Job động và thực thi theo lịch bằng NestJS

## Mô Tả Dự Án

**Cron Scheduler Demo** là một ứng dụng học tập xây dựng bằng NestJS. Tập trung vào 2 yêu cầu chính:

1. **Validate Cron Expression**: Kiểm tra cú pháp Cron Expression và tính toán thời gian chạy tiếp theo
2. **Thực thi Job tự động**: Đăng ký Cron Job động và tự động thực thi callback khi đến thời gian được cấu hình

CRUD Task chỉ là chức năng phụ để quản lý danh sách công việc.

## Đáp ứng yêu cầu đề bài

### 1. Validate Cron Expression

- Nhập Cron Expression từ request
- Kiểm tra cú pháp bằng `cron-parser`
- Nếu **hợp lệ**:
  - Trả về `nextRun`: thời gian chạy tiếp theo
  - Status: `valid: true`
- Nếu **không hợp lệ**:
  - Trả về thông báo lỗi từ `cron-parser`
  - Status: `valid: false`

### 2. Thực thi công việc theo lịch

Sau khi người dùng tạo Task:

- Lưu Task vào bộ nhớ RAM
- Đăng ký **CronJob động** bằng `cron` library
- Sử dụng `SchedulerRegistry` để quản lý job trong NestJS
- Khi đến **đúng thời gian**:
  - Callback được gọi tự động
  - Demo bằng `console.log("Execute Task: ...")`

### 3. Quản lý Task (CRUD)

- Tạo Task
- Xem danh sách Task
- Cập nhật Task
- Xóa Task

## Kiến trúc xử lý

```
Nguời dùng nhập Cron Expression
              ↓
        cron-parser
              ↓
      Kiểm tra cú pháp
              ↓
        Nếu hợp lệ
              ↓
      Tính Next Run
              ↓
     Tạo CronJob
              ↓
   SchedulerRegistry
     đăng ký Job
              ↓
      Đến thời gian
              ↓
    Callback thực thi
      (console.log)
```

## Giải pháp

### Validate Cron Expression

**Thư viện**: `cron-parser`

**Chức năng**:
- Validate Cron Expression
- Tính lần chạy tiếp theo
- Trả về thông báo lỗi khi sai cú pháp

**Ví dụ**:
```typescript
const interval = CronExpressionParser.parse("0 0 * * *");
const nextRun = interval.next().toDate(); // 2026-07-15T00:00:00.000Z
```

### Thực thi Job Động

**Thư viện**:
- `cron`: Tạo CronJob
- `@nestjs/schedule`: Module lập lịch
- `SchedulerRegistry`: Quản lý job trong runtime

**Chức năng**:
- Tạo CronJob động từ Cron Expression
- Đăng ký Job vào SchedulerRegistry
- Tự động thực thi callback khi đến thời gian
- Có thể start/stop/delete job

**Ví dụ**:
```typescript
const job = new CronJob(expression, () => {
  console.log(`Execute Task: ${title}`);
});
this.schedulerRegistry.addCronJob(id.toString(), job);
job.start();
```

## Công Nghệ

- **NestJS 11.0.1**: Framework Node.js
- **@nestjs/schedule**: Module lập lịch
- **SchedulerRegistry**: Quản lý Cron Job
- **cron**: Thư viện thực thi Cron
- **cron-parser**: Validate và tính Cron Expression
- **Swagger**: API documentation
- **class-validator**: Validation DTO
- **TypeScript**: Ngôn ngữ chính

## Cài Đặt

### Yêu Cầu
- Node.js 18+ 
- npm hoặc yarn

### Các Bước Cài Đặt

1. **Clone hoặc tải dự án**
   ```bash
   cd task_schedule_v0
   ```

2. **Cài đặt dependencies**
   ```bash
   npm install
   ```

3. **Chạy ứng dụng ở chế độ phát triển**
   ```bash
   npm run start:dev
   ```

   Ứng dụng sẽ khởi động trên `http://localhost:3000`

## Sử Dụng

### Khởi Động Ứng Dụng

**Chế độ phát triển (Development):**
```bash
npm run start:dev
```

**Chế độ sản xuất (Production):**
```bash
npm run build
npm run start:prod
```

**Chế độ debug:**
```bash
npm run start:debug
```

### Truy Cập API Documentation

Sau khi khởi động ứng dụng, truy cập Swagger UI tại:
```
http://localhost:3000/api
```

## API Endpoints

Tất cả các endpoint nằm dưới route `/scheduler`

### 1. Validate Cron Expression

**Endpoint**: `POST /scheduler/validate`

**Mô tả**: Kiểm tra tính hợp lệ của biểu thức Cron

**Request Body**:
```json
{
  "expression": "0 */2 * * * *"
}
```

**Response Success (200)**:
```json
{
  "valid": true,
  "nextRun": "2026-07-15T10:00:00.000Z"
}
```

**Response Error (400)**:
```json
{
  "valid": false,
  "message": "Invalid cron expression"
}
```

### 2. Tạo Tác Vụ

**Endpoint**: `POST /scheduler`

**Mô tả**: Tạo một tác vụ lên lịch mới

**Request Body**:
```json
{
  "title": "Backup Database",
  "expression": "0 2 * * *"
}
```

**Response Success (201)**:
```json
{
  "message": "Create successfully!",
  "data": {
    "id": 1,
    "title": "Backup Database",
    "expression": "0 2 * * *"
  }
}
```

**Response Error**:
```json
{
  "message": "Invalid cron expression"
}
```

### 3. Lấy Danh Sách Tất Cả Tác Vụ

**Endpoint**: `GET /scheduler`

**Mô tả**: Lấy danh sách tất cả các tác vụ được tạo

**Response Success (200)**:
```json
[
  {
    "id": 1,
    "title": "Backup Database",
    "expression": "0 2 * * *"
  },
  {
    "id": 2,
    "title": "Clean Logs",
    "expression": "0 0 * * 0"
  }
]
```

### 4. Cập Nhật Tác Vụ

**Endpoint**: `PUT /scheduler/:id`

**Mô tả**: Cập nhật thông tin của một tác vụ

**Request Body**:
```json
{
  "title": "Daily Backup",
  "expression": "0 3 * * *"
}
```

**Response Success (200)**:
```json
{
  "id": 1,
  "title": "Daily Backup",
  "expression": "0 3 * * *"
}
```

### 5. Xóa Tác Vụ

**Endpoint**: `DELETE /scheduler/:id`

**Mô tả**: Xóa một tác vụ

**Response Success (200)**:
```json
{
  "message": "Delete successfully!"
}
```

## Cấu Trúc Dự Án

```
task_schedule_v0/
├── src/
│   ├── main.ts                    # Entry point
│   ├── app.module.ts              # Root module
│   ├── app.controller.ts          # App controller
│   ├── app.service.ts             # App service
│   └── scheduler/
│       ├── scheduler.module.ts    # Scheduler module
│       ├── scheduler.controller.ts # Scheduler controller
│       ├── scheduler.service.ts   # Scheduler service (logic chính)
│       ├── dto/
│       │   ├── createTask.dto.ts
│       │   ├── updateTask.dto.ts
│       │   └── validate-cron.dto.ts
│       └── interfaces/
│           └── task.interface.ts
├── test/
│   ├── app.e2e-spec.ts
│   └── jest-e2e.json
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── nest-cli.json
├── eslint.config.mjs
└── README.md
```

## Giải Thích Các Thành Phần Chính

### SchedulerService
Dịch vụ chính chứa logic quản lý tác vụ:
- `validate()`: Xác thực biểu thức Cron
- `create()`: Tạo tác vụ mới
- `get()`: Lấy danh sách tác vụ
- `update()`: Cập nhật tác vụ
- `delete()`: Xóa tác vụ
- `registerTask()`: Đăng ký tác vụ với Cron scheduler

### Task Interface
```typescript
interface Task {
  id: number;
  title: string;
  expression: string;
}
```

## Ví Dụ Biểu Thức Cron

Dưới đây là một số ví dụ biểu thức Cron phổ biến:

| Biểu Thức | Mô Tả |
|-----------|--------|
| `0 0 * * *` | Hàng ngày lúc nửa đêm |
| `0 9 * * 1-5` | Các ngày trong tuần lúc 9:00 sáng |
| `*/15 * * * *` | Cứ 15 phút |
| `0 */2 * * *` | Cứ 2 giờ |
| `0 0 1 * *` | Đầu tháng |
| `0 0 * * 0` | Hàng tuần vào Chủ nhật |
| `*/30 * * * * *` | Cứ 30 giây |


