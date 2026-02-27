# VidyaSetu Backend LMS — Complete API Reference

NestJS monorepo powering the entire VidyaSetu platform. Three apps share a common database (PostgreSQL) and Redis cache.

---

## 🏗 Ports & Apps

| App | Port | Purpose |
| :--- | :--- | :--- |
| `apps/main-panel` | **5000** | Public student web API |
| `apps/admin-panel` | **5001** | Instructor & admin management API |
| `apps/mobile-api` | **5002** | Mobile app API (consumed via BFF on 5003) |

---

## 📱 Mobile API (Port 5002) — `/api/v1/*`

> Used **exclusively** by the Arise app via the BFF. All routes require `authorization: Bearer <token>` unless marked 🔓 Public.

### 🔑 Auth — `/auth`

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/signup` | 🔓 Public | Register new customer. Returns `{ user, sessionId }` |
| `POST` | `/auth/login` | 🔓 Public | Login with email/password. Returns `{ user, sessionId }` |
| `POST` | `/auth/logout` | 🔒 Session | Revoke current session |
| `GET` | `/auth/me` | 🔒 Session | Get current authenticated user profile |

### 👤 Customer — `/customer`

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/customer/me` | 🔒 Session | Get full customer profile |
| `PATCH` | `/customer/me` | 🔒 Session | Update profile fields |
| `POST` | `/customer/onboarding` | 🔒 Session | Save onboarding data (language, age, grade, subjects, goals) |
| `PATCH` | `/customer/preferences` | 🔒 Session | Update language preference only |

### � Courses — `/courses`

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/courses` | 🔓 Public | List all published courses |
| `GET` | `/courses/:slug` | 🔓 Optional | Get course detail with sections, lessons, purchase status |
| `GET` | `/courses/:slug/lessons/:lessonId` | 🔓 Optional | Get lesson with video embed URL (gated if not purchased) |

### 💳 Billing — `/billing`

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/billing/plans` | 🔓 Public | List all active subscription plans |
| `POST` | `/billing/checkout/session` | 🔒 Session | Create Stripe checkout for a subscription plan. Body: `{ price_id, promotion_code? }` |
| `POST` | `/billing/checkout/course-session` | 🔒 Session | Create Stripe checkout for a single course. Body: `{ product_id, promotion_code? }` |
| `GET` | `/billing/subscription/status` | 🔒 Session | Get current subscription status, plan name, and expiry |

---

## 🌐 Main Panel API (Port 5000) — Public Web Student Portal

> Used by `frontend-Lms`. Auth via session cookie.

### 🔑 Auth — `/auth`

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/signup` | 🔓 Public | Register + set session cookie |
| `POST` | `/auth/login` | 🔓 Public | Login + set session cookie |
| `POST` | `/auth/logout` | 🔒 Session | Clear session cookie |
| `GET` | `/auth/me` | 🔒 Session | Get current user |
| `GET` | `/auth/google` | 🔓 Public | Initiate Google OAuth. Returns `{ url }` |
| `GET` | `/auth/google/callback` | 🔓 Public | OAuth callback, redirects to frontend |
| `POST` | `/auth/forgot-password` | 🔓 Public | Send password reset email. Body: `{ email }` |
| `POST` | `/auth/forgot-password/reset` | 🔓 Public | Reset password with token. Body: `{ token, password }` |

### 📚 Courses — `/courses`

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/courses` | 🔓 Public | List all published courses |
| `GET` | `/courses/:slug` | 🔓 Optional | Full course detail (sections, lessons, purchase status) |
| `GET` | `/courses/:slug/lessons/:lessonId` | 🔓 Optional | Lesson content + video embed URL |
| `GET` | `/courses/:slug/topics/:topicId` | 🔓 Optional | Topic content (sub-item inside a lesson) |
| `GET` | `/courses/:slug/quizzes` | 🔓 Optional | List all quizzes for a course |
| `GET` | `/courses/:slug/quizzes/:quizId` | 🔓 Optional | Get quiz with questions and answer options |

### 📹 Videos — `/videos`

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/videos` | 🔒 Session | List videos. Query: `?page&limit&category_id` |

### 👤 Onboarding — `/customers/me`

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/customers/me/onboarding` | 🔒 Session | Save onboarding data |
| `PATCH` | `/customers/me/preferences` | 🔒 Session | Update language preference |

### 💳 Billing — Root level

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/plans` | 🔓 Public | List active subscription plans |
| `POST` | `/checkout/session` | 🔒 Session | Create Stripe subscription checkout. Body: `{ price_id, promotion_code? }` |
| `POST` | `/checkout/course-session` | 🔒 Session | Create Stripe course purchase. Body: `{ product_id, promotion_code? }` |
| `POST` | `/checkout/portal` | 🔒 Session | Open Stripe billing portal |
| `GET` | `/checkout/subscription-status` | 🔒 Session | Get active subscription status |
| `POST` | `/webhooks/stripe` | 🔓 Public | Stripe webhook handler (requires Stripe-Signature header) |

---

## 🛡 Admin Panel API (Port 5001) — Admin & Instructor Management

> Used by `admin-Lms`. All routes require `admin_session_id` cookie unless stated.

### 🔑 Auth — `/auth`

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/auth/login` | Admin login with email/password |
| `POST` | `/auth/logout` | Revoke admin session |
| `GET` | `/auth/me` | Get current admin/instructor |

### 👥 Admin Users — `/admin-users` *(Admin role only)*

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/admin-users` | Create a new staff/instructor account |
| `GET` | `/admin-users` | List all staff members (paginated) |
| `PATCH` | `/admin-users/:id` | Update staff profile |
| `POST` | `/admin-users/:id/deactivate` | Deactivate staff account (revokes all sessions) |
| `POST` | `/admin-users/:id/activate` | Re-activate staff account |

### 🎓 Courses — `/courses`

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/courses` | Create a new course |
| `GET` | `/courses` | List all courses (instructors see only their own). Query: `?page&limit&published` |
| `GET` | `/courses/:id` | Get full course detail |
| `PATCH` | `/courses/:id` | Update course metadata |
| `DELETE` | `/courses/:id` | Soft-delete a course |
| `POST` | `/courses/:id/publish` | Publish course (also syncs to Stripe if paid) |
| `POST` | `/courses/:id/unpublish` | Unpublish course |

### � Sections — `/courses/:productId/sections`

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/courses/:productId/sections` | Add a section to a course |
| `GET` | `/courses/:productId/sections` | List all sections in a course |
| `GET` | `/courses/:productId/sections/:id` | Get a section |
| `PATCH` | `/courses/:productId/sections/:id` | Update a section |
| `DELETE` | `/courses/:productId/sections/:id` | Remove a section |
| `PUT` | `/courses/:productId/sections/reorder` | Reorder sections. Body: `{ section_ids: string[] }` |

### 📄 Lessons — `/courses/:productId/lessons`

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/courses/:productId/lessons` | Add a lesson (video or text) |
| `GET` | `/courses/:productId/lessons` | List all lessons |
| `GET` | `/courses/:productId/lessons/:id` | Get a lesson |
| `PATCH` | `/courses/:productId/lessons/:id` | Update lesson content/video |
| `DELETE` | `/courses/:productId/lessons/:id` | Soft-delete a lesson |
| `PUT` | `/courses/:productId/lessons/reorder` | Reorder lessons. Body: `{ lesson_ids: string[] }` |

### 🗒 Topics — `/courses/:productId/topics`

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/courses/:productId/topics` | Add a topic (sub-item inside a lesson) |
| `GET` | `/courses/:productId/topics` | List all topics |
| `GET` | `/courses/:productId/topics/:id` | Get a topic |
| `PATCH` | `/courses/:productId/topics/:id` | Update topic |
| `DELETE` | `/courses/:productId/topics/:id` | Remove topic |
| `PUT` | `/courses/:productId/topics/reorder` | Reorder topics |

### ❓ Quizzes — `/courses/:productId/quizzes`

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/courses/:productId/quizzes` | Create a quiz |
| `GET` | `/courses/:productId/quizzes` | List all quizzes |
| `GET` | `/courses/:productId/quizzes/:id` | Get quiz + questions + options |
| `PATCH` | `/courses/:productId/quizzes/:id` | Update quiz settings |
| `DELETE` | `/courses/:productId/quizzes/:id` | Remove quiz |
| `PUT` | `/courses/:productId/quizzes/reorder` | Reorder quizzes |
| `POST` | `/courses/:productId/quizzes/:quizId/questions` | Add a question |
| `PATCH` | `/courses/:productId/quizzes/:quizId/questions/:questionId` | Update a question |
| `DELETE` | `/courses/:productId/quizzes/:quizId/questions/:questionId` | Remove a question |
| `PUT` | `/courses/:productId/quizzes/:quizId/questions/reorder` | Reorder questions |
| `POST` | `/courses/:productId/quizzes/:quizId/questions/:questionId/options` | Add an answer option |
| `PATCH` | `/courses/:productId/quizzes/:quizId/questions/:questionId/options/:optionId` | Update option |
| `DELETE` | `/courses/:productId/quizzes/:quizId/questions/:questionId/options/:optionId` | Remove option |
| `PUT` | `/courses/:productId/quizzes/:quizId/questions/:questionId/options/reorder` | Reorder options |

### 🎬 Videos — `/videos`

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/videos` | Create video record (linked to Bunny CDN) |
| `GET` | `/videos` | List all videos. Query: `?page&limit&category_id&published` |
| `GET` | `/videos/:id` | Get video with embed URL |
| `PATCH` | `/videos/:id` | Update video metadata |
| `DELETE` | `/videos/:id` | Delete video record |
| `POST` | `/videos/:id/publish` | Publish video |
| `POST` | `/videos/:id/unpublish` | Unpublish video |
| `PUT` | `/videos/:id/upload` | Upload file directly to Bunny CDN (multipart) |
| `POST` | `/videos/:id/reencode` | Re-encode video on Bunny |
| `POST` | `/videos/:id/thumbnail` | Set thumbnail (file upload or URL) |
| `POST` | `/videos/fetch` | Fetch video by URL into Bunny |
| `POST` | `/videos/sync` | Sync all videos from Bunny CDN to DB |
| `POST` | `/videos/:id/captions/:srclang` | Add caption/subtitle track |
| `DELETE` | `/videos/:id/captions/:srclang` | Remove caption track |

### 📝 Posts — `/posts`

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/posts` | Create a blog post |
| `GET` | `/posts` | List all posts (instructors see only their own). Query: `?page&limit&published` |
| `GET` | `/posts/:id` | Get a post |
| `PATCH` | `/posts/:id` | Update post content |
| `DELETE` | `/posts/:id` | Delete post |
| `POST` | `/posts/:id/publish` | Publish post |
| `POST` | `/posts/:id/unpublish` | Unpublish post |

### 👥 Customer Management — `/customers` *(Admin role only)*

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/customers` | Search customers. Query: `?q&page&limit` |
| `GET` | `/customers/:id` | Get full customer details |
| `PATCH` | `/customers/:id/email` | Update customer email |
| `POST` | `/customers/:id/reset-password` | Admin-force password reset |
| `GET` | `/customers/:id/subscriptions` | Get all subscriptions for customer |
| `GET` | `/customers/:id/orders` | Get order history (paginated) |
| `GET` | `/customers/:id/purchases` | Get all purchases by customer |
| `POST` | `/customers/:id/orders/:orderId/refund` | Issue full/partial refund |
| `POST` | `/customers/:id/subscriptions/:subscriptionId/cancel` | Cancel subscription |

### 💰 Subscription Plans — `/subscription-plans`

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/subscription-plans` | List plans. Query: `?include_archived` |
| `GET` | `/subscription-plans/:id` | Get a plan |
| `POST` | `/subscription-plans` | Create a plan |
| `PATCH` | `/subscription-plans/:id` | Update a plan |
| `POST` | `/subscription-plans/:id/archive` | Archive plan |
| `POST` | `/subscription-plans/:id/unarchive` | Restore plan |
| `POST` | `/subscription-plans/:id/sync-stripe` | Sync plan to Stripe |

### � Products — `/products`

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/products` | List all products. Query: `?content_type` |

### 🏷 Categories & Tags

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/categories` | List all categories |
| `GET` | `/tags` | List all tags |

---

## 🚧 GAP ANALYSIS — Mobile App vs. What Exists

These backend routes **exist and work** but the mobile app (`Arise`) doesn't use them yet:

| Feature | Backend Endpoint | Status |
| :--- | :--- | :--- |
| Google OAuth login for mobile | `/auth/google` + `/auth/google/callback` | ❌ Not wired in app |
| Password reset | `/auth/forgot-password` | ❌ Not in app |
| Quizzes in course | `GET /courses/:slug/quizzes` & `/quizzes/:quizId` | ❌ Broken — app calls wrong BFF path |
| Topics (sub-lessons) | `GET /courses/:slug/topics/:topicId` | ❌ Not in app |
| Stripe billing portal | `POST /checkout/portal` | ❌ Not in BFF or app |
| Course purchase (one-time) | `POST /billing/checkout/course-session` | ⚠️ BFF has it, app doesn't call it |
| Video listing | `GET /videos` | ❌ Not in BFF or app |

---

## 🗄 Database & Seeding

```bash
node scripts/seed-mock-data.js   # Seeds VidyaSetu mock courses, plans, quizzes
npm run migrate                  # Run pending SQL migrations
npm run seed:admin               # Create initial admin user
npm run seed:plans               # Seed subscription plans
```

## 🚀 Running Locally

```bash
npm run dev          # Main panel (port 5000)
npm run dev:mobile   # Mobile API (port 5002)
npm run dev:admin    # Admin panel (port 5001)
npm run dev:all      # All three concurrently
```
